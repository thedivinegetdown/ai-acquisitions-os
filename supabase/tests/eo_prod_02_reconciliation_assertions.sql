do $$
begin
  if (select count(*) from public.deals) <> 16 then raise exception 'synthetic deals changed'; end if;
  if (select count(*) from public.message_logs) <> 7 then raise exception 'synthetic messages changed'; end if;
  if (select count(*) from public."Deals") <> 1 then raise exception 'legacy Deals changed'; end if;
  if (select count(*) from public.activities) <> 1 then raise exception 'legacy activities changed'; end if;
  if (select count(*) from public.leads) <> 1 then raise exception 'legacy leads changed'; end if;

  if exists(select 1 from public.deals where id::text not like '10000000-0000-0000-0000-%') then raise exception 'deal IDs changed'; end if;
  if exists(select 1 from public.message_logs where id::text not like '20000000-0000-0000-0000-%') then raise exception 'message IDs changed'; end if;

  if to_regclass('public.seller_tasks') is null or to_regclass('public.organizations') is null
     or to_regclass('public.organization_memberships') is null
     or to_regclass('public.communication_consents') is null then
    raise exception 'required table missing';
  end if;

  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='deals' and column_name='organization_id')
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='deals' and column_name='bedrooms')
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='message_logs' and column_name='provider_status') then
    raise exception 'required reconciliation column missing';
  end if;

  if exists(select 1 from public.deals where organization_id is not null) then raise exception 'ownership assigned implicitly'; end if;
  if exists(select 1 from public.deals where bedrooms is not null or bathrooms is not null or property_condition is not null) then raise exception 'legacy aliases populated implicitly'; end if;

  if not exists(select 1 from pg_policies where schemaname='public' and tablename='deals' and policyname='Allow all for now')
     or not exists(select 1 from pg_policies where schemaname='public' and tablename='message_logs' and policyname='Allow read access') then
    raise exception 'legacy policy removed';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.deals'::regclass) then raise exception 'legacy RLS flag changed'; end if;

  if to_regnamespace('supabase_migrations') is not null then raise exception 'migration ledger falsified'; end if;
end $$;
