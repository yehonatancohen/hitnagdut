-- Run this in the Supabase SQL editor to set up the schema.

create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  clerk_id    text unique not null,
  email       text,
  name        text,
  role        text not null default 'user',   -- 'user' | 'admin'
  is_blocked  boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists user_credits (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references users(id) on delete cascade,
  credits_remaining  integer not null default 0,
  updated_at         timestamptz not null default now(),
  unique(user_id)
);

create table if not exists purchases (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  plan             text not null,  -- 'single' | 'bundle_10' | 'monthly_50'
  credits_added    integer not null,
  price_ils        integer not null,
  created_at       timestamptz not null default now()
);

create table if not exists jobs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  file_names    text[] not null default '{}',
  file_count    integer not null default 0,
  clause_count  integer not null default 0,
  result_json   jsonb not null,
  status        text not null default 'completed'
);

-- Indexes for fast lookups
create index if not exists idx_users_clerk_id      on users(clerk_id);
create index if not exists idx_user_credits_user   on user_credits(user_id);
create index if not exists idx_jobs_user_created   on jobs(user_id, created_at desc);
create index if not exists idx_purchases_user      on purchases(user_id);

-- Referral program: each user gets a shareable code; referred_by tracks who
-- invited them so the inviter can be credited exactly once.
alter table users add column if not exists referral_code text;
alter table users add column if not exists referred_by uuid references users(id);
create unique index if not exists idx_users_referral_code on users(referral_code) where referral_code is not null;
