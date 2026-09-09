import express from "express";
import db from "../db.js";
import roleAuth from "../middleware/roleAuth.js";

// Creates the same CRUD routes for any of the student's professional
// sub-resources: projects, experience, certifications. All three share
// the same shape - an id, a student_id owner column, and a handful of
// plain text fields - so instead of writing near-identical CRUD code
// three times, we write it once here and each routes/<name>.js file
// just calls makeSubResourceRouter("<table_name>", [<editable columns>]).
//
// Ownership is enforced the simple way, same idea as the course demos:
// every UPDATE/DELETE includes "AND student_id = $..." in the WHERE
// clause, so a student can never touch a row that isn't theirs - if it
// doesn't match, 0 rows come back and we just say "Not found".
export default function makeSubResourceRouter(tableName, fields) {
  const router = express.Router();

  // GET / -> the logged-in student's own rows
  router.get("/", roleAuth("student"), async (req, res) => {
    try {
      const result = await db.query(
        `SELECT * FROM ${tableName} WHERE student_id = $1 ORDER BY id`,
        [req.userId]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST / -> add a new row owned by the logged-in student
  router.post("/", roleAuth("student"), async (req, res) => {
    const values = fields.map((f) => req.body[f]);
    const placeholders = fields.map((_, i) => `$${i + 2}`).join(", ");

    try {
      const result = await db.query(
        `INSERT INTO ${tableName} (student_id, ${fields.join(", ")})
         VALUES ($1, ${placeholders}) RETURNING *`,
        [req.userId, ...values]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PUT /:id -> edit a row (only if it belongs to the logged-in student)
  router.put("/:id", roleAuth("student"), async (req, res) => {
    const values = fields.map((f) => req.body[f]);
    const setClause = fields.map((f, i) => `${f} = $${i + 3}`).join(", ");

    try {
      const result = await db.query(
        `UPDATE ${tableName} SET ${setClause}
         WHERE id = $1 AND student_id = $2 RETURNING *`,
        [req.params.id, req.userId, ...values]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Not found" });
      }
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // DELETE /:id -> remove a row (only if it belongs to the logged-in student)
  router.delete("/:id", roleAuth("student"), async (req, res) => {
    try {
      const result = await db.query(
        `DELETE FROM ${tableName} WHERE id = $1 AND student_id = $2 RETURNING *`,
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

  return router;
}
