# Jordan Internship Hub — Backend API

Node.js/Express + PostgreSQL API powering the Jordan Internship Hub, a
platform that connects university students in Jordan with internship
opportunities posted by companies, with an admin layer for oversight and
platform data management.

## Technologies

- Node.js + Express 5
- PostgreSQL, via the raw `pg` driver (no ORM)
- `dotenv` — environment variable loading
- `cors` — cross-origin requests from the frontend
- `morgan` — request logging (dev format)
- `multer` — local-disk file uploads (CVs, profile photos, company logos)
- `axios` — server-side calls to the ZenQuotes API (daily quote widget)
- No TypeScript, no ORM, no JWT/session auth — see [Authentication](#authentication) below

## Getting started

### Prerequisites

- Node.js (v18+)
- PostgreSQL running locally (or reachable via connection string)

### 1. Clone and install

```bash
git clone https://github.com/zaid1-1/Internship-Hub-Server.git
cd Internship-Hub-Server
npm install
```

### 2. Configure environment variables

Copy the sample env file and fill in your own local database credentials:

```bash
cp .env.sample .env
```

`.env` needs:

```
DATABASE_URL=postgres://username:password@localhost:5432/internship_hub
PORT=5000
```

`PORT` is optional (defaults to `5000` if omitted).

### 3. Set up the database

Create the database, then run the schema against it:

```bash
createdb internship_hub
psql -U <username> -d internship_hub -f schema.sql
```

Optionally seed the admin-managed lookup tables (skills, fields,
locations, etc.) with starter data:

```bash
psql -U <username> -d internship_hub -f seed_lookup_tables.sql
```

### 4. Run the server

```bash
npm start
```

The API is now running at `http://localhost:5000` (or whatever `PORT` you
set). There's no `nodemon` — restart the server manually after editing
any file.

## Project structure

```
Internship-Hub-Server/
├── server.js              # app entry point, route mounting
├── db.js                  # PostgreSQL client (pg.Client)
├── schema.sql              # full database schema
├── seed_lookup_tables.sql  # starter data for lookup tables
├── middleware/
│   ├── requireAuth.js      # "must be logged in" check
│   ├── roleAuth.js         # role-restricted route guard
│   └── upload.js           # shared multer instance
├── routes/                 # one file per resource (auth, students,
│                            # companies, internships, applications,
│                            # admin, reports, quotes, and the 7
│                            # lookup tables)
├── utils/
│   └── matching.js         # rule-based student↔internship match score
└── uploads/                 # uploaded CVs/photos/logos (served statically)
```

## Authentication

There's no session, JWT, or cookie. Every protected request is identified
by two custom headers the frontend attaches after login:

| Header | Value |
|---|---|
| `x-user-id` | the logged-in user's numeric id |
| `x-role` | `student`, `company`, or `admin` |

Passwords are stored and compared as plain text — a deliberate decision
matching the course material this project is scoped to, not an oversight.

## Response shape

- Success → the row/array/object directly (no `{ data: ... }` wrapper)
- 4xx → `{ "message": "..." }`
- 500 → `{ "error": "Internal server error" }`
- Created rows → `201` + the created row
- Deletes → `200 { "deleted": {...} }`, or `200 { "message": "Removed" }` for junction-table removals

Base URL for every path below: `http://localhost:5000`.

## API reference

**Auth** — `/api/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/signup` | none | body `{ email, password, role, ...role-specific fields }` (`first_name`/`last_name` for student, `company_name` for company) → `201` |
| POST | `/login` | none | body `{ email, password }` → `200 { user }` or `401` |
| PUT | `/email` | any logged-in role | body `{ email }` — update your own email |
| PUT | `/password` | any logged-in role | body `{ currentPassword, newPassword }` |
| PUT | `/deactivate` | any logged-in role | no body — sets your own account `status` to `Disabled` |
| DELETE | `/me` | any logged-in role | no body — deletes your own account (cascades) |

**Students** — `/api/students` (all `roleAuth("student")` unless noted)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/me` | your profile + skills + interests |
| PUT | `/me` | full-body profile update |
| POST / DELETE | `/me/skills` / `/me/skills/:skillId` | skills junction |
| POST / DELETE | `/me/interests` / `/me/interests/:fieldId` | career-interest junction |
| POST | `/me/cv` | multipart upload, field name `cv` |
| POST | `/me/photo` | multipart upload, field name `photo` |
| GET | `/me/recommendations` | every Active internship with a computed match score, best-first |

**Companies** — `/api/companies`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/me` | company | your company profile |
| PUT | `/me` | company | full-body profile update |
| POST | `/me/logo` | company | multipart upload, field name `logo` |
| GET | `/:id` | none | public view of a company's profile |

**Internships** — `/api/internships`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/mine` | company | all of your internships, any status |
| POST | `/` | company | create one (`status` defaults to `Draft`) |
| PUT | `/:id` | company, owner | full content update (not status) |
| PATCH | `/:id/status` | company, owner | body `{ status }` — Draft/Active/Expired/Inactive |
| DELETE | `/:id` | company, owner | remove |
| GET | `/:id/skills` | none | required-skills list |
| POST / DELETE | `/:id/skills` / `/:id/skills/:skillId` | company, owner | attach/remove a required skill |
| GET | `/:id/match` | student | your match score + breakdown against this internship |
| GET | `/` | none | public browse — `?field_id=&location_id=&work_arrangement_id=&internship_type_id=&keyword=`, Active only |
| GET | `/:id` | none | single internship, full row — **increments `views` on every call** |

**Saved internships** — `/api/saved` (all `roleAuth("student")`)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | your saved internships + match score |
| POST | `/` | body `{ internship_id }` |
| DELETE | `/:internshipId` | unsave |

**Applications** — `/api/applications`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/` | student | body `{ internship_id }` — track an "apply" click |
| GET | `/mine` | student | your tracked applications |
| GET | `/candidates` | company | every applicant across your internships, with match scores |
| GET | `/candidates/:id` | company, owner | one candidate's full profile |
| PUT | `/:id` | student or company (owner) | update status/notes/follow-up |
| DELETE | `/:id` | student, owner | withdraw |

**Admin** — `/api/admin` (all `roleAuth("admin")`)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/stats` | dashboard counters |
| GET | `/students` / `/companies` | all accounts of that role |
| GET | `/users/:id` | one user + their profile |
| PUT | `/users/:id/status` | body `{ status }` — enable/disable |
| DELETE | `/users/:id` | delete an account (cascades) |
| GET | `/internships` | every company's internships — `?status=`, or `?status=Reported` |
| GET | `/internships/:id` | view any internship (no `views` increment) |
| PUT | `/internships/:id/status` | deactivate/reactivate any internship |
| DELETE | `/internships/:id` | remove any internship |
| GET | `/reports` | all filed reports — `?status=` |
| PUT | `/reports/:id/status` | body `{ status }` — Pending/Reviewed/Dismissed/Action Taken |

**Reports** — `/api/reports`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/` | any logged-in role | body `{ reported_type, reported_internship_id \| reported_company_id \| reported_user_id, reason }` — exactly one target id |

**Quotes** — `/api/quotes`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/daily` | none | random motivational quote, proxied server-side from ZenQuotes |

**Lookup / platform data** — 7 identical tables, each mounted at its own base path and supporting the same 5 routes:

`/api/skills`, `/api/fields`, `/api/study-fields`, `/api/locations`, `/api/internship-types`, `/api/work-arrangements`, `/api/education-levels`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `{base}/` | none | list all rows |
| POST | `{base}/` | admin | body `{ name }` |
| PUT | `{base}/:id` | admin | body `{ name }` |
| PATCH | `{base}/:id/status` | admin | body `{ status }` — Active/Disabled |
| DELETE | `{base}/:id` | admin | remove |

## Notes & gotchas

- **Enums are exact-match strings** — a typo or wrong casing throws a `500`, there's no validation layer in front of Postgres. See `schema.sql` for the exact allowed values per column (`academic_year`, `duration`, `experience_level`, `status` columns, etc.).
- **`GET /api/internships/:id` increments `views` on every call**, including repeats from the same viewer — this is intentional, not a bug. A company viewing its own listing should use `GET /api/internships/mine` (filtered client-side) instead, to avoid inflating its own view count.
- **Match scores (`match_score`/`match_breakdown`/`matchingSkills`/`missingSkills`) are computed on every request, not stored** — they appear on `GET /internships/:id/match`, `GET /students/me/recommendations`, `GET /saved`, `GET /applications/candidates`, and `GET /applications/candidates/:id`.
- **Ownership failures and "doesn't exist" both return `404`**, not `403`, for owned resources — except `PUT /api/applications/:id`, which returns `403` since both a student and a company can hit that one route.