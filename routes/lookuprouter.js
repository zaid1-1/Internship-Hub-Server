import express from "express";
import db from "../db.js";
import roleAuth from "../middleware/roleAuth.js";

// Creates the same 5 CRUD routes for any platform-data lookup table:
// skills, fields, study_fields, locations, internship_types,
// work_arrangements, education_levels.
//
// Instead of writing near-identical GET/POST/PUT/PATCH/DELETE code
// 7 separate times (one per table), we write it once here and each
// routes/<name>.js file just calls makeLookupRouter("<table_name>").
export default function makeLookupRouter(tableName) {
  const router = express.Router();

  // GET / -> list all values (public - used to populate <select> options)
  router.get("/", async (req, res) => {
    try {
      const result = await db.query(`SELECT * FROM ${tableName} ORDER BY name`);
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST / -> add a new value (admin only)
  router.post("/", roleAuth("admin"), async (req, res) => {
    const { name } = req.body;
    try {
      const result = await db.query(
        `INSERT INTO ${tableName} (name) VALUES ($1) RETURNING *`,
        [name]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PUT /:id -> edit a value's name (admin only)
  router.put("/:id", roleAuth("admin"), async (req, res) => {
    const { name } = req.body;
    try {
      const result = await db.query(
        `UPDATE ${tableName} SET name = $1 WHERE id = $2 RETURNING *`,
        [name, req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Not found" });
      }
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PATCH /:id/status -> Active/Disabled toggle (admin only)
  router.patch("/:id/status", roleAuth("admin"), async (req, res) => {
    const { status } = req.body;
    try {
      const result = await db.query(
        `UPDATE ${tableName} SET status = $1 WHERE id = $2 RETURNING *`,
        [status, req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Not found" });
      }
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // DELETE /:id -> remove a value (admin only)
  router.delete("/:id", roleAuth("admin"), async (req, res) => {
    try {
      const result = await db.query(
        `DELETE FROM ${tableName} WHERE id = $1 RETURNING *`,
        [req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Not found" });
      }
      res.json({ deleted: result.rows[0] });
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}