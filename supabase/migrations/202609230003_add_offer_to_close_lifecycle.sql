-- Build 3: immutable offer and closing snapshots are authoritative. Existing
-- mutable deal columns remain read-compatible projections maintained only by
-- the insert triggers below.

create table if not exists public.offer_revisions (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null,
  organization_id uuid not null,
  revision_number integer not null,
  supersedes_revision_id uuid,
  revision_kind text not null default 'offer',
  status text not null default 'draft',
  offer_amount numeric not null,
  terms jsonb not null default '{}'::jsonb,
  decision_basis jsonb not null default '{}'::jsonb,
  follow_up_date date,
  notes text,
  actor_id uuid default auth.uid(),
  actor_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offer_revisions_deal_organization_fkey
    foreign key (deal_id, organization_id)
    references public.deals (id, organization_id)
    on delete restrict,
  constraint offer_revisions_supersedes_fkey
    foreign key (supersedes_revision_id)
    references public.offer_revisions (id)
    on delete restrict,
  constraint offer_revisions_revision_kind_check
    check (revision_kind in ('offer', 'seller_counter')),
  constraint offer_revisions_status_check
    check (status in ('draft', 'sent', 'countered', 'accepted', 'rejected', 'withdrawn')),
  constraint offer_revisions_amount_nonnegative check (offer_amount >= 0),
  constraint offer_revisions_terms_object check (jsonb_typeof(terms) = 'object'),
  constraint offer_revisions_decision_basis_object check (jsonb_typeof(decision_basis) = 'object'),
  constraint offer_revisions_revision_positive check (revision_number > 0),
  constraint offer_revisions_deal_revision_key unique (deal_id, revision_number),
  constraint offer_revisions_id_organization_key unique (id, organization_id),
  constraint offer_revisions_id_deal_organization_key unique (id, deal_id, organization_id)
);

create index if not exists offer_revisions_deal_latest_idx
  on public.offer_revisions (deal_id, revision_number desc);
create index if not exists offer_revisions_organization_created_at_idx
  on public.offer_revisions (organization_id, created_at desc);

create or replace function public.prepare_offer_revision()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  previous public.offer_revisions%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.deal_id::text, 0));

  select * into previous
  from public.offer_revisions
  where deal_id = new.deal_id
  order by revision_number desc
  limit 1;

  if previous.id is null then
    if new.status <> 'draft' then
      raise exception 'The first offer revision must be draft.';
    end if;
    new.revision_number := 1;
    new.supersedes_revision_id := null;
  else
    if previous.organization_id <> new.organization_id then
      raise exception 'Offer revision organization must match its history.';
    end if;
    if previous.status = 'accepted' then
      raise exception 'Accepted offer history is terminal.';
    end if;
    if previous.status in ('rejected', 'withdrawn') and new.status <> 'draft' then
      raise exception 'A terminal offer may only restart with a new draft.';
    end if;
    if previous.status = 'draft' and new.status not in ('draft', 'sent', 'withdrawn') then
      raise exception 'Invalid offer transition from draft to %.', new.status;
    end if;
    if previous.status = 'sent' and new.status not in ('countered', 'accepted', 'rejected', 'withdrawn') then
      raise exception 'Invalid offer transition from sent to %.', new.status;
    end if;
    if previous.status = 'countered' and new.status not in ('sent', 'accepted', 'rejected', 'withdrawn') then
      raise exception 'Invalid offer transition from countered to %.', new.status;
    end if;
    new.revision_number := previous.revision_number + 1;
    new.supersedes_revision_id := previous.id;
  end if;

  if new.status = 'countered' and new.revision_kind <> 'seller_counter' then
    raise exception 'Countered revisions must be seller counters.';
  end if;
  if new.status <> 'countered' and new.revision_kind = 'seller_counter'
    and previous.id is null then
    raise exception 'A seller counter requires prior offer history.';
  end if;

  new.updated_at := new.created_at;
  return new;
end;
$$;

create trigger offer_revisions_prepare_insert
  before insert on public.offer_revisions
  for each row execute function public.prepare_offer_revision();

