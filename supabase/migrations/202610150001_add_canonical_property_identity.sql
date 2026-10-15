-- Canonical verified property identity and active-opportunity admission.
-- Closed and Dead Lead are the existing terminal deal stages. Historical rows
-- remain linked and readable; only nonterminal opportunities are unique.

begin;

create table if not exists public.property_identities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  jurisdiction text not null,
  authoritative_parcel_id text not null,
  verification_source text not null,
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_identities_jurisdiction_check
    check (jurisdiction ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint property_identities_parcel_check
    check (authoritative_parcel_id ~ '^[A-Za-z0-9]+$'),
  constraint property_identities_natural_key
    unique (organization_id, jurisdiction, authoritative_parcel_id)
);

alter table public.deals
  add column if not exists property_jurisdiction text,
  add column if not exists authoritative_parcel_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'deals_verified_property_identity_pair_check'
      and conrelid = 'public.deals'::regclass
  ) then
    alter table public.deals
      add constraint deals_verified_property_identity_pair_check
      check (
        (property_jurisdiction is null and authoritative_parcel_id is null)
        or
        (property_jurisdiction is not null and authoritative_parcel_id is not null)
      ) not valid;
  end if;
end $$;

-- Source attempts are append-only history. A duplicate parcel intake links its
-- independent import identity and provenance to the existing active deal.
create table if not exists public.deal_intake_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  deal_id uuid not null,
  import_id text,
  source text,
  source_record_id text,
  provenance jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint deal_intake_sources_deal_organization_fkey
    foreign key (deal_id, organization_id)
    references public.deals (id, organization_id)
    on delete restrict,
  constraint deal_intake_sources_provenance_object_check
    check (jsonb_typeof(provenance) = 'object')
);

create unique index if not exists deal_intake_sources_organization_import_id_uidx
  on public.deal_intake_sources (organization_id, import_id)
  where import_id is not null;

create index if not exists deal_intake_sources_deal_received_idx
  on public.deal_intake_sources (organization_id, deal_id, received_at desc);

-- Every existing importer identity is retained in the new source ledger.
insert into public.deal_intake_sources (
  organization_id, deal_id, import_id, source, provenance, received_at
)
select
  d.organization_id,
  d.id,
  d.import_id,
  d.source,
  jsonb_strip_nulls(jsonb_build_object(
    'import_id', d.import_id,
    'source', d.source,
    'imported_at', d.imported_at,
    'research_evidence', d.research_evidence
  )),
  coalesce(d.imported_at, d.created_at, now())
from public.deals d
where d.organization_id is not null
  and d.import_id is not null
on conflict (organization_id, import_id) where import_id is not null do nothing;

-- Orange Tax Sale is the only existing save path whose stored parcel was
-- admitted through an exact official property-appraiser match. Generic manual
-- parcel fields are deliberately excluded from backfill.
create temporary table verified_property_backfill as
select
  d.id as deal_id,
  d.organization_id,
  'us-fl-orange-county'::text as jurisdiction,
  regexp_replace(d.parcel_number, '[^0-9A-Za-z]', '', 'g') as authoritative_parcel_id,
  'orange-county-property-appraiser'::text as verification_source,
  coalesce(d.imported_at, d.created_at, now()) as verified_at,
  d.stage
from public.deals d
where d.organization_id is not null
  and d.source = 'orange-county-tax-sale'
  and nullif(regexp_replace(coalesce(d.parcel_number, ''), '[^0-9A-Za-z]', '', 'g'), '') is not null
  and exists (
    select 1
    from jsonb_array_elements(coalesce(d.research_evidence, '[]'::jsonb)) evidence
    where evidence->>'sourceSystem' = 'orange-county-property-appraiser'
      and evidence->>'verificationState' = 'verified'
  );

do $$
declare
  conflict_count integer;
begin
  select count(*) into conflict_count
  from (
    select organization_id, jurisdiction, authoritative_parcel_id
    from verified_property_backfill
    where coalesce(lower(btrim(stage)), '') not in ('closed', 'dead lead')
    group by organization_id, jurisdiction, authoritative_parcel_id
    having count(*) > 1
  ) conflicts;

  if conflict_count > 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Canonical property identity migration found %s active verified parcel conflict(s). Owner disposition is required; no migration changes were applied.',
        conflict_count
      );
  end if;
end $$;

insert into public.property_identities (
  organization_id, jurisdiction, authoritative_parcel_id,
  verification_source, verified_at
)
select distinct on (organization_id, jurisdiction, authoritative_parcel_id)
  organization_id, jurisdiction, authoritative_parcel_id,
  verification_source, verified_at
from verified_property_backfill
order by organization_id, jurisdiction, authoritative_parcel_id, verified_at
on conflict (organization_id, jurisdiction, authoritative_parcel_id) do nothing;

