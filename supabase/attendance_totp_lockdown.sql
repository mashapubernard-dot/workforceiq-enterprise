-- WorkforceIQ attendance write lockdown.
-- Apply only after the new TOTP-enabled app is live on main.
-- This removes direct client clock-in/clock-out writes, DELETE and TRUNCATE.
begin;

revoke all on table public.attendance from public, anon, authenticated;
grant select on table public.attendance to authenticated;
grant update (status, status_started_at) on table public.attendance to authenticated;

commit;
