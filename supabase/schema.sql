create extension if not exists pgcrypto;

create type public.app_role as enum ('admin','manager','agent');

create table if not exists public.companies (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 brand_color text not null default '#DC2626',
 created_at timestamptz not null default now()
);

create table if not exists public.branches (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 name text not null,
 address text,
 created_at timestamptz not null default now()
);

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 company_id uuid references public.companies(id) on delete set null,
 branch_id uuid references public.branches(id) on delete set null,
 full_name text not null,
 role public.app_role not null default 'agent',
 phone text,
 active boolean not null default true,
 created_at timestamptz not null default now()
);

create table if not exists public.shifts (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 branch_id uuid references public.branches(id) on delete set null,
 employee_id uuid not null references public.profiles(id) on delete cascade,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 status text not null default 'scheduled'
);

create table if not exists public.clockins (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 branch_id uuid references public.branches(id) on delete set null,
 employee_id uuid not null references public.profiles(id) on delete cascade,
 clocked_in_at timestamptz not null default now(),
 clocked_out_at timestamptz,
 latitude double precision,
 longitude double precision,
 photo_path text,
 verification_status text not null default 'pending'
);

create table if not exists public.performance (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 employee_id uuid not null references public.profiles(id) on delete cascade,
 metric_type text not null,
 metric_value numeric not null default 0,
 target_value numeric,
 recorded_at timestamptz not null default now()
);

create table if not exists public.qa_scores (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 employee_id uuid not null references public.profiles(id) on delete cascade,
 manager_id uuid not null references public.profiles(id),
 score int not null check (score between 1 and 10),
 notes text,
 coaching_task text,
 due_at timestamptz,
 created_at timestamptz not null default now()
);

create table if not exists public.inventory (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 branch_id uuid references public.branches(id) on delete cascade,
 sku text not null,
 name text not null,
 quantity int not null default 0,
 low_stock_threshold int not null default 10,
 unique(branch_id, sku)
);

create table if not exists public.alerts (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 branch_id uuid references public.branches(id) on delete set null,
 employee_id uuid references public.profiles(id) on delete set null,
 type text not null,
 title text not null,
 message text,
 channel text not null default 'in_app',
 status text not null default 'open',
 created_at timestamptz not null default now()
);

alter table public.companies enable row level security;
alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.shifts enable row level security;
alter table public.clockins enable row level security;
alter table public.performance enable row level security;
alter table public.qa_scores enable row level security;
alter table public.inventory enable row level security;
alter table public.alerts enable row level security;

create or replace function public.my_company_id()
returns uuid language sql stable security definer set search_path=public
as $$ select company_id from public.profiles where id = auth.uid() $$;

create or replace function public.my_role()
returns public.app_role language sql stable security definer set search_path=public
as $$ select role from public.profiles where id = auth.uid() $$;

create policy "company members can view company" on public.companies for select using (id = public.my_company_id());
create policy "company members branches" on public.branches for all using (company_id = public.my_company_id()) with check (company_id = public.my_company_id());
create policy "profiles same company" on public.profiles for select using (company_id = public.my_company_id() or id = auth.uid());
create policy "profiles managers write" on public.profiles for all using (company_id = public.my_company_id() and public.my_role() in ('admin','manager')) with check (company_id = public.my_company_id());
create policy "company shifts" on public.shifts for all using (company_id = public.my_company_id()) with check (company_id = public.my_company_id());
create policy "company clockins" on public.clockins for all using (company_id = public.my_company_id()) with check (company_id = public.my_company_id());
create policy "company performance" on public.performance for all using (company_id = public.my_company_id()) with check (company_id = public.my_company_id());
create policy "company qa" on public.qa_scores for all using (company_id = public.my_company_id()) with check (company_id = public.my_company_id());
create policy "company inventory" on public.inventory for all using (company_id = public.my_company_id()) with check (company_id = public.my_company_id());
create policy "company alerts" on public.alerts for all using (company_id = public.my_company_id()) with check (company_id = public.my_company_id());

insert into storage.buckets (id, name, public) values ('clockin-photos','clockin-photos',false)
on conflict (id) do nothing;

create policy "clockin photos company users" on storage.objects for select
using (bucket_id = 'clockin-photos' and auth.uid() is not null);

create policy "clockin photos upload" on storage.objects for insert
with check (bucket_id = 'clockin-photos' and auth.uid() is not null);

alter publication supabase_realtime add table public.clockins, public.performance, public.alerts;
