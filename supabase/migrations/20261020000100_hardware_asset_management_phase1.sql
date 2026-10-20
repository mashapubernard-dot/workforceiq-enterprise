-- WorkforceIQ Hardware Asset Management — Phase 1
-- Additive migration: preserves the existing assets and asset_events tables.
-- Existing assets without an org_id are intentionally left unassigned rather than
-- guessing whether they belong to Lemon Tree, Mesh IT, or another tenant.
-- A Platform Super Admin can see these legacy rows and assign the correct tenant.

begin;

alter table public.assets
  add column if not exists org_id uuid references public.organizations(id) on delete restrict,
  add column if not exists cost_center text,
  add column if not exists purchase_order text,
  add column if not exists purchase_date date,
  add column if not exists purchase_cost numeric(12,2),
  add column if not exists ownership_type text not null default 'Owned',
  add column if not exists assigned_owner_id uuid references public.user_profiles(id) on delete set null,
  add column if not exists ip_address text,
  add column if not exists model_id uuid;

alter table public.assets
  drop constraint if exists assets_purchase_cost_nonnegative,
  add constraint assets_purchase_cost_nonnegative check (purchase_cost is null or purchase_cost >= 0),
  drop constraint if exists assets_ownership_type_valid,
  add constraint assets_ownership_type_valid check (ownership_type in ('Owned', 'Leased', 'Rented'));

create table if not exists public.asset_models (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  manufacturer text not null,
  canonical_name text not null,
  model_number text,
  category text not null default 'Other',
  reorder_threshold integer not null default 0 check (reorder_threshold >= 0),
  merged_into_id uuid references public.asset_models(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint asset_models_org_id_id_unique unique (org_id, id)
);

alter table public.asset_models
  add constraint asset_models_merge_same_org_fkey
  foreign key (org_id, merged_into_id)
  references public.asset_models(org_id, id)
  on delete restrict;

create unique index if not exists asset_models_canonical_unique
  on public.asset_models (
    org_id,
    lower(btrim(manufacturer)),
    lower(btrim(canonical_name)),
    coalesce(lower(btrim(model_number)), '')
  )
  where merged_into_id is null;

alter table public.assets
  add constraint assets_org_id_id_unique unique (org_id, id);

alter table public.assets
  add constraint assets_org_model_fkey
  foreign key (org_id, model_id)
  references public.asset_models(org_id, id)
  on delete restrict;

create index if not exists assets_org_location_idx on public.assets(org_id, location);
create index if not exists assets_org_model_idx on public.assets(org_id, model_id);
create index if not exists assets_org_status_idx on public.assets(org_id, status);

-- Reuse the existing asset_events timeline table rather than creating a duplicate.
alter table public.asset_events
  add column if not exists org_id uuid references public.organizations(id) on delete cascade,
  add column if not exists created_by_name text;

alter table public.asset_events
  add constraint asset_events_org_asset_fkey
  foreign key (org_id, asset_id) references public.assets(org_id, id) on delete cascade;

update public.asset_events e
set org_id = a.org_id
from public.assets a
where e.asset_id = a.id
  and e.org_id is null
  and a.org_id is not null;

update public.asset_events e
set created_by_name = coalesce(up.full_name, up.email)
from public.user_profiles up
where e.created_by = up.id
  and e.created_by_name is null;

create table if not exists public.asset_relationships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  asset_id uuid not null,
  related_asset_id uuid,
  service_name text,
  relationship_type text not null default 'Depends on',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint asset_relationships_one_target check (
    related_asset_id is not null or nullif(btrim(service_name), '') is not null
  ),
  constraint asset_relationships_source_same_org_fkey
    foreign key (org_id, asset_id) references public.assets(org_id, id) on delete cascade,
  constraint asset_relationships_target_same_org_fkey
    foreign key (org_id, related_asset_id) references public.assets(org_id, id) on delete cascade
);

create index if not exists asset_relationships_org_asset_idx
  on public.asset_relationships(org_id, asset_id);

