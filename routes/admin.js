import express from "express";
import db from "../db.js";
import roleAuth from "../middleware/roleAuth.js";

const router = express.Router();

// GET /api/admin/stats -> the 5 counters on the Admin Dashboard (spec
// section 47). Five separate plain COUNT(*) queries - no subqueries, no
// joins needed for a straight count. COUNT(*) itself isn't shown
// anywhere in the uploaded material, but it's a database-only technique
// (not a JS pattern), which is the one place that's fine to go beyond
// the material - see scope-and-decisions.md.
router.get("/stats", roleAuth("admin"), async (req, res) => {
  try {
    const totalStudents = await db.query("SELECT COUNT(*) FROM student_profiles");
    const totalCompanies = await db.query("SELECT COUNT(*) FROM company_profiles");
    const totalOpportunities = await db.query("SELECT COUNT(*) FROM internships");
    const activeOpportunities = await db.query(
      "SELECT COUNT(*) FROM internships WHERE status = 'Active'"
    );
    const pendingReports = await db.query(
      "SELECT COUNT(*) FROM reports WHERE status = 'Pending'"
    );

    res.json({
      totalStudents: Number(totalStudents.rows[0].count),
      totalCompanies: Number(totalCompanies.rows[0].count),
      totalOpportunities: Number(totalOpportunities.rows[0].count),
      activeOpportunities: Number(activeOpportunities.rows[0].count),
      pendingReports: Number(pendingReports.rows[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/students -> the Students tab of Admin User Management
// (spec section 48). Raw study_field_id column, same as every other
// lookup-id column returned elsewhere in this API (internships.js's
// field_id/location_id, etc.) - the frontend resolves the name with the
// already-built GET /api/study-fields, same as it does everywhere else.
router.get("/students", roleAuth("admin"), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.email, u.status, u.created_at,
              s.first_name, s.last_name, s.university, s.study_field_id
       FROM users u
       JOIN student_profiles s ON s.user_id = u.id
       WHERE u.role = 'student'
       ORDER BY u.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/companies -> the Companies tab of Admin User Management
// (spec section 48).
router.get("/companies", roleAuth("admin"), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.email, u.status, u.created_at,
              c.company_name, c.industry
       FROM users u
       JOIN company_profiles c ON c.user_id = u.id
       WHERE u.role = 'company'
       ORDER BY u.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/users/:id -> Admin User Details (spec section 49).
// Looks the user up first, then branches on role in plain JS to fetch
// the matching profile - same branching style as applications.js's
// PUT /:id (checks req.role, not a switch/class).
router.get("/users/:id", roleAuth("admin"), async (req, res) => {
  try {
    const userResult = await db.query("SELECT * FROM users WHERE id = $1", [
      req.params.id,
    ]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const user = userResult.rows[0];

    if (user.role === "student") {
      const profile = await db.query(
        "SELECT * FROM student_profiles WHERE user_id = $1",
        [req.params.id]
      );
      return res.json({ user, profile: profile.rows[0] || null });
    }

    if (user.role === "company") {
      const profile = await db.query(
        "SELECT * FROM company_profiles WHERE user_id = $1",
        [req.params.id]
      );
      return res.json({ user, profile: profile.rows[0] || null });
    }

    res.json({ user, profile: null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/admin/users/:id/status -> Enable/Disable a student or company
// account (spec sections 48-50's Enable/Disable actions). body:
// { "status": "Active" | "Disabled" }. PUT rather than PATCH on
// purpose - see the "no new PATCH routes" rule in scope-and-decisions.md.
// status is the only field this action ever changes, so PUT with just
// that field is the full-body update for this action (there's no email/
// password/role editing here per spec).
router.put("/users/:id/status", roleAuth("admin"), async (req, res) => {
  const { status } = req.body;
  try {
    const result = await db.query(
      "UPDATE users SET status = $1 WHERE id = $2 RETURNING id, email, role, status, created_at",
      [status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/admin/users/:id -> the Delete action (spec sections 48-50).
// The users row cascades to student_profiles/company_profiles and
// everything owned by them (ON DELETE CASCADE in schema.sql), same as
// the DB already does for every other owned table in this project.
router.delete("/users/:id", roleAuth("admin"), async (req, res) => {
  try {
    const result = await db.query(
      "DELETE FROM users WHERE id = $1 RETURNING id, email, role",
      [req.params.id]
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

// ============================================================
// Opportunity Management (spec section 51) - admin acting on ANY
// company's internships, not just its own. No applicant management
// here (that stays on the company's own Candidates view).
// ============================================================

// GET /api/admin/internships -> the Admin Opportunities table. Optional
// ?status= filter using the exact same "array of condition strings +
// parameterized values" technique as internships.js's public browse
// route - nothing new there. ?status=Reported is a special case (not a
// real internship_status enum value) - see the reasoning above on why
// it uses DISTINCT + a plain JOIN against reports instead of a subquery.
router.get("/internships", roleAuth("admin"), async (req, res) => {
  const { status } = req.query;
  try {
    if (status === "Reported") {
      const result = await db.query(
        `SELECT DISTINCT i.*, c.company_name
         FROM internships i
         JOIN company_profiles c ON c.user_id = i.company_id
         JOIN reports r ON r.reported_internship_id = i.id
         WHERE r.reported_type = 'Internship Opportunity'
         ORDER BY i.created_at DESC`
      );
      return res.json(result.rows);
    }

    const conditions = [];
    const values = [];
    if (status) {
      values.push(status);
      conditions.push(`i.status = $${values.length}`);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await db.query(
      `SELECT i.*, c.company_name
       FROM internships i
       JOIN company_profiles c ON c.user_id = i.company_id
       ${whereClause}
       ORDER BY i.created_at DESC`,
      values
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/internships/:id -> the "View" action, any internship
// regardless of owner or status. Deliberately a plain SELECT, not the
// views-incrementing UPDATE that the public GET /api/internships/:id
// uses - an admin looking at a listing shouldn't inflate its view count.
router.get("/internships/:id", roleAuth("admin"), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT i.*, c.company_name
       FROM internships i
       JOIN company_profiles c ON c.user_id = i.company_id
       WHERE i.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Internship not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/admin/internships/:id/status -> Deactivate/Reactivate, on ANY
// company's internship (no company_id check, unlike the company's own
// PATCH /api/internships/:id/status). body: { "status": "Draft" |
// "Active" | "Expired" | "Inactive" }. PUT, not PATCH, same reasoning as
// the users' status route above. "Approve" isn't a separate action here
// since there's no separate approval workflow built (the spec itself
// says "if approval workflow is implemented" - it isn't, so this is
// skipped on purpose, not a gap).
router.put("/internships/:id/status", roleAuth("admin"), async (req, res) => {
  const { status } = req.body;
  try {
    const result = await db.query(
      "UPDATE internships SET status = $1, updated_at = now() WHERE id = $2 RETURNING *",
      [status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/admin/internships/:id -> the "Remove" action, any company's
// internship. Cascades to internship_skills/saved_internships/
// applications (ON DELETE CASCADE in schema.sql), same as the company's
// own DELETE /api/internships/:id already relies on.
router.delete("/internships/:id", roleAuth("admin"), async (req, res) => {
  try {
    const result = await db.query(
      "DELETE FROM internships WHERE id = $1 RETURNING *",
      [req.params.id]
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

// ============================================================
// Reports (spec section 52) - admin side. Filing a report is a separate,
// non-admin route (POST /api/reports, any logged-in user) - see
// routes/reports.js.
// ============================================================

// GET /api/admin/reports -> the Admin Reports list. Optional ?status=
// filter (Pending/Reviewed/Dismissed/Action Taken), same dynamic-filter
// technique as the internships list above. Deliberately does NOT join
// to internships/company_profiles/users to resolve "what was reported"
// - only one of reported_internship_id/reported_company_id/
// reported_user_id is ever set (enforced by the DB's own CHECK
// constraint), and joining all three would need LEFT JOINs, which have
// zero precedent - same call already made for the students list's
// nullable study_field_id. The raw ids + reported_type are returned
// instead; the frontend resolves the actual item via the endpoints that
// already exist (GET /api/internships/:id, GET /api/companies/:id,
// GET /api/admin/users/:id) based on reported_type.
router.get("/reports", roleAuth("admin"), async (req, res) => {
  const { status } = req.query;
  try {
    const conditions = [];
    const values = [];
    if (status) {
      values.push(status);
      conditions.push(`r.status = $${values.length}`);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await db.query(
      `SELECT r.*, u.email AS reporter_email
       FROM reports r
       JOIN users u ON u.id = r.reporter_user_id
       ${whereClause}
       ORDER BY r.created_at DESC`,
      values
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/admin/reports/:id/status -> the "Dismiss" action (and the
// Reviewed/Action Taken transitions). body: { "status": "Pending" |
// "Reviewed" | "Dismissed" | "Action Taken" }. "Remove content" and
// "Disable account" (the other two admin actions on a report) aren't
// separate routes - they're just calling the DELETE/PUT status routes
// that already exist above for internships/users on whatever the report
// points at.
router.put("/reports/:id/status", roleAuth("admin"), async (req, res) => {
  const { status } = req.body;
  try {
    const result = await db.query(
      "UPDATE reports SET status = $1 WHERE id = $2 RETURNING *",
      [status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;