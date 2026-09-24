-- ─────────────────────────────────────────────────────────────────────────────
-- YID Due Ledger — Supabase (Postgres) schema
-- Run this once in: Supabase Dashboard → SQL Editor → New query
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Regions ──────────────────────────────────────────────────────────────────
create table if not exists regions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  code       text,
  created_at timestamptz not null default now()
);

-- ── Departments ──────────────────────────────────────────────────────────────
create table if not exists departments (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  code       text,
  created_at timestamptz not null default now()
);
create index if not exists departments_code_idx on departments (code);

-- ── Users (members + admins) ─────────────────────────────────────────────────
create table if not exists users (
  id                   uuid primary key default gen_random_uuid(),
  user_id_code         text unique,             -- Smart Ledger ID, e.g. LA1-MED-1001
  full_name            text not null,
  username             text unique,             -- dedicated login handle (admin uses this)
  email                text unique,             -- optional; admin signs in with username
  password_hash        text not null,
  position             text,
  role_title           text,
  region_id            uuid references regions (id),
  dept_code            text,
  role                 text not null default 'member',  -- 'member' | 'super_admin'
  is_active            boolean not null default true,
  must_change_password boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists users_region_idx    on users (region_id);
create index if not exists users_role_idx      on users (role);
create index if not exists users_email_idx     on users (email);
create index if not exists users_idcode_idx    on users (user_id_code);

-- ── Monthly dues ─────────────────────────────────────────────────────────────
create table if not exists monthly_dues (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  due_month  int  not null check (due_month between 1 and 12),
  due_year   int  not null,
  amount     numeric(12,2) not null default 0,
  status     text not null default 'pending' check (status in ('paid','pending','arrears')),
  notes      text,
  updated_by uuid references users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, due_year, due_month)
);
create index if not exists dues_user_idx on monthly_dues (user_id, due_year desc, due_month desc);

-- ── Program pledges ──────────────────────────────────────────────────────────
create table if not exists program_pledges (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users (id) on delete cascade,
  program_name text not null,
  pledge_amount numeric(12,2) not null default 0,
  status       text not null default 'pending' check (status in ('paid','pending','arrears')),
  pledge_date  date,
  notes        text,
  updated_by   uuid references users (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists prog_pledges_user_idx on program_pledges (user_id, created_at desc);

-- ── Other pledges ────────────────────────────────────────────────────────────
create table if not exists other_pledges (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users (id) on delete cascade,
  description   text not null,
  pledge_amount numeric(12,2) not null default 0,
  status        text not null default 'pending' check (status in ('paid','pending','arrears')),
  pledge_date   date,
  notes         text,
  updated_by    uuid references users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists other_pledges_user_idx on other_pledges (user_id, created_at desc);

-- ── Audit logs ───────────────────────────────────────────────────────────────
create table if not exists audit_logs (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references users (id),
  action       text not null,
  target_table text,
  target_id    text,
  before_value text,
  after_value  text,
  created_at   timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on audit_logs (created_at desc);

-- ── Atomic counters (Smart Ledger ID serials) ────────────────────────────────
create table if not exists counters (
  name  text primary key,
  value int not null default 1000
);

create table if not exists user_id_sequences (
  region_code text not null,
  dept_code   text not null,
  year_month  text not null,        -- e.g. '202506'
  last_seq    int  not null default 0,
  primary key (region_code, dept_code, year_month)
);

-- Atomic increment for the global member serial (starts at 1000 → first = 1001).
create or replace function next_member_serial()
returns int language sql as $$
  insert into counters (name, value) values ('member_serial', 1001)
  on conflict (name) do update set value = counters.value + 1
  returning value;
$$;

-- Atomic per region/dept/month sequence for user_id_code (e.g. ...-0002).
create or replace function next_user_sequence(p_region_code text, p_dept_code text, p_year_month text)
returns int language sql as $$
  insert into user_id_sequences (region_code, dept_code, year_month, last_seq)
  values (p_region_code, p_dept_code, p_year_month, 1)
  on conflict (region_code, dept_code, year_month)
  do update set last_seq = user_id_sequences.last_seq + 1
  returning last_seq;
$$;
