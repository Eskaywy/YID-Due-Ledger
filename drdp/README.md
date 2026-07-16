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
- Node.js 18+

### Install & Run

```bash
# 1. Install backend dependencies
npm install

# 2. Install & build frontend
cd frontend && npm install && npm run build && cd ..

# 3. Start the server (serves both API + frontend)
NODE_ENV=production node server.js
```

Open http://localhost:3001

### Development (hot reload)

```bash
# Terminal 1 — Backend
node server.js

# Terminal 2 — Frontend dev server (proxies /api to :3001)
cd frontend && npm run dev
```

Frontend dev server: http://localhost:5173

---

## Project Structure

```
drdp/
├── server.js              # Express app entry point
├── db.js                  # sql.js database, schema, seed data
├── middleware/
│   ├── auth.js            # JWT auth + requireSuperAdmin guard
│   └── audit.js           # Audit log writer
├── routes/
│   ├── auth.js            # POST /login, GET /me, PUT /change-password
│   ├── members.js         # Member self-service: GET /my/dues, /pledges, /summary
│   ├── admin.js           # Super Admin CRUD, batch upload, export
│   └── records.js         # Individual dues & pledge CRUD
├── data/
│   └── drdp.sqlite        # SQLite database (auto-created on first run)
├── uploads/               # Temporary batch upload files
└── frontend/
    └── src/
        ├── pages/
        │   ├── LoginPage.jsx
        │   ├── MemberDashboard.jsx   # Self-service ledger view
        │   ├── AdminDashboard.jsx    # Stats overview
        │   ├── MembersPage.jsx       # Member list + search + export
        │   ├── MemberDetailPage.jsx  # Full ledger editing per member
        │   ├── BatchUploadPage.jsx   # CSV/Excel upload
        │   ├── AuditLogsPage.jsx     # Action history
        │   └── ProfilePage.jsx       # Own profile + change password
        ├── components/
        │   ├── Layout.jsx            # Sidebar + topbar
        │   └── CreateMemberModal.jsx
        ├── context/
        │   └── AuthContext.jsx       # JWT auth state
        └── utils/
            └── api.js                # Axios client
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
| PORT         | 3001                                 | Server port          |
| JWT_SECRET   | yid-due-ledger-secret-key-change-in-production | **Change in prod!**  |
| CLIENT_URL   | http://localhost:5173                | CORS allowed origin  |
| NODE_ENV     | (unset)                              | Set to `production`  |
