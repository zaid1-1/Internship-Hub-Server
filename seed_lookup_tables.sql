-- Jordan Internship Hub — seed data for the 7 admin-managed lookup
-- tables (skills, fields, study_fields, locations, internship_types,
-- work_arrangements, education_levels).
--
-- Each of these tables only needs a `name` column filled in — `status`
-- defaults to 'Active' on its own (per routes/lookuprouter.js's
-- INSERT INTO <table> (name) VALUES ($1)). Run this once against your
-- local `internship_hub` database and every "Not specified"-only
-- dropdown in the app (Profile, Filters, Create Internship, etc.) will
-- have real options.
--
-- Written with a NOT EXISTS guard per row instead of ON CONFLICT, so it
-- is safe to run more than once (e.g. if you've already added a couple
-- of these manually through Postman) without erroring or duplicating
-- rows, and without assuming a UNIQUE constraint exists on `name`.

-- Skills — exact list from the course spec ("WEBAPP idea" doc, section D)
INSERT INTO skills (name)
SELECT v FROM (VALUES
  ('JavaScript'), ('React'), ('Node.js'), ('Python'), ('Java'), ('SQL'),
  ('Git'), ('Docker'), ('AWS'), ('Azure'), ('MongoDB'), ('PostgreSQL')
) AS t(v)
WHERE NOT EXISTS (SELECT 1 FROM skills WHERE skills.name = t.v);

-- Fields (career interests / internship field categories) — exact list
-- from the spec, section E
INSERT INTO fields (name)
SELECT v FROM (VALUES
  ('Software Engineering'), ('Web Development'), ('Mobile Development'),
  ('Data Science'), ('AI / Machine Learning'), ('Cybersecurity'),
  ('Cloud Computing'), ('DevOps'), ('UI/UX'), ('QA / Testing')
) AS t(v)
WHERE NOT EXISTS (SELECT 1 FROM fields WHERE fields.name = t.v);

-- Locations — exact list from the spec, section F
INSERT INTO locations (name)
SELECT v FROM (VALUES
  ('Amman'), ('Irbid'), ('Zarqa'), ('Aqaba'), ('Remote')
) AS t(v)
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE locations.name = t.v);

-- Work arrangements — from the spec, section F ("Any" is left out on
-- purpose: it's the frontend's "no preference" option, not a real row -
-- the filter dropdowns already render their own "All arrangements"/"Any"
-- placeholder separately from these options)
INSERT INTO work_arrangements (name)
SELECT v FROM (VALUES
  ('On-site'), ('Hybrid'), ('Remote')
) AS t(v)
WHERE NOT EXISTS (SELECT 1 FROM work_arrangements WHERE work_arrangements.name = t.v);

-- Internship types — from the spec, section F (same "Any" note as above)
INSERT INTO internship_types (name)
SELECT v FROM (VALUES
  ('Summer'), ('Semester'), ('Full-time'), ('Part-time')
) AS t(v)
WHERE NOT EXISTS (SELECT 1 FROM internship_types WHERE internship_types.name = t.v);

-- Study fields (Field of Study, under Education) — NOT explicitly listed
-- in the spec, only "Field of study" as a generic label. This is a
-- reasonable CS-course set; edit/add rows below (or later through the
-- Admin Platform Data screen) if you want different majors.
INSERT INTO study_fields (name)
SELECT v FROM (VALUES
  ('Computer Science'), ('Software Engineering'), ('Computer Engineering'),
  ('Information Technology'), ('Information Systems'), ('Data Science'),
  ('Cybersecurity'), ('Artificial Intelligence')
) AS t(v)
WHERE NOT EXISTS (SELECT 1 FROM study_fields WHERE study_fields.name = t.v);

-- Education levels (Degree Level) — also NOT explicitly listed in the
-- spec (only "Degree" as a generic label). Standard set below; edit/add
-- as needed.
INSERT INTO education_levels (name)
SELECT v FROM (VALUES
  ('Diploma'), ('Associate Degree'), ('Bachelor''s Degree'),
  ('Master''s Degree'), ('PhD')
) AS t(v)
WHERE NOT EXISTS (SELECT 1 FROM education_levels WHERE education_levels.name = t.v);