create or replace function public.reject_lifecycle_snapshot_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'Lifecycle snapshots are immutable; append a new revision.';
end;
$$;

create trigger offer_revisions_immutable
  before update or delete on public.offer_revisions
  for each row execute function public.reject_lifecycle_snapshot_mutation();

create or replace function public.project_offer_revision_to_deal()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  update public.deals
  set latest_offer = new.offer_amount,
      counter_offer = case when new.revision_kind = 'seller_counter' then new.offer_amount else counter_offer end,
      negotiation_status = case new.status
        when 'draft' then 'Not Started'
        when 'sent' then 'Offer Sent'
        when 'countered' then 'Counter Received'
        when 'accepted' then 'Accepted'
        when 'rejected' then 'Rejected'
        when 'withdrawn' then 'Withdrawn'
      end,
      updated_at = now()
  where id = new.deal_id and organization_id = new.organization_id;
  return new;
end;
$$;

create trigger offer_revisions_project_after_insert
  after insert on public.offer_revisions
  for each row execute function public.project_offer_revision_to_deal();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'buyers_id_organization_key') then
    alter table public.buyers
      add constraint buyers_id_organization_key unique (id, organization_id);
  end if;
end $$;

create table if not exists public.deal_closing_revisions (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null,
  organization_id uuid not null,
  revision_number integer not null,
  supersedes_revision_id uuid,
  accepted_offer_revision_id uuid not null,
  status text not null default 'under_contract',
  contract_date date,
  closing_date date,
  material_deadlines jsonb not null default '[]'::jsonb,
  title_company_reference text,
  selected_buyer_id uuid,
  assignment_fee numeric,
  expected_proceeds numeric,
  actual_realized_proceeds numeric,
  actual_costs numeric,
  notes text,
  actor_id uuid default auth.uid(),
  actor_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deal_closing_revisions_deal_organization_fkey
    foreign key (deal_id, organization_id)
    references public.deals (id, organization_id)
    on delete restrict,
  constraint deal_closing_revisions_offer_organization_fkey
    foreign key (accepted_offer_revision_id, organization_id)
    references public.offer_revisions (id, organization_id)
    on delete restrict,
  constraint deal_closing_revisions_buyer_organization_fkey
    foreign key (selected_buyer_id, organization_id)
    references public.buyers (id, organization_id)
    on delete restrict,
  constraint deal_closing_revisions_supersedes_fkey
    foreign key (supersedes_revision_id)
    references public.deal_closing_revisions (id)
    on delete restrict,
  constraint deal_closing_revisions_status_check
    check (status in ('under_contract', 'closed', 'cancelled')),
  constraint deal_closing_revisions_deadlines_array
    check (jsonb_typeof(material_deadlines) = 'array'),
  constraint deal_closing_revisions_assignment_fee_nonnegative
    check (assignment_fee is null or assignment_fee >= 0),
  constraint deal_closing_revisions_expected_proceeds_nonnegative
    check (expected_proceeds is null or expected_proceeds >= 0),
  constraint deal_closing_revisions_actual_proceeds_nonnegative
    check (actual_realized_proceeds is null or actual_realized_proceeds >= 0),
  constraint deal_closing_revisions_actual_costs_nonnegative
    check (actual_costs is null or actual_costs >= 0),
  constraint deal_closing_revisions_closed_actuals
    check (status <> 'closed' or (actual_realized_proceeds is not null and actual_costs is not null)),
  constraint deal_closing_revisions_revision_positive check (revision_number > 0),
  constraint deal_closing_revisions_deal_revision_key unique (deal_id, revision_number),
  constraint deal_closing_revisions_id_organization_key unique (id, organization_id),
  constraint deal_closing_revisions_id_deal_organization_key unique (id, deal_id, organization_id)
);

create index if not exists deal_closing_revisions_deal_latest_idx
  on public.deal_closing_revisions (deal_id, revision_number desc);
create index if not exists deal_closing_revisions_organization_created_at_idx
  on public.deal_closing_revisions (organization_id, created_at desc);

