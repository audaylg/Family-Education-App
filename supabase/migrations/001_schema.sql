-- Smart Family Education Manager: schema + RLS (as applied to Supabase project gzdlkmhcgdjuqsawuwnt)
create extension if not exists pgcrypto;

create type user_role as enum ('parent','student');
create type task_status as enum ('pending','in_progress','done','missed');
create type q_type as enum ('mcq','true_false','short','essay');

create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  family_id uuid not null references families on delete cascade,
  role user_role not null,
  full_name text not null,
  created_at timestamptz default now()
);
create table students (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  user_id uuid unique references profiles on delete set null,
  name text not null,
  grade smallint not null default 10,
  points_balance int not null default 0,
  level int not null default 1,
  created_at timestamptz default now()
);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  student_id uuid not null references students on delete cascade,
  name text not null, color text default '#2563eb',
  is_weak boolean default false, priority smallint default 3
);
create table lessons (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  student_id uuid not null references students on delete cascade,
  subject_id uuid not null references subjects on delete cascade,
  title text not null, unit text, status task_status default 'pending',
  completed_at timestamptz
);
create table schedule_entries (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  student_id uuid not null references students on delete cascade,
  subject_id uuid references subjects on delete set null,
  kind text not null check (kind in ('school','study','revision','homework','break')),
  weekday smallint check (weekday between 0 and 6),
  on_date date, start_time time not null, end_time time not null,
  status task_status default 'pending', auto_generated boolean default false
);
create table study_sessions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  student_id uuid not null references students on delete cascade,
  subject_id uuid references subjects on delete set null,
  lesson_id uuid references lessons on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz, duration_sec int
);
create table homework (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  student_id uuid not null references students on delete cascade,
  subject_id uuid references subjects on delete set null,
  title text not null, details text, due_date date not null,
  status task_status default 'pending', completed_at timestamptz
);
create table exams (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  student_id uuid not null references students on delete cascade,
  subject_id uuid references subjects on delete set null,
  title text not null, exam_date timestamptz not null, max_score numeric
);
create table grades (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  student_id uuid not null references students on delete cascade,
  subject_id uuid not null references subjects on delete cascade,
  exam_id uuid references exams on delete set null,
  score numeric not null, max_score numeric not null check (max_score > 0),
  recorded_on date default current_date, note text
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  student_id uuid references students on delete cascade,
  subject_id uuid references subjects on delete set null,
  title text not null, storage_path text not null,
  extracted_text text, content_hash text, created_at timestamptz default now()
);
create table quizzes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  student_id uuid not null references students on delete cascade,
  subject_id uuid references subjects on delete set null,
  document_id uuid references documents on delete set null,
  kind text default 'practice' check (kind in ('practice','weekly','exam_prep')),
  title text not null, created_at timestamptz default now()
);
create table quiz_questions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  quiz_id uuid not null references quizzes on delete cascade,
  type q_type not null, prompt text not null,
  options jsonb, source_excerpt text
);
create table quiz_answer_keys (
  question_id uuid primary key references quiz_questions on delete cascade,
  family_id uuid not null references families on delete cascade,
  correct_answer text, rubric text, explanation text
);
create table quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  student_id uuid not null references students on delete cascade,
  quiz_id uuid not null references quizzes on delete cascade,
  score numeric, max_score numeric, submitted_at timestamptz default now()
);
create table quiz_answers (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  attempt_id uuid not null references quiz_attempts on delete cascade,
  question_id uuid not null references quiz_questions on delete cascade,
  answer text, is_correct boolean, graded_by text check (graded_by in ('auto','ai','parent')),
  feedback text
);
create table ai_cache (
  cache_key text primary key,
  family_id uuid not null references families on delete cascade,
  payload jsonb not null, created_at timestamptz default now()
);

create table reward_rules (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  event text not null check (event in ('study_minutes','homework_done','quiz_score','exam_grade','streak')),
  points int not null, threshold numeric, active boolean default true
);
create table rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  title text not null, cost int not null check (cost > 0), active boolean default true
);
create table points_ledger (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  student_id uuid not null references students on delete cascade,
  delta int not null, reason text not null, ref_table text, ref_id uuid,
  created_at timestamptz default now()
);
create table redemptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  student_id uuid not null references students on delete cascade,
  reward_id uuid not null references rewards on delete restrict,
  status text default 'requested' check (status in ('requested','approved','rejected','delivered')),
  created_at timestamptz default now()
);
create table badges (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families on delete cascade,
  code text not null, title text not null, description text
);
create table student_badges (
  family_id uuid not null references families on delete cascade,
  student_id uuid not null references students on delete cascade,
  badge_id uuid not null references badges on delete cascade,
  earned_at timestamptz default now(), primary key (student_id, badge_id)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  student_id uuid references students on delete cascade,
  channel text not null check (channel in ('in_app','email','telegram')),
  title text not null, body text,
  delivery_status text not null default 'pending' check (delivery_status in ('pending','sent','failed','skipped')),
  delivery_error text, sent_at timestamptz, created_at timestamptz default now()
);
create table reports (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  student_id uuid not null references students on delete cascade,
  period text not null check (period in ('daily','weekly')),
  period_start date not null, data jsonb not null, created_at timestamptz default now(),
  unique (student_id, period, period_start)
);

