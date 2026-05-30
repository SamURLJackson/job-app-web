-- ─── Job Agent Web — Supabase Schema ─────────────────────────────────────────
-- Run this in your Supabase project: SQL Editor → New Query → paste & run

-- Users table
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  email       text unique not null,
  name        text,
  avatar_url  text,
  onboarded   boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- User settings / job search configuration
create table if not exists user_settings (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references users(id) on delete cascade unique not null,
  -- Job search
  job_titles      text[] default array['IT Manager', 'Systems Engineer', 'Systems Administrator'],
  salary_floor    integer default 110000,
  score_threshold integer default 7,
  location        text default 'Salt Lake City, UT',
  location_radius integer default 50,   -- miles
  remote_only     boolean default true,
  -- Skills (plain text, used in Claude prompt)
  skills_text     text,
  -- Resume
  resume_filename text,
  resume_url      text,   -- Supabase Storage public URL
  resume_text     text,   -- Plain text version for Claude scoring
  -- Sender info
  your_name       text,
  your_email      text,
  -- Platform account warnings acknowledged
  linkedin_warned boolean default false,
  indeed_warned   boolean default false,
  dice_warned     boolean default false,
  builtin_warned  boolean default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Pipeline runs
create table if not exists pipeline_runs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references users(id) on delete cascade not null,
  github_run_id   bigint,                -- GitHub Actions run ID for status polling
  status          text default 'pending', -- pending | running | complete | failed
  jobs_fetched    integer default 0,
  jobs_qualified  integer default 0,
  emails_sent     integer default 0,
  queued_count    integer default 0,
  error_message   text,
  started_at      timestamptz default now(),
  completed_at    timestamptz
);

-- Job queue (qualified jobs)
create table if not exists job_queue (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references users(id) on delete cascade not null,
  run_id          uuid references pipeline_runs(id) on delete set null,
  -- Job info
  title           text not null,
  company         text,
  url             text,
  source          text,
  salary_note     text,
  -- Scoring
  score           integer,
  score_reason    text,
  -- Application
  is_email_apply  boolean default false,
  apply_email     text,
  cover_letter    text,
  -- Status
  status          text default 'pending',  -- pending | applied | skipped
  applied_at      timestamptz,
  notes           text,
  created_at      timestamptz default now()
);

-- ─── Row Level Security ────────────────────────────────────────────────────────

alter table users enable row level security;
alter table user_settings enable row level security;
alter table pipeline_runs enable row level security;
alter table job_queue enable row level security;

-- Users can only see/edit their own data
-- (Service role key bypasses RLS — used server-side only)

create policy "users_own" on users for all using (auth.uid()::text = id::text);
create policy "settings_own" on user_settings for all using (
  user_id in (select id from users where email = auth.jwt() ->> 'email')
);
create policy "runs_own" on pipeline_runs for all using (
  user_id in (select id from users where email = auth.jwt() ->> 'email')
);
create policy "queue_own" on job_queue for all using (
  user_id in (select id from users where email = auth.jwt() ->> 'email')
);

-- ─── Storage bucket for resumes ───────────────────────────────────────────────
-- Run in Supabase Dashboard → Storage → New Bucket
-- Name: resumes
-- Public: false
-- After creating, add this policy:
-- Allow authenticated users to manage their own folder: resumes/{user_id}/*
