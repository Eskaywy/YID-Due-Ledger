# YID Due Ledger

A secure, full-stack web application for the Lagos & South-West Region pilot programme.
Members verify their own records; the Super Admin manages everything.

---

## Roles

| Role         | Access                                                     |
|--------------|------------------------------------------------------------|
| `member`     | View own profile, monthly dues, program pledges, other pledges |
| `super_admin`| Full platform access — all members, all regions, batch upload, audit logs |

> **Regional Administrator has been removed.** There are exactly two roles.

---

## Demo Credentials

| Role        | Email                  | Password     |
|-------------|------------------------|--------------|
| Super Admin | superadmin@drdp.ng     | Admin@2025   |
| Member      | adewale@drdp.ng        | Member@2025  |
| Member      | chidinma@drdp.ng       | Member@2025  |
| Member      | ngozi@drdp.ng          | Member@2025  |

---

## Quick Start

### Prerequisites
- Node.js 20+ (recommended; Node 18 also works)
- A [Supabase](https://supabase.com/) project (free tier works)

### Install & Run

```bash
# 1. Install backend dependencies
npm install

# 2. Create the database schema (one time)
#    Supabase Dashboard → SQL Editor → paste supabase/schema.sql → Run

# 3. Configure environment (copy .env.example to .env and fill it in)
#    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, CLIENT_URL

# 4. Install & build frontend
npm run build

# 5. Start the server (serves both API + frontend in production mode)
NODE_ENV=production node server.js
```

Open http://localhost:3000

### Development (hot reload)

```bash
# Terminal 1 — Backend
node server.js

# Terminal 2 — Frontend dev server (proxies /api to :3000)
cd frontend && npm run dev
```

Frontend dev server: http://localhost:5173

---

### Project Structure

```
yid-due-ledger/
├── package.json              # Backend deps + scripts (npm run build/deploy)
├── server.js                 # Express app entry point (exportable for Vercel)
├── supabaseAdmin.js          # Supabase client (service role, server-side only)
├── supabase/
│   └── schema.sql            # Postgres schema + RPC functions (run once in SQL Editor)
├── db.js                     # DB init + seed data (Supabase)
├── .env.example              # Template for environment variables
├── middleware/
│   ├── auth.js               # JWT auth + requireSuperAdmin guard
│   └── audit.js              # Audit log writer
├── routes/
│   ├── auth.js               # POST /login, GET /me, PUT /change-password, signup
│   ├── members.js            # Member self-service: GET /my/dues, /pledges, /summary
│   ├── admin.js              # Super Admin CRUD, batch upload, export
│   └── records.js            # Individual dues & pledge CRUD
├── api/
│   └── index.js              # Vercel serverless function wrapper for server.js
├── scripts/                  # Utility / admin scripts
│   └── preview-check.js      # End-to-end dev-server + API check
├── uploads/                  # Temporary batch-upload files (gitignored)
├── data/                     # Legacy data dir (now Supabase-backed)
└── frontend/                 # React + Vite SPA
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── tsconfig.json
    ├── public/
    │   ├── favicon.svg
    │   └── icons.svg
    └── src/
        ├── index.css
        ├── main.jsx
        ├── App.jsx
        ├── assets/
        │   └── hero.png
        ├── components/
        │   ├── Layout.jsx            # Sidebar + topbar
        │   └── CreateMemberModal.jsx
        ├── context/
        │   └── AuthContext.jsx       # JWT auth state
        ├── pages/
        │   ├── LoginPage.jsx
        │   ├── SignupPage.jsx
        │   ├── ChangePasswordPage.jsx
        │   ├── MemberDashboard.jsx   # Self-service ledger view
        │   ├── AdminDashboard.jsx    # Stats overview
        │   ├── MembersPage.jsx       # Member list + search + export
        │   ├── MemberDetailPage.jsx  # Full ledger editing per member
        │   ├── BatchUploadPage.jsx   # CSV/Excel upload
        │   ├── AuditLogsPage.jsx     # Action history
        │   └── ProfilePage.jsx       # Own profile + change password
        └── utils/
            ├── api.js                # Axios client (env-aware base URL)
```

---

## API Reference

### Auth
| Method | Endpoint               | Auth    | Description             |
|--------|------------------------|---------|-------------------------|
| POST   | /api/auth/login        | None    | Login, returns JWT      |
| GET    | /api/auth/me           | Any     | Get own profile         |
| PUT    | /api/auth/change-password | Any  | Change own password     |

### Member Self-Service
| Method | Endpoint                      | Auth   | Description           |
|--------|-------------------------------|--------|-----------------------|
| GET    | /api/members/my/dues          | Any    | Own monthly dues      |
| GET    | /api/members/my/pledges/program | Any  | Own program pledges   |
| GET    | /api/members/my/pledges/other | Any    | Own other pledges     |
| GET    | /api/members/my/summary       | Any    | Financial summary     |

### Admin (Super Admin only)
| Method | Endpoint                      | Description                  |
|--------|-------------------------------|------------------------------|
| GET    | /api/admin/stats              | Dashboard stats              |
| GET    | /api/admin/members            | List members (search/filter) |
| POST   | /api/admin/members            | Create member                |
| GET    | /api/admin/members/:id        | Member + full ledger         |
| PUT    | /api/admin/members/:id        | Update member profile        |
| DELETE | /api/admin/members/:id        | Archive (soft delete) member |
| POST   | /api/admin/batch-upload       | Upload CSV/Excel             |
| GET    | /api/admin/export             | Export members to Excel      |
| GET    | /api/admin/audit-logs         | Last 100 audit entries       |
| GET    | /api/admin/regions            | List regions                 |

### Records (Super Admin only)
| Method | Endpoint                              | Description              |
|--------|---------------------------------------|--------------------------|
| PUT    | /api/records/dues/:userId             | Upsert monthly due       |
| DELETE | /api/records/dues/:dueId              | Delete due record        |
| POST   | /api/records/pledges/program/:userId  | Add program pledge       |
| PUT    | /api/records/pledges/program/:pledgeId | Update program pledge   |
| DELETE | /api/records/pledges/program/:pledgeId | Delete program pledge   |
| POST   | /api/records/pledges/other/:userId    | Add other pledge         |
| PUT    | /api/records/pledges/other/:pledgeId  | Update other pledge      |
| DELETE | /api/records/pledges/other/:pledgeId  | Delete other pledge      |

---

## Batch Upload CSV Format

```csv
user_id,email,due_month,due_year,due_amount,due_status,pledge_program,pledge_amount,pledge_status,pledge_date
LGS-MED-202506-0002,,6,2025,2000,paid,,,,
LGS-MED-202506-0003,,5,2025,2000,arrears,Annual Dinner 2025,5000,pending,2025-03-15
```

- Use `user_id` (Member ID code) OR `email` to identify a member — one is sufficient
- A single row can update a due AND add a pledge simultaneously
- Duplicate `user_id + month + year` combinations are updated (upsert), not duplicated
- Download the template from the Batch Upload page in the Admin Panel

---

## Member ID Format

```
[REGION]-[DEPT]-[YYYYMM]-[SEQ]
e.g. LGS-MED-202506-0002

LGS = Lagos
SWR = South-West Region
MED = Media
INF = Information
```

IDs are auto-generated and sequential per region + department + month.

---

## Security

- Passwords hashed with bcrypt (10 rounds)
- JWTs expire after 8 hours
- Role enforcement at API middleware level (`requireSuperAdmin`)
- Members can only read their own records (server-enforced `WHERE user_id = req.user.id`)
- Rate limiting: 300 requests/15 min on all API routes, 20/15 min on auth routes
- All admin mutations written to `audit_logs` table
- Soft delete (archive) preserves data integrity

---

## Environment Variables

| Variable     | Default                              | Description          |
|--------------|--------------------------------------|----------------------|
| PORT         | 3000                                 | Server port (includes OAuth `/oauth/*` endpoints) |
| JWT_SECRET   | yid-due-ledger-secret-key-change-in-production | **Change in prod!**  |
| CLIENT_URL   | http://localhost:5173                | CORS allowed origin  |
| NODE_ENV     | (unset)                              | Set to `production`  |

---

## OAuth 2.0 Authorization Server

The server includes a built-in OAuth 2.0 / OpenID Connect authorization server on the same port (`/oauth/*` endpoints). It provides a complete authorization-code flow with a consent screen, suitable for development and testing.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/oauth/consent` | Consent screen — shows login form if not authenticated, or client card + requested scopes + Allow/Deny buttons if authenticated |
| `POST` | `/oauth/consent` | Handles login, approve, or deny actions |
| `POST` | `/oauth/login` | Programmatic login — returns JWT access token + user info (JSON API) |
| `POST` | `/oauth/token` | Exchange authorization code for access token (standard OAuth token endpoint) |
| `GET` | `/oauth/userinfo` | Get user info — requires `Authorization: Bearer <token>` header |
| `GET` | `/oauth/callback` | Demo callback page — shows token + user info after code exchange (end-to-end testing) |
| `GET` | `/oauth/authorize` | OAuth authorize endpoint — validates client, redirects to consent |
| `GET` | `/oauth/.well-known/openid-configuration` | OIDC discovery document |
| `GET` | `/oauth/logout` | Clears the `oauth_token` session cookie |

### Demo Clients (in-memory)

| Client ID | Redirect URI |
|-----------|-------------|
| `yid-web-app` | `http://localhost:3000/oauth/callback` |
| `yid-mobile-app` | `http://localhost:3000/oauth/callback` |

### Demo Users (in-memory, bcrypt hashed at startup)

| Email | Password | Role |
|-------|----------|------|
| `superadmin@drdp.ng` | `Admin@2025` | `super_admin` |
| `adewale@drdp.ng` | `Member@2025` | `member` |

### Quick Test

```bash
# 1. Login (programmatic)
curl -X POST http://localhost:3000/oauth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@drdp.ng","password":"Admin@2025"}'

# 2. Use the returned access_token to call userinfo
curl http://localhost:3000/oauth/userinfo \
  -H "Authorization: Bearer <access_token>"

# 3. Consent flow (browser-based)
open http://localhost:3000/oauth/consent
# → Login with demo credentials → Approve → callback shows access token
```

### OIDC Discovery

```bash
curl http://localhost:3000/oauth/.well-known/openid-configuration
```

Returns a valid OpenID Connect discovery document with `authorization_endpoint`, `token_endpoint`, `userinfo_endpoint`, and supported scopes (`openid`, `profile`, `email`, `member_data`).

---

## Deployment

### Option A — Self-hosted (Node server)

The Express app serves both the API (`/api/*`) and the built frontend
(`frontend/dist`) from a single Node process:

```bash
# 1. Create the schema in Supabase (one time)
#    Supabase Dashboard → SQL Editor → paste supabase/schema.sql → Run

# 2. Configure environment (copy .env.example to .env and fill it in)
#    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, CLIENT_URL

# 3. Build the frontend and start the server
npm run build
npm start
```

### Option B — Vercel (recommended)

The project can also be deployed to [Vercel](https://vercel.com/) as a static frontend + serverless API. Vercel builds the Vite frontend automatically and deploys `api/index.js` as a serverless function.

#### One-time setup

1. Push the repo to GitHub (or GitLab/Bitbucket).
2. In the [Vercel Dashboard](https://vercel.com/dashboard), click **Add New → Project** and import the repo.
3. Vercel auto-detects `vercel.json`. Keep the defaults:
   - **Root Directory**: the repo root (where `package.json`, `server.js`, and `vercel.json` live).
   - **Framework Preset**: leave as "Vercel" (auto-detected from `vercel.json` builds).
   - **Build Command**: leave as default (`npm run build` from the `frontend/` directory).
   - **Output Directory**: `frontend/dist` (set in `vercel.json` under `@vercel/static-build`).
4. Add the following **Environment Variables** in the Vercel project settings:
   | Variable | Value |
   |----------|-------|
   | `SUPABASE_URL` | your Supabase project URL (Project Settings → API) |
   | `SUPABASE_SERVICE_ROLE_KEY` | your Supabase service_role secret (keep secret!) |
   | `JWT_SECRET` | your production secret (use the same value as locally) |
   | `CLIENT_URL` | your Vercel deployment URL (e.g. `https://yid-due-ledger.vercel.app`) |
   | `NODE_ENV` | `production` |

   > **Note**: no key files are needed on Vercel — the Supabase credentials
   > come exclusively from these environment variables.

5. Click **Deploy**.

#### Deploy from CLI

```bash
npm install -g vercel
vercel login
vercel --prod          # or: npm run deploy:vercel
```

For a preview deployment (shared URL, not production):

```bash
vercel                 # or: npm run deploy:vercel:preview
```

#### How Vercel routing works

- `/api/*` → routed to `api/index.js` (Vercel serverless function, handles the Express app)
- Everything else → served as static files from `frontend/dist/`
- SPA routes (e.g. `/members`, `/admin`) → fall back to `index.html` via the catch-all route

> **Note**: `server.js` skips static file serving when `process.env.VERCEL === 'true'` (line 27). Vercel handles the frontend via CDN, not Express.

---

## How to choose

| | Self-hosted (Node) | Vercel |
|--|--------------------|--------|
| Frontend hosting | Express serves `frontend/dist` | Vercel Edge Network (CDN) |
| Backend (API) | Same Node process | Vercel Serverless Functions |
| Database | Supabase (Postgres) — same for both | Supabase (Postgres) — same for both |
| Cold starts | none (long-running process) | ~100-500ms |
| Best for | full control, always-on server | zero-ops deploys, global CDN |

Both options use the **same** Supabase database —
deploying to either does not affect your data. You can even deploy to
both simultaneously (e.g. preview on Vercel, production self-hosted).
