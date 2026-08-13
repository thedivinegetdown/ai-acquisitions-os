-- EO-PROD-01 REVIEW TEMPLATE ONLY. Never run without a later execution order.
-- Replace all three placeholders and review the captured preflight counts.
\set ON_ERROR_STOP on
\set target_organization_id 'REPLACE_WITH_TARGET_ORGANIZATION_UUID'
\set target_organization_name 'REPLACE_WITH_EXACT_ORGANIZATION_NAME'
\set owner_user_id 'REPLACE_WITH_ACTIVE_OWNER_USER_UUID'

begin;

select set_config('eo_prod.target_organization_id', :'target_organization_id', true);
select set_config('eo_prod.target_organization_name', :'target_organization_name', true);
select set_config('eo_prod.owner_user_id', :'owner_user_id', true);

do $$
declare
  target_text text := current_setting('eo_prod.target_organization_id');
  target_name text := current_setting('eo_prod.target_organization_name');
  owner_text text := current_setting('eo_prod.owner_user_id');
  target_id uuid;
  owner_id uuid;
  conflict_count bigint;
  child_mismatch_count bigint;
begin
  if target_text like 'REPLACE_WITH_%'
     or target_name like 'REPLACE_WITH_%'
     or owner_text like 'REPLACE_WITH_%' then
    raise exception 'All explicit production ownership placeholders must be replaced.';
  end if;

  target_id := target_text::uuid;
  owner_id := owner_text::uuid;

  if not exists (
    select 1 from public.organizations
    where id = target_id and name = target_name and status = 'active'
  ) then
    raise exception 'Target organization is unknown, inactive, or has a name mismatch.';
  end if;

  if not exists (
    select 1 from public.organization_memberships
    where organization_id = target_id
      and user_id = owner_id
      and role = 'owner'
      and status = 'active'
  ) then
    raise exception 'Target organization does not have the explicit active owner membership.';
  end if;

  select sum(issue_count) into conflict_count
  from (
    select count(*) as issue_count from public.deals where organization_id is not null and organization_id <> target_id
    union all select count(*) from public.message_logs where organization_id is not null and organization_id <> target_id
    union all select count(*) from public.seller_tasks where organization_id is not null and organization_id <> target_id
    union all select count(*) from public.buyers where organization_id is not null and organization_id <> target_id
    union all select count(*) from public.documents where organization_id is not null and organization_id <> target_id
    union all select count(*) from public.comps where organization_id is not null and organization_id <> target_id
    union all select count(*) from public.sequences where organization_id is not null and organization_id <> target_id
    union all select count(*) from public.communication_consents where organization_id <> target_id
  ) conflicts;
  if conflict_count <> 0 then
    raise exception 'Existing non-null ownership conflicts with the explicit target organization.';
  end if;

  select sum(issue_count) into child_mismatch_count
  from (
    select count(*) as issue_count from public.message_logs child left join public.deals parent on parent.id = child.deal_id where child.deal_id is not null and (parent.id is null or (child.organization_id is not null and parent.organization_id is distinct from child.organization_id))
    union all select count(*) from public.seller_tasks child left join public.deals parent on parent.id = child.deal_id where child.deal_id is not null and (parent.id is null or (child.organization_id is not null and parent.organization_id is distinct from child.organization_id))
    union all select count(*) from public.documents child left join public.deals parent on parent.id = child.deal_id where child.deal_id is not null and (parent.id is null or (child.organization_id is not null and parent.organization_id is distinct from child.organization_id))
    union all select count(*) from public.comps child left join public.deals parent on parent.id = child.deal_id where child.deal_id is not null and (parent.id is null or (child.organization_id is not null and parent.organization_id is distinct from child.organization_id))
    union all select count(*) from public.sequences child left join public.deals parent on parent.id = child.deal_id where child.deal_id is not null and (parent.id is null or (child.organization_id is not null and parent.organization_id is distinct from child.organization_id))
  ) mismatches;
  if child_mismatch_count <> 0 then
    raise exception 'Child/deal ownership or relationship mismatch blocks backfill.';
  end if;
