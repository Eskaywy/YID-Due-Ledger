-- ─────────────────────────────────────────────────────────────────────────────
-- YISD-DUE-LEDGER — Sprint 1 foundation migration
-- Idempotent. Adds: 3-letter unique code constraints for regions/departments,
-- canonical region seed (LAG/SWE/NOR/SEA/SST), first_name/surname on users,
-- a public events table (landing countdown), updated_at triggers, indexes and
-- Row-Level Security. Run in Supabase SQL Editor or `supabase db push`.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- ── 1. Regions: 3-letter unique code + canonical seed ────────────────────────
alter table if exists regions add column if not exists code text;
alter table if exists regions add column if not exists updated_at timestamptz not null default now();
drop index if exists regions_code_idx;

update regions
   set code = upper(regexp_replace(coalesce(code, name), '[^A-Za-z0-9]', '', 'g'))
 where code is null or code ~ '[^A-Z0-9]';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'regions_code_key' and conrelid = 'public.regions'::regclass
  ) then
    alter table public.regions add constraint regions_code_key unique (code);
  end if;
exception when duplicate_table then null; when unique_violation then null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'regions_code_shape' and conrelid = 'public.regions'::regclass
  ) then
    alter table public.regions add constraint regions_code_shape
      check (code is null or code ~ '^[A-Z0-9]{2,3}$');
  end if;
end $$;

insert into regions (name, code) values
  ('Lagos', 'LAG'),
  ('South-West', 'SWE'),
  ('North', 'NOR'),
  ('South-East', 'SEA'),
  ('South-South', 'SST')
on conflict (code) do update set name = excluded.name;

-- ── 2. Departments: 3-letter unique code ─────────────────────────────────────
alter table if exists departments add column if not exists updated_at timestamptz not null default now();
drop index if exists departments_code_idx;

update departments
   set code = upper(regexp_replace(coalesce(code, name), '[^A-Za-z]', '', 'g'))
 where code is null or code ~ '[^A-Z]';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'departments_code_key' and conrelid = 'public.departments'::regclass
  ) then
    alter table public.departments add constraint departments_code_key unique (code);
  end if;
exception when duplicate_table then null; when unique_violation then null;
end $$;

insert into departments (name, code) values
  ('Information', 'INF'),
  ('Media', 'MED')
on conflict (code) do update set name = excluded.name;

-- ── 3. Users: first_name / surname for the onboarding form ───────────────────
alter table if exists users add column if not exists first_name text;
alter table if exists users add column if not exists surname text;
alter table if exists users add column if not exists department_id uuid references departments (id);
alter table if exists users add column if not exists id_format_version int not null default 2;
alter table if exists users add column if not exists archived_at timestamptz;

update users
   set first_name = split_part(full_name, ' ', 1),
       surname    = nullif(trim(both ' ' from substr(full_name, length(split_part(full_name, ' ', 1)) + 1)), '')
 where (first_name is null or surname is null) and full_name is not null;

update users u
   set department_id = d.id
  from departments d
 where u.department_id is null and u.dept_code = d.code;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'users_role_check' and conrelid = 'public.users'::regclass
  ) then
    alter table public.users add constraint users_role_check
      check (role in ('member', 'super_admin'));
  end if;
end $$;

create index if not exists users_department_idx on users (department_id);

-- ── 4. Public events table (landing page + countdown) ────────────────────────
create table if not exists events (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique,
  title        text not null,
  description  text,
  venue        text,
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  timezone     text not null default 'Africa/Lagos',
  poster_url   text,
  is_featured  boolean not null default false,
  is_published boolean not null default true,
  created_by   uuid references users (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists events_upcoming_idx on events (starts_at) where is_published;

-- ── 5. Shared updated_at trigger ─────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['regions', 'departments', 'users', 'events']
  loop
    if not exists (
      select 1 from pg_trigger
      where tgname = t || '_updated_at_trg' and tgrelid = ('public.' || t)::regclass
    ) then
      execute format(
        'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
        t || '_updated_at_trg', t
      );
    end if;
  end loop;
end $$;


-- ── 6. Row-Level Security: defence in depth ──────────────────────────────────
-- The Node backend uses the service-role key (bypasses RLS). We enable RLS on
-- every ledger table and revoke blanket grants from the anon/authenticated API
-- roles, so the public Data API cannot read or write ledger data directly.
-- The signup form only needs read access to the two dropdown tables.
do $$
declare t text;
begin
  foreach t in array array['regions', 'departments', 'users', 'monthly_dues',
                           'program_pledges', 'other_pledges', 'audit_logs',
                           'counters', 'user_id_sequences', 'events']
  loop
    begin
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on public.%I from anon, authenticated', t);
    exception when undefined_table then null;
               when invalid_grant_operation then null;
    end;
  end loop;
end $$;

-- Read-only exception: signup needs the region + department lists pre-auth.
grant select on public.regions, public.departments to anon, authenticated;

-- Final index (kept inside the transaction).
create index if not exists users_active_role_idx on users (is_active, role);

commit;