-- Derive the tenant for normal asset creation from the signed-in user's profile.
create or replace function public.set_asset_tenant_from_profile()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if tg_op = 'INSERT' and new.org_id is null then
    select coalesce(up.org_id, up.organization_id)
      into v_org_id
      from public.user_profiles up
      where up.id = auth.uid();

    if v_org_id is null then
      raise exception 'Your WorkforceIQ profile is not linked to an organisation. Ask an administrator to fix the profile before adding assets.';
    end if;

    new.org_id := v_org_id;
  end if;

  if new.model_id is null and new.org_id is not null and nullif(btrim(new.make), '') is not null then
    select model.id
      into new.model_id
      from public.asset_models model
      where model.org_id = new.org_id
        and model.merged_into_id is null
        and (
          lower(btrim(model.manufacturer)) = lower(btrim(new.make))
          and (
            (nullif(btrim(new.model_number), '') is not null and lower(btrim(coalesce(model.model_number, ''))) = lower(btrim(new.model_number)))
            or lower(btrim(model.canonical_name)) = lower(btrim(coalesce(new.model_number, '')))
          )
        )
      order by model.created_at
      limit 1;
  end if;

  if new.assigned_owner_id is not null and new.org_id is not null then
    if not exists (
      select 1
      from public.user_profiles owner_profile
      where owner_profile.id = new.assigned_owner_id
        and coalesce(owner_profile.org_id, owner_profile.organization_id) = new.org_id
    ) then
      raise exception 'The assigned owner must belong to the same organisation as the asset.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists assets_set_tenant_before_write on public.assets;
create trigger assets_set_tenant_before_write
before insert or update on public.assets
for each row execute function public.set_asset_tenant_from_profile();

-- Lifecycle audit: procurement on registration and event records for key changes.
create or replace function public.write_asset_lifecycle_event()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.org_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.asset_events (org_id, asset_id, event_type, to_value, notes, created_by, created_by_name)
    values (
      new.org_id, new.id, 'procurement', new.asset_tag, 'Asset registered in WorkforceIQ.', auth.uid(),
      (select coalesce(up.full_name, up.email) from public.user_profiles up where up.id = auth.uid())
    );
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into public.asset_events (org_id, asset_id, event_type, from_value, to_value, notes, created_by, created_by_name)
    values (
      new.org_id, new.id,
      case
        when lower(new.status) = 'retired' then 'disposal'
        when lower(new.status) = 'in repair' then 'repair'
        when lower(new.status) in ('in storage', 'returned') then 'return'
        else 'status_change'
      end,
      old.status, new.status, 'Status updated.', auth.uid(),
      (select coalesce(up.full_name, up.email) from public.user_profiles up where up.id = auth.uid())
    );
  end if;

  if old.assigned_to is distinct from new.assigned_to then
    insert into public.asset_events (org_id, asset_id, event_type, from_value, to_value, notes, created_by, created_by_name)
    values (
      new.org_id, new.id,
      case when nullif(btrim(new.assigned_to), '') is null then 'return'
           when nullif(btrim(old.assigned_to), '') is null then 'assignment'
           else 'transfer' end,
      old.assigned_to, new.assigned_to, 'Asset assignment updated.', auth.uid(),
      (select coalesce(up.full_name, up.email) from public.user_profiles up where up.id = auth.uid())
    );
  end if;

  if old.location is distinct from new.location then
    insert into public.asset_events (org_id, asset_id, event_type, from_value, to_value, notes, created_by, created_by_name)
    values (
      new.org_id, new.id, 'transfer', old.location, new.location, 'Asset location updated.', auth.uid(),
      (select coalesce(up.full_name, up.email) from public.user_profiles up where up.id = auth.uid())
    );
  end if;

  return new;
end;
$$;

drop trigger if exists assets_lifecycle_after_insert on public.assets;
create trigger assets_lifecycle_after_insert
after insert on public.assets
for each row execute function public.write_asset_lifecycle_event();

drop trigger if exists assets_lifecycle_after_update on public.assets;
create trigger assets_lifecycle_after_update
after update of status, assigned_to, location on public.assets
for each row execute function public.write_asset_lifecycle_event();

