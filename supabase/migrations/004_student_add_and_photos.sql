alter table homework add column photo_path text;

create policy student_ins on subjects for insert with check (family_id = my_family() and student_id = my_student());
create policy student_ins on lessons  for insert with check (family_id = my_family() and student_id = my_student());
create policy student_ins on homework for insert with check (family_id = my_family() and student_id = my_student());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('homework-photos','homework-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy hw_photo_student_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'homework-photos' and (storage.foldername(name))[1] = my_family()::text
              and (storage.foldername(name))[2] = my_student()::text);
create policy hw_photo_student_read on storage.objects for select to authenticated
  using (bucket_id = 'homework-photos' and (storage.foldername(name))[1] = my_family()::text
         and (storage.foldername(name))[2] = my_student()::text);
create policy hw_photo_parent_read on storage.objects for select to authenticated
  using (bucket_id = 'homework-photos' and is_parent() and (storage.foldername(name))[1] = my_family()::text);
create policy hw_photo_parent_del on storage.objects for delete to authenticated
  using (bucket_id = 'homework-photos' and is_parent() and (storage.foldername(name))[1] = my_family()::text);
