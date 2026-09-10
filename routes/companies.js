import express from "express";
import db from "../db.js";
import roleAuth from "../middleware/roleAuth.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// GET /api/companies/me
// The logged-in company's own profile.
router.get("/me", roleAuth("company"), async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM company_profiles WHERE user_id = $1",
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/companies/me
// Full profile update - same pattern as student_profiles: the frontend
// sends every editable field every time, not a partial patch.
router.put("/me", roleAuth("company"), async (req, res) => {
  const {
    company_name,
    industry,
    location_id,
    website,
    about,
    logo_url,
    contact_email,
    company_size,
  } = req.body;

  try {
    const result = await db.query(
      `UPDATE company_profiles SET
        company_name = $1,
        industry = $2,
        location_id = $3,
        website = $4,
        about = $5,
        logo_url = $6,
        contact_email = $7,
        company_size = $8,
        updated_at = now()
       WHERE user_id = $9
       RETURNING *`,
      [
        company_name,
        industry,
        location_id,
        website,
        about,
        logo_url,
        contact_email,
        company_size,
        req.userId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});



// POST /api/companies/me/logo -> multipart file upload, form field name
// "logo". Same pattern as students.js's /me/cv and /me/photo.
router.post("/me/logo", roleAuth("company"), upload.single("logo"), async (req, res) => {
  try {
    const logo_url = `/uploads/${req.file.filename}`;
    const result = await db.query(
      "UPDATE company_profiles SET logo_url = $1, updated_at = now() WHERE user_id = $2 RETURNING *",
      [logo_url, req.userId]
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


// GET /api/companies/:id
// Public company profile - anyone (including guests) can view it.
// Once the internships routes exist, this will also list the company's
// active internships (spec item 38) - left out for now since that table
// isn't built yet.
router.get("/:id", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM company_profiles WHERE user_id = $1",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Company not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
