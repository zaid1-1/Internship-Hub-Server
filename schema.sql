-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE user_role         AS ENUM ('student', 'company', 'admin');
CREATE TYPE account_status    AS ENUM ('Active', 'Disabled');
CREATE TYPE academic_year     AS ENUM ('Year 1','Year 2','Year 3','Year 4','Graduated');
CREATE TYPE experience_level  AS ENUM ('No experience required','Some experience preferred','Relevant coursework required');
CREATE TYPE internship_duration AS ENUM ('1-2 months','3 months','4-6 months','6+ months');
CREATE TYPE internship_status AS ENUM ('Draft','Active','Expired','Inactive');
CREATE TYPE application_status AS ENUM ('Clicked Apply','Applied','Interview','Offer','Rejected','Ghosted','Withdrawn');
CREATE TYPE report_type       AS ENUM ('Internship Opportunity','Company Profile','User');
CREATE TYPE report_status     AS ENUM ('Pending','Reviewed','Dismissed','Action Taken');

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL,
  status        account_status NOT NULL DEFAULT 'Active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- LOOKUP / PLATFORM DATA TABLES (admin-managed)
-- ============================================================
CREATE TABLE skills (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) UNIQUE NOT NULL,
  category   VARCHAR(100),
  status     account_status NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fields (
  id     SERIAL PRIMARY KEY,
  name   VARCHAR(100) UNIQUE NOT NULL,
  status account_status NOT NULL DEFAULT 'Active'
);

CREATE TABLE study_fields (
  id     SERIAL PRIMARY KEY,
  name   VARCHAR(100) UNIQUE NOT NULL,
  status account_status NOT NULL DEFAULT 'Active'
);

CREATE TABLE locations (
  id     SERIAL PRIMARY KEY,
  name   VARCHAR(100) UNIQUE NOT NULL,
  status account_status NOT NULL DEFAULT 'Active'
);

CREATE TABLE internship_types (
  id     SERIAL PRIMARY KEY,
  name   VARCHAR(50) UNIQUE NOT NULL,
  status account_status NOT NULL DEFAULT 'Active'
);

CREATE TABLE work_arrangements (
  id     SERIAL PRIMARY KEY,
  name   VARCHAR(50) UNIQUE NOT NULL,
  status account_status NOT NULL DEFAULT 'Active'
);

CREATE TABLE education_levels (
  id     SERIAL PRIMARY KEY,
  name   VARCHAR(50) UNIQUE NOT NULL,
  status account_status NOT NULL DEFAULT 'Active'
);