create or replace function public.prepare_deal_closing_revision()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  previous public.deal_closing_revisions%rowtype;
  accepted_offer public.offer_revisions%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.deal_id::text, 1));

  select * into accepted_offer
  from public.offer_revisions
  where id = new.accepted_offer_revision_id
    and deal_id = new.deal_id
    and organization_id = new.organization_id;
  if accepted_offer.id is null or accepted_offer.status <> 'accepted' then
    raise exception 'Closing requires an accepted offer revision for the same deal and organization.';
  end if;

  select * into previous
  from public.deal_closing_revisions
  where deal_id = new.deal_id
  order by revision_number desc
  limit 1;

  if previous.id is null then
    if new.status <> 'under_contract' then
      raise exception 'The first closing revision must be under_contract.';
    end if;
    new.revision_number := 1;
    new.supersedes_revision_id := null;
  else
    if previous.organization_id <> new.organization_id then
      raise exception 'Closing revision organization must match its history.';
    end if;
    if previous.status in ('closed', 'cancelled') then
      raise exception 'Closed or cancelled closing history is terminal.';
    end if;
    new.revision_number := previous.revision_number + 1;
    new.supersedes_revision_id := previous.id;
  end if;

  new.updated_at := new.created_at;
  return new;
end;
$$;

create trigger deal_closing_revisions_prepare_insert
  before insert on public.deal_closing_revisions
  for each row execute function public.prepare_deal_closing_revision();

create trigger deal_closing_revisions_immutable
  before update or delete on public.deal_closing_revisions
  for each row execute function public.reject_lifecycle_snapshot_mutation();

create or replace function public.project_closing_revision_to_deal()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  selected_buyer_name text;
begin
  if new.selected_buyer_id is not null then
    select name into selected_buyer_name
    from public.buyers
    where id = new.selected_buyer_id and organization_id = new.organization_id;
  end if;

  update public.deals
  set stage = case new.status
        when 'under_contract' then 'Under Contract'
        when 'closed' then 'Closed'
        when 'cancelled' then 'Dead Lead'
      end,
      title_company = new.title_company_reference,
      target_closing_date = new.closing_date,
      closing_date = new.closing_date,
      buyer_assignee = selected_buyer_name,
      assignment_fee = coalesce(new.assignment_fee, new.expected_proceeds),
      closed_at = case when new.status = 'closed' then now() else closed_at end,
      updated_at = now()
  where id = new.deal_id and organization_id = new.organization_id;
  return new;
end;
$$;

create trigger deal_closing_revisions_project_after_insert
  after insert on public.deal_closing_revisions
  for each row execute function public.project_closing_revision_to_deal();

alter table public.documents
  add column if not exists offer_revision_id uuid,
  add column if not exists closing_revision_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'documents_offer_revision_organization_fkey') then
    alter table public.documents
      add constraint documents_offer_revision_organization_fkey
      foreign key (offer_revision_id, deal_id, organization_id)
      references public.offer_revisions (id, deal_id, organization_id)
      on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'documents_closing_revision_organization_fkey') then
    alter table public.documents
      add constraint documents_closing_revision_organization_fkey
      foreign key (closing_revision_id, deal_id, organization_id)
      references public.deal_closing_revisions (id, deal_id, organization_id)
      on delete restrict;
  end if;
end $$;

create index if not exists documents_offer_revision_idx
  on public.documents (offer_revision_id) where offer_revision_id is not null;
create index if not exists documents_closing_revision_idx
  on public.documents (closing_revision_id) where closing_revision_id is not null;

alter table public.seller_tasks
  add column if not exists source_type text,
  add column if not exists source_key text;

alter table public.seller_tasks
  add constraint seller_tasks_lifecycle_source_pair check (
    (source_type is null and source_key is null)
    or (source_type is not null and source_key is not null)
  ),
  add constraint seller_tasks_lifecycle_source_key
    unique (organization_id, deal_id, source_type, source_key);

create policy offer_revisions_select_member
  on public.offer_revisions for select to authenticated
  using (public.is_organization_member(organization_id));
