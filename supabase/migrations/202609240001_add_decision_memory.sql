-- Build 5 / DI-07: append-only Decision Memory. This records historical
-- recommendations and human decisions; it does not participate in scoring.

create table if not exists public.decision_recommendation_snapshots (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null,
  organization_id uuid not null,
  snapshot_number integer not null,
  memory_contract_version text not null,
  decision_contract_version text not null,
  recalculation_contract_version text not null,
  recommendation_result jsonb not null,
  canonical_input_fingerprint text not null,
  recommendation_basis jsonb not null default '{}'::jsonb,
  evaluated_at timestamptz not null,
  actor_id uuid default auth.uid(),
  actor_reference text,
  created_at timestamptz not null default now(),
  constraint decision_recommendation_snapshots_deal_organization_fkey
    foreign key (deal_id, organization_id)
    references public.deals (id, organization_id)
    on delete restrict,
  constraint decision_recommendation_snapshots_number_positive
    check (snapshot_number > 0),
  constraint decision_recommendation_snapshots_result_object
    check (jsonb_typeof(recommendation_result) = 'object'),
  constraint decision_recommendation_snapshots_basis_object
    check (jsonb_typeof(recommendation_basis) = 'object'),
  constraint decision_recommendation_snapshots_fingerprint_present
    check (length(btrim(canonical_input_fingerprint)) > 0),
  constraint decision_recommendation_snapshots_deal_number_key
    unique (organization_id, deal_id, snapshot_number),
  constraint decision_recommendation_snapshots_scope_key
    unique (id, deal_id, organization_id)
);

create index if not exists decision_recommendation_snapshots_deal_latest_idx
  on public.decision_recommendation_snapshots (organization_id, deal_id, snapshot_number desc);

create or replace function public.prepare_decision_recommendation_snapshot()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  previous public.decision_recommendation_snapshots%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.deal_id::text, 2));

  select * into previous
  from public.decision_recommendation_snapshots
  where deal_id = new.deal_id and organization_id = new.organization_id
  order by snapshot_number desc
  limit 1;

  -- Reloads and concurrent renders of the same DI-06 result are idempotent.
  if previous.id is not null
    and previous.canonical_input_fingerprint = new.canonical_input_fingerprint
    and previous.decision_contract_version = new.decision_contract_version
    and previous.recalculation_contract_version = new.recalculation_contract_version
    and (previous.recommendation_result - 'evaluatedTimestamp' - 'expirationTimestamp')
      = (new.recommendation_result - 'evaluatedTimestamp' - 'expirationTimestamp')
    and previous.recommendation_basis = new.recommendation_basis then
    return null;
  end if;

  new.snapshot_number := coalesce(previous.snapshot_number, 0) + 1;
  return new;
end;
$$;

create trigger decision_recommendation_snapshots_prepare_insert
  before insert on public.decision_recommendation_snapshots
  for each row execute function public.prepare_decision_recommendation_snapshot();

create table if not exists public.decision_owner_decisions (
  id uuid primary key default gen_random_uuid(),
  recommendation_snapshot_id uuid not null,
  deal_id uuid not null,
  organization_id uuid not null,
  decision_type text not null,
  override_flag boolean not null,
  alternative_result jsonb,
  reason text,
  actor_id uuid not null default auth.uid(),
  actor_reference text not null,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint decision_owner_decisions_snapshot_scope_fkey
    foreign key (recommendation_snapshot_id, deal_id, organization_id)
    references public.decision_recommendation_snapshots (id, deal_id, organization_id)
    on delete restrict,
  constraint decision_owner_decisions_type_check
    check (decision_type in ('followed', 'alternative')),
  constraint decision_owner_decisions_override_consistent
    check (override_flag = (decision_type = 'alternative')),
  constraint decision_owner_decisions_alternative_object
    check (alternative_result is null or jsonb_typeof(alternative_result) = 'object'),
  constraint decision_owner_decisions_alternative_required
    check (
      (decision_type = 'followed' and alternative_result is null)
      or (decision_type = 'alternative' and length(btrim(alternative_result->>'label')) > 0)
    ),
  constraint decision_owner_decisions_override_reason_required
    check (not override_flag or coalesce(length(btrim(reason)), 0) > 0),
  constraint decision_owner_decisions_actor_present
    check (length(btrim(actor_reference)) > 0),
  constraint decision_owner_decisions_snapshot_key unique (recommendation_snapshot_id)
);

