import express from "express";
import axios from "axios";

const router = express.Router();

// GET /api/quotes/daily -> a random motivational quote, called
// server-side only (never straight from the frontend). Uses axios
// instead of Node's built-in fetch since axios is the library the
// course material already uses for calling an external API (demo-04's
// Digimon fetch, client-side) - same familiar tool, just moved
// server-side.
router.get("/daily", async (req, res) => {
  try {
    const response = await axios.get("https://zenquotes.io/api/random");
    res.json(response.data[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;