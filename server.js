import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
dotenv.config();

import db from "./db.js";

import skillsRoutes from "./routes/skills.js";
import fieldsRoutes from "./routes/fields.js";
import studyFieldsRoutes from "./routes/studyFields.js";
import locationsRoutes from "./routes/locations.js";
import internshipTypesRoutes from "./routes/internshipTypes.js";
import workArrangementsRoutes from "./routes/workArrangements.js";
import educationLevelsRoutes from "./routes/educationLevels.js";
import companiesRoutes from "./routes/companies.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import quoteRoutes from "./routes/quotes.js";


import studentsRoutes from "./routes/students.js";
import projectsRoutes from "./routes/projects.js";
import experienceRoutes from "./routes/experience.js";
import certificationsRoutes from "./routes/certifications.js";
import internshipsRoutes from "./routes/internships.js";
import savedRoutes from "./routes/saved.js";

import applicationsRoutes from "./routes/applications.js";
import reportRoutes from "./routes/reports.js";

// import quoteRoutes from "./routes/quotes.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.send("🚀 Jordan Internship Hub API is running");
});
app.use("/api/companies", companiesRoutes);
app.use("/api/skills", skillsRoutes);
app.use("/api/fields", fieldsRoutes);
app.use("/api/study-fields", studyFieldsRoutes);
app.use("/api/locations", locationsRoutes);
app.use("/api/internship-types", internshipTypesRoutes);
app.use("/api/work-arrangements", workArrangementsRoutes);
app.use("/api/education-levels", educationLevelsRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/students", studentsRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/experience", experienceRoutes);
app.use("/api/certifications", certificationsRoutes);
// app.use("/api/companies", companyRoutes);
app.use("/api/internships", internshipsRoutes);
app.use("/api/applications", applicationsRoutes);
app.use("/api/quotes", quoteRoutes);
app.use("/uploads", express.static("uploads"));
app.use("/api/saved", savedRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "🚫 Route not found" });
});

db.connect().then(() => {
  app.listen(PORT, () => {
    console.log(`Listening on PORT ${PORT}`);
  });
});