create index if not exists decision_owner_decisions_deal_decided_idx
  on public.decision_owner_decisions (organization_id, deal_id, decided_at);

create or replace function public.reject_decision_memory_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'Decision Memory is immutable; append a new recommendation boundary.';
end;
$$;

create trigger decision_recommendation_snapshots_immutable
  before update or delete on public.decision_recommendation_snapshots
  for each row execute function public.reject_decision_memory_mutation();
create trigger decision_owner_decisions_immutable
  before update or delete on public.decision_owner_decisions
  for each row execute function public.reject_decision_memory_mutation();

create policy decision_recommendation_snapshots_select_member
  on public.decision_recommendation_snapshots for select to authenticated
  using (public.is_organization_member(organization_id));
create policy decision_recommendation_snapshots_insert_writer
  on public.decision_recommendation_snapshots for insert to authenticated
  with check (public.has_organization_role(organization_id, array['owner', 'admin', 'analyst']));
create policy decision_owner_decisions_select_member
  on public.decision_owner_decisions for select to authenticated
  using (public.is_organization_member(organization_id));
create policy decision_owner_decisions_insert_owner
  on public.decision_owner_decisions for insert to authenticated
  with check (public.has_organization_role(organization_id, array['owner', 'admin']));

create or replace function public.tenant_table_ownership_report()
returns table (subject text, row_count bigint, null_organization_count bigint)
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select 'deals', count(*), count(*) filter (where organization_id is null) from public.deals
  union all select 'message_logs', count(*), count(*) filter (where organization_id is null) from public.message_logs
  union all select 'seller_tasks', count(*), count(*) filter (where organization_id is null) from public.seller_tasks
  union all select 'buyers', count(*), count(*) filter (where organization_id is null) from public.buyers
  union all select 'documents', count(*), count(*) filter (where organization_id is null) from public.documents
  union all select 'comps', count(*), count(*) filter (where organization_id is null) from public.comps
  union all select 'sequences', count(*), count(*) filter (where organization_id is null) from public.sequences
  union all select 'offer_revisions', count(*), count(*) filter (where organization_id is null) from public.offer_revisions
  union all select 'deal_closing_revisions', count(*), count(*) filter (where organization_id is null) from public.deal_closing_revisions
  union all select 'decision_recommendation_snapshots', count(*), count(*) filter (where organization_id is null) from public.decision_recommendation_snapshots
  union all select 'decision_owner_decisions', count(*), count(*) filter (where organization_id is null) from public.decision_owner_decisions;
$$;

revoke all on function public.tenant_table_ownership_report() from public;
grant execute on function public.tenant_table_ownership_report() to service_role;

