drop policy if exists "field job photos tenant access" on public.field_job_photos;
create policy "field job photos tenant select"
on public.field_job_photos for select
using (public.is_super_admin() or org_id = public.current_user_org_id());

create policy "field job photos tenant insert"
on public.field_job_photos for insert
with check (org_id = public.current_user_org_id());

create policy "field job photos tenant update"
on public.field_job_photos for update
using (org_id = public.current_user_org_id())
with check (org_id = public.current_user_org_id());

create policy "field job photos tenant delete"
on public.field_job_photos for delete
using (org_id = public.current_user_org_id());

drop policy if exists "field job photos storage select" on storage.objects;
create policy "field job photos storage select"
on storage.objects for select to authenticated
using (
  bucket_id = 'field-job-photos'
  and (public.is_super_admin() or (storage.foldername(name))[1] = public.current_user_org_id()::text)
);