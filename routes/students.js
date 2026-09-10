import express from "express";
import db from "../db.js";
import roleAuth from "../middleware/roleAuth.js";
import calculateMatch from "../utils/matching.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// GET /api/students/me
// Returns the logged-in student's profile row, plus their selected
// skills and career interests joined with the lookup tables so the
// frontend gets readable names, not just ids.
router.get("/me", roleAuth("student"), async (req, res) => {
  try {
    const profile = await db.query(
      "SELECT * FROM student_profiles WHERE user_id = $1",
      [req.userId]
    );

    if (profile.rows.length === 0) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const skills = await db.query(
      `SELECT s.id, s.name
       FROM student_skills ss
       JOIN skills s ON s.id = ss.skill_id
       WHERE ss.student_id = $1`,
      [req.userId]
    );

    const interests = await db.query(
      `SELECT f.id, f.name
       FROM student_interests si
       JOIN fields f ON f.id = si.field_id
       WHERE si.student_id = $1`,
      [req.userId]
    );

    res.json({
      profile: profile.rows[0],
      skills: skills.rows,
      interests: interests.rows,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/students/me
// Full profile update - the frontend sends every editable field every
// time (same pattern as the course's UpdateForm / EditProductForm
// demos), not a partial patch.
router.put("/me", roleAuth("student"), async (req, res) => {
  const {
    first_name,
    last_name,
    phone,
    photo_url,
    location_id,
    headline,
    about,
    university,
    degree_level_id,
    study_field_id,
    academic_year,
    expected_graduation_year,
    gpa,
    cv_url,
    github_url,
    linkedin_url,
    portfolio_url,
    personal_website_url,
    preferred_location_id,
    preferred_work_arrangement_id,
    preferred_internship_type_id,
    preferred_duration,
  } = req.body;

  try {
    const result = await db.query(
      `UPDATE student_profiles SET
        first_name = $1,
        last_name = $2,
        phone = $3,
        photo_url = $4,
        location_id = $5,
        headline = $6,
        about = $7,
        university = $8,
        degree_level_id = $9,
        study_field_id = $10,
        academic_year = $11,
        expected_graduation_year = $12,
        gpa = $13,
        cv_url = $14,
        github_url = $15,
        linkedin_url = $16,
        portfolio_url = $17,
        personal_website_url = $18,
        preferred_location_id = $19,
        preferred_work_arrangement_id = $20,
        preferred_internship_type_id = $21,
        preferred_duration = $22,
        updated_at = now()
       WHERE user_id = $23
       RETURNING *`,
      [
        first_name,
        last_name,
        phone,
        photo_url,
        location_id,
        headline,
        about,
        university,
        degree_level_id,
        study_field_id,
        academic_year,
        expected_graduation_year,
        gpa,
        cv_url,
        github_url,
        linkedin_url,
        portfolio_url,
        personal_website_url,
        preferred_location_id,
        preferred_work_arrangement_id,
        preferred_internship_type_id,
        preferred_duration,
        req.userId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/students/me/skills
// body: { skill_id }
router.post("/me/skills", roleAuth("student"), async (req, res) => {
  const { skill_id } = req.body;
  try {
    await db.query(
      "INSERT INTO student_skills (student_id, skill_id) VALUES ($1, $2)",
      [req.userId, skill_id]
    );
    res.status(201).json({ student_id: req.userId, skill_id });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/students/me/skills/:skillId
router.delete("/me/skills/:skillId", roleAuth("student"), async (req, res) => {
  try {
    await db.query(
      "DELETE FROM student_skills WHERE student_id = $1 AND skill_id = $2",
      [req.userId, req.params.skillId]
    );
    res.json({ message: "Removed" });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/students/me/interests
// body: { field_id }
router.post("/me/interests", roleAuth("student"), async (req, res) => {
  const { field_id } = req.body;
  try {
    await db.query(
      "INSERT INTO student_interests (student_id, field_id) VALUES ($1, $2)",
      [req.userId, field_id]
    );
    res.status(201).json({ student_id: req.userId, field_id });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/students/me/interests/:fieldId
router.delete("/me/interests/:fieldId", roleAuth("student"), async (req, res) => {
  try {
    await db.query(
      "DELETE FROM student_interests WHERE student_id = $1 AND field_id = $2",
      [req.userId, req.params.fieldId]
    );
    res.json({ message: "Removed" });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/students/me/recommendations -> every Active internship, each
// with a computed match score, best matches first (for the Recommended
// Internships page). Same calculateMatch helper as
// internships.js's GET /:id/match - the student's own data is fetched
// once, then looped over the internships in plain JS instead of running
// calculateMatch's queries once per internship.
router.get("/me/recommendations", roleAuth("student"), async (req, res) => {
  try {
    const profileResult = await db.query(
      "SELECT * FROM student_profiles WHERE user_id = $1",
      [req.userId]
    );
    if (profileResult.rows.length === 0) {
      return res.status(404).json({ message: "Profile not found" });
    }
    const profile = profileResult.rows[0];

    const studentSkills = await db.query(
      `SELECT s.id, s.name
       FROM student_skills ss
       JOIN skills s ON s.id = ss.skill_id
       WHERE ss.student_id = $1`,
      [req.userId]
    );

    const interestRows = await db.query(
      "SELECT field_id FROM student_interests WHERE student_id = $1",
      [req.userId]
    );
    const interestFieldIds = [];
    for (let i = 0; i < interestRows.rows.length; i++) {
      interestFieldIds.push(interestRows.rows[i].field_id);
    }

    const internships = await db.query(
      `SELECT i.*, c.company_name
       FROM internships i
       JOIN company_profiles c ON c.user_id = i.company_id
       WHERE i.status = 'Active'`
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

    const studentInfo = {
      skillIds: studentSkills.rows,
      interestFieldIds,
      preferred_location_id: profile.preferred_location_id,
      preferred_internship_type_id: profile.preferred_internship_type_id,
      study_field_id: profile.study_field_id,
    };

    const recommendations = [];
    for (let i = 0; i < internships.rows.length; i++) {
      const internship = internships.rows[i];
      const requiredSkills = skillsByInternship[internship.id] || [];

      const match = calculateMatch(studentInfo, {
        requiredSkills,
        field_id: internship.field_id,
        location_id: internship.location_id,
        internship_type_id: internship.internship_type_id,
        required_study_field_id: internship.required_study_field_id,
      });

      internship.match_score = match.score;
      internship.match_breakdown = match.breakdown;
      internship.matchingSkills = match.matchingSkills;
      internship.missingSkills = match.missingSkills;
      recommendations.push(internship);
    }

    recommendations.sort((a, b) => b.match_score - a.match_score);

    res.json(recommendations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});


// POST /api/students/me/cv -> multipart file upload, form field name
// "cv". multer's upload.single("cv") writes the file to /uploads and
// hands req.file to the handler, which just stores the path - same
// UPDATE-one-column style as everything else in this project.
router.post("/me/cv", roleAuth("student"), upload.single("cv"), async (req, res) => {
  try {
    const cv_url = `/uploads/${req.file.filename}`;
    const result = await db.query(
      "UPDATE student_profiles SET cv_url = $1, updated_at = now() WHERE user_id = $2 RETURNING *",
      [cv_url, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Profile not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/students/me/photo -> same idea, field name "photo".
router.post("/me/photo", roleAuth("student"), upload.single("photo"), async (req, res) => {
  try {
    const photo_url = `/uploads/${req.file.filename}`;
    const result = await db.query(
      "UPDATE student_profiles SET photo_url = $1, updated_at = now() WHERE user_id = $2 RETURNING *",
      [photo_url, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Profile not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
