-- WorkforceIQ platform subscription and billing administration.
-- Access is restricted to authenticated Super Admin users; no payment processor is connected by this migration.

create table if not exists public.platform_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations(id) on delete cascade,
  plan text not null default 'Starter' check (plan in ('Starter','Professional','Enterprise')),
  billing_cycle text not null default 'Monthly' check (billing_cycle in ('Monthly','Annual')),
  monthly_price numeric(12,2) not null default 499 check (monthly_price >= 0),
  employee_limit integer not null default 10 check (employee_limit >= 1),
  subscription_status text not null default 'Trial' check (subscription_status in ('Trial','Active','Past Due','Suspended','Cancelled')),
  payment_status text not null default 'Unpaid' check (payment_status in ('Paid','Unpaid','Overdue','Waived')),
  next_billing_at date,
  last_payment_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_billing_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid references public.platform_subscriptions(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  status text not null default 'Paid' check (status in ('Paid','Refunded','Failed')),
  provider text not null default 'Manual',
  provider_reference text,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists platform_subscriptions_status_idx
  on public.platform_subscriptions (subscription_status, payment_status);
create index if not exists platform_billing_payments_org_created_idx
  on public.platform_billing_payments (org_id, created_at desc);

alter table public.platform_subscriptions enable row level security;
alter table public.platform_billing_payments enable row level security;

drop policy if exists "Master Admin manages platform subscriptions" on public.platform_subscriptions;
create policy "Master Admin manages platform subscriptions"
  on public.platform_subscriptions
  for all
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = (select auth.uid())
        and up.role = 'Super Admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles up
      where up.id = (select auth.uid())
        and up.role = 'Super Admin'
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
        and up.role = 'Super Admin'
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
        and up.role = 'Super Admin'
    )
  );

grant select, insert, update, delete on public.platform_subscriptions to authenticated;
grant select, insert on public.platform_billing_payments to authenticated;
