-- WorkforceIQ TOTP kiosk migration. Review against live schema before applying.
create table if not exists public.workforceiq_kiosk_totp (
 employee_id uuid primary key references public.user_profiles(id) on delete cascade,
 org_id uuid not null, encrypted_secret text, pending_encrypted_secret text,
 pending_expires_at timestamptz, enrolled_at timestamptz, last_used_step bigint,
 failed_attempts integer not null default 0, locked_until timestamptz,
 updated_at timestamptz not null default now()
);
create index if not exists workforceiq_kiosk_totp_org_idx on public.workforceiq_kiosk_totp(org_id,enrolled_at);
create table if not exists public.workforceiq_kiosk_audit (
 id bigint generated always as identity primary key, org_id uuid not null, employee_id uuid,
 actor_id uuid, event_type text not null, details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists workforceiq_kiosk_audit_org_created_idx on public.workforceiq_kiosk_audit(org_id,created_at desc);
alter table public.workforceiq_kiosk_totp enable row level security;
alter table public.workforceiq_kiosk_audit enable row level security;
revoke all on public.workforceiq_kiosk_totp from public, anon, authenticated;
revoke all on public.workforceiq_kiosk_audit from public, anon, authenticated;
grant all on public.workforceiq_kiosk_totp to service_role;
grant all on public.workforceiq_kiosk_audit to service_role;

create or replace function public.workforceiq_consume_kiosk_totp_step(p_employee_id uuid,p_org_id uuid,p_step bigint)
returns boolean language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 update public.workforceiq_kiosk_totp set last_used_step=p_step,failed_attempts=0,locked_until=null,updated_at=now()
 where employee_id=p_employee_id and org_id=p_org_id and enrolled_at is not null
 and (last_used_step is null or last_used_step<p_step) and (locked_until is null or locked_until<now());
 get diagnostics n=row_count; return n=1;
end; $$;



-- Atomically count failed TOTP attempts and enforce a five-minute lockout.
create or replace function public.workforceiq_register_kiosk_totp_failure(
  p_employee_id uuid,
  p_org_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  is_locked boolean;
begin
  update public.workforceiq_kiosk_totp
  set failed_attempts = case when failed_attempts + 1 >= 5 then 0 else failed_attempts + 1 end,
      locked_until = case when failed_attempts + 1 >= 5 then now() + interval '5 minutes' else locked_until end,
      updated_at = now()
  where employee_id = p_employee_id
    and org_id = p_org_id
    and (locked_until is null or locked_until <= now())
  returning (locked_until is not null and locked_until > now()) into is_locked;

  if not found then
    return true;
  end if;
  return coalesce(is_locked, false);
end;
$function$;

revoke all on function public.workforceiq_register_kiosk_totp_failure(uuid,uuid) from public, anon, authenticated;
grant execute on function public.workforceiq_register_kiosk_totp_failure(uuid,uuid) to service_role;

-- Remove the unused PIN-era RPC if it exists from an earlier rollout.
drop function if exists public.workforceiq_kiosk_record_punch(uuid,uuid);

-- Employee self-service punch RPC. Only the Edge Function service role may call it.
-- Geofence checks happen inside PostgreSQL using the employee's tenant sites.
create or replace function public.workforceiq_kiosk_record_self_punch(
  p_employee_id uuid,
  p_org_id uuid,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_accuracy_m double precision default null,
  p_site_id uuid default null,
  p_distance_m double precision default null,
  p_geofence_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $self_punch$
declare
  open_row public.attendance%rowtype;
  employee_name text;
  punch_time timestamptz := now();
  site_row public.workforce_sites%rowtype;
  distance_m double precision;
  has_sites boolean;
begin
  perform pg_advisory_xact_lock(hashtext(p_employee_id::text));
  select full_name into employee_name
  from public.user_profiles
  where id = p_employee_id and org_id = p_org_id;
  if not found then raise exception 'Employee not found for this company'; end if;

  select * into open_row
  from public.attendance
  where user_id = p_employee_id and org_id = p_org_id and clock_out is null
  order by clock_in desc limit 1 for update;

  if found then
    update public.attendance
    set clock_out = punch_time,
        status = 'Off Duty',
        status_started_at = null,
        clock_out_latitude = p_latitude,
        clock_out_longitude = p_longitude,
        clock_out_accuracy_m = p_accuracy_m
    where id = open_row.id;
    return jsonb_build_object('employee_name', employee_name, 'action', 'CLOCK_OUT', 'event_time', punch_time);
  end if;

  if p_latitude is null or p_longitude is null
     or p_latitude < -90 or p_latitude > 90
     or p_longitude < -180 or p_longitude > 180
     or (p_accuracy_m is not null and p_accuracy_m < 0) then
    return jsonb_build_object('error', 'Valid GPS coordinates are required to clock in. Enable location services and try again.');
  end if;

  select exists(
    select 1 from public.workforce_sites
    where org_id = p_org_id and enabled = true and enforce_geofence = true
  ) into has_sites;

  if has_sites then
    select ranked.site_row, ranked.calculated_distance
    into site_row, distance_m
    from (
      select s as site_row,
        6371000 * 2 * asin(sqrt(least(1::double precision, greatest(0::double precision,
          power(sin(radians(s.latitude - p_latitude) / 2), 2) +
          cos(radians(p_latitude)) * cos(radians(s.latitude)) *
          power(sin(radians(s.longitude - p_longitude) / 2), 2)
        )))) as calculated_distance
      from public.workforce_sites s
      where s.org_id = p_org_id and s.enabled = true and s.enforce_geofence = true
        and s.latitude between -90 and 90
        and s.longitude between -180 and 180
        and (s.radius_m is null or (s.radius_m > 0 and s.radius_m < 'Infinity'::double precision))
    ) ranked
    order by ranked.calculated_distance asc
    limit 1;

    if site_row.id is null then
      return jsonb_build_object('error', 'Your company work-site geofence is not configured correctly. Contact your administrator.');
    end if;

    if distance_m > coalesce(site_row.radius_m, 100) then
      insert into public.workforce_geofence_events(
        org_id,user_id,site_id,latitude,longitude,accuracy_m,distance_m,radius_m,result,reason
      ) values (
        p_org_id,p_employee_id,site_row.id,p_latitude,p_longitude,p_accuracy_m,
        distance_m,coalesce(site_row.radius_m, 100),'OUTSIDE',
        'Clock-in blocked outside the configured geofence.'
      );
      return jsonb_build_object(
        'error',
        format('Clock-in blocked: you are %s m from %s. Allowed distance is %s m.',
          round(distance_m)::text, site_row.name, round(coalesce(site_row.radius_m, 100))::text)
      );
    end if;
  end if;

  insert into public.attendance(
    user_id,org_id,clock_in,status,status_started_at,
    clock_in_latitude,clock_in_longitude,clock_in_accuracy_m,
    clock_in_distance_m,clock_in_geofence_status,clock_in_site_id
  ) values (
    p_employee_id,p_org_id,punch_time,'Working',null,
    p_latitude,p_longitude,p_accuracy_m,
    case when has_sites then distance_m else null end,
    case when has_sites then 'INSIDE' else 'NO_GEOFENCE_CONFIGURED' end,
    case when has_sites then site_row.id else null end
  );

  insert into public.workforce_geofence_events(
    org_id,user_id,site_id,latitude,longitude,accuracy_m,distance_m,radius_m,result,reason
  ) values (
    p_org_id,p_employee_id,case when has_sites then site_row.id else null end,
    p_latitude,p_longitude,p_accuracy_m,case when has_sites then distance_m else null end,
    case when has_sites then site_row.radius_m else null end,
    case when has_sites then 'INSIDE' else 'NO_GEOFENCE_CONFIGURED' end,
    case when has_sites then 'Authenticator-verified clock-in inside configured geofence.'
      else 'Authenticator-verified clock-in; no enforced geofence configured.' end
  );

  return jsonb_build_object('employee_name', employee_name, 'action', 'CLOCK_IN', 'event_time', punch_time);
end;
$self_punch$;

revoke all on function public.workforceiq_kiosk_record_self_punch(uuid,uuid,double precision,double precision,double precision,uuid,double precision,text) from public, anon, authenticated;
grant execute on function public.workforceiq_kiosk_record_self_punch(uuid,uuid,double precision,double precision,double precision,uuid,double precision,text) to service_role;


-- Remove broad browser privileges (including DELETE/TRUNCATE) from attendance.
-- Authenticated users retain read access and may update only status fields.
revoke all on table public.attendance from public, anon, authenticated;
grant select on table public.attendance to authenticated;
grant update (status, status_started_at) on table public.attendance to authenticated;
