-- Relay: Supabase schema
-- Run this once in the Supabase SQL editor (or via `supabase db push`) before
-- setting SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in your deployment.
--
-- Timestamps are stored as bigint epoch-milliseconds (not timestamptz) to
-- match the existing app's Date.now()-based data model exactly, so no
-- conversion logic is needed anywhere else in the codebase.
--
-- Row Level Security is enabled on every table below with NO policies. The
-- app only ever talks to Supabase server-side using the service_role key
-- (see app/lib/data/supabase-client.ts), which bypasses RLS entirely - so
-- this has zero effect on the app itself. What it does do: fully lock out
-- the public anon/authenticated API keys from reading or writing any of
-- this data (including plus_users' password hashes) if those keys were
-- ever exposed client-side, now or in the future.

-- gen_random_uuid() is a Postgres 13+ built-in (no pgcrypto extension needed).

-- Upload history (both anonymous "public" uploads and Plus-account uploads
-- live in the same table, distinguished by `scope`).
create table if not exists upload_records (
  id bigint generated always as identity primary key,
  scope text not null check (scope in ('public', 'plus')),
  url text not null,
  filename text not null,
  size bigint not null default 0,
  created_at bigint not null,
  last_access_time bigint not null,
  expires_at bigint not null,
  ip text,
  owner_id text,
  owner_email text,
  folder text,
  tags text[],
  favorite boolean,
  display_name text,
  updated_at bigint,
  unique (scope, url)
);
create index if not exists idx_upload_records_scope on upload_records (scope);
create index if not exists idx_upload_records_owner on upload_records (owner_id);
create index if not exists idx_upload_records_folder on upload_records (folder);
create index if not exists idx_upload_records_last_access on upload_records (last_access_time);
alter table upload_records enable row level security;

-- Folders (flat, shared list used to organize uploads).
create table if not exists folders (
  id text primary key,
  name text not null,
  created_at bigint not null,
  updated_at bigint,
  share_code text unique
);
alter table folders enable row level security;

-- Files created through the rootz-compatible /api/files/* API.
create table if not exists api_files (
  id uuid primary key default gen_random_uuid(),
  short_id text unique not null,
  object_key text not null,
  name text not null,
  size bigint not null default 0,
  mime_type text,
  folder_id text,
  owner_id text,
  is_anonymous boolean not null default true,
  deletion_token text,
  created_at bigint not null,
  expires_at bigint,
  download_count integer not null default 0
);
create index if not exists idx_api_files_owner on api_files (owner_id);
create index if not exists idx_api_files_short_id on api_files (short_id);
create index if not exists idx_api_files_folder on api_files (folder_id);
alter table api_files enable row level security;

-- Plus accounts.
create table if not exists plus_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  salt text not null,
  created_at bigint not null,
  last_login_at bigint
);
alter table plus_users enable row level security;

-- Plus signup invites. Used invites are kept (not deleted) with used_at set,
-- so a presented token can never be replayed even after use.
create table if not exists plus_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null,
  created_at bigint not null,
  expires_at bigint not null,
  used_at bigint,
  used_by_user_id uuid references plus_users(id) on delete set null
);
create index if not exists idx_plus_invites_token on plus_invites (token);
alter table plus_invites enable row level security;

-- Plus login sessions.
create table if not exists plus_sessions (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  user_id uuid not null references plus_users(id) on delete cascade,
  created_at bigint not null,
  expires_at bigint not null
);
create index if not exists idx_plus_sessions_token on plus_sessions (token);
create index if not exists idx_plus_sessions_user on plus_sessions (user_id);
alter table plus_sessions enable row level security;
