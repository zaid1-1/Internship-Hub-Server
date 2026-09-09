import express from "express";
import db from "../db.js";
import roleAuth from "../middleware/roleAuth.js";

const router = express.Router();

// GET /api/saved -> the logged-in student's saved internships, joined
// with the internship's own row plus the owning company's name (same
// join style already used for skills/interests in students.js).
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
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/saved -> save an internship
// body: { internship_id }
router.post("/", roleAuth("student"), async (req, res) => {
  const { internship_id } = req.body;
  try {
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

// DELETE /api/saved/:internshipId -> unsave
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
