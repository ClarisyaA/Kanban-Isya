-- Jalankan sekali di Supabase -> SQL Editor (alternatif dari `npm run db:push`).

-- ---------- Better Auth ----------
create table if not exists "user" (
  id text primary key,
  name text not null,
  email text not null unique,
  email_verified boolean not null default false,
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists "session" (
  id text primary key,
  expires_at timestamptz not null,
  token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  user_id text not null references "user"(id) on delete cascade
);

create table if not exists "account" (
  id text primary key,
  account_id text not null,
  provider_id text not null,
  user_id text not null references "user"(id) on delete cascade,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists "verification" (
  id text primary key,
  identifier text not null,
  value text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- App ----------
create table if not exists project (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user"(id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists project_user_idx on project(user_id);

create table if not exists board_column (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references project(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists board_column_project_idx on board_column(project_id);

create table if not exists task (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references project(id) on delete cascade,
  column_id uuid not null references board_column(id) on delete cascade,
  title text not null,
  description text not null default '',
  priority text not null default 'medium',
  start_date date,
  due_date date,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists task_project_idx on task(project_id);
create index if not exists task_column_idx on task(column_id);

-- App mengakses DB lewat koneksi Postgres langsung (bukan Supabase REST API).
-- Aktifkan RLS tanpa policy supaya tabel tidak bisa dibaca lewat anon key.
alter table "user" enable row level security;
alter table "session" enable row level security;
alter table "account" enable row level security;
alter table "verification" enable row level security;
alter table project enable row level security;
alter table board_column enable row level security;
alter table task enable row level security;