-- ============================================================
-- STUDENT PROFILE
-- ============================================================
CREATE TABLE student_profiles (
  user_id                       INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  first_name                    VARCHAR(100) NOT NULL,
  last_name                     VARCHAR(100) NOT NULL,
  phone                         VARCHAR(30),
  photo_url                     TEXT,
  location_id                   INT REFERENCES locations(id),
  headline                      VARCHAR(255),
  about                         TEXT,
  university                    VARCHAR(150),
  degree_level_id               INT REFERENCES education_levels(id),
  study_field_id                INT REFERENCES study_fields(id),
  academic_year                 academic_year,
  expected_graduation_year      SMALLINT,
  gpa                           NUMERIC(3,2),
  cv_url                        TEXT,
  github_url                    TEXT,
  linkedin_url                  TEXT,
  portfolio_url                 TEXT,
  personal_website_url          TEXT,
  preferred_location_id         INT REFERENCES locations(id),
  preferred_work_arrangement_id INT REFERENCES work_arrangements(id),
  preferred_internship_type_id  INT REFERENCES internship_types(id),
  preferred_duration            internship_duration,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE student_skills (
  student_id INT REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  skill_id   INT REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (student_id, skill_id)
);

CREATE TABLE student_interests (
  student_id INT REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  field_id   INT REFERENCES fields(id) ON DELETE CASCADE,
  PRIMARY KEY (student_id, field_id)
);

CREATE TABLE projects (
  id           SERIAL PRIMARY KEY,
  student_id   INT NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  name         VARCHAR(150) NOT NULL,
  description  TEXT,
  technologies VARCHAR(255),
  github_url   TEXT,
  demo_url     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE experience (
  id          SERIAL PRIMARY KEY,
  student_id  INT NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  title       VARCHAR(150) NOT NULL,
  organization VARCHAR(150) NOT NULL,
  start_date  VARCHAR(30),
  end_date    VARCHAR(30),
  description TEXT
);

CREATE TABLE certifications (
  id                SERIAL PRIMARY KEY,
  student_id        INT NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  name              VARCHAR(150) NOT NULL,
  issuing_organization VARCHAR(150) NOT NULL,
  date              VARCHAR(30),
  credential_id     VARCHAR(100),
  credential_url    TEXT
);

-- ============================================================
-- COMPANY PROFILE
-- ============================================================
CREATE TABLE company_profiles (
  user_id       INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_name  VARCHAR(150) NOT NULL,
  industry      VARCHAR(100),
  location_id   INT REFERENCES locations(id),
  website       TEXT,
  about         TEXT,
  logo_url      TEXT,
  contact_email VARCHAR(255),
  company_size  VARCHAR(50),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INTERNSHIPS
-- ============================================================
CREATE TABLE internships (
  id                        SERIAL PRIMARY KEY,
  company_id                INT NOT NULL REFERENCES company_profiles(user_id) ON DELETE CASCADE,
  title                     VARCHAR(200) NOT NULL,
  description               TEXT,
  field_id                  INT REFERENCES fields(id),
  location_id               INT REFERENCES locations(id),
  work_arrangement_id       INT REFERENCES work_arrangements(id),
  internship_type_id        INT REFERENCES internship_types(id),
  duration                  internship_duration,
  experience_level          experience_level,
  required_degree_level_id  INT REFERENCES education_levels(id),
  required_study_field_id   INT REFERENCES study_fields(id),
  application_deadline      DATE,
  responsibilities          TEXT,
  requirements              TEXT,
  benefits                  TEXT,
  additional_info           TEXT,
  external_application_url  TEXT NOT NULL,
  status                    internship_status NOT NULL DEFAULT 'Draft',
  posted_date               TIMESTAMPTZ,
  views                     INT NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE internship_skills (
  internship_id INT REFERENCES internships(id) ON DELETE CASCADE,
  skill_id      INT REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (internship_id, skill_id)
);

CREATE TABLE saved_internships (
  student_id    INT REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  internship_id INT REFERENCES internships(id) ON DELETE CASCADE,
  saved_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, internship_id)
);

-- ============================================================
-- APPLICATIONS (tracking record + candidate association)
-- ============================================================
CREATE TABLE applications (
  id             SERIAL PRIMARY KEY,
  student_id     INT NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  internship_id  INT NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
  status         application_status NOT NULL DEFAULT 'Clicked Apply',
  clicked_date   TIMESTAMPTZ NOT NULL DEFAULT now(),
  follow_up_date DATE,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, internship_id)
);

-- ============================================================
-- REPORTS
-- ============================================================
CREATE TABLE reports (
  id                    SERIAL PRIMARY KEY,
  reporter_user_id      INT NOT NULL REFERENCES users(id),
  reported_type         report_type NOT NULL,
  reported_internship_id INT REFERENCES internships(id),
  reported_company_id   INT REFERENCES company_profiles(user_id),
  reported_user_id      INT REFERENCES users(id),
  reason                TEXT NOT NULL,
  status                report_status NOT NULL DEFAULT 'Pending',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT one_target_only CHECK (
    (CASE WHEN reported_internship_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN reported_company_id    IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN reported_user_id       IS NOT NULL THEN 1 ELSE 0 END) = 1
  )
);

-- ============================================================
-- USEFUL INDEXES
-- ============================================================
CREATE INDEX idx_internships_company   ON internships(company_id);
CREATE INDEX idx_internships_status    ON internships(status);
CREATE INDEX idx_applications_student  ON applications(student_id);
CREATE INDEX idx_applications_internship ON applications(internship_id);
CREATE INDEX idx_saved_student         ON saved_internships(student_id);