create policy offer_revisions_insert_writer
  on public.offer_revisions for insert to authenticated
  with check (public.has_organization_role(organization_id, array['owner', 'admin', 'analyst']));
create policy deal_closing_revisions_select_member
  on public.deal_closing_revisions for select to authenticated
  using (public.is_organization_member(organization_id));
create policy deal_closing_revisions_insert_writer
  on public.deal_closing_revisions for insert to authenticated
  with check (public.has_organization_role(organization_id, array['owner', 'admin', 'analyst']));

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
  union all select 'deal_closing_revisions', count(*), count(*) filter (where organization_id is null) from public.deal_closing_revisions;
$$;

comment on function public.tenant_table_ownership_report() is
  'Reports total and unowned row counts without assigning legacy ownership.';
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
  union all select 'orphan_organization_id', 'deals', count(*) from public.deals t left join public.organizations o on o.id=t.organization_id where t.organization_id is not null and o.id is null
  union all select 'orphan_organization_id', 'message_logs', count(*) from public.message_logs t left join public.organizations o on o.id=t.organization_id where t.organization_id is not null and o.id is null
  union all select 'orphan_organization_id', 'seller_tasks', count(*) from public.seller_tasks t left join public.organizations o on o.id=t.organization_id where t.organization_id is not null and o.id is null
  union all select 'orphan_organization_id', 'buyers', count(*) from public.buyers t left join public.organizations o on o.id=t.organization_id where t.organization_id is not null and o.id is null
  union all select 'orphan_organization_id', 'documents', count(*) from public.documents t left join public.organizations o on o.id=t.organization_id where t.organization_id is not null and o.id is null
  union all select 'orphan_organization_id', 'comps', count(*) from public.comps t left join public.organizations o on o.id=t.organization_id where t.organization_id is not null and o.id is null
  union all select 'orphan_organization_id', 'sequences', count(*) from public.sequences t left join public.organizations o on o.id=t.organization_id where t.organization_id is not null and o.id is null
  union all select 'orphan_organization_id', 'offer_revisions', count(*) from public.offer_revisions t left join public.organizations o on o.id=t.organization_id where o.id is null
  union all select 'orphan_organization_id', 'deal_closing_revisions', count(*) from public.deal_closing_revisions t left join public.organizations o on o.id=t.organization_id where o.id is null
  union all select 'cross_tenant_deal', 'message_logs', count(*) from public.message_logs c join public.deals p on p.id=c.deal_id where c.organization_id is not null and p.organization_id is distinct from c.organization_id
  union all select 'cross_tenant_deal', 'seller_tasks', count(*) from public.seller_tasks c join public.deals p on p.id=c.deal_id where c.organization_id is not null and p.organization_id is distinct from c.organization_id
  union all select 'cross_tenant_deal', 'documents', count(*) from public.documents c join public.deals p on p.id=c.deal_id where c.organization_id is not null and p.organization_id is distinct from c.organization_id
  union all select 'cross_tenant_deal', 'comps', count(*) from public.comps c join public.deals p on p.id=c.deal_id where c.organization_id is not null and p.organization_id is distinct from c.organization_id
  union all select 'cross_tenant_deal', 'sequences', count(*) from public.sequences c join public.deals p on p.id=c.deal_id where c.organization_id is not null and p.organization_id is distinct from c.organization_id
  union all select 'cross_tenant_deal', 'offer_revisions', count(*) from public.offer_revisions c join public.deals p on p.id=c.deal_id where p.organization_id is distinct from c.organization_id
  union all select 'cross_tenant_deal', 'deal_closing_revisions', count(*) from public.deal_closing_revisions c join public.deals p on p.id=c.deal_id where p.organization_id is distinct from c.organization_id
  union all select 'active_organization_without_owner', 'organizations', count(*)
  from public.organizations o where o.status='active' and not exists (
    select 1 from public.organization_memberships m
    where m.organization_id=o.id and m.role='owner' and m.status='active'
  );
$$;

revoke all on function public.tenant_rls_readiness_report() from public;
grant execute on function public.tenant_rls_readiness_report() to service_role;
