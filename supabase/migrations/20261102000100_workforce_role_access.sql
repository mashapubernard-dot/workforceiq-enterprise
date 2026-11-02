-- WorkforceIQ: six operational roles and organisation-specific tab permissions.
-- Keep legacy Supervisor/Employee enum values so existing accounts and attendance history remain valid.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'HR';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'Technical Associate';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'IT';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'Real-Time Analyst';

CREATE TABLE IF NOT EXISTS public.organization_role_tab_access (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('HR', 'Technical Associate', 'IT', 'Real-Time Analyst', 'Team Leader')),
  blocked_tabs text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (org_id, role)
);

ALTER TABLE public.organization_role_tab_access ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_role_tab_access TO authenticated;

DROP POLICY IF EXISTS "Org members can read their role tab settings" ON public.organization_role_tab_access;
CREATE POLICY "Org members can read their role tab settings"
ON public.organization_role_tab_access
FOR SELECT TO authenticated
USING (org_id = public.current_user_org_id());

DROP POLICY IF EXISTS "Org administrators manage role tab settings" ON public.organization_role_tab_access;
CREATE POLICY "Org administrators manage role tab settings"
ON public.organization_role_tab_access
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = (SELECT auth.uid())
      AND up.org_id = organization_role_tab_access.org_id
      AND up.role::text = 'Administrator'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = (SELECT auth.uid())
      AND up.org_id = organization_role_tab_access.org_id
      AND up.role::text = 'Administrator'
  )
);

-- HR can read organisation staff profiles for HR administration, but cannot change roles through table access.
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
      AND role::text IN ('Administrator', 'Supervisor', 'Team Leader', 'HR')
  );
$function$;

-- Narrow role-change endpoint: tenant admins can change another member's operational role,
-- but cannot edit themselves, move users between tenants, or grant platform-admin roles.
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.set_workforce_user_role(target_user_id uuid, new_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  actor_org uuid;
  target_org uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT up.org_id
    INTO actor_org
  FROM public.user_profiles up
  WHERE up.id = (SELECT auth.uid())
    AND up.role::text = 'Administrator';

  IF actor_org IS NULL THEN
    RAISE EXCEPTION 'Only an organisation Administrator can change roles' USING ERRCODE = '42501';
  END IF;

  IF new_role NOT IN ('Administrator', 'HR', 'Technical Associate', 'IT', 'Real-Time Analyst', 'Team Leader') THEN
    RAISE EXCEPTION 'Invalid operational role' USING ERRCODE = '22023';
  END IF;

  SELECT up.org_id
    INTO target_org
  FROM public.user_profiles up
  WHERE up.id = target_user_id;

  IF target_org IS DISTINCT FROM actor_org OR target_user_id = (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'You can only change another member of your own organisation' USING ERRCODE = '42501';
  END IF;

  UPDATE public.user_profiles
  SET role = new_role::public.app_role,
      updated_at = now()
  WHERE id = target_user_id
    AND org_id = actor_org;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found in this organisation' USING ERRCODE = 'P0002';
  END IF;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION private.set_workforce_user_role(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.set_workforce_user_role(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION private.set_workforce_user_role(uuid, text) TO authenticated;

-- Expose a restricted RPC wrapper in the private schema is intentionally avoided:
-- the client calls this function through PostgREST only if the private schema is exposed.
-- Instead, add a public invoker wrapper with no elevated privileges; execution delegates to the
-- guarded private function above.
CREATE OR REPLACE FUNCTION public.set_workforce_user_role(target_user_id uuid, new_role text)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT private.set_workforce_user_role(target_user_id, new_role);
$function$;

REVOKE ALL ON FUNCTION public.set_workforce_user_role(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_workforce_user_role(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_workforce_user_role(uuid, text) TO authenticated;
