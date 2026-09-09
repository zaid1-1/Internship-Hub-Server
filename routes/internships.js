import express from "express";
import db from "../db.js";
import roleAuth from "../middleware/roleAuth.js";

const router = express.Router();

// ============================================================
// COMPANY-OWNED CRUD (roleAuth("company"), scoped to req.userId)
// ============================================================

// GET /api/internships/mine -> the logged-in company's own internships,
// every status included (Draft/Active/Expired/Inactive)
router.get("/mine", roleAuth("company"), async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM internships WHERE company_id = $1 ORDER BY created_at DESC",
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/internships -> create a new internship owned by the logged-in
// company. status defaults to "Draft" if not sent (matches the Create
// Internship screen's Save as Draft / Publish actions).
router.post("/", roleAuth("company"), async (req, res) => {
  const {
    title,
    description,
    field_id,
    location_id,
    work_arrangement_id,
    internship_type_id,
    duration,
    experience_level,
    required_degree_level_id,
    required_study_field_id,
    application_deadline,
    responsibilities,
    requirements,
    benefits,
    additional_info,
    external_application_url,
    status,
  } = req.body;

  const finalStatus = status || "Draft";

  try {
    const result = await db.query(
      `INSERT INTO internships (
        company_id, title, description, field_id, location_id,
        work_arrangement_id, internship_type_id, duration, experience_level,
        required_degree_level_id, required_study_field_id,
        application_deadline, responsibilities, requirements, benefits,
        additional_info, external_application_url, status, posted_date
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, CASE WHEN $18 = 'Active' THEN now() ELSE NULL END
      ) RETURNING *`,
      [
        req.userId,
        title,
        description,
        field_id,
        location_id,
        work_arrangement_id,
        internship_type_id,
        duration,
        experience_level,
        required_degree_level_id,
        required_study_field_id,
        application_deadline,
        responsibilities,
        requirements,
        benefits,
        additional_info,
        external_application_url,
        finalStatus,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/internships/:id -> edit the content fields (only if owned by
// the logged-in company). Status is changed separately via
// PATCH /:id/status, same convention as lookupRouter.js.
router.put("/:id", roleAuth("company"), async (req, res) => {
  const {
    title,
    description,
    field_id,
    location_id,
    work_arrangement_id,
    internship_type_id,
    duration,
    experience_level,
    required_degree_level_id,
    required_study_field_id,
    application_deadline,
    responsibilities,
    requirements,
    benefits,
    additional_info,
    external_application_url,
  } = req.body;

  try {
    const result = await db.query(
      `UPDATE internships SET
        title = $1,
        description = $2,
        field_id = $3,
        location_id = $4,
        work_arrangement_id = $5,
        internship_type_id = $6,
        duration = $7,
        experience_level = $8,
        required_degree_level_id = $9,
        required_study_field_id = $10,
        application_deadline = $11,
        responsibilities = $12,
        requirements = $13,
        benefits = $14,
        additional_info = $15,
        external_application_url = $16,
        updated_at = now()
       WHERE id = $17 AND company_id = $18
       RETURNING *`,
      [
        title,
        description,
        field_id,
        location_id,
        work_arrangement_id,
        internship_type_id,
        duration,
        experience_level,
        required_degree_level_id,
        required_study_field_id,
        application_deadline,
        responsibilities,
        requirements,
        benefits,
        additional_info,
        external_application_url,
        req.params.id,
        req.userId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/internships/:id/status -> Draft/Active/Expired/Inactive
// toggle (only if owned by the logged-in company). First time it's set
// to "Active", posted_date gets stamped.
router.patch("/:id/status", roleAuth("company"), async (req, res) => {
  const { status } = req.body;
  try {
    const result = await db.query(
      `UPDATE internships SET
        status = $1,
        posted_date = CASE
          WHEN $1 = 'Active' AND posted_date IS NULL THEN now()
          ELSE posted_date
        END,
        updated_at = now()
       WHERE id = $2 AND company_id = $3
       RETURNING *`,
      [status, req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/internships/:id -> remove (only if owned by the logged-in company)
router.delete("/:id", roleAuth("company"), async (req, res) => {
  try {
    const result = await db.query(
      "DELETE FROM internships WHERE id = $1 AND company_id = $2 RETURNING *",
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Not found" });
    }
    res.json({ deleted: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// REQUIRED SKILLS (internship_skills junction)
// ============================================================

// GET /api/internships/:id/skills -> public, used on the internship
// details screen
router.get("/:id/skills", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT s.id, s.name
       FROM internship_skills isk
       JOIN skills s ON s.id = isk.skill_id
       WHERE isk.internship_id = $1`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/internships/:id/skills -> add a required skill (owner only)
// body: { skill_id }
router.post("/:id/skills", roleAuth("company"), async (req, res) => {
  const { skill_id } = req.body;
  try {
    const owns = await db.query(
      "SELECT * FROM internships WHERE id = $1 AND company_id = $2",
      [req.params.id, req.userId]
    );
    if (owns.rows.length === 0) {
      return res.status(404).json({ message: "Not found" });
    }

    await db.query(
      "INSERT INTO internship_skills (internship_id, skill_id) VALUES ($1, $2)",
      [req.params.id, skill_id]
    );
    res.status(201).json({ internship_id: req.params.id, skill_id });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/internships/:id/skills/:skillId -> remove a required skill
// (owner only)
router.delete("/:id/skills/:skillId", roleAuth("company"), async (req, res) => {
  try {
    const owns = await db.query(
      "SELECT * FROM internships WHERE id = $1 AND company_id = $2",
      [req.params.id, req.userId]
    );
    if (owns.rows.length === 0) {
      return res.status(404).json({ message: "Not found" });
    }

    await db.query(
      "DELETE FROM internship_skills WHERE internship_id = $1 AND skill_id = $2",
      [req.params.id, req.params.skillId]
    );
    res.json({ message: "Removed" });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// PUBLIC BROWSE (guests + students, no auth required)
// ============================================================

// GET /api/internships -> only Active internships, with optional filters:
// ?field_id=&location_id=&work_arrangement_id=&internship_type_id=&keyword=
// Built the same way as the dynamic column lists in subResourceRouter.js -
// an array of conditions/values assembled with plain JS, still plugged
// into the query as parameterized placeholders.
router.get("/", async (req, res) => {
  const { field_id, location_id, work_arrangement_id, internship_type_id, keyword } =
    req.query;

  const conditions = ["status = 'Active'"];
  const values = [];

  if (field_id) {
    values.push(field_id);
    conditions.push(`field_id = $${values.length}`);
  }
  if (location_id) {
    values.push(location_id);
    conditions.push(`location_id = $${values.length}`);
  }
  if (work_arrangement_id) {
    values.push(work_arrangement_id);
    conditions.push(`work_arrangement_id = $${values.length}`);
  }
  if (internship_type_id) {
    values.push(internship_type_id);
    conditions.push(`internship_type_id = $${values.length}`);
  }
  if (keyword) {
    values.push(`%${keyword}%`);
    conditions.push(`title ILIKE $${values.length}`);
  }

  try {
    const result = await db.query(
      `SELECT * FROM internships WHERE ${conditions.join(" AND ")} ORDER BY posted_date DESC`,
      values
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/internships/:id -> public internship details. Bumps the views
// counter each time it's opened.
router.get("/:id", async (req, res) => {
  try {
    const result = await db.query(
      "UPDATE internships SET views = views + 1 WHERE id = $1 RETURNING *",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Internship not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
