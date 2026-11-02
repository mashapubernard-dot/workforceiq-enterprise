-- WorkforceIQ shared attendance kiosk (PIN-based first release).
-- Run this script in the Supabase SQL editor after reviewing it against the live schema.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.workforceiq_kiosk_pins (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  employee_id uuid not null references public.user_profiles(id) on delete cascade,
  pin_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, employee_id)
);
alter table public.workforceiq_kiosk_pins enable row level security;
revoke all on public.workforceiq_kiosk_pins from anon, authenticated;

create or replace function public.admin_set_kiosk_pin(p_employee_id uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_org uuid; v_role text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select org_id, role::text into v_org, v_role
  from public.user_profiles where id = auth.uid();
  if v_org is null or lower(coalesce(v_role,'')) not in ('administrator','admin') then
    raise exception 'Only a company administrator can register kiosk PINs';
  end if;
  if p_pin !~ '^[0-9]{6} (select 1 from public.user_profiles where id=p_employee_id and org_id=v_org) then
    raise exception 'Employee does not belong to this company';
  end if;
  insert into public.workforceiq_kiosk_pins(org_id,employee_id,pin_hash,updated_at)
  values(v_org,p_employee_id,extensions.crypt(p_pin,extensions.gen_salt('bf')),now())
  on conflict(org_id,employee_id) do update
    set pin_hash=excluded.pin_hash, updated_at=now();
  return jsonb_build_object('success',true);
end;
$$;

create or replace function public.admin_list_kiosk_pins()
returns table(employee_id uuid, enrolled_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare v_org uuid; v_role text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select org_id, role::text into v_org, v_role from public.user_profiles where id=auth.uid();
  if v_org is null or lower(coalesce(v_role,'')) not in ('administrator','admin') then
    raise exception 'Administrator access required';
  end if;
  return query select k.employee_id,k.created_at from public.workforceiq_kiosk_pins k where k.org_id=v_org;
end;
$$;

create or replace function public.admin_remove_kiosk_pin(p_employee_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_org uuid; v_role text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select org_id, role::text into v_org, v_role from public.user_profiles where id=auth.uid();
  if v_org is null or lower(coalesce(v_role,'')) not in ('administrator','admin') then
    raise exception 'Administrator access required';
  end if;
  delete from public.workforceiq_kiosk_pins where org_id=v_org and employee_id=p_employee_id;
  return jsonb_build_object('success',true);
end;
$$;

create or replace function public.kiosk_clock_action(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_org uuid; v_employee uuid; v_name text; v_open_id uuid; v_time timestamptz := now();
begin
  if auth.uid() is null then raise exception 'Sign in to the company kiosk account first'; end if;
  select org_id into v_org from public.user_profiles where id=auth.uid();
  if v_org is null then raise exception 'Kiosk account is not linked to a company'; end if;
  if p_pin !~ '^[0-9]{6}$' then raise exception 'Invalid employee PIN'; end if;
  select k.employee_id, p.full_name into v_employee, v_name
  from public.workforceiq_kiosk_pins k
  join public.user_profiles p on p.id=k.employee_id and p.org_id=k.org_id
  where k.org_id=v_org and k.pin_hash=extensions.crypt(p_pin,k.pin_hash)
  limit 1;
  if v_employee is null then raise exception 'PIN not recognised'; end if;
  select id into v_open_id from public.attendance
  where user_id=v_employee and clock_out is null
  order by clock_in desc limit 1;
  if v_open_id is not null then
    update public.attendance set clock_out=v_time, status='Off Duty'
    where id=v_open_id;
    return jsonb_build_object('employee_name',v_name,'action','CLOCK_OUT','event_time',v_time);
  else
    insert into public.attendance(user_id,clock_in,status,status_started_at)
    values(v_employee,v_time,'Working',null);
    return jsonb_build_object('employee_name',v_name,'action','CLOCK_IN','event_time',v_time);
  end if;
end;
$$;

revoke all on function public.admin_set_kiosk_pin(uuid,text) from public, anon;
revoke all on function public.admin_list_kiosk_pins() from public, anon;
revoke all on function public.admin_remove_kiosk_pin(uuid) from public, anon;
revoke all on function public.kiosk_clock_action(text) from public, anon;
grant execute on function public.admin_set_kiosk_pin(uuid,text) to authenticated;
grant execute on function public.admin_list_kiosk_pins() to authenticated;
grant execute on function public.admin_remove_kiosk_pin(uuid) to authenticated;
grant execute on function public.kiosk_clock_action(text) to authenticated;
 then raise exception 'PIN must be exactly six digits'; end if;
  if exists (select 1 from public.workforceiq_kiosk_pins k where k.org_id=v_org and k.employee_id<>p_employee_id and k.pin_hash=extensions.crypt(p_pin,k.pin_hash)) then
    raise exception 'That PIN is already assigned to another employee in this company';
  end if;
  if not exists (select 1 from public.user_profiles where id=p_employee_id and org_id=v_org) then
    raise exception 'Employee does not belong to this company';
  end if;
  insert into public.workforceiq_kiosk_pins(org_id,employee_id,pin_hash,updated_at)
  values(v_org,p_employee_id,extensions.crypt(p_pin,extensions.gen_salt('bf')),now())
  on conflict(org_id,employee_id) do update
    set pin_hash=excluded.pin_hash, updated_at=now();
  return jsonb_build_object('success',true);
end;
$$;

create or replace function public.admin_list_kiosk_pins()
returns table(employee_id uuid, enrolled_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare v_org uuid; v_role text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select org_id, role::text into v_org, v_role from public.user_profiles where id=auth.uid();
  if v_org is null or lower(coalesce(v_role,'')) not in ('administrator','admin') then
    raise exception 'Administrator access required';
  end if;
  return query select k.employee_id,k.created_at from public.workforceiq_kiosk_pins k where k.org_id=v_org;
end;
$$;

create or replace function public.admin_remove_kiosk_pin(p_employee_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_org uuid; v_role text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select org_id, role::text into v_org, v_role from public.user_profiles where id=auth.uid();
  if v_org is null or lower(coalesce(v_role,'')) not in ('administrator','admin') then
    raise exception 'Administrator access required';
  end if;
  delete from public.workforceiq_kiosk_pins where org_id=v_org and employee_id=p_employee_id;
  return jsonb_build_object('success',true);
end;
$$;

create or replace function public.kiosk_clock_action(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_org uuid; v_employee uuid; v_name text; v_open_id uuid; v_time timestamptz := now();
begin
  if auth.uid() is null then raise exception 'Sign in to the company kiosk account first'; end if;
  select org_id into v_org from public.user_profiles where id=auth.uid();
  if v_org is null then raise exception 'Kiosk account is not linked to a company'; end if;
  if p_pin !~ '^[0-9]{6}$' then raise exception 'Invalid employee PIN'; end if;
  select k.employee_id, p.full_name into v_employee, v_name
  from public.workforceiq_kiosk_pins k
  join public.user_profiles p on p.id=k.employee_id and p.org_id=k.org_id
  where k.org_id=v_org and k.pin_hash=extensions.crypt(p_pin,k.pin_hash)
  limit 1;
  if v_employee is null then raise exception 'PIN not recognised'; end if;
  select id into v_open_id from public.attendance
  where user_id=v_employee and clock_out is null
  order by clock_in desc limit 1;
  if v_open_id is not null then
    update public.attendance set clock_out=v_time, status='Off Duty'
    where id=v_open_id;
    return jsonb_build_object('employee_name',v_name,'action','CLOCK_OUT','event_time',v_time);
  else
    insert into public.attendance(user_id,clock_in,status,status_started_at)
    values(v_employee,v_time,'Working',null);
    return jsonb_build_object('employee_name',v_name,'action','CLOCK_IN','event_time',v_time);
  end if;
end;
$$;

revoke all on function public.admin_set_kiosk_pin(uuid,text) from public, anon;
revoke all on function public.admin_list_kiosk_pins() from public, anon;
revoke all on function public.admin_remove_kiosk_pin(uuid) from public, anon;
revoke all on function public.kiosk_clock_action(text) from public, anon;
grant execute on function public.admin_set_kiosk_pin(uuid,text) to authenticated;
grant execute on function public.admin_list_kiosk_pins() to authenticated;
grant execute on function public.admin_remove_kiosk_pin(uuid) to authenticated;
grant execute on function public.kiosk_clock_action(text) to authenticated;
