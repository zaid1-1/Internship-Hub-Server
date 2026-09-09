import express from "express";
import db from "../db.js";
import roleAuth from "../middleware/roleAuth.js";
import requireAuth from "../middleware/requireAuth.js";

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
router.get("/candidates", roleAuth("company"), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.*, s.first_name, s.last_name, s.headline, s.university,
              i.title AS internship_title
       FROM applications a
       JOIN internships i ON i.id = a.internship_id
       JOIN student_profiles s ON s.user_id = a.student_id
       WHERE i.company_id = $1
       ORDER BY a.clicked_date DESC`,
      [req.userId]
    );
    res.json(result.rows);
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
