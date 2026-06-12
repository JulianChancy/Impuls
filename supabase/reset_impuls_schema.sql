-- Impuls Supabase destructive reset + schema
-- WARNING: This drops existing Impuls app tables in public schema, including stored sessions/check-ins/programmes.
-- Use this only for an early/prototype Supabase project where old tables have incompatible bigint ids.
-- If you already have important production data, do not run this. Migrate the data first.

drop table if exists public.check_in_insight_history cascade;
drop table if exists public.check_ins cascade;
drop table if exists public.session_exercises cascade;
drop table if exists public.sessions cascade;
drop table if exists public.planned_exercises cascade;
drop table if exists public.planned_sessions cascade;
drop table if exists public.training_weeks cascade;
drop table if exists public.training_blocks cascade;
drop table if exists public.macro_blocks cascade;
drop table if exists public.programmes cascade;
drop table if exists public.profiles cascade;

-- Impuls Supabase schema
-- This schema adds multi-user persistence while keeping the app's current JSON-to-logic.py analysis flow intact.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- User profile metadata. The product can later expand this without changing training tables.
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  onboarding_completed boolean not null default false,
  tutorial_flags jsonb not null default '{}'::jsonb,
  pbs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_user_id_key unique (user_id)
);

comment on column public.profiles.tutorial_flags is 'Dismissed contextual tutorial hints keyed by app area.';
comment on column public.profiles.pbs is 'Flexible personal-best fields; jsonb keeps sport-specific PBs editable without changing training tables.';

-- Programme planning tables: programme -> macro blocks -> training blocks -> weeks -> planned sessions -> planned exercises.
create table if not exists public.programmes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  calendar_name text not null default 'Programme',
  selected_macro_id uuid,
  selected_block_id uuid,
  selected_week_id uuid,
  day_notes jsonb not null default '{}'::jsonb,
  copied_session jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint programmes_user_id_key unique (user_id)
);

create table if not exists public.macro_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  programme_id uuid not null references public.programmes(id) on delete cascade,
  macro_block_name text not null default '',
  start_date date,
  end_date date,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint macro_blocks_programme_position_key unique (programme_id, position)
);

create table if not exists public.training_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  macro_block_id uuid not null references public.macro_blocks(id) on delete cascade,
  block_name text not null default '',
  start_date date,
  end_date date,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_blocks_macro_position_key unique (macro_block_id, position)
);

create table if not exists public.training_weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  block_id uuid not null references public.training_blocks(id) on delete cascade,
  week_name text not null default '',
  start_date date,
  end_date date,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_weeks_block_position_key unique (block_id, position)
);

create table if not exists public.planned_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_id uuid not null references public.training_weeks(id) on delete cascade,
  date date,
  session_name text not null default '',
  focus text,
  duration text,
  notes text,
  performance_score numeric,
  performance_notes text,
  performance_logged_at timestamptz,
  completed boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planned_sessions_week_position_key unique (week_id, position)
);

create table if not exists public.planned_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  planned_session_id uuid not null references public.planned_sessions(id) on delete cascade,
  exercise_name text not null default '',
  movement_type text,
  sets numeric,
  reps numeric,
  contacts numeric,
  duration_minutes numeric,
  intensity_value numeric,
  intensity_unit text,
  intent_percent numeric,
  rom text,
  -- set_metrics stays jsonb because each exercise can store flexible set-level metrics that vary by movement type.
  set_metrics jsonb not null default '[]'::jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planned_exercises_session_position_key unique (planned_session_id, position)
);

-- Completed training tables: actual logged sessions and the exercise rows completed inside them.
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_name text not null default '',
  session_datetime timestamptz not null default now(),
  notes text,
  metric_type text,
  metrics jsonb not null default '{}'::jsonb,
  planned_session_id uuid references public.planned_sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  exercise_name text not null default '',
  movement_type text,
  sets numeric,
  reps numeric,
  contacts numeric,
  duration_minutes numeric,
  intensity_value numeric,
  intensity_unit text,
  intent_percent numeric,
  rom text,
  -- set_metrics stays jsonb because performance metrics are set-specific and app-specific.
  set_metrics jsonb not null default '[]'::jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_exercises_session_position_key unique (session_id, position)
);

-- Check-ins: daily recovery, irritation, and performance inputs consumed by logic.py.
create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  check_in_datetime timestamptz not null default now(),
  linked_session_id uuid references public.sessions(id) on delete set null,
  pain_score numeric,
  pain_location text,
  freshness_score numeric,
  soreness_score numeric,
  performance_score numeric,
  performance_type text,
  gct numeric,
  ft numeric,
  height_or_distance numeric,
  unit text,
  sprint_time numeric,
  distance numeric,
  lift_name text,
  weight numeric,
  sets numeric,
  reps numeric,
  bar_velocity numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.check_in_insight_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  check_in_id uuid references public.check_ins(id) on delete set null,
  saved_at timestamptz not null default now(),
  -- review is jsonb because the backend returns a structured, versionable insight object from logic.py.
  review jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'programmes_selected_macro_id_fkey') then
    alter table public.programmes
      add constraint programmes_selected_macro_id_fkey
      foreign key (selected_macro_id) references public.macro_blocks(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'programmes_selected_block_id_fkey') then
    alter table public.programmes
      add constraint programmes_selected_block_id_fkey
      foreign key (selected_block_id) references public.training_blocks(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'programmes_selected_week_id_fkey') then
    alter table public.programmes
      add constraint programmes_selected_week_id_fkey
      foreign key (selected_week_id) references public.training_weeks(id) on delete set null;
  end if;
end $$;

