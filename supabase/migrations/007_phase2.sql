-- Phase 2 (applied as migration 007_phase2)
alter table homework
  add column kind text not null default 'homework' check (kind in ('homework','project')),
  add column review_status text check (review_status in ('pending','approved','rejected')),
  add column reviewed_at timestamptz,
  add column review_note text;

alter table notifications
  add column audience text not null default 'parent' check (audience in ('parent','student')),
  add column read_at timestamptz,
  add column dedupe_key text;
create unique index notif_dedupe on notifications(dedupe_key) where dedupe_key is not null;
create index on notifications (family_id, audience, created_at desc);
drop policy student_read on notifications;
create policy student_read on notifications for select using (family_id = my_family() and student_id = my_student() and audience = 'student');
create policy student_upd on notifications for update using (family_id = my_family() and student_id = my_student() and audience = 'student');
revoke update on notifications from authenticated;
grant update (read_at) on notifications to authenticated;

create function notify(p_family uuid, p_student uuid, p_audience text, p_title text, p_body text, p_key text default null)
returns void language sql security definer set search_path=public as $$
  insert into notifications (family_id, student_id, channel, audience, title, body, delivery_status, sent_at, dedupe_key)
  values (p_family, p_student, 'in_app', p_audience, p_title, p_body, 'sent', now(), p_key) on conflict do nothing $$;
revoke all on function notify(uuid,uuid,text,text,text,text) from public, anon, authenticated;

create function homework_guard() returns trigger language plpgsql as $$
begin
  if is_parent() then
    if tg_op = 'UPDATE' and new.review_status in ('approved','rejected') and new.review_status is distinct from old.review_status then
      new.reviewed_at := now();
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.review_status := case when new.photo_path is not null then 'pending' end;
    new.reviewed_at := null; new.review_note := null;
  else
    new.reviewed_at := old.reviewed_at; new.review_note := old.review_note;
    new.review_status := case when new.photo_path is not null and new.photo_path is distinct from old.photo_path then 'pending' else old.review_status end;
  end if;
  return new;
end $$;

create function homework_notify() returns trigger language plpgsql security definer set search_path=public as $$
declare nm text;
begin
  select name into nm from students where id = new.student_id;
  if tg_op = 'INSERT' then
    if is_parent() then
      perform notify(new.family_id, new.student_id, 'student', '📝 واجب جديد', new.title);
    elsif new.photo_path is null then
      perform notify(new.family_id, new.student_id, 'parent', '📝 ' || nm || ' أضاف ' || case new.kind when 'project' then 'مشروعاً' else 'واجباً' end, new.title);
    end if;
  end if;
  if new.photo_path is not null and new.review_status = 'pending' and (tg_op = 'INSERT' or old.photo_path is distinct from new.photo_path) then
    perform notify(new.family_id, new.student_id, 'parent', '📷 تسليم بانتظار المراجعة', nm || ': ' || new.title);
  end if;
  if tg_op = 'UPDATE' and new.review_status in ('approved','rejected') and old.review_status is distinct from new.review_status then
    perform notify(new.family_id, new.student_id, 'student',
      case new.review_status when 'approved' then '✅ تمت الموافقة على تسليمك' else '↩ تسليمك يحتاج إعادة' end,
      new.title || coalesce(' — ' || new.review_note, ''));
  end if;
  return new;
end $$;
create trigger trg_hw_guard before insert or update on homework for each row execute function homework_guard();
create trigger trg_hw_notify after insert or update on homework for each row execute function homework_notify();

create function badge_notify() returns trigger language plpgsql security definer set search_path=public as $$
declare nm text; t text;
begin
  select name into nm from students where id = new.student_id;
  select title into t from badges where id = new.badge_id;
  perform notify(new.family_id, new.student_id, 'student', '🏆 إنجاز جديد', t);
  perform notify(new.family_id, new.student_id, 'parent', '🏆 ' || nm || ' حصل على إنجاز', t);
  return new;
end $$;
create trigger trg_badge_notify after insert on student_badges for each row execute function badge_notify();

create or replace function apply_points() returns trigger language plpgsql security definer set search_path=public as $$
declare old_lvl int; new_lvl int; nm text;
begin
  select level, name into old_lvl, nm from students where id = new.student_id;
  update students set points_balance = points_balance + new.delta,
         level = greatest(1, 1 + (points_balance + new.delta) / 500)
   where id = new.student_id returning level into new_lvl;
  if new_lvl > old_lvl then
    perform notify(new.family_id, new.student_id, 'student', '⭐ ترقية! المستوى ' || new_lvl, null);
    perform notify(new.family_id, new.student_id, 'parent', '⭐ ' || nm || ' وصل للمستوى ' || new_lvl, null);
  end if;
  return new;
end $$;

create function generate_reminders() returns int language plpgsql security definer set search_path=public as $$
declare n int := 0; r record; fam uuid := my_family(); d text;
begin
  if fam is null then return 0; end if;
  for r in select e.id, e.student_id, e.title, e.exam_date, s.name from exams e join students s on s.id = e.student_id
           where e.family_id = fam and e.exam_date > now() and e.exam_date <= now() + interval '3 days'
             and (is_parent() or e.student_id = my_student()) loop
    d := to_char(r.exam_date at time zone 'Africa/Cairo', 'YYYY-MM-DD HH24:MI');
    perform notify(fam, r.student_id, 'student', '📅 امتحان قريب', r.title || ' — ' || d, 'exam3:' || r.id || ':student');
    perform notify(fam, r.student_id, 'parent', '📅 امتحان قريب لـ ' || r.name, r.title || ' — ' || d, 'exam3:' || r.id || ':parent');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function generate_reminders() from public, anon;
grant execute on function generate_reminders() to authenticated;
