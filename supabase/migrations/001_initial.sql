-- Life App Database Schema
-- Run this in your Supabase SQL Editor

-- Profile (single user, id = 1)
create table if not exists public.profile (
  id integer primary key default 1,
  name text not null default 'User',
  age integer,
  values text[] default '{}',
  struggles text[] default '{}',
  ideal_self text default '',
  weight_unit text default 'lbs',
  currency text default 'USD',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Goals
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null default 'personal',
  target_date date,
  status text not null default 'active',
  progress integer default 0,
  milestones jsonb default '[]',
  created_at timestamptz default now()
);

-- Habits
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null default 'build',
  category text default 'personal',
  frequency text default 'daily',
  streak integer default 0,
  best_streak integer default 0,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid references public.habits(id) on delete cascade,
  date date not null,
  completed boolean default false,
  notes text,
  unique(habit_id, date)
);

-- Daily Check-ins
create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  date date unique not null,
  mood integer not null,
  energy integer not null,
  stress integer not null,
  notes text
);

-- Meals
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  meal_type text not null,
  description text not null,
  calories integer,
  protein numeric,
  carbs numeric,
  fats numeric,
  created_at timestamptz default now()
);

-- Water Logs
create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  amount integer not null,
  logged_at timestamptz default now()
);

-- Sleep Logs
create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  date date unique not null,
  bedtime text not null,
  wake_time text not null,
  quality integer not null,
  notes text
);

-- Exercise Logs
create table if not exists public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  type text not null,
  duration integer not null,
  intensity text not null,
  notes text,
  created_at timestamptz default now()
);

-- Body Metrics
create table if not exists public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  date date unique not null,
  weight numeric,
  notes text
);

-- Income
create table if not exists public.income (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  amount numeric not null,
  category text not null,
  description text not null,
  recurring boolean default false,
  created_at timestamptz default now()
);

-- Expenses
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  amount numeric not null,
  category text not null,
  description text not null,
  recurring boolean default false,
  created_at timestamptz default now()
);

-- Savings Goals
create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  target_amount numeric not null,
  current_amount numeric default 0,
  target_date date,
  created_at timestamptz default now()
);

-- Journal Entries
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  type text not null,
  title text,
  content text not null,
  tags text[] default '{}',
  created_at timestamptz default now()
);

-- Routines
create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  steps jsonb default '[]',
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.routine_logs (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid references public.routines(id) on delete cascade,
  date date not null,
  completed_steps text[] default '{}',
  unique(routine_id, date)
);

-- Learning Items
create table if not exists public.learning_items (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  author text,
  status text not null default 'want',
  progress integer default 0,
  notes text,
  started_at date,
  completed_at date,
  created_at timestamptz default now()
);

-- Relationships
create table if not exists public.relationships (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  importance integer default 3,
  last_contact date,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.relationship_logs (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid references public.relationships(id) on delete cascade,
  date date not null,
  type text not null,
  notes text,
  created_at timestamptz default now()
);

-- Grant anon access (single-user app, no auth needed)
grant usage on schema public to anon;
grant all on all tables in schema public to anon;
grant all on all sequences in schema public to anon;