update public.deals d
set property_jurisdiction = b.jurisdiction,
    authoritative_parcel_id = b.authoritative_parcel_id
from verified_property_backfill b
where d.id = b.deal_id
  and d.organization_id = b.organization_id
  and d.property_jurisdiction is null
  and d.authoritative_parcel_id is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'deals_verified_property_identity_fkey'
      and conrelid = 'public.deals'::regclass
  ) then
    alter table public.deals
      add constraint deals_verified_property_identity_fkey
      foreign key (organization_id, property_jurisdiction, authoritative_parcel_id)
      references public.property_identities (
        organization_id, jurisdiction, authoritative_parcel_id
      )
      on delete restrict not valid;
  end if;
end $$;

create unique index if not exists deals_one_active_verified_property_uidx
  on public.deals (organization_id, property_jurisdiction, authoritative_parcel_id)
  where property_jurisdiction is not null
    and authoritative_parcel_id is not null
    and coalesce(lower(btrim(stage)), '') not in ('closed', 'dead lead');

create index if not exists deals_verified_property_history_idx
  on public.deals (
    organization_id, property_jurisdiction, authoritative_parcel_id, created_at desc
  )
  where property_jurisdiction is not null and authoritative_parcel_id is not null;

alter table public.property_identities enable row level security;
alter table public.deal_intake_sources enable row level security;

create policy property_identities_select_member
  on public.property_identities for select to authenticated
  using (public.is_organization_member(organization_id));

create policy deal_intake_sources_select_member
  on public.deal_intake_sources for select to authenticated
  using (public.is_organization_member(organization_id));