-- Keep the existing asset_events schema and enforce tenant-aware access.
drop policy if exists assets_select on public.assets;
drop policy if exists assets_insert on public.assets;
drop policy if exists assets_update on public.assets;
drop policy if exists assets_delete on public.assets;

create policy assets_select_tenant
on public.assets for select to authenticated
using (
  org_id = (
    select coalesce(up.org_id, up.organization_id)
    from public.user_profiles up
    where up.id = (select auth.uid())
  )
  or (org_id is null and public.is_super_admin())
);

create policy assets_insert_tenant
on public.assets for insert to authenticated
with check (
  org_id = (
    select coalesce(up.org_id, up.organization_id)
    from public.user_profiles up
    where up.id = (select auth.uid())
  )
);

create policy assets_update_tenant
on public.assets for update to authenticated
using (
  org_id = (
    select coalesce(up.org_id, up.organization_id)
    from public.user_profiles up
    where up.id = (select auth.uid())
  )
  or (org_id is null and public.is_super_admin())
)
with check (
  org_id = (
    select coalesce(up.org_id, up.organization_id)
    from public.user_profiles up
    where up.id = (select auth.uid())
  )
  or public.is_super_admin()
);

create policy assets_delete_tenant
on public.assets for delete to authenticated
using (
  org_id = (
    select coalesce(up.org_id, up.organization_id)
    from public.user_profiles up
    where up.id = (select auth.uid())
  )
);

drop policy if exists asset_events_manager_all on public.asset_events;
create policy asset_events_select_tenant
on public.asset_events for select to authenticated
using (
  org_id = (
    select coalesce(up.org_id, up.organization_id)
    from public.user_profiles up
    where up.id = (select auth.uid())
  )
  or (org_id is null and public.is_super_admin())
);

create policy asset_events_insert_tenant
on public.asset_events for insert to authenticated
with check (
  org_id = (
    select coalesce(up.org_id, up.organization_id)
    from public.user_profiles up
    where up.id = (select auth.uid())
  )
  or public.is_super_admin()
);

alter table public.asset_models enable row level security;
create policy asset_models_select_tenant on public.asset_models
for select to authenticated
using (org_id = (select coalesce(up.org_id, up.organization_id) from public.user_profiles up where up.id = (select auth.uid())));

create policy asset_models_insert_tenant on public.asset_models
for insert to authenticated
with check (org_id = (select coalesce(up.org_id, up.organization_id) from public.user_profiles up where up.id = (select auth.uid())));

create policy asset_models_update_tenant on public.asset_models
for update to authenticated
using (org_id = (select coalesce(up.org_id, up.organization_id) from public.user_profiles up where up.id = (select auth.uid())))
with check (org_id = (select coalesce(up.org_id, up.organization_id) from public.user_profiles up where up.id = (select auth.uid())));

create policy asset_models_delete_tenant on public.asset_models
for delete to authenticated
using (org_id = (select coalesce(up.org_id, up.organization_id) from public.user_profiles up where up.id = (select auth.uid())));

alter table public.asset_relationships enable row level security;
create policy asset_relationships_select_tenant on public.asset_relationships
for select to authenticated
using (org_id = (select coalesce(up.org_id, up.organization_id) from public.user_profiles up where up.id = (select auth.uid())));

create policy asset_relationships_insert_tenant on public.asset_relationships
for insert to authenticated
with check (org_id = (select coalesce(up.org_id, up.organization_id) from public.user_profiles up where up.id = (select auth.uid())));

create policy asset_relationships_update_tenant on public.asset_relationships
for update to authenticated
using (org_id = (select coalesce(up.org_id, up.organization_id) from public.user_profiles up where up.id = (select auth.uid())))
with check (org_id = (select coalesce(up.org_id, up.organization_id) from public.user_profiles up where up.id = (select auth.uid())));

create policy asset_relationships_delete_tenant on public.asset_relationships
for delete to authenticated
using (org_id = (select coalesce(up.org_id, up.organization_id) from public.user_profiles up where up.id = (select auth.uid())));

commit;
