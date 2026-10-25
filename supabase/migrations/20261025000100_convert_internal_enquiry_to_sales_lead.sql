create or replace function public.convert_internal_enquiry_to_sales_lead(p_enquiry_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_enquiry public.internal_enquiries%rowtype;
  v_lead_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if not (
    private.internal_user_can('general_enquiries')
    or private.internal_user_can('business_admin')
  ) then
    raise exception 'You do not have permission to convert enquiries';
  end if;

  select *
    into v_enquiry
    from public.internal_enquiries
   where id = p_enquiry_id
     and org_id = 'fba160f0-76c4-422f-898e-47b275c52d18'::uuid
   for update;

  if not found then
    raise exception 'Enquiry not found';
  end if;

  if v_enquiry.converted_lead_id is not null then
    return v_enquiry.converted_lead_id;
  end if;

  if v_enquiry.status = 'Closed' then
    raise exception 'Closed enquiries cannot be converted';
  end if;

  insert into public.sales_leads (
    org_id, company_name, contact_name, email, phone, source, stage,
    estimated_monthly_value, notes, created_by, owner_id
  ) values (
    'fba160f0-76c4-422f-898e-47b275c52d18'::uuid,
    coalesce(nullif(trim(v_enquiry.subject), ''), 'Inbound enquiry'),
    nullif(trim(coalesce(v_enquiry.contact_name, '')), ''),
    nullif(trim(coalesce(v_enquiry.email, '')), ''),
    nullif(trim(coalesce(v_enquiry.phone, '')), ''),
    'Inbound',
    'New Lead',
    0,
    concat_ws(E'\n\n', 'Converted from General Enquiries.', nullif(trim(coalesce(v_enquiry.details, '')), '')),
    (select auth.uid()),
    null
  )
  returning id into v_lead_id;

  update public.internal_enquiries
     set converted_lead_id = v_lead_id,
         status = 'Converted to Sales',
         updated_at = now()
   where id = v_enquiry.id
     and org_id = 'fba160f0-76c4-422f-898e-47b275c52d18'::uuid;

  return v_lead_id;
end;
$function$;

revoke all on function public.convert_internal_enquiry_to_sales_lead(uuid) from public;
revoke all on function public.convert_internal_enquiry_to_sales_lead(uuid) from anon;
grant execute on function public.convert_internal_enquiry_to_sales_lead(uuid) to authenticated;
