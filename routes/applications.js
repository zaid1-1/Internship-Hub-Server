import express from "express";
import db from "../db.js";
import roleAuth from "../middleware/roleAuth.js";
import requireAuth from "../middleware/requireAuth.js";
import calculateMatch from "../utils/matching.js";

const router = express.Router();

// POST /api/applications -> student clicks "Apply" on an internship,
// creating the tracking record. body: { internship_id }
// Same duplicate-check style as auth.js's signup (check first, friendly
// 400 if it already exists, instead of letting the UNIQUE constraint
// throw a raw 500).
router.post("/", roleAuth("student"), async (req, res) => {
  const { internship_id } = req.body;
  try {
    const exists = await db.query(
      "SELECT * FROM applications WHERE student_id = $1 AND internship_id = $2",
      [req.userId, internship_id]
    );
    if (exists.rows.length > 0) {
      return res.status(400).json({ message: "Already applied to this internship" });
    }

    const result = await db.query(
      "INSERT INTO applications (student_id, internship_id) VALUES ($1, $2) RETURNING *",
      [req.userId, internship_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/applications/mine -> the logged-in student's own tracked
// applications, joined with the internship title + owning company name
// (same join style as saved.js).
router.get("/mine", roleAuth("student"), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.*, i.title, i.external_application_url, c.company_name
       FROM applications a
       JOIN internships i ON i.id = a.internship_id
       JOIN company_profiles c ON c.user_id = i.company_id
       WHERE a.student_id = $1
       ORDER BY a.clicked_date DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/applications/candidates -> every application to any
// internship owned by the logged-in company. This is the "Candidates"
// list - not a separate table, just a filtered join of applications
// scoped to this company's own internships (per the ERD notes).
// GET /api/applications/candidates -> every application to any
// internship owned by the logged-in company. This is the "Candidates"
// list - not a separate table, just a filtered join of applications
// scoped to this company's own internships (per the ERD notes). Also
// attaches match_score/match_breakdown/matchingSkills/missingSkills per
// candidate - same calculateMatch helper as internships.js's
// GET /:id/match and students.js's GET /me/recommendations, same
// "fetch everything once, group in plain JS" technique as
// /me/recommendations instead of a query per candidate.
router.get("/candidates", roleAuth("company"), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.*, s.first_name, s.last_name, s.headline, s.university,
              s.preferred_location_id, s.preferred_internship_type_id,
              s.study_field_id,
              i.title AS internship_title, i.field_id, i.location_id,
              i.internship_type_id, i.required_study_field_id
       FROM applications a
       JOIN internships i ON i.id = a.internship_id
       JOIN student_profiles s ON s.user_id = a.student_id
       WHERE i.company_id = $1
       ORDER BY a.clicked_date DESC`,
      [req.userId]
    );

    const allRequiredSkills = await db.query(
      `SELECT isk.internship_id, s.id, s.name
       FROM internship_skills isk
       JOIN skills s ON s.id = isk.skill_id`
    );
    const skillsByInternship = {};
    for (let i = 0; i < allRequiredSkills.rows.length; i++) {
      const row = allRequiredSkills.rows[i];
      if (!skillsByInternship[row.internship_id]) {
        skillsByInternship[row.internship_id] = [];
      }
      skillsByInternship[row.internship_id].push({ id: row.id, name: row.name });
    }

    const allStudentSkills = await db.query(
      `SELECT ss.student_id, s.id, s.name
       FROM student_skills ss
       JOIN skills s ON s.id = ss.skill_id`
    );
    const skillsByStudent = {};
    for (let i = 0; i < allStudentSkills.rows.length; i++) {
      const row = allStudentSkills.rows[i];
      if (!skillsByStudent[row.student_id]) {
        skillsByStudent[row.student_id] = [];
      }
      skillsByStudent[row.student_id].push({ id: row.id, name: row.name });
    }

    const allInterests = await db.query(
      "SELECT student_id, field_id FROM student_interests"
    );
    const interestsByStudent = {};
    for (let i = 0; i < allInterests.rows.length; i++) {
      const row = allInterests.rows[i];
      if (!interestsByStudent[row.student_id]) {
        interestsByStudent[row.student_id] = [];
      }
      interestsByStudent[row.student_id].push(row.field_id);
    }

    const candidates = result.rows;
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];

      const match = calculateMatch(
        {
          skillIds: skillsByStudent[candidate.student_id] || [],
          interestFieldIds: interestsByStudent[candidate.student_id] || [],
          preferred_location_id: candidate.preferred_location_id,
          preferred_internship_type_id: candidate.preferred_internship_type_id,
          study_field_id: candidate.study_field_id,
        },
        {
          requiredSkills: skillsByInternship[candidate.internship_id] || [],
          field_id: candidate.field_id,
          location_id: candidate.location_id,
          internship_type_id: candidate.internship_type_id,
          required_study_field_id: candidate.required_study_field_id,
        }
      );

      candidate.match_score = match.score;
      candidate.match_breakdown = match.breakdown;
      candidate.matchingSkills = match.matchingSkills;
      candidate.missingSkills = match.missingSkills;
    }

    res.json(candidates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/applications/candidates/:id -> the FULL profile for ONE
// candidate (one applications row), scoped to internships owned by the
// logged-in company - same ownership check as GET /candidates above
// (WHERE i.company_id = req.userId), just for a single row. This exists
// because GET /candidates only returns the fields the Candidates LIST
// view needs (spec section 22); the Candidate Profile screen (spec
// section 24) needs the student's full profile - About, Education,
// links, CV - plus their complete skill list and Projects/Experience/
// Certifications, none of which the list route sends.
// Columns are listed explicitly rather than "a.*, s.*" because
// applications and student_profiles both have created_at/updated_at
// columns, and s.location_id (the student's own location) would
// otherwise collide with i.location_id (the internship's location) -
// same explicit-column style GET /candidates above already uses.
// Sub-resources (skills/projects/experience/certifications) are read
// with the exact same queries subResourceRouter.js's own GET / route
// uses, just scoped to the candidate's student_id instead of req.userId
// - a company only ever VIEWS these, never writes them (spec section 23
// - "Cannot edit a student's tracking status" extends to not touching
// their profile data at all).
router.get("/candidates/:id", roleAuth("company"), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.id, a.student_id, a.internship_id, a.status, a.clicked_date,
              a.follow_up_date, a.notes,
              s.first_name, s.last_name, s.phone, s.photo_url,
              s.location_id, s.headline, s.about, s.university,
              s.degree_level_id, s.study_field_id, s.academic_year,
              s.expected_graduation_year, s.gpa, s.cv_url, s.github_url,
              s.linkedin_url, s.portfolio_url, s.personal_website_url,
              s.preferred_location_id, s.preferred_internship_type_id,
              i.title AS internship_title, i.field_id,
              i.location_id AS internship_location_id,
              i.internship_type_id, i.required_study_field_id, i.company_id
       FROM applications a
       JOIN internships i ON i.id = a.internship_id
       JOIN student_profiles s ON s.user_id = a.student_id
       WHERE a.id = $1 AND i.company_id = $2`,
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Not found" });
    }
    const candidate = result.rows[0];

    const skills = await db.query(
      `SELECT s.id, s.name
       FROM student_skills ss
       JOIN skills s ON s.id = ss.skill_id
       WHERE ss.student_id = $1`,
      [candidate.student_id]
    );

    const requiredSkills = await db.query(
      `SELECT s.id, s.name
       FROM internship_skills isk
       JOIN skills s ON s.id = isk.skill_id
       WHERE isk.internship_id = $1`,
      [candidate.internship_id]
    );

    const interestRows = await db.query(
      "SELECT field_id FROM student_interests WHERE student_id = $1",
      [candidate.student_id]
    );
    const interestFieldIds = [];
    for (let i = 0; i < interestRows.rows.length; i++) {
      interestFieldIds.push(interestRows.rows[i].field_id);
    }

    const match = calculateMatch(
      {
        skillIds: skills.rows,
        interestFieldIds,
        preferred_location_id: candidate.preferred_location_id,
        preferred_internship_type_id: candidate.preferred_internship_type_id,
        study_field_id: candidate.study_field_id,
      },
      {
        requiredSkills: requiredSkills.rows,
        field_id: candidate.field_id,
        location_id: candidate.internship_location_id,
        internship_type_id: candidate.internship_type_id,
        required_study_field_id: candidate.required_study_field_id,
      }
    );

    const projects = await db.query(
      "SELECT * FROM projects WHERE student_id = $1 ORDER BY id",
      [candidate.student_id]
    );
    const experience = await db.query(
      "SELECT * FROM experience WHERE student_id = $1 ORDER BY id",
      [candidate.student_id]
    );
    const certifications = await db.query(
      "SELECT * FROM certifications WHERE student_id = $1 ORDER BY id",
      [candidate.student_id]
    );

    res.json({
      ...candidate,
      skills: skills.rows,
      match_score: match.score,
      match_breakdown: match.breakdown,
      matchingSkills: match.matchingSkills,
      missingSkills: match.missingSkills,
      projects: projects.rows,
      experience: experience.rows,
      certifications: certifications.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/applications/:id -> a student can update their own
// status/follow_up_date/notes; a company can update the status of an
// application to one of ITS OWN internships. Since two different roles
// can hit this same route, it uses requireAuth (any logged-in user)
// instead of roleAuth(one role), then branches on req.role in plain JS.
// Ownership is checked the same two-step way as the internship_skills
// junction routes: look the row up (with a join to find which company
// owns the underlying internship), then mutate.
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const lookup = await db.query(
      `SELECT a.*, i.company_id
       FROM applications a
       JOIN internships i ON i.id = a.internship_id
       WHERE a.id = $1`,
      [req.params.id]
    );

    if (lookup.rows.length === 0) {
      return res.status(404).json({ message: "Not found" });
    }
    const application = lookup.rows[0];

    if (req.role === "student" && String(application.student_id) === req.userId) {
      const { status, follow_up_date, notes } = req.body;
      const result = await db.query(
        `UPDATE applications SET
          status = $1, follow_up_date = $2, notes = $3, updated_at = now()
         WHERE id = $4 AND student_id = $5
         RETURNING *`,
        [status, follow_up_date, notes, req.params.id, req.userId]
      );
      return res.json(result.rows[0]);
    }

    if (req.role === "company" && String(application.company_id) === req.userId) {
      const { status } = req.body;
      const result = await db.query(
        "UPDATE applications SET status = $1, updated_at = now() WHERE id = $2 RETURNING *",
        [status, req.params.id]
      );
      return res.json(result.rows[0]);
    }

    return res.status(403).json({ message: "Not allowed to update this application" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/applications/:id -> student withdraws/removes their own
// tracked application
router.delete("/:id", roleAuth("student"), async (req, res) => {
  try {
    const result = await db.query(
      "DELETE FROM applications WHERE id = $1 AND student_id = $2 RETURNING *",
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Not found" });
    }
    res.json({ deleted: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
