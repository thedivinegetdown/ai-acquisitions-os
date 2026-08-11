-- MANUAL STAGED ACTIVATION ONLY. Do not run until ownership has been backfilled,
-- all checks are clear, and application paths have passed staging validation.
begin;

select public.assert_tenant_rls_ready();

do $$
declare
  missing_policy_count bigint;
begin
  select count(*) into missing_policy_count
  from (values
    ('organizations', 'organizations_select_member'),
    ('organizations', 'organizations_update_owner'),
    ('organization_memberships', 'organization_memberships_select_member'),
    ('organization_memberships', 'organization_memberships_insert_owner'),
    ('organization_memberships', 'organization_memberships_update_owner'),
    ('deals', 'deals_select_member'), ('deals', 'deals_insert_writer'), ('deals', 'deals_update_writer'),
    ('message_logs', 'message_logs_select_member'), ('message_logs', 'message_logs_insert_writer'), ('message_logs', 'message_logs_update_writer'),
    ('seller_tasks', 'seller_tasks_select_member'), ('seller_tasks', 'seller_tasks_insert_writer'), ('seller_tasks', 'seller_tasks_update_writer'),
    ('buyers', 'buyers_select_member'), ('buyers', 'buyers_insert_writer'), ('buyers', 'buyers_update_writer'),
    ('documents', 'documents_select_member'), ('documents', 'documents_insert_writer'), ('documents', 'documents_update_writer'),
    ('comps', 'comps_select_member'), ('comps', 'comps_insert_writer'), ('comps', 'comps_update_writer'),
    ('sequences', 'sequences_select_member'), ('sequences', 'sequences_insert_writer'), ('sequences', 'sequences_update_writer')
  ) required(table_name, policy_name)
  where not exists (
    select 1 from pg_catalog.pg_policies existing_policy
    where existing_policy.schemaname = 'public'
      and existing_policy.tablename = required.table_name
      and existing_policy.policyname = required.policy_name
  );

  if missing_policy_count <> 0 then
    raise exception 'Tenant RLS activation blocked: % required policies are missing.', missing_policy_count;
  end if;
end $$;

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.deals enable row level security;
alter table public.message_logs enable row level security;
alter table public.seller_tasks enable row level security;
alter table public.buyers enable row level security;
alter table public.documents enable row level security;
alter table public.comps enable row level security;
alter table public.sequences enable row level security;

do $$
begin
  if exists (
    select 1
    from (values
      ('organizations'), ('organization_memberships'), ('deals'),
      ('message_logs'), ('seller_tasks'), ('buyers'), ('documents'),
      ('comps'), ('sequences')
    ) required(table_name)
    left join (
      select relation.oid, relation.relname, relation.relrowsecurity
      from pg_catalog.pg_class relation
      join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
    ) relation on relation.relname = required.table_name
    where relation.oid is null or not relation.relrowsecurity
  ) then
    raise exception 'Tenant RLS activation verification failed.';
  end if;
end $$;

commit;
