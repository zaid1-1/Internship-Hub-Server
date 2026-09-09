import express from "express";
import db from "../db.js";

const router = express.Router();

// POST /api/auth/signup
// body (student): { email, password, role: "student", first_name, last_name }
// body (company): { email, password, role: "company", company_name }
//
// Creates the users row, then the matching student_profiles or
// company_profiles row right away (with just the required fields -
// the rest of the profile gets filled in later from the Profile /
// Company Profile screens via PUT).
router.post("/signup", async (req, res) => {
  const { email, password, role } = req.body;

  if (role !== "student" && role !== "company") {
    return res.status(400).json({ message: "role must be 'student' or 'company'" });
  }

  try {
    const exists = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    // password stored as-is, same as the course's auth.js example
    const newUser = await db.query(
      "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING *",
      [email, password, role]
    );
    const user = newUser.rows[0];

    if (role === "student") {
      const { first_name, last_name } = req.body;
      if (!first_name || !last_name) {
        return res.status(400).json({ message: "first_name and last_name are required" });
      }
      await db.query(
        "INSERT INTO student_profiles (user_id, first_name, last_name) VALUES ($1, $2, $3)",
        [user.id, first_name, last_name]
      );
    } else {
      const { company_name } = req.body;
      if (!company_name) {
        return res.status(400).json({ message: "company_name is required" });
      }
      await db.query(
        "INSERT INTO company_profiles (user_id, company_name) VALUES ($1, $2)",
        [user.id, company_name]
      );
    }

    // never send password_hash back to the client
    res.status(201).json({
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/login
// body: { email, password }
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await db.query(
      "SELECT * FROM users WHERE email = $1 AND password_hash = $2",
      [email, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];
    res.json({
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
