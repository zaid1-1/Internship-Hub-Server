import express from "express";
import db from "../db.js";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();

// POST /api/reports -> spec section 52: any logged-in user (student or
// company) can report an internship opportunity, a company profile, or
// a user. Uses requireAuth (any logged-in role), same as
// applications.js's shared PUT /:id, since both students and companies
// can file a report. Exactly one of reported_internship_id/
// reported_company_id/reported_user_id must end up set - that's
// enforced by the DB's own CHECK constraint (one_target_only, in
// schema.sql), not re-checked here in JS, same "trust the DB constraint"
// approach already used for applications' UNIQUE(student_id,
// internship_id) 500 path and the lookup tables' enum columns.
router.post("/", requireAuth, async (req, res) => {
  const {
    reported_type,
    reported_internship_id,
    reported_company_id,
    reported_user_id,
    reason,
  } = req.body;

  try {
    const result = await db.query(
      `INSERT INTO reports
        (reporter_user_id, reported_type, reported_internship_id, reported_company_id, reported_user_id, reason)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        req.userId,
        reported_type,
        reported_internship_id || null,
        reported_company_id || null,
        reported_user_id || null,
        reason,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;