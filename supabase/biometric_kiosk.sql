-- WorkforceIQ TOTP kiosk migration. Review against live schema before applying.
create extension if not exists pgcrypto with schema extensions;
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
revoke all on public.workforceiq_kiosk_totp from anon,authenticated;
revoke all on public.workforceiq_kiosk_audit from anon,authenticated;

create or replace function public.workforceiq_consume_kiosk_totp_step(p_employee_id uuid,p_org_id uuid,p_step bigint)
returns boolean language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 update public.workforceiq_kiosk_totp set last_used_step=p_step,failed_attempts=0,locked_until=null,updated_at=now()
 where employee_id=p_employee_id and org_id=p_org_id and enrolled_at is not null
 and (last_used_step is null or last_used_step<p_step) and (locked_until is null or locked_until<now());
 get diagnostics n=row_count; return n=1;
end; $$;

create or replace function public.workforceiq_kiosk_record_punch(p_employee_id uuid,p_org_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare open_id uuid; employee_name text; punch_time timestamptz:=now();
begin
 perform pg_advisory_xact_lock(hashtext(p_employee_id::text));
 select full_name into employee_name from public.user_profiles where id=p_employee_id and org_id=p_org_id;
 if employee_name is null then raise exception 'Employee not found for this company'; end if;
 select id into open_id from public.attendance where user_id=p_employee_id and clock_out is null order by clock_in desc limit 1 for update;
 if open_id is not null then
  update public.attendance set clock_out=punch_time,status='Off Duty',status_started_at=punch_time where id=open_id;
  return jsonb_build_object('employee_name',employee_name,'action','CLOCK_OUT','event_time',punch_time);
 end if;
 insert into public.attendance(user_id,clock_in,status,status_started_at) values(p_employee_id,punch_time,'Working',punch_time);
 return jsonb_build_object('employee_name',employee_name,'action','CLOCK_IN','event_time',punch_time);
end; $$;
revoke all on function public.workforceiq_consume_kiosk_totp_step(uuid,uuid,bigint) from public,anon,authenticated;
revoke all on function public.workforceiq_kiosk_record_punch(uuid,uuid) from public,anon,authenticated;
grant execute on function public.workforceiq_consume_kiosk_totp_step(uuid,uuid,bigint) to service_role;
grant execute on function public.workforceiq_kiosk_record_punch(uuid,uuid) to service_role;