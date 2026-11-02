DROP POLICY IF EXISTS "Org administrators manage role tab settings" ON public.organization_role_tab_access;

CREATE POLICY "Org administrators insert role tab settings"
ON public.organization_role_tab_access
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = (SELECT auth.uid())
      AND up.org_id = organization_role_tab_access.org_id
      AND up.role::text = 'Administrator'
  )
);

CREATE POLICY "Org administrators update role tab settings"
ON public.organization_role_tab_access
FOR UPDATE TO authenticated
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

CREATE POLICY "Org administrators delete role tab settings"
ON public.organization_role_tab_access
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = (SELECT auth.uid())
      AND up.org_id = organization_role_tab_access.org_id
      AND up.role::text = 'Administrator'
  )
);