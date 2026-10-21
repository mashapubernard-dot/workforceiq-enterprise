-- WorkforceIQ Hardware Asset Management Phase 1
-- Additive migration: preserves existing asset rows and enforces tenant isolation.

alter table public.assets
  add column if not exists org_id uuid default public.current_user_org_id(),
  add column if not exists purchase_date date,
  add column if not exists purchase_order text,
  add column if not exists cost_center text,
  add column if not exists purchase_cost numeric(12,2),
  add column if not exists ownership_type text not null default 'Company-owned',
  add column if not exists assigned_owner text,
  add column if not exists created_by uuid default auth.uid(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists assets_org_id_idx on public.assets(org_id);
create unique index if not exists assets_org_asset_tag_unique on public.assets(org_id, asset_tag) where asset_tag is not null and asset_tag <> '';

create table if not exists public.hardware_models (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_user_org_id(),
  make text not null,
  model_number text not null,
  category text not null default 'Other',
  description text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  merged_into uuid references public.hardware_models(id) on delete set null,
  unique (org_id, make, model_number)
);
create index if not exists hardware_models_org_id_idx on public.hardware_models(org_id);

create table if not exists public.asset_stock_levels (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_user_org_id(),
  hardware_model_id uuid not null references public.hardware_models(id) on delete cascade,
  location text not null default '',
  quantity integer not null default 0 check (quantity >= 0),
  reorder_threshold integer not null default 0 check (reorder_threshold >= 0),
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (org_id, hardware_model_id, location)
);
create index if not exists asset_stock_levels_org_id_idx on public.asset_stock_levels(org_id);

alter table public.assets enable row level security;
alter table public.asset_events enable row level security;
alter table public.hardware_models enable row level security;
alter table public.asset_stock_levels enable row level security;

drop policy if exists assets_select on public.assets;
drop policy if exists assets_insert on public.assets;
drop policy if exists assets_update on public.assets;
drop policy if exists assets_delete on public.assets;
drop policy if exists assets_tenant_select on public.assets;
drop policy if exists assets_tenant_insert on public.assets;
drop policy if exists assets_tenant_update on public.assets;
drop policy if exists assets_tenant_delete on public.assets;

create policy assets_tenant_select on public.assets for select to authenticated
using (org_id = public.current_user_org_id());
create policy assets_tenant_insert on public.assets for insert to authenticated
with check (org_id = public.current_user_org_id());
create policy assets_tenant_update on public.assets for update to authenticated
using (org_id = public.current_user_org_id() and public.is_workforce_manager())
with check (org_id = public.current_user_org_id() and public.is_workforce_manager());
create policy assets_tenant_delete on public.assets for delete to authenticated
using (org_id = public.current_user_org_id() and public.is_workforceiq_manager());

drop policy if exists asset_events_manager_all on public.asset_events;
drop policy if exists asset_events_tenant_select on public.asset_events;
drop policy if exists asset_events_tenant_insert on public.asset_events;
drop policy if exists asset_events_tenant_manage on public.asset_events;

create policy asset_events_tenant_select on public.asset_events for select to authenticated
using (exists (select 1 from public.assets a where a.id = asset_events.asset_id and a.org_id = public.current_user_org_id()));
create policy asset_events_tenant_insert on public.asset_events for insert to authenticated
with check (exists (select 1 from public.assets a where a.id = asset_events.asset_id and a.org_id = public.current_user_org_id()));
create policy asset_events_tenant_manage on public.asset_events for update to authenticated
using (public.is_workforce_manager() and exists (select 1 from public.assets a where a.id = asset_events.asset_id and a.org_id = public.current_user_org_id()))
with check (public.is_workforce_manager() and exists (select 1 from public.assets a where a.id = asset_events.asset_id and a.org_id = public.current_user_org_id()));

drop policy if exists hardware_models_tenant_select on public.hardware_models;
drop policy if exists hardware_models_tenant_insert on public.hardware_models;
drop policy if exists hardware_models_tenant_update on public.hardware_models;
drop policy if exists hardware_models_tenant_delete on public.hardware_models;
drop policy if exists asset_stock_tenant_select on public.asset_stock_levels;
drop policy if exists asset_stock_tenant_insert on public.asset_stock_levels;
drop policy if exists asset_stock_tenant_update on public.asset_stock_levels;
drop policy if exists asset_stock_tenant_delete on public.asset_stock_levels;

create policy hardware_models_tenant_select on public.hardware_models for select to authenticated using (org_id = public.current_user_org_id());
create policy hardware_models_tenant_insert on public.hardware_models for insert to authenticated with check (org_id = public.current_user_org_id());
create policy hardware_models_tenant_update on public.hardware_models for update to authenticated using (org_id = public.current_user_org_id() and public.is_workforce_manager()) with check (org_id = public.current_user_org_id() and public.is_workforce_manager());
create policy hardware_models_tenant_delete on public.hardware_models for delete to authenticated using (org_id = public.current_user_org_id() and public.is_workforceiq_manager());

create policy asset_stock_tenant_select on public.asset_stock_levels for select to authenticated using (org_id = public.current_user_org_id());
create policy asset_stock_tenant_insert on public.asset_stock_levels for insert to authenticated with check (org_id = public.current_user_org_id());
create policy asset_stock_tenant_update on public.asset_stock_levels for update to authenticated using (org_id = public.current_user_org_id() and public.is_workforce_manager()) with check (org_id = public.current_user_org_id() and public.is_workforce_manager());
create policy asset_stock_tenant_delete on public.asset_stock_levels for delete to authenticated using (org_id = public.current_user_org_id() and public.is_workforceiq_manager());

create or replace function public.set_asset_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists assets_set_updated_at on public.assets;
create trigger assets_set_updated_at before update on public.assets for each row execute function public.set_asset_updated_at();
drop trigger if exists hardware_models_set_updated_at on public.hardware_models;
create trigger hardware_models_set_updated_at before update on public.hardware_models for each row execute function public.set_asset_updated_at();
drop trigger if exists asset_stock_set_updated_at on public.asset_stock_levels;
create trigger asset_stock_set_updated_at before update on public.asset_stock_levels for each row execute function public.set_asset_updated_at();

create or replace function public.record_asset_registration()
returns trigger language plpgsql security invoker as $$
begin
  insert into public.asset_events(asset_id, event_type, to_value, notes, created_by)
  values (new.id, 'Registered', new.status, 'Asset registered', coalesce(new.created_by, auth.uid()));
  return new;
end;
$$;
drop trigger if exists assets_record_registration on public.assets;
create trigger assets_record_registration after insert on public.assets for each row execute function public.record_asset_registration();
