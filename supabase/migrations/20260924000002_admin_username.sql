-- Dedicated login username for the admin (instead of email).
-- Username is stored lowercase and unique; email becomes optional because the
-- first super_admin authenticates with username + password, not an email.
begin;

alter table users add column if not exists username text;

-- Email no longer mandatory: admin bootstrap uses a dedicated username.
alter table users alter column email drop not null;

-- Unique username (nulls allowed for members who sign in with email/Smart ID).
create unique index if not exists users_username_key
  on users (username) where username is not null;

create index if not exists users_username_idx on users (username);

commit;