-- The function is the only write boundary for verified identity admission. It
-- serializes import identity and property identity before inspecting active
-- opportunities, so concurrent intake cannot pass the check twice.
create or replace function public.admit_verified_property_deal(
  p_organization_id uuid,
  p_jurisdiction text,
  p_authoritative_parcel_id text,
  p_verification_source text,
  p_verified_at timestamptz,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized_jurisdiction text := lower(btrim(coalesce(p_jurisdiction, '')));
  normalized_parcel text := btrim(coalesce(p_authoritative_parcel_id, ''));
  normalized_source text := btrim(coalesce(p_verification_source, ''));
  payload jsonb := coalesce(p_payload, '{}'::jsonb) - 'organization_id';
  incoming_import_id text := nullif(btrim(payload->>'import_id'), '');
  existing_deal public.deals%rowtype;
  admitted_deal public.deals%rowtype;
begin
  if auth.uid() is null or not public.has_organization_role(
    p_organization_id, array['owner', 'admin', 'analyst']
  ) then
    raise exception 'Verified property admission requires an active organization writer.';
  end if;
  if jsonb_typeof(payload) <> 'object' then
    raise exception 'A deal payload object is required.';
  end if;
  if p_verified_at is null or normalized_source = '' then
    raise exception 'Server verification source and timestamp are required.';
  end if;
  if normalized_jurisdiction = 'us-fl-volusia-county' then
    if normalized_source <> 'volusia-parcel-ownership' or normalized_parcel !~ '^[0-9]{7}$' then
      raise exception 'Volusia admission requires an exact verified seven-digit PARID.';
    end if;
  elsif normalized_jurisdiction = 'us-fl-orange-county' then
    if normalized_source <> 'orange-county-property-appraiser' or normalized_parcel !~ '^[0-9]{15}$' then
      raise exception 'Orange admission requires an exact verified property-appraiser parcel ID.';
    end if;
  else
    raise exception 'Unsupported verified property jurisdiction.';
  end if;

  if incoming_import_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(
      p_organization_id::text || ':import:' || incoming_import_id, 0
    ));
    select d.* into existing_deal
    from public.deal_intake_sources s
    join public.deals d
      on d.id = s.deal_id and d.organization_id = s.organization_id
    where s.organization_id = p_organization_id
      and s.import_id = incoming_import_id
    limit 1;
    if existing_deal.id is not null then
      return jsonb_build_object('status', 'existing', 'deal', to_jsonb(existing_deal));
    end if;
  end if;

  insert into public.property_identities (
    organization_id, jurisdiction, authoritative_parcel_id,
    verification_source, verified_at
  ) values (
    p_organization_id, normalized_jurisdiction, normalized_parcel,
    normalized_source, p_verified_at
  )
  on conflict (organization_id, jurisdiction, authoritative_parcel_id) do nothing;

  select d.* into existing_deal
  from public.deals d
  where d.organization_id = p_organization_id
    and d.property_jurisdiction = normalized_jurisdiction
    and d.authoritative_parcel_id = normalized_parcel
    and coalesce(lower(btrim(d.stage)), '') not in ('closed', 'dead lead')
  limit 1;

  if existing_deal.id is not null then
    insert into public.deal_intake_sources (
      organization_id, deal_id, import_id, source, source_record_id,
      provenance, received_at
    ) values (
      p_organization_id, existing_deal.id, incoming_import_id,
      nullif(payload->>'source', ''), nullif(payload->>'source_record_id', ''),
      jsonb_strip_nulls(jsonb_build_object(
        'import_id', incoming_import_id,
        'source', payload->>'source',
        'source_record_id', payload->>'source_record_id',
        'imported_at', payload->>'imported_at',
        'property_address', payload->>'property_address',
        'research_evidence', payload->'research_evidence'
      )),
      coalesce((nullif(payload->>'imported_at', ''))::timestamptz, now())
    ) on conflict (organization_id, import_id) where import_id is not null do nothing;
    return jsonb_build_object('status', 'existing', 'deal', to_jsonb(existing_deal));
  end if;

  insert into public.deals (
    organization_id, property_jurisdiction, authoritative_parcel_id,
    owner_name, seller_name, phone, email, seller_email,
    property_address, city, state, zip, stage, status, source, market,
    asset_type, property_type, asking_price, price, arv, repairs,
    motivation, seller_timeline, parcel_id, parcel_number, acreage,
    zoning, county, next_action, next_action_due_date, due_date, notes,
    import_id, imported_at, research_evidence, operating_scope
  ) values (
    p_organization_id, normalized_jurisdiction, normalized_parcel,
    nullif(payload->>'owner_name', ''), nullif(payload->>'seller_name', ''),
    nullif(payload->>'phone', ''), nullif(payload->>'email', ''),
    nullif(payload->>'seller_email', ''), nullif(payload->>'property_address', ''),
    nullif(payload->>'city', ''), nullif(payload->>'state', ''),
    nullif(payload->>'zip', ''), coalesce(nullif(payload->>'stage', ''), 'New Lead'),
    nullif(payload->>'status', ''), nullif(payload->>'source', ''),
    nullif(payload->>'market', ''), nullif(payload->>'asset_type', ''),
    nullif(payload->>'property_type', ''), (nullif(payload->>'asking_price', ''))::numeric,
    (nullif(payload->>'price', ''))::numeric, (nullif(payload->>'arv', ''))::numeric,
    (nullif(payload->>'repairs', ''))::numeric, (nullif(payload->>'motivation', ''))::numeric,
    nullif(payload->>'seller_timeline', ''), nullif(payload->>'parcel_id', ''),
    nullif(payload->>'parcel_number', ''), (nullif(payload->>'acreage', ''))::numeric,
    nullif(payload->>'zoning', ''), nullif(payload->>'county', ''),
    nullif(payload->>'next_action', ''), (nullif(payload->>'next_action_due_date', ''))::date,
    (nullif(payload->>'due_date', ''))::date, nullif(payload->>'notes', ''),
    incoming_import_id, coalesce((nullif(payload->>'imported_at', ''))::timestamptz, now()),
    coalesce(payload->'research_evidence', '[]'::jsonb),
    coalesce(nullif(payload->>'operating_scope', ''), 'active_acquisition')
  ) returning * into admitted_deal;

  insert into public.deal_intake_sources (
    organization_id, deal_id, import_id, source, source_record_id,
    provenance, received_at
  ) values (
    p_organization_id, admitted_deal.id, incoming_import_id,
    admitted_deal.source, nullif(payload->>'source_record_id', ''),
    jsonb_strip_nulls(jsonb_build_object(
      'import_id', incoming_import_id,
      'source', admitted_deal.source,
      'source_record_id', payload->>'source_record_id',
      'imported_at', admitted_deal.imported_at,
      'property_address', admitted_deal.property_address,
      'research_evidence', admitted_deal.research_evidence
    )),
    admitted_deal.imported_at
  );

  return jsonb_build_object('status', 'imported', 'deal', to_jsonb(admitted_deal));
exception
  when unique_violation then
    select d.* into existing_deal
    from public.deals d
    where d.organization_id = p_organization_id
      and d.property_jurisdiction = normalized_jurisdiction
      and d.authoritative_parcel_id = normalized_parcel
      and coalesce(lower(btrim(d.stage)), '') not in ('closed', 'dead lead')
    limit 1;
    if existing_deal.id is not null then
      return jsonb_build_object('status', 'existing', 'deal', to_jsonb(existing_deal));
    end if;
    raise;
end;
$$;

revoke all on function public.admit_verified_property_deal(
  uuid, text, text, text, timestamptz, jsonb
) from public, anon;
grant execute on function public.admit_verified_property_deal(
  uuid, text, text, text, timestamptz, jsonb
) to authenticated;

comment on table public.property_identities is
  'Tenant-scoped canonical identities created only from authoritative parcel verification.';
comment on table public.deal_intake_sources is
  'Append-only source and import history for new and duplicate deal admissions.';

commit;