create or replace function public.tenant_rls_readiness_report()
returns table (check_name text, subject text, violation_count bigint)
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select 'null_organization_id', 'deals', count(*) from public.deals where organization_id is null
  union all select 'null_organization_id', 'message_logs', count(*) from public.message_logs where organization_id is null
  union all select 'null_organization_id', 'seller_tasks', count(*) from public.seller_tasks where organization_id is null
  union all select 'null_organization_id', 'buyers', count(*) from public.buyers where organization_id is null
  union all select 'null_organization_id', 'documents', count(*) from public.documents where organization_id is null
  union all select 'null_organization_id', 'comps', count(*) from public.comps where organization_id is null
  union all select 'null_organization_id', 'sequences', count(*) from public.sequences where organization_id is null
  union all select 'null_organization_id', 'offer_revisions', count(*) from public.offer_revisions where organization_id is null
  union all select 'null_organization_id', 'deal_closing_revisions', count(*) from public.deal_closing_revisions where organization_id is null
  union all select 'null_organization_id', 'decision_recommendation_snapshots', count(*) from public.decision_recommendation_snapshots where organization_id is null
  union all select 'null_organization_id', 'decision_owner_decisions', count(*) from public.decision_owner_decisions where organization_id is null
  union all select 'orphan_organization_id', 'deals', count(*) from public.deals t left join public.organizations o on o.id=t.organization_id where t.organization_id is not null and o.id is null
  union all select 'orphan_organization_id', 'message_logs', count(*) from public.message_logs t left join public.organizations o on o.id=t.organization_id where t.organization_id is not null and o.id is null
  union all select 'orphan_organization_id', 'seller_tasks', count(*) from public.seller_tasks t left join public.organizations o on o.id=t.organization_id where t.organization_id is not null and o.id is null
  union all select 'orphan_organization_id', 'buyers', count(*) from public.buyers t left join public.organizations o on o.id=t.organization_id where t.organization_id is not null and o.id is null
  union all select 'orphan_organization_id', 'documents', count(*) from public.documents t left join public.organizations o on o.id=t.organization_id where t.organization_id is not null and o.id is null
  union all select 'orphan_organization_id', 'comps', count(*) from public.comps t left join public.organizations o on o.id=t.organization_id where t.organization_id is not null and o.id is null
  union all select 'orphan_organization_id', 'sequences', count(*) from public.sequences t left join public.organizations o on o.id=t.organization_id where t.organization_id is not null and o.id is null
  union all select 'orphan_organization_id', 'offer_revisions', count(*) from public.offer_revisions t left join public.organizations o on o.id=t.organization_id where o.id is null
  union all select 'orphan_organization_id', 'deal_closing_revisions', count(*) from public.deal_closing_revisions t left join public.organizations o on o.id=t.organization_id where o.id is null
  union all select 'orphan_organization_id', 'decision_recommendation_snapshots', count(*) from public.decision_recommendation_snapshots t left join public.organizations o on o.id=t.organization_id where o.id is null
  union all select 'orphan_organization_id', 'decision_owner_decisions', count(*) from public.decision_owner_decisions t left join public.organizations o on o.id=t.organization_id where o.id is null
  union all select 'cross_tenant_deal', 'message_logs', count(*) from public.message_logs c join public.deals p on p.id=c.deal_id where c.organization_id is not null and p.organization_id is distinct from c.organization_id
  union all select 'cross_tenant_deal', 'seller_tasks', count(*) from public.seller_tasks c join public.deals p on p.id=c.deal_id where c.organization_id is not null and p.organization_id is distinct from c.organization_id
  union all select 'cross_tenant_deal', 'documents', count(*) from public.documents c join public.deals p on p.id=c.deal_id where c.organization_id is not null and p.organization_id is distinct from c.organization_id
  union all select 'cross_tenant_deal', 'comps', count(*) from public.comps c join public.deals p on p.id=c.deal_id where c.organization_id is not null and p.organization_id is distinct from c.organization_id
  union all select 'cross_tenant_deal', 'sequences', count(*) from public.sequences c join public.deals p on p.id=c.deal_id where c.organization_id is not null and p.organization_id is distinct from c.organization_id
  union all select 'cross_tenant_deal', 'offer_revisions', count(*) from public.offer_revisions c join public.deals p on p.id=c.deal_id where p.organization_id is distinct from c.organization_id
  union all select 'cross_tenant_deal', 'deal_closing_revisions', count(*) from public.deal_closing_revisions c join public.deals p on p.id=c.deal_id where p.organization_id is distinct from c.organization_id
  union all select 'cross_tenant_deal', 'decision_recommendation_snapshots', count(*) from public.decision_recommendation_snapshots c join public.deals p on p.id=c.deal_id where p.organization_id is distinct from c.organization_id
  union all select 'cross_tenant_deal', 'decision_owner_decisions', count(*) from public.decision_owner_decisions c join public.deals p on p.id=c.deal_id where p.organization_id is distinct from c.organization_id
  union all select 'cross_tenant_snapshot', 'decision_owner_decisions', count(*)
    from public.decision_owner_decisions d
    join public.decision_recommendation_snapshots s on s.id=d.recommendation_snapshot_id
    where (s.deal_id, s.organization_id) is distinct from (d.deal_id, d.organization_id)
  union all select 'active_organization_without_owner', 'organizations', count(*)
  from public.organizations o where o.status='active' and not exists (
    select 1 from public.organization_memberships m
    where m.organization_id=o.id and m.role='owner' and m.status='active'
  );
$$;

revoke all on function public.tenant_rls_readiness_report() from public;
grant execute on function public.tenant_rls_readiness_report() to service_role;