create index on study_sessions (student_id, started_at desc);
create index on homework (student_id, due_date) where status <> 'done';
create index on exams (student_id, exam_date);
create index on grades (student_id, subject_id, recorded_on);
create index on schedule_entries (student_id, on_date, weekday);
create index on points_ledger (student_id, created_at desc);
create index on notifications (family_id, created_at desc);
create index on students (family_id);
create index on profiles (family_id);
create index on subjects (student_id);
create index on lessons (student_id, subject_id);
create index on quiz_questions (quiz_id);
create index on quiz_attempts (student_id, quiz_id);
create index on quiz_answers (attempt_id);

create function apply_points() returns trigger language plpgsql security definer set search_path=public as $$
begin
  update students set points_balance = points_balance + new.delta,
         level = greatest(1, 1 + (points_balance + new.delta) / 500)
   where id = new.student_id;
  return new;
end $$;
create trigger trg_points after insert on points_ledger
  for each row execute function apply_points();

create function my_family() returns uuid language sql stable security definer set search_path=public as
$$ select family_id from profiles where id = auth.uid() $$;
create function is_parent() returns boolean language sql stable security definer set search_path=public as
$$ select exists(select 1 from profiles where id = auth.uid() and role='parent') $$;
create function my_student() returns uuid language sql stable security definer set search_path=public as
$$ select id from students where user_id = auth.uid() $$;
revoke execute on function my_family(), is_parent(), my_student(), apply_points() from public, anon;
grant execute on function my_family(), is_parent(), my_student() to authenticated;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('alter table %I enable row level security', t);
  end loop;

  for t in select table_name from information_schema.columns
           where table_schema='public' and column_name='family_id'
             and table_name not in ('families','profiles','badges','quiz_answer_keys','points_ledger') loop
    execute format('create policy parent_all on %I for all
      using (is_parent() and family_id = my_family())
      with check (is_parent() and family_id = my_family())', t);
  end loop;

  for t in select unnest(array['subjects','lessons','schedule_entries','study_sessions','homework',
      'exams','grades','quizzes','quiz_attempts','redemptions','notifications',
      'reports','student_badges','points_ledger','documents']) loop
    execute format('create policy student_read on %I for select
      using (family_id = my_family() and student_id = my_student())', t);
  end loop;
end $$;

create policy student_read on students for select using (id = my_student());
create policy student_read on quiz_answers for select using (
  family_id = my_family() and attempt_id in (select id from quiz_attempts where student_id = my_student()));
create policy student_read on quiz_questions for select using (
  family_id = my_family() and quiz_id in (select id from quizzes where student_id = my_student()));
create policy student_read on rewards for select using (family_id = my_family() and active);
create policy student_read on reward_rules for select using (family_id = my_family());

create policy student_ins on study_sessions for insert with check (family_id = my_family() and student_id = my_student());
create policy student_upd on study_sessions for update using (family_id = my_family() and student_id = my_student());
create policy student_upd on homework for update using (family_id = my_family() and student_id = my_student());
create policy student_upd on schedule_entries for update using (family_id = my_family() and student_id = my_student());
create policy student_upd on lessons for update using (family_id = my_family() and student_id = my_student());
create policy student_req on redemptions for insert with check (
  family_id = my_family() and student_id = my_student() and status = 'requested');

create policy parent_read on points_ledger for select using (is_parent() and family_id = my_family());
create policy parent_adjust on points_ledger for insert with check (is_parent() and family_id = my_family());
create policy parent_read on quiz_answer_keys for select using (is_parent() and family_id = my_family());

create policy fam_read on families for select using (id = my_family());
create policy prof_read on profiles for select using (family_id = my_family());
create policy badge_read on badges for select using (family_id is null or family_id = my_family());
create policy badge_parent on badges for all using (is_parent() and family_id = my_family())
  with check (is_parent() and family_id = my_family());
