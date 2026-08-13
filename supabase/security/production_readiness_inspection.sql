-- EO-PROD-01 read-only production inspection.
-- Run only with a reviewed production connection that is authorized for reads.
\set ON_ERROR_STOP on

begin transaction read only;
set transaction read only;

select version
from supabase_migrations.schema_migrations
order by version;

with expected(table_name) as (
  values
    ('organizations'), ('organization_memberships'), ('deals'), ('message_logs'),
    ('seller_tasks'), ('buyers'), ('documents'), ('comps'), ('sequences'),
    ('communication_consents')
)
select
  expected.table_name,
  (tables.table_name is not null) as present
from expected
left join information_schema.tables tables
  on tables.table_schema = 'public'
 and tables.table_name = expected.table_name
order by expected.table_name;

select
  table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'organizations', 'organization_memberships', 'deals', 'message_logs',
    'seller_tasks', 'buyers', 'documents', 'comps', 'sequences',
    'communication_consents'
  )
order by table_name, ordinal_position;

select
  relation.relname as table_name,
  constraint_record.conname as constraint_name,
  constraint_record.contype as constraint_type,
  constraint_record.convalidated as validated,
  pg_get_constraintdef(constraint_record.oid) as definition
from pg_catalog.pg_constraint constraint_record
join pg_catalog.pg_class relation on relation.oid = constraint_record.conrelid
join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
where namespace.nspname = 'public'
  and relation.relname in (
    'organizations', 'organization_memberships', 'deals', 'message_logs',
    'seller_tasks', 'buyers', 'documents', 'comps', 'sequences',
    'communication_consents'
  )
order by relation.relname, constraint_record.conname;

select tablename, indexname, indexdef
from pg_catalog.pg_indexes
where schemaname = 'public'
  and tablename in (
    'organizations', 'organization_memberships', 'deals', 'message_logs',
    'seller_tasks', 'buyers', 'documents', 'comps', 'sequences',
    'communication_consents'
  )
order by tablename, indexname;

select
  relation.relname as table_name,
  relation.relrowsecurity as rls_enabled,
  relation.relforcerowsecurity as rls_forced
from pg_catalog.pg_class relation
join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
where namespace.nspname = 'public'
  and relation.relname in (
    'organizations', 'organization_memberships', 'deals', 'message_logs',
    'seller_tasks', 'buyers', 'documents', 'comps', 'sequences',
    'communication_consents'
  )
order by relation.relname;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename in (
    'organizations', 'organization_memberships', 'deals', 'message_logs',
    'seller_tasks', 'buyers', 'documents', 'comps', 'sequences',
    'communication_consents'
  )
order by tablename, policyname;

select * from public.tenant_table_ownership_report() order by subject;
select * from public.tenant_rls_readiness_report() order by check_name, subject;
select public.tenant_rls_is_ready() as tenant_rls_is_ready;

select 'deals' as subject, count(*) as row_count,
       count(*) filter (where organization_id is not null) as owned_count,
       count(*) filter (where organization_id is null) as unowned_count,
       count(distinct organization_id) filter (where organization_id is not null) as distinct_organization_count
from public.deals
union all
select 'message_logs', count(*), count(*) filter (where organization_id is not null), count(*) filter (where organization_id is null), count(distinct organization_id) filter (where organization_id is not null) from public.message_logs
union all
select 'seller_tasks', count(*), count(*) filter (where organization_id is not null), count(*) filter (where organization_id is null), count(distinct organization_id) filter (where organization_id is not null) from public.seller_tasks
union all
select 'buyers', count(*), count(*) filter (where organization_id is not null), count(*) filter (where organization_id is null), count(distinct organization_id) filter (where organization_id is not null) from public.buyers
union all
select 'documents', count(*), count(*) filter (where organization_id is not null), count(*) filter (where organization_id is null), count(distinct organization_id) filter (where organization_id is not null) from public.documents
union all
select 'comps', count(*), count(*) filter (where organization_id is not null), count(*) filter (where organization_id is null), count(distinct organization_id) filter (where organization_id is not null) from public.comps
union all
select 'sequences', count(*), count(*) filter (where organization_id is not null), count(*) filter (where organization_id is null), count(distinct organization_id) filter (where organization_id is not null) from public.sequences
union all
select 'communication_consents', count(*), count(*) filter (where organization_id is not null), count(*) filter (where organization_id is null), count(distinct organization_id) filter (where organization_id is not null) from public.communication_consents
order by subject;

select 'deals' as subject, count(*) as orphan_count from public.deals row_record left join public.organizations organization on organization.id = row_record.organization_id where row_record.organization_id is not null and organization.id is null
union all select 'message_logs', count(*) from public.message_logs row_record left join public.organizations organization on organization.id = row_record.organization_id where row_record.organization_id is not null and organization.id is null
union all select 'seller_tasks', count(*) from public.seller_tasks row_record left join public.organizations organization on organization.id = row_record.organization_id where row_record.organization_id is not null and organization.id is null
union all select 'buyers', count(*) from public.buyers row_record left join public.organizations organization on organization.id = row_record.organization_id where row_record.organization_id is not null and organization.id is null
union all select 'documents', count(*) from public.documents row_record left join public.organizations organization on organization.id = row_record.organization_id where row_record.organization_id is not null and organization.id is null
union all select 'comps', count(*) from public.comps row_record left join public.organizations organization on organization.id = row_record.organization_id where row_record.organization_id is not null and organization.id is null
union all select 'sequences', count(*) from public.sequences row_record left join public.organizations organization on organization.id = row_record.organization_id where row_record.organization_id is not null and organization.id is null
union all select 'communication_consents', count(*) from public.communication_consents row_record left join public.organizations organization on organization.id = row_record.organization_id where row_record.organization_id is not null and organization.id is null
order by subject;

select 'message_logs' as subject, count(*) as cross_tenant_or_missing_deal_count from public.message_logs child left join public.deals parent on parent.id = child.deal_id where child.deal_id is not null and (parent.id is null or parent.organization_id is distinct from child.organization_id)
union all select 'seller_tasks', count(*) from public.seller_tasks child left join public.deals parent on parent.id = child.deal_id where child.deal_id is not null and (parent.id is null or parent.organization_id is distinct from child.organization_id)
union all select 'documents', count(*) from public.documents child left join public.deals parent on parent.id = child.deal_id where child.deal_id is not null and (parent.id is null or parent.organization_id is distinct from child.organization_id)
union all select 'comps', count(*) from public.comps child left join public.deals parent on parent.id = child.deal_id where child.deal_id is not null and (parent.id is null or parent.organization_id is distinct from child.organization_id)
union all select 'sequences', count(*) from public.sequences child left join public.deals parent on parent.id = child.deal_id where child.deal_id is not null and (parent.id is null or parent.organization_id is distinct from child.organization_id)
order by subject;

select id, name, status, created_by
from public.organizations
order by created_at, id;

select organization_id, user_id, role, status
from public.organization_memberships
order by organization_id, role, user_id;

rollback;