create index if not exists idx_profiles_user_id on public.profiles(user_id);
create index if not exists idx_programmes_user_id on public.programmes(user_id);
create index if not exists idx_programmes_selected_macro_id on public.programmes(selected_macro_id);
create index if not exists idx_programmes_selected_block_id on public.programmes(selected_block_id);
create index if not exists idx_programmes_selected_week_id on public.programmes(selected_week_id);

create index if not exists idx_macro_blocks_user_id on public.macro_blocks(user_id);
create index if not exists idx_macro_blocks_programme_id on public.macro_blocks(programme_id);
create index if not exists idx_macro_blocks_start_date on public.macro_blocks(start_date);

create index if not exists idx_training_blocks_user_id on public.training_blocks(user_id);
create index if not exists idx_training_blocks_macro_block_id on public.training_blocks(macro_block_id);
create index if not exists idx_training_blocks_start_date on public.training_blocks(start_date);

create index if not exists idx_training_weeks_user_id on public.training_weeks(user_id);
create index if not exists idx_training_weeks_block_id on public.training_weeks(block_id);
create index if not exists idx_training_weeks_start_date on public.training_weeks(start_date);

create index if not exists idx_planned_sessions_user_id on public.planned_sessions(user_id);
create index if not exists idx_planned_sessions_week_id on public.planned_sessions(week_id);
create index if not exists idx_planned_sessions_date on public.planned_sessions(date);

create index if not exists idx_planned_exercises_user_id on public.planned_exercises(user_id);
create index if not exists idx_planned_exercises_planned_session_id on public.planned_exercises(planned_session_id);

create index if not exists idx_sessions_user_id on public.sessions(user_id);
create index if not exists idx_sessions_planned_session_id on public.sessions(planned_session_id);
create index if not exists idx_sessions_session_datetime on public.sessions(session_datetime);
create index if not exists idx_sessions_user_datetime on public.sessions(user_id, session_datetime);

create index if not exists idx_session_exercises_user_id on public.session_exercises(user_id);
create index if not exists idx_session_exercises_session_id on public.session_exercises(session_id);

create index if not exists idx_check_ins_user_id on public.check_ins(user_id);
create index if not exists idx_check_ins_linked_session_id on public.check_ins(linked_session_id);
create index if not exists idx_check_ins_check_in_datetime on public.check_ins(check_in_datetime);
create index if not exists idx_check_ins_user_datetime on public.check_ins(user_id, check_in_datetime);

create index if not exists idx_check_in_insight_history_user_id on public.check_in_insight_history(user_id);
create index if not exists idx_check_in_insight_history_check_in_id on public.check_in_insight_history(check_in_id);
create index if not exists idx_check_in_insight_history_saved_at on public.check_in_insight_history(saved_at);

alter table public.profiles enable row level security;
alter table public.programmes enable row level security;
alter table public.macro_blocks enable row level security;
alter table public.training_blocks enable row level security;
alter table public.training_weeks enable row level security;
alter table public.planned_sessions enable row level security;
alter table public.planned_exercises enable row level security;
alter table public.sessions enable row level security;
alter table public.session_exercises enable row level security;
alter table public.check_ins enable row level security;
alter table public.check_in_insight_history enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'programmes',
    'macro_blocks',
    'training_blocks',
    'training_weeks',
    'planned_sessions',
    'planned_exercises',
    'sessions',
    'session_exercises',
    'check_ins',
    'check_in_insight_history'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_own_rows_select', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_own_rows_insert', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_own_rows_update', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_own_rows_delete', table_name);

    execute format('create policy %I on public.%I for select using (auth.uid() = user_id)', table_name || '_own_rows_select', table_name);
    execute format('create policy %I on public.%I for insert with check (auth.uid() = user_id)', table_name || '_own_rows_insert', table_name);
    execute format('create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', table_name || '_own_rows_update', table_name);
    execute format('create policy %I on public.%I for delete using (auth.uid() = user_id)', table_name || '_own_rows_delete', table_name);
  end loop;
end $$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

drop trigger if exists set_programmes_updated_at on public.programmes;
create trigger set_programmes_updated_at before update on public.programmes for each row execute function public.set_updated_at();

drop trigger if exists set_macro_blocks_updated_at on public.macro_blocks;
create trigger set_macro_blocks_updated_at before update on public.macro_blocks for each row execute function public.set_updated_at();

drop trigger if exists set_training_blocks_updated_at on public.training_blocks;
create trigger set_training_blocks_updated_at before update on public.training_blocks for each row execute function public.set_updated_at();

drop trigger if exists set_training_weeks_updated_at on public.training_weeks;
create trigger set_training_weeks_updated_at before update on public.training_weeks for each row execute function public.set_updated_at();

drop trigger if exists set_planned_sessions_updated_at on public.planned_sessions;
create trigger set_planned_sessions_updated_at before update on public.planned_sessions for each row execute function public.set_updated_at();

drop trigger if exists set_planned_exercises_updated_at on public.planned_exercises;
create trigger set_planned_exercises_updated_at before update on public.planned_exercises for each row execute function public.set_updated_at();

drop trigger if exists set_sessions_updated_at on public.sessions;
create trigger set_sessions_updated_at before update on public.sessions for each row execute function public.set_updated_at();

drop trigger if exists set_session_exercises_updated_at on public.session_exercises;
create trigger set_session_exercises_updated_at before update on public.session_exercises for each row execute function public.set_updated_at();

drop trigger if exists set_check_ins_updated_at on public.check_ins;
create trigger set_check_ins_updated_at before update on public.check_ins for each row execute function public.set_updated_at();

drop trigger if exists set_check_in_insight_history_updated_at on public.check_in_insight_history;
create trigger set_check_in_insight_history_updated_at before update on public.check_in_insight_history for each row execute function public.set_updated_at();
