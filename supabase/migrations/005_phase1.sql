-- Phase 1 (applied as migrations 005_phase1 + 006_fix_refresh_auth; consolidated final state)
alter table students add column avatar_path text;
revoke update on students from authenticated;
grant update (avatar_path) on students to authenticated;
create policy student_upd on students for update using (id = my_student()) with check (id = my_student());

drop policy student_upd on study_sessions;
drop policy student_ins on study_sessions;
create policy student_ins on study_sessions for insert with check (
  family_id = my_family() and student_id = my_student()
  and ended_at is null and duration_sec is null and started_at >= now() - interval '2 minutes');

create unique index badges_global_code on badges(code) where family_id is null;
insert into badges (family_id, code, title, description) values
 (null,'first_homework','أول واجب منجز','أنجزت أول واجب لك'),
 (null,'first_hour','أول ساعة مذاكرة','أكملت ساعة مذاكرة إجمالية'),
 (null,'streak_7','سلسلة 7 أيام','ذاكرت 7 أيام متتالية'),
 (null,'subject_complete','إنهاء مادة','أنهيت كل دروس إحدى المواد');

create function award_achievements(p_student uuid) returns text[]
language plpgsql security definer set search_path=public as $$
declare fam uuid; got text[] := '{}'; r record; ok boolean;
begin
  select family_id into fam from students where id = p_student;
  if fam is null then return got; end if;
  for r in select id, code, title from badges where family_id is null loop
    if exists (select 1 from student_badges where student_id = p_student and badge_id = r.id) then continue; end if;
    ok := case r.code
      when 'first_homework' then exists (select 1 from homework where student_id = p_student and status = 'done')
      when 'first_hour' then coalesce((select sum(duration_sec) from study_sessions where student_id = p_student and ended_at is not null), 0) >= 3600
      when 'streak_7' then coalesce((
          select max(c) from (
            select count(*) c, max(d) mx from (
              select d, d - (row_number() over (order by d))::int g from (
                select distinct (started_at at time zone 'Africa/Cairo')::date d from study_sessions
                where student_id = p_student and ended_at is not null and duration_sec >= 300) x) y
            group by g) z
          where mx >= (now() at time zone 'Africa/Cairo')::date - 1), 0) >= 7
      when 'subject_complete' then exists (select 1 from lessons where student_id = p_student group by subject_id having bool_and(status = 'done'))
      else false end;
    if ok then
      insert into student_badges (family_id, student_id, badge_id) values (fam, p_student, r.id) on conflict do nothing;
      got := got || r.title;
    end if;
  end loop;
  return got;
end $$;

create function refresh_achievements(p_student uuid) returns text[]
language plpgsql security definer set search_path=public as $$
begin
  if not coalesce(
       p_student = my_student()
       or (is_parent() and exists (select 1 from students where id = p_student and family_id = my_family())),
       false) then
    raise exception 'not allowed';
  end if;
  return award_achievements(p_student);
end $$;

create function finish_study_session(p_session uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare s study_sessions; sec int; pts int; got text[];
begin
  select * into s from study_sessions where id = p_session and student_id = my_student() and ended_at is null for update;
  if not found then raise exception 'session not found'; end if;
  sec := least(extract(epoch from now() - s.started_at)::int, 14400);
  update study_sessions set ended_at = now(), duration_sec = sec where id = s.id;
  pts := least(sec / 300, 24);   -- 1 point per full 5 minutes, max 24 per session
  if pts > 0 then
    insert into points_ledger (family_id, student_id, delta, reason, ref_table, ref_id)
    values (s.family_id, s.student_id, pts, 'جلسة مذاكرة', 'study_sessions', s.id);
  end if;
  got := award_achievements(s.student_id);
  return jsonb_build_object('seconds', sec, 'points', pts, 'badges', to_jsonb(got));
end $$;

revoke all on function award_achievements(uuid), refresh_achievements(uuid), finish_study_session(uuid) from public, anon, authenticated;
grant execute on function refresh_achievements(uuid), finish_study_session(uuid) to authenticated;
