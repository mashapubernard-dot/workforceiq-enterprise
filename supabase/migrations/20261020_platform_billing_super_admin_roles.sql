-- Allow both supported platform-level admin roles to administer billing.
drop policy if exists "Master Admin manages platform subscriptions" on public.platform_subscriptions;
create policy "Master Admin manages platform subscriptions"
  on public.platform_subscriptions
  for all
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = (select auth.uid())
        and up.role in ('Super Admin', 'Platform Super Admin')
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles up
      where up.id = (select auth.uid())
        and up.role in ('Super Admin', 'Platform Super Admin')
    )
  );

drop policy if exists "Master Admin reads platform billing payments" on public.platform_billing_payments;
create policy "Master Admin reads platform billing payments"
  on public.platform_billing_payments
  for select
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = (select auth.uid())
        and up.role in ('Super Admin', 'Platform Super Admin')
    )
  );

drop policy if exists "Master Admin records platform billing payments" on public.platform_billing_payments;
create policy "Master Admin records platform billing payments"
  on public.platform_billing_payments
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.user_profiles up
      where up.id = (select auth.uid())
        and up.role in ('Super Admin', 'Platform Super Admin')
    )
  );