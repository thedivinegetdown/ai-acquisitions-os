do $$
declare
  missing_count integer;
begin
  select count(*) into missing_count
  from unnest(array[
    'organizations', 'organization_memberships', 'communication_consents',
    'deals', 'message_logs', 'seller_tasks', 'buyers', 'documents', 'comps', 'sequences'
  ]) expected(table_name)
  where to_regclass('public.' || expected.table_name) is null;
  if missing_count <> 0 then
    raise exception 'EO-VAL-01 schema check failed: % expected tables missing', missing_count;
  end if;

  select count(*) into missing_count
  from (values
    ('deals', 'organization_id'),
    ('message_logs', 'organization_id'),
    ('message_logs', 'provider_message_id'),
    ('message_logs', 'provider_status'),
    ('seller_tasks', 'organization_id'),
    ('buyers', 'organization_id'),
    ('documents', 'organization_id'),
    ('comps', 'organization_id'),
    ('sequences', 'organization_id'),
    ('communication_consents', 'organization_id'),
    ('communication_consents', 'status')
  ) expected(table_name, column_name)
  where not exists (
    select 1
    from information_schema.columns column_definition
    where column_definition.table_schema = 'public'
      and column_definition.table_name = expected.table_name
      and column_definition.column_name = expected.column_name
  );
  if missing_count <> 0 then
    raise exception 'EO-VAL-01 schema check failed: % expected columns missing', missing_count;
  end if;

  select count(*) into missing_count
  from unnest(array[
    'message_logs_deal_organization_fkey',
    'seller_tasks_deal_organization_fkey',
    'documents_deal_organization_fkey',
    'comps_deal_organization_fkey',
    'sequences_deal_organization_fkey',
    'communication_consents_org_phone_channel_key'
  ]) expected(constraint_name)
  where not exists (
    select 1 from pg_catalog.pg_constraint constraint_definition
    where constraint_definition.conname = expected.constraint_name
  );
  if missing_count <> 0 then
    raise exception 'EO-VAL-01 schema check failed: % expected constraints missing', missing_count;
  end if;

  select count(*) into missing_count
  from unnest(array[
    'deals_organization_created_at_idx',
    'message_logs_provider_message_id_uidx',
    'message_logs_org_provider_status_idx',
    'communication_consents_org_status_idx'
  ]) expected(index_name)
  where to_regclass('public.' || expected.index_name) is null;
  if missing_count <> 0 then
    raise exception 'EO-VAL-01 schema check failed: % expected indexes missing', missing_count;
  end if;
end $$;
