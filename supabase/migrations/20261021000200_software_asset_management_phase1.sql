-- Software Asset Management Phase 1: tenant-scoped software licences and assignments.
create table if not exists public.software_licenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_user_org_id(),
  software_name text not null,
  publisher text,
  version text,
  category text not null default 'Business',
  license_type text not null default 'Subscription',
  license_key_reference text,
  seats_purchased integer not null default 1 check (seats_purchased >= 0),
  purchase_cost numeric(12,2) not null default 0 check (purchase_cost >= 0),
  purchase_date date,
  renewal_date date,
  expiry_date date,
  status text not null default 'Active' check (status in ('Active','Expiring','Expired','Cancelled','Pending')),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.software_assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_user_org_id(),
  license_id uuid not null references public.software_licenses(id) on delete cascade,
  employee_name text not null,
  device_name text,
  assigned_date date not null default current_date,
  returned_date date,
  notes text,
  assigned_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists software_licenses_org_idx on public.software_licenses(org_id);
create index if not exists software_assignments_org_idx on public.software_assignments(org_id);
create index if not exists software_assignments_license_idx on public.software_assignments(license_id);
alter table public.software_licenses enable row level security;
alter table public.software_assignments enable row level security;
drop policy if exists software_licenses_tenant_select on public.software_licenses;
create policy software_licenses_tenant_select on public.software_licenses for select to authenticated using (org_id = public.current_user_org_id());
drop policy if exists software_licenses_tenant_insert on public.software_licenses;
create policy software_licenses_tenant_insert on public.software_licenses for insert to authenticated with check (org_id = public.current_user_org_id());
drop policy if exists software_licenses_tenant_update on public.software_licenses;
create policy software_licenses_tenant_update on public.software_licenses for update to authenticated using (org_id = public.current_user_org_id() and public.is_workforce_manager()) with check (org_id = public.current_user_org_id() and public.is_workforce_manager());
drop policy if exists software_licenses_tenant_delete on public.software_licenses;
create policy software_licenses_tenant_delete on public.software_licenses for delete to authenticated using (org_id = public.current_user_org_id() and public.is_workforceiq_manager());
drop policy if exists software_assignments_tenant_select on public.software_assignments;
create policy software_assignments_tenant_select on public.software_assignments for select to authenticated using (org_id = public.current_user_org_id());
drop policy if exists software_assignments_tenant_insert on public.software_assignments;
create policy software_assignments_tenant_insert on public.software_assignments for insert to authenticated with check (org_id = public.current_user_org_id() and exists (select 1 from public.software_licenses l where l.id = license_id and l.org_id = public.current_user_org_id()));
drop policy if exists software_assignments_tenant_update on public.software_assignments;
create policy software_assignments_tenant_update on public.software_assignments for update to authenticated using (org_id = public.current_user_org_id() and public.is_workforce_manager()) with check (org_id = public.current_user_org_id() and public.is_workforce_manager());
drop policy if exists software_assignments_tenant_delete on public.software_assignments;
create policy software_assignments_tenant_delete on public.software_assignments for delete to authenticated using (org_id = public.current_user_org_id() and public.is_workforceiq_manager());
create or replace function public.set_software_asset_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists software_licenses_updated_at on public.software_licenses;
create trigger software_licenses_updated_at before update on public.software_licenses for each row execute function public.set_software_asset_updated_at();
grant select, insert, update, delete on public.software_licenses to authenticated;
grant select, insert, update, delete on public.software_assignments to authenticated;
