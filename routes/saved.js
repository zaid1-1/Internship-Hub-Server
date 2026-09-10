import express from "express";
import db from "../db.js";
import roleAuth from "../middleware/roleAuth.js";
import calculateMatch from "../utils/matching.js";

const router = express.Router();

router.get("/", roleAuth("student"), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT i.*, c.company_name, si.saved_at
       FROM saved_internships si
       JOIN internships i ON i.id = si.internship_id
       JOIN company_profiles c ON c.user_id = i.company_id
       WHERE si.student_id = $1
       ORDER BY si.saved_at DESC`,
      [req.userId]
    );

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

    const saved = result.rows;
    for (let i = 0; i < saved.length; i++) {
      const internship = saved[i];
      const match = calculateMatch(studentInfo, {
        requiredSkills: skillsByInternship[internship.id] || [],
        field_id: internship.field_id,
        location_id: internship.location_id,
        internship_type_id: internship.internship_type_id,
        required_study_field_id: internship.required_study_field_id,
      });
      internship.match_score = match.score;
      internship.match_breakdown = match.breakdown;
    }

    res.json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Same duplicate-check style as applications.js's POST / - check first,
// friendly response if it's already saved, instead of letting a second
// insert throw a raw 500 (the frontend can end up calling this twice for
// the same internship if its local "saved" state hasn't loaded yet).
router.post("/", roleAuth("student"), async (req, res) => {
  const { internship_id } = req.body;
  try {
    const exists = await db.query(
      "SELECT * FROM saved_internships WHERE student_id = $1 AND internship_id = $2",
      [req.userId, internship_id]
    );
    if (exists.rows.length > 0) {
      return res.status(200).json({ student_id: req.userId, internship_id, message: "Already saved" });
    }

    await db.query(
      "INSERT INTO saved_internships (student_id, internship_id) VALUES ($1, $2)",
      [req.userId, internship_id]
    );
    res.status(201).json({ student_id: req.userId, internship_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:internshipId", roleAuth("student"), async (req, res) => {
  try {
    await db.query(
      "DELETE FROM saved_internships WHERE student_id = $1 AND internship_id = $2",
      [req.userId, req.params.internshipId]
    );
    res.json({ message: "Removed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;