-- Internal Operations workspace schema
-- Applied to Supabase project WorkforceV5. Internal tenant UUID:
-- fba160f0-76c4-422f-898e-47b275c52d18

create table if not exists public.internal_departments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  purpose text,
  lead_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'Active' check (status in ('Active','Planned','Paused')),
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create table if not exists public.internal_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.internal_departments(id) on delete set null,
  title text not null,
  description text,
  assigned_to uuid references auth.users(id) on delete set null,
  due_date date,
  priority text not null default 'Medium' check (priority in ('Low','Medium','High','Urgent')),
  status text not null default 'To Do' check (status in ('To Do','In Progress','Blocked','Done')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  company_name text not null,
  contact_name text,
  email text,
  phone text,
  industry text,
  source text not null default 'Outbound',
  stage text not null default 'New Lead' check (stage in ('New Lead','Contacted','Interested','Demo Booked','Proposal Sent','Won','Lost')),
  estimated_monthly_value numeric(12,2) not null default 0 check (estimated_monthly_value >= 0),
  next_follow_up date,
  last_contacted_at timestamptz,
  notes text,
  owner_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_activities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.sales_leads(id) on delete cascade,
  activity_type text not null check (activity_type in ('Email','Call','Follow-up','Meeting','Demo','Proposal','Note')),
  summary text not null,
  activity_at timestamptz not null default now(),
  next_follow_up date,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists internal_tasks_org_status_idx on public.internal_tasks(org_id,status);
create index if not exists sales_leads_org_stage_idx on public.sales_leads(org_id,stage);
create index if not exists sales_leads_followup_idx on public.sales_leads(org_id,next_follow_up);
create index if not exists sales_activities_lead_date_idx on public.sales_activities(lead_id,activity_at desc);

alter table public.internal_departments enable row level security;
alter table public.internal_tasks enable row level security;
alter table public.sales_leads enable row level security;
alter table public.sales_activities enable row level security;

drop policy if exists internal_departments_org_access on public.internal_departments;
create policy internal_departments_org_access on public.internal_departments for all to authenticated
using (org_id = public.current_user_org_id()) with check (org_id = public.current_user_org_id());
drop policy if exists internal_tasks_org_access on public.internal_tasks;
create policy internal_tasks_org_access on public.internal_tasks for all to authenticated
using (org_id = public.current_user_org_id()) with check (org_id = public.current_user_org_id());
drop policy if exists sales_leads_org_access on public.sales_leads;
create policy sales_leads_org_access on public.sales_leads for all to authenticated
using (org_id = public.current_user_org_id()) with check (org_id = public.current_user_org_id());
drop policy if exists sales_activities_org_access on public.sales_activities;
create policy sales_activities_org_access on public.sales_activities for all to authenticated
using (org_id = public.current_user_org_id()) with check (org_id = public.current_user_org_id());

grant select, insert, update, delete on public.internal_departments, public.internal_tasks, public.sales_leads, public.sales_activities to authenticated;

insert into public.internal_departments (org_id,name,purpose) values
('fba160f0-76c4-422f-898e-47b275c52d18','Executive & Administration','Business direction, planning and company-wide performance.'),
('fba160f0-76c4-422f-898e-47b275c52d18','Marketing','Generate awareness, enquiries and qualified prospects.'),
('fba160f0-76c4-422f-898e-47b275c52d18','Sales','Manage prospects, outreach, demos, proposals and deals.'),
('fba160f0-76c4-422f-898e-47b275c52d18','Finance','Track expenses, invoices, payments and profitability.'),
('fba160f0-76c4-422f-898e-47b275c52d18','HR & Recruitment','Recruiting, staff records and onboarding.'),
('fba160f0-76c4-422f-898e-47b275c52d18','Technology & IT','Product development, platform reliability and technical incidents.'),
('fba160f0-76c4-422f-898e-47b275c52d18','Customer Success','Customer onboarding, support, renewals and service quality.'),
('fba160f0-76c4-422f-898e-47b275c52d18','Partnerships','Referral relationships and business development.')
on conflict (org_id,name) do nothing;
