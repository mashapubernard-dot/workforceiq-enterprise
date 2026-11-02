-- Keep the broad manager helper limited to roles already allowed to administer devices.
CREATE OR REPLACE FUNCTION public.is_workforce_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = (SELECT auth.uid())
      AND role::text IN ('Administrator', 'Supervisor', 'Team Leader')
  );
$function$;

-- Private, read-only role lookup used by RLS policies without recursive profile queries.
CREATE OR REPLACE FUNCTION private.current_workforce_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT up.role::text
  FROM public.user_profiles up
  WHERE up.id = (SELECT auth.uid())
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION private.current_workforce_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.current_workforce_role() FROM anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_workforce_role() TO authenticated;

-- HR and Real-Time Analysts can read organisation profiles without receiving device-admin rights.
DROP POLICY IF EXISTS "HR and analysts can view organisation profiles" ON public.user_profiles;
CREATE POLICY "HR and analysts can view organisation profiles"
ON public.user_profiles
FOR SELECT TO authenticated
USING (
  org_id = public.current_user_org_id()
  AND private.current_workforce_role() IN ('HR', 'Real-Time Analyst')
);

-- Attendance is personal by default; designated workforce roles can see the organisation feed.
DROP POLICY IF EXISTS "Tenant users can view attendance" ON public.attendance;
DROP POLICY IF EXISTS "Workforce roles can view organisation attendance" ON public.attendance;
CREATE POLICY "Workforce roles can view organisation attendance"
ON public.attendance
FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (
    org_id = public.current_user_org_id()
    AND private.current_workforce_role() IN (
      'Administrator', 'Supervisor', 'Team Leader', 'HR', 'Real-Time Analyst'
    )
  )
);

-- Schedules are personal by default; workforce leads, HR and analysts can view the organisation schedule.
DROP POLICY IF EXISTS "Tenant managers can view schedules" ON public.schedules;
DROP POLICY IF EXISTS "Workforce roles can view organisation schedules" ON public.schedules;
CREATE POLICY "Workforce roles can view organisation schedules"
ON public.schedules
FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (
    org_id = public.current_user_org_id()
    AND private.current_workforce_role() IN (
      'Administrator', 'Supervisor', 'Team Leader', 'HR', 'Real-Time Analyst'
    )
  )
);

-- HR can create and edit schedules, but deletion remains limited to existing Admin/Supervisor policy.
DROP POLICY IF EXISTS "Tenant admins and supervisors can create schedules" ON public.schedules;
CREATE POLICY "Tenant admins HR and supervisors can create schedules"
ON public.schedules
FOR INSERT TO authenticated
WITH CHECK (
  org_id = public.current_user_org_id()
  AND private.current_workforce_role() IN ('Administrator', 'Supervisor', 'HR')
);

DROP POLICY IF EXISTS "Tenant admins and supervisors can update schedules" ON public.schedules;
CREATE POLICY "Tenant admins HR and supervisors can update schedules"
ON public.schedules
FOR UPDATE TO authenticated
USING (
  org_id = public.current_user_org_id()
  AND private.current_workforce_role() IN ('Administrator', 'Supervisor', 'HR')
)
WITH CHECK (
  org_id = public.current_user_org_id()
  AND private.current_workforce_role() IN ('Administrator', 'Supervisor', 'HR')
);