end $$;

select * from public.tenant_table_ownership_report() order by subject;
select * from public.tenant_rls_readiness_report() order by check_name, subject;

update public.deals
set organization_id = current_setting('eo_prod.target_organization_id')::uuid
where organization_id is null;

update public.message_logs child
set organization_id = current_setting('eo_prod.target_organization_id')::uuid
where child.organization_id is null
  and (
    child.deal_id is null
    or exists (
      select 1 from public.deals parent
      where parent.id = child.deal_id
        and parent.organization_id = current_setting('eo_prod.target_organization_id')::uuid
    )
  );

update public.seller_tasks child
set organization_id = current_setting('eo_prod.target_organization_id')::uuid
where child.organization_id is null
  and (
    child.deal_id is null
    or exists (select 1 from public.deals parent where parent.id = child.deal_id and parent.organization_id = current_setting('eo_prod.target_organization_id')::uuid)
  );

update public.documents child
set organization_id = current_setting('eo_prod.target_organization_id')::uuid
where child.organization_id is null
  and (
    child.deal_id is null
    or exists (select 1 from public.deals parent where parent.id = child.deal_id and parent.organization_id = current_setting('eo_prod.target_organization_id')::uuid)
  );

update public.comps child
set organization_id = current_setting('eo_prod.target_organization_id')::uuid
where child.organization_id is null
  and (
    child.deal_id is null
    or exists (select 1 from public.deals parent where parent.id = child.deal_id and parent.organization_id = current_setting('eo_prod.target_organization_id')::uuid)
  );

update public.sequences child
set organization_id = current_setting('eo_prod.target_organization_id')::uuid
where child.organization_id is null
  and (
    child.deal_id is null
    or exists (select 1 from public.deals parent where parent.id = child.deal_id and parent.organization_id = current_setting('eo_prod.target_organization_id')::uuid)
  );

update public.buyers
set organization_id = current_setting('eo_prod.target_organization_id')::uuid
where organization_id is null;

do $$
declare
  remaining_count bigint;
  mismatch_count bigint;
begin
  select sum(issue_count) into remaining_count
  from (
    select count(*) as issue_count from public.deals where organization_id is null
    union all select count(*) from public.message_logs where organization_id is null
    union all select count(*) from public.seller_tasks where organization_id is null
    union all select count(*) from public.buyers where organization_id is null
    union all select count(*) from public.documents where organization_id is null
    union all select count(*) from public.comps where organization_id is null
    union all select count(*) from public.sequences where organization_id is null
    union all select count(*) from public.communication_consents where organization_id is null
  ) remaining;
  if remaining_count <> 0 then
    raise exception 'Backfill verification found remaining null ownership.';
  end if;

  select sum(issue_count) into mismatch_count
  from (
    select count(*) as issue_count from public.message_logs child join public.deals parent on parent.id = child.deal_id where parent.organization_id is distinct from child.organization_id
    union all select count(*) from public.seller_tasks child join public.deals parent on parent.id = child.deal_id where parent.organization_id is distinct from child.organization_id
    union all select count(*) from public.documents child join public.deals parent on parent.id = child.deal_id where parent.organization_id is distinct from child.organization_id
    union all select count(*) from public.comps child join public.deals parent on parent.id = child.deal_id where parent.organization_id is distinct from child.organization_id
    union all select count(*) from public.sequences child join public.deals parent on parent.id = child.deal_id where parent.organization_id is distinct from child.organization_id
  ) mismatches;
  if mismatch_count <> 0 then
    raise exception 'Backfill verification found cross-tenant child relationships.';
  end if;
end $$;

select * from public.tenant_table_ownership_report() order by subject;
select * from public.tenant_rls_readiness_report() order by check_name, subject;
select public.tenant_rls_is_ready() as tenant_rls_is_ready;

-- Safety default. A later explicitly authorized execution order must replace this decision.
rollback;
