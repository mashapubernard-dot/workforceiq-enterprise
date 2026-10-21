-- Enterprise Asset Management Phase 1: tenant-scoped sites, work orders, and preventative plans.
create table if not exists public.eam_locations (
 id uuid primary key default gen_random_uuid(), org_id uuid not null default public.current_user_org_id(),
 name text not null, site_code text, address text, location_type text not null default 'Site',
 parent_location_id uuid references public.eam_locations(id) on delete set null, notes text,
 created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.eam_work_orders (
 id uuid primary key default gen_random_uuid(), org_id uuid not null default public.current_user_org_id(),
 work_order_number text not null, title text not null, description text,
 asset_id uuid references public.assets(id) on delete set null,
 location_id uuid references public.eam_locations(id) on delete set null,
 work_type text not null default 'Corrective', priority text not null default 'Medium' check (priority in ('Low','Medium','High','Critical')),
 status text not null default 'Open' check (status in ('Open','Planned','In Progress','On Hold','Completed','Cancelled')),
 assigned_to text, requested_by uuid default auth.uid(), scheduled_date date, due_date date, completed_at timestamptz,
 downtime_minutes integer not null default 0 check (downtime_minutes >= 0), cost numeric(12,2) not null default 0 check (cost >= 0),
 resolution_notes text, created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(org_id, work_order_number)
);
create table if not exists public.eam_maintenance_plans (
 id uuid primary key default gen_random_uuid(), org_id uuid not null default public.current_user_org_id(),
 plan_name text not null, asset_id uuid references public.assets(id) on delete set null,
 location_id uuid references public.eam_locations(id) on delete set null, interval_days integer not null default 90 check (interval_days > 0),
 last_service_date date, next_due_date date not null, assigned_to text, checklist text,
 status text not null default 'Active' check (status in ('Active','Paused','Archived')),
 created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists eam_locations_org_idx on public.eam_locations(org_id);
create index if not exists eam_work_orders_org_idx on public.eam_work_orders(org_id);
create index if not exists eam_work_orders_asset_idx on public.eam_work_orders(asset_id);
create index if not exists eam_work_orders_due_idx on public.eam_work_orders(org_id,due_date);
create index if not exists eam_maintenance_plans_org_idx on public.eam_maintenance_plans(org_id);
create index if not exists eam_maintenance_plans_due_idx on public.eam_maintenance_plans(org_id,next_due_date);
alter table public.eam_locations enable row level security;
alter table public.eam_work_orders enable row level security;
alter table public.eam_maintenance_plans enable row level security;
drop policy if exists eam_locations_select on public.eam_locations;
create policy eam_locations_select on public.eam_locations for select to authenticated using (org_id=public.current_user_org_id());
drop policy if exists eam_locations_insert on public.eam_locations;
create policy eam_locations_insert on public.eam_locations for insert to authenticated with check (org_id=public.current_user_org_id());
drop policy if exists eam_locations_update on public.eam_locations;
create policy eam_locations_update on public.eam_locations for update to authenticated using (org_id=public.current_user_org_id() and public.is_workforce_manager()) with check (org_id=public.current_user_org_id() and public.is_workforce_manager());
drop policy if exists eam_locations_delete on public.eam_locations;
create policy eam_locations_delete on public.eam_locations for delete to authenticated using (org_id=public.current_user_org_id() and public.is_workforceiq_manager());
drop policy if exists eam_work_orders_select on public.eam_work_orders;
create policy eam_work_orders_select on public.eam_work_orders for select to authenticated using (org_id=public.current_user_org_id());
drop policy if exists eam_work_orders_insert on public.eam_work_orders;
create policy eam_work_orders_insert on public.eam_work_orders for insert to authenticated with check (org_id=public.current_user_org_id() and (asset_id is null or exists(select 1 from public.assets a where a.id=asset_id and a.org_id=public.current_user_org_id())) and (location_id is null or exists(select 1 from public.eam_locations l where l.id=location_id and l.org_id=public.current_user_org_id())));
drop policy if exists eam_work_orders_update on public.eam_work_orders;
create policy eam_work_orders_update on public.eam_work_orders for update to authenticated using (org_id=public.current_user_org_id() and public.is_workforce_manager()) with check (org_id=public.current_user_org_id() and public.is_workforce_manager());
drop policy if exists eam_work_orders_delete on public.eam_work_orders;
create policy eam_work_orders_delete on public.eam_work_orders for delete to authenticated using (org_id=public.current_user_org_id() and public.is_workforceiq_manager());
drop policy if exists eam_maintenance_plans_select on public.eam_maintenance_plans;
create policy eam_maintenance_plans_select on public.eam_maintenance_plans for select to authenticated using (org_id=public.current_user_org_id());
drop policy if exists eam_maintenance_plans_insert on public.eam_maintenance_plans;
create policy eam_maintenance_plans_insert on public.eam_maintenance_plans for insert to authenticated with check (org_id=public.current_user_org_id() and (asset_id is null or exists(select 1 from public.assets a where a.id=asset_id and a.org_id=public.current_user_org_id())) and (location_id is null or exists(select 1 from public.eam_locations l where l.id=location_id and l.org_id=public.current_user_org_id())));
drop policy if exists eam_maintenance_plans_update on public.eam_maintenance_plans;
create policy eam_maintenance_plans_update on public.eam_maintenance_plans for update to authenticated using (org_id=public.current_user_org_id() and public.is_workforce_manager()) with check (org_id=public.current_user_org_id() and public.is_workforce_manager());
drop policy if exists eam_maintenance_plans_delete on public.eam_maintenance_plans;
create policy eam_maintenance_plans_delete on public.eam_maintenance_plans for delete to authenticated using (org_id=public.current_user_org_id() and public.is_workforceiq_manager());
create or replace function public.set_eam_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists eam_locations_updated_at on public.eam_locations;
create trigger eam_locations_updated_at before update on public.eam_locations for each row execute function public.set_eam_updated_at();
drop trigger if exists eam_work_orders_updated_at on public.eam_work_orders;
create trigger eam_work_orders_updated_at before update on public.eam_work_orders for each row execute function public.set_eam_updated_at();
drop trigger if exists eam_maintenance_plans_updated_at on public.eam_maintenance_plans;
create trigger eam_maintenance_plans_updated_at before update on public.eam_maintenance_plans for each row execute function public.set_eam_updated_at();
grant select,insert,update,delete on public.eam_locations,public.eam_work_orders,public.eam_maintenance_plans to authenticated;
