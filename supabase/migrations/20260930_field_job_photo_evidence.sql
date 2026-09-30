create table if not exists public.field_job_photos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  ticket_id bigint references public.tickets(id) on delete set null,
  work_order_id text,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid references public.devices(id) on delete set null,
  photo_type text not null check (photo_type in ('before','after')),
  storage_path text not null,
  latitude double precision,
  longitude double precision,
  accuracy_meters double precision,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists field_job_photos_org_idx on public.field_job_photos(org_id);
create index if not exists field_job_photos_ticket_idx on public.field_job_photos(ticket_id);
create index if not exists field_job_photos_user_idx on public.field_job_photos(user_id);
create index if not exists field_job_photos_captured_idx on public.field_job_photos(captured_at desc);

alter table public.field_job_photos enable row level security;

drop policy if exists "field job photos tenant access" on public.field_job_photos;
create policy "field job photos tenant access"
on public.field_job_photos
for all
using (org_id = public.current_user_org_id())
with check (org_id = public.current_user_org_id());

insert into storage.buckets (id, name, public)
values ('field-job-photos', 'field-job-photos', false)
on conflict (id) do nothing;

drop policy if exists "field job photos storage select" on storage.objects;
create policy "field job photos storage select"
on storage.objects
for select
to authenticated
using (bucket_id = 'field-job-photos' and (storage.foldername(name))[1] = public.current_user_org_id()::text);

drop policy if exists "field job photos storage insert" on storage.objects;
create policy "field job photos storage insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'field-job-photos' and (storage.foldername(name))[1] = public.current_user_org_id()::text);

drop policy if exists "field job photos storage update" on storage.objects;
create policy "field job photos storage update"
on storage.objects
for update
to authenticated
using (bucket_id = 'field-job-photos' and (storage.foldername(name))[1] = public.current_user_org_id()::text)
with check (bucket_id = 'field-job-photos' and (storage.foldername(name))[1] = public.current_user_org_id()::text);

alter publication supabase_realtime add table public.field_job_photos;