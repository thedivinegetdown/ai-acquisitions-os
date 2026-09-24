-- Build 6: assisted paid-pilot readiness. Administrative functions are
-- service-role only; customer access continues through the accepted RLS model.

create table if not exists public.pilot_provisioning_requests (
  idempotency_key text primary key,
  organization_id uuid not null unique,
  owner_user_id uuid not null,
  created_at timestamptz not null default now(),
  constraint pilot_provisioning_requests_key_present
    check (length(btrim(idempotency_key)) between 8 and 200),
  constraint pilot_provisioning_requests_organization_fkey
    foreign key (organization_id) references public.organizations (id) on delete restrict
);

create unique index if not exists pilot_provisioning_requests_owner_uidx
  on public.pilot_provisioning_requests (owner_user_id);

create table if not exists public.organization_settings (
  organization_id uuid primary key,
  default_market text not null default '',
  default_lead_source text not null default 'Direct mail',
  default_pipeline_stage text not null default 'New Lead',
  default_follow_up_cadence text not null default 'Every 2 days',
  default_offer_formula text not null default '70% ARV minus repairs',
  default_assignment_fee_target numeric not null default 15000,
  default_repair_estimate_buffer numeric not null default 10,
  default_timezone text not null default 'America/New_York',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_settings_organization_fkey
    foreign key (organization_id) references public.organizations (id) on delete restrict,
  constraint organization_settings_assignment_fee_nonnegative
    check (default_assignment_fee_target >= 0),
  constraint organization_settings_repair_buffer_nonnegative
    check (default_repair_estimate_buffer >= 0),
  constraint organization_settings_required_values
    check (
      length(btrim(default_lead_source)) > 0
      and length(btrim(default_pipeline_stage)) > 0
      and length(btrim(default_follow_up_cadence)) > 0
      and length(btrim(default_offer_formula)) > 0
      and length(btrim(default_timezone)) > 0
    )
);

create table if not exists public.organization_provider_policies (
  organization_id uuid not null,
  provider text not null,
  enabled boolean not null default false,
  monthly_request_cap integer,
  max_prompt_characters integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, provider),
  constraint organization_provider_policies_organization_fkey
    foreign key (organization_id) references public.organizations (id) on delete restrict,
  constraint organization_provider_policies_provider_check
    check (provider in ('openai')),
  constraint organization_provider_policies_enabled_requires_limits
    check (
      not enabled
      or (
        monthly_request_cap is not null and monthly_request_cap > 0
        and max_prompt_characters is not null and max_prompt_characters between 1 and 28000
      )
    ),
  constraint organization_provider_policies_optional_limits_positive
    check (
      (monthly_request_cap is null or monthly_request_cap > 0)
      and (max_prompt_characters is null or max_prompt_characters between 1 and 28000)
    )
);

create table if not exists public.organization_provider_usage (
  organization_id uuid not null,
  provider text not null,
  period_start date not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (organization_id, provider, period_start),
  constraint organization_provider_usage_policy_fkey
    foreign key (organization_id, provider)
    references public.organization_provider_policies (organization_id, provider)
    on delete restrict,
  constraint organization_provider_usage_count_nonnegative check (request_count >= 0)
);

insert into public.organization_settings (organization_id)
select id from public.organizations
on conflict (organization_id) do nothing;

-- Optional paid providers are explicit and fail closed for every existing and
-- newly provisioned organization. Credentials remain server environment only.
insert into public.organization_provider_policies (organization_id, provider, enabled)
select id, 'openai', false from public.organizations
on conflict (organization_id, provider) do nothing;

create policy organization_settings_select_member
  on public.organization_settings for select to authenticated
  using (public.is_organization_member(organization_id));
create policy organization_settings_insert_owner
  on public.organization_settings for insert to authenticated
  with check (public.has_organization_role(organization_id, array['owner']));
create policy organization_settings_update_owner
  on public.organization_settings for update to authenticated
  using (public.has_organization_role(organization_id, array['owner']))
  with check (public.has_organization_role(organization_id, array['owner']));

create policy organization_provider_policies_select_member
  on public.organization_provider_policies for select to authenticated
  using (public.is_organization_member(organization_id));

create trigger pilot_provisioning_requests_prevent_organization_transfer
  before update of organization_id on public.pilot_provisioning_requests
  for each row execute function public.prevent_organization_transfer();
create trigger organization_settings_prevent_organization_transfer
  before update of organization_id on public.organization_settings
  for each row execute function public.prevent_organization_transfer();
create trigger organization_provider_policies_prevent_organization_transfer
  before update of organization_id on public.organization_provider_policies
  for each row execute function public.prevent_organization_transfer();
create trigger organization_provider_usage_prevent_organization_transfer
  before update of organization_id on public.organization_provider_usage
  for each row execute function public.prevent_organization_transfer();

-- These are new tables applied after the production RLS cutover. Enforce their
-- policies immediately; admin-only tables intentionally have no customer policy.
alter table public.pilot_provisioning_requests enable row level security;
alter table public.organization_settings enable row level security;
alter table public.organization_provider_policies enable row level security;
alter table public.organization_provider_usage enable row level security;

create or replace function public.provision_assisted_pilot(
  p_idempotency_key text,
  p_organization_name text,
  p_owner_user_id uuid,
  p_slug text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized_key text := btrim(coalesce(p_idempotency_key, ''));
  normalized_name text := btrim(coalesce(p_organization_name, ''));
  normalized_slug text := nullif(lower(btrim(coalesce(p_slug, ''))), '');
  existing_request public.pilot_provisioning_requests%rowtype;
  existing_owner_organization uuid;
  new_organization_id uuid;
begin
  if length(normalized_key) not between 8 and 200 then
    raise exception 'A stable idempotency key between 8 and 200 characters is required.';
  end if;
  if normalized_name = '' or p_owner_user_id is null then
    raise exception 'Organization name and owner user ID are required.';
  end if;
  if normalized_slug is not null and normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Organization slug is invalid.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(normalized_key, 6));
  perform pg_advisory_xact_lock(hashtextextended(p_owner_user_id::text, 6));

  select * into existing_request
  from public.pilot_provisioning_requests
  where idempotency_key = normalized_key;

  if existing_request.organization_id is not null then
    if existing_request.owner_user_id <> p_owner_user_id then
      raise exception 'Idempotency key is already bound to another owner.';
    end if;
    return public.pilot_support_diagnostics(existing_request.organization_id);
  end if;

  select organization_id into existing_owner_organization
  from public.organization_memberships
  where user_id = p_owner_user_id and status = 'active'
  order by organization_id
  limit 1;
  if existing_owner_organization is not null then
    raise exception 'Owner already has an active organization membership.';
  end if;

  insert into public.organizations (name, slug, status, created_by)
  values (normalized_name, normalized_slug, 'active', p_owner_user_id)
  returning id into new_organization_id;

  insert into public.organization_memberships (organization_id, user_id, role, status)
  values (new_organization_id, p_owner_user_id, 'owner', 'active');
  insert into public.organization_settings (organization_id)
  values (new_organization_id);
  insert into public.organization_provider_policies (organization_id, provider, enabled)
  values (new_organization_id, 'openai', false);
  insert into public.pilot_provisioning_requests (
    idempotency_key, organization_id, owner_user_id
  ) values (normalized_key, new_organization_id, p_owner_user_id);

  return public.pilot_support_diagnostics(new_organization_id);
end;
$$;

create or replace function public.set_assisted_pilot_status(
  p_organization_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized_status text := lower(btrim(coalesce(p_status, '')));
begin
  if normalized_status not in ('active', 'suspended') then
    raise exception 'Pilot status must be active or suspended.';
  end if;
  if not exists (
    select 1 from public.pilot_provisioning_requests
    where organization_id = p_organization_id
  ) then
    raise exception 'Pilot organization was not found.';
  end if;
  if normalized_status = 'active' and not exists (
    select 1 from public.organization_memberships
    where organization_id = p_organization_id and role = 'owner' and status = 'active'
  ) then
    raise exception 'Pilot cannot be activated without an active owner.';
  end if;

  update public.organizations
  set status = normalized_status, updated_at = now()
  where id = p_organization_id;
  return public.pilot_support_diagnostics(p_organization_id);
end;
$$;

create or replace function public.configure_assisted_pilot_settings(
  p_organization_id uuid,
  p_settings jsonb
)
returns public.organization_settings
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  configured public.organization_settings%rowtype;
begin
  if not exists (
    select 1 from public.pilot_provisioning_requests where organization_id = p_organization_id
  ) then
    raise exception 'Pilot organization was not found.';
  end if;
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' then
    raise exception 'Settings must be a JSON object.';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_settings) key
    where key not in (
      'default_market', 'default_lead_source', 'default_pipeline_stage',
      'default_follow_up_cadence', 'default_offer_formula',
      'default_assignment_fee_target', 'default_repair_estimate_buffer',
      'default_timezone'
    )
  ) then
    raise exception 'Unsupported pilot setting.';
  end if;

  update public.organization_settings
  set
    default_market = coalesce(p_settings->>'default_market', default_market),
    default_lead_source = coalesce(p_settings->>'default_lead_source', default_lead_source),
    default_pipeline_stage = coalesce(p_settings->>'default_pipeline_stage', default_pipeline_stage),
    default_follow_up_cadence = coalesce(p_settings->>'default_follow_up_cadence', default_follow_up_cadence),
    default_offer_formula = coalesce(p_settings->>'default_offer_formula', default_offer_formula),
    default_assignment_fee_target = coalesce(
      (p_settings->>'default_assignment_fee_target')::numeric,
      default_assignment_fee_target
    ),
    default_repair_estimate_buffer = coalesce(
      (p_settings->>'default_repair_estimate_buffer')::numeric,
      default_repair_estimate_buffer
    ),
    default_timezone = coalesce(p_settings->>'default_timezone', default_timezone),
    updated_at = now()
  where organization_id = p_organization_id
  returning * into configured;
  return configured;
end;
$$;

create or replace function public.configure_assisted_pilot_provider(
  p_organization_id uuid,
  p_provider text,
  p_enabled boolean,
  p_monthly_request_cap integer default null,
  p_max_prompt_characters integer default null
)
returns public.organization_provider_policies
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized_provider text := lower(btrim(coalesce(p_provider, '')));
  configured public.organization_provider_policies%rowtype;
begin
  if normalized_provider <> 'openai' then
    raise exception 'Provider is not supported for this pilot.';
  end if;
  if not exists (
    select 1 from public.pilot_provisioning_requests where organization_id = p_organization_id
  ) then
    raise exception 'Pilot organization was not found.';
  end if;
  if p_enabled and (
    p_monthly_request_cap is null or p_monthly_request_cap <= 0
    or p_max_prompt_characters is null or p_max_prompt_characters not between 1 and 28000
  ) then
    raise exception 'Enabling a provider requires positive request and prompt limits.';
  end if;

  insert into public.organization_provider_policies (
    organization_id, provider, enabled, monthly_request_cap,
    max_prompt_characters, updated_at
  ) values (
    p_organization_id, normalized_provider, p_enabled,
    case when p_enabled then p_monthly_request_cap else null end,
    case when p_enabled then p_max_prompt_characters else null end,
    now()
  )
  on conflict (organization_id, provider) do update set
    enabled = excluded.enabled,
    monthly_request_cap = excluded.monthly_request_cap,
    max_prompt_characters = excluded.max_prompt_characters,
    updated_at = now()
  returning * into configured;
  return configured;
end;
$$;

create or replace function public.consume_organization_provider_request(
  p_organization_id uuid,
  p_provider text,
  p_prompt_characters integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  policy public.organization_provider_policies%rowtype;
  usage_count integer;
  current_period date := date_trunc('month', current_date)::date;
begin
  select * into policy
  from public.organization_provider_policies
  where organization_id = p_organization_id
    and provider = lower(btrim(coalesce(p_provider, '')))
  for update;

  if policy.organization_id is null or not policy.enabled then
    return jsonb_build_object('allowed', false, 'reason', 'provider-disabled');
  end if;
  if not exists (
    select 1
    from public.organizations o
    join public.pilot_provisioning_requests r on r.organization_id = o.id
    where o.id = p_organization_id and o.status = 'active'
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'account-suspended');
  end if;
  if p_prompt_characters < 0 or p_prompt_characters > policy.max_prompt_characters then
    return jsonb_build_object('allowed', false, 'reason', 'request-limit-exceeded');
  end if;

  insert into public.organization_provider_usage (
    organization_id, provider, period_start, request_count
  ) values (p_organization_id, policy.provider, current_period, 1)
  on conflict (organization_id, provider, period_start) do update
    set request_count = public.organization_provider_usage.request_count + 1,
        updated_at = now()
    where public.organization_provider_usage.request_count < policy.monthly_request_cap
  returning request_count into usage_count;

  if usage_count is null then
    return jsonb_build_object('allowed', false, 'reason', 'monthly-cap-reached');
  end if;
  return jsonb_build_object(
    'allowed', true,
    'provider', policy.provider,
    'request_count', usage_count,
    'monthly_request_cap', policy.monthly_request_cap
  );
end;
$$;

create or replace function public.persist_assisted_pilot_import(
  p_organization_id uuid,
  p_confirmation_token text,
  p_records jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  record jsonb;
  payload jsonb;
  row_number integer;
  inserted_deal public.deals%rowtype;
  outcomes jsonb := '[]'::jsonb;
  imported_count integer := 0;
  duplicate_count integer := 0;
  failed_count integer := 0;
begin
  if length(btrim(coalesce(p_confirmation_token, ''))) < 16 then
    raise exception 'A preview confirmation token is required.';
  end if;
  if jsonb_typeof(p_records) <> 'array' or jsonb_array_length(p_records) = 0 then
    raise exception 'Confirmed import records are required.';
  end if;
  if not exists (
    select 1
    from public.organizations o
    join public.pilot_provisioning_requests r on r.organization_id = o.id
    where o.id = p_organization_id and o.status = 'active'
  ) then
    raise exception 'Target pilot organization is not active.';
  end if;

  for record in select value from jsonb_array_elements(p_records)
  loop
    payload := coalesce(record->'payload', '{}'::jsonb);
    row_number := coalesce((record->>'rowNumber')::integer, 0);
    if payload ? 'organization_id'
      and nullif(payload->>'organization_id', '')::uuid <> p_organization_id then
      raise exception 'Import payload organization conflicts with target organization.';
    end if;

    begin
      insert into public.deals (
        organization_id, owner_name, phone, email, property_address, city,
        state, zip, source, market, asking_price, notes, stage,
        import_id, imported_at
      ) values (
        p_organization_id,
        nullif(payload->>'owner_name', ''), nullif(payload->>'phone', ''),
        nullif(payload->>'email', ''), nullif(payload->>'property_address', ''),
        nullif(payload->>'city', ''), nullif(payload->>'state', ''),
        nullif(payload->>'zip', ''), nullif(payload->>'source', ''),
        nullif(payload->>'market', ''), (payload->>'asking_price')::numeric,
        nullif(payload->>'notes', ''), coalesce(nullif(payload->>'stage', ''), 'New Lead'),
        nullif(payload->>'import_id', ''),
        coalesce((payload->>'imported_at')::timestamptz, now())
      ) returning * into inserted_deal;
      imported_count := imported_count + 1;
      outcomes := outcomes || jsonb_build_array(jsonb_build_object(
        'rowNumber', row_number, 'status', 'imported', 'dealId', inserted_deal.id
      ));
    exception
      when unique_violation then
        duplicate_count := duplicate_count + 1;
        outcomes := outcomes || jsonb_build_array(jsonb_build_object(
          'rowNumber', row_number, 'status', 'duplicate'
        ));
      when others then
        failed_count := failed_count + 1;
        outcomes := outcomes || jsonb_build_array(jsonb_build_object(
          'rowNumber', row_number, 'status', 'failed', 'error', 'Record was rejected by persistence validation.'
        ));
    end;
  end loop;

  return jsonb_build_object(
    'organization_id', p_organization_id,
    'confirmation_token', p_confirmation_token,
    'results', outcomes,
    'importedCount', imported_count,
    'duplicateCount', duplicate_count,
    'failedCount', failed_count
  );
end;
$$;

create or replace function public.export_assisted_pilot_data(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  result jsonb;
begin
  if not exists (
    select 1 from public.pilot_provisioning_requests where organization_id = p_organization_id
  ) then
    raise exception 'Pilot organization was not found.';
  end if;

  select jsonb_build_object(
    'format', 'ai-acquisitions-os-pilot-export-v1',
    'organization', jsonb_build_object('id', o.id, 'name', o.name, 'slug', o.slug, 'status', o.status),
    'settings', coalesce((select to_jsonb(s) - array['organization_id','created_at','updated_at'] from public.organization_settings s where s.organization_id=o.id), '{}'::jsonb),
    'providers', coalesce((select jsonb_agg(to_jsonb(p) - array['organization_id','created_at','updated_at'] order by p.provider) from public.organization_provider_policies p where p.organization_id=o.id), '[]'::jsonb),
    'deals', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (
      select id, property_address, owner_name, seller_name, phone, email, seller_email,
        stage, status, source, market, city, state, zip, asset_type, property_type,
        lead_score, motivation, motivation_score, price, asking_price, arv, repairs, rent,
        mortgage_balance, mortgage_status, seller_timeline, occupancy_status,
        property_condition, bedrooms, bathrooms, square_footage, square_feet, year_built,
        lot_size, comps, buyer_matches, parcel_id, parcel_number, acreage, land_square_feet,
        legal_access, road_frontage, zoning, permitted_use, utilities, water_access,
        sewer_access, septic_feasibility, flood_zone, wetlands, topography,
        deed_restrictions, subdivision_potential, taxes_and_liens, land_comps,
        comparable_land_value, builder_demand, land_buyer_demand, county,
        legal_description, latitude, longitude, next_action, next_action_due_date,
        due_date, follow_up_date, notes, assignment_fee, closing_date, closed_at,
        acquisitions_rep, dispositions_rep, seller_ask, latest_offer, counter_offer,
        objection, negotiation_status, offer_ready, exit_strategy, title_company,
        target_closing_date, earnest_money_deposit, contingencies, buyer_assignee,
        auto_score, import_id, imported_at, data_confidence, confidence_label,
        data_reliability_grade, created_at, updated_at
      from public.deals where organization_id=o.id order by id
    ) x), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (
      select id, deal_id, phone, message, status, direction, created_at, updated_at
      from public.message_logs where organization_id=o.id order by id
    ) x), '[]'::jsonb),
    'seller_tasks', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (
      select id, deal_id, phone, title, status, due_at, created_at, updated_at
      from public.seller_tasks where organization_id=o.id order by id
    ) x), '[]'::jsonb),
    'buyers', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (
      select id, name, email, phone, target_areas, max_price, notes, created_at, updated_at
      from public.buyers where organization_id=o.id order by id
    ) x), '[]'::jsonb),
    'documents', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (
      select id, deal_id, doc_type, title, notes, created_at, updated_at
      from public.documents where organization_id=o.id order by id
    ) x), '[]'::jsonb),
    'comparables', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (
      select id, deal_id, address, sale_price, sqft, beds, baths, created_at, updated_at
      from public.comps where organization_id=o.id order by id
    ) x), '[]'::jsonb),
    'sequences', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (
      select id, deal_id, step_day, action_type, due_date, status, created_at, updated_at
      from public.sequences where organization_id=o.id order by id
    ) x), '[]'::jsonb),
    'communication_consents', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (
      select id, normalized_phone, channel, status, source, provider, last_event_at, created_at, updated_at
      from public.communication_consents where organization_id=o.id order by id
    ) x), '[]'::jsonb),
    'offer_revisions', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (
      select id, deal_id, revision_number, supersedes_revision_id, revision_kind, status,
        offer_amount, terms, decision_basis, follow_up_date, notes,
        created_at, updated_at
      from public.offer_revisions where organization_id=o.id order by id
    ) x), '[]'::jsonb),
    'closing_revisions', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (
      select id, deal_id, revision_number, supersedes_revision_id,
        accepted_offer_revision_id, status, contract_date, closing_date,
        material_deadlines, title_company_reference, selected_buyer_id, assignment_fee,
        expected_proceeds, actual_realized_proceeds, actual_costs, notes,
        created_at, updated_at
      from public.deal_closing_revisions where organization_id=o.id order by id
    ) x), '[]'::jsonb),
    'decision_recommendations', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (
      select id, deal_id, snapshot_number, memory_contract_version,
        decision_contract_version, recalculation_contract_version,
        recommendation_result, canonical_input_fingerprint, recommendation_basis,
        evaluated_at, created_at
      from public.decision_recommendation_snapshots where organization_id=o.id order by id
    ) x), '[]'::jsonb),
    'owner_decisions', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (
      select id, recommendation_snapshot_id, deal_id, decision_type, override_flag,
        alternative_result, reason, decided_at, created_at
      from public.decision_owner_decisions where organization_id=o.id order by id
    ) x), '[]'::jsonb)
  ) into result
  from public.organizations o where o.id = p_organization_id;

  return result;
end;
$$;

create or replace function public.pilot_support_diagnostics(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  result jsonb;
begin
  if not exists (
    select 1 from public.pilot_provisioning_requests
    where organization_id = p_organization_id
  ) then
    raise exception 'Pilot organization was not found.';
  end if;

  select jsonb_build_object(
    'build', 'build-6',
    'schema_version', '202609240002',
    'organization', jsonb_build_object('id', o.id, 'name', o.name, 'slug', o.slug, 'status', o.status),
    'active_owner_count', (select count(*) from public.organization_memberships m where m.organization_id=o.id and m.role='owner' and m.status='active'),
    'configuration', jsonb_build_object(
      'settings_present', s.organization_id is not null,
      'default_market_configured', coalesce(length(btrim(s.default_market)), 0) > 0,
      'default_lead_source_configured', coalesce(length(btrim(s.default_lead_source)), 0) > 0,
      'default_timezone_configured', coalesce(length(btrim(s.default_timezone)), 0) > 0
    ),
    'providers', coalesce((select jsonb_agg(jsonb_build_object(
      'provider', p.provider, 'enabled', p.enabled,
      'limits_configured', p.monthly_request_cap is not null and p.max_prompt_characters is not null,
      'monthly_request_cap', p.monthly_request_cap,
      'max_prompt_characters', p.max_prompt_characters,
      'readiness', case when o.status='active' and p.enabled and p.monthly_request_cap > 0 and p.max_prompt_characters > 0 then 'ready' else 'disabled' end
    ) order by p.provider) from public.organization_provider_policies p where p.organization_id=o.id), '[]'::jsonb),
    'import', jsonb_build_object('ready', o.status='active' and s.organization_id is not null, 'durable_idempotency', true),
    'export', jsonb_build_object('ready', true, 'format', 'ai-acquisitions-os-pilot-export-v1'),
    'record_counts', jsonb_build_object(
      'deals', (select count(*) from public.deals d where d.organization_id=o.id),
      'buyers', (select count(*) from public.buyers b where b.organization_id=o.id),
      'messages', (select count(*) from public.message_logs m where m.organization_id=o.id)
    ),
    'recent_failures', jsonb_build_object(
      'available', false,
      'reason', 'Existing telemetry is log-only; no message bodies or unbounded logs are exposed.'
    )
  ) into result
  from public.organizations o
  left join public.organization_settings s on s.organization_id=o.id
  where o.id=p_organization_id;

  if result is null then raise exception 'Pilot organization was not found.'; end if;
  return result;
end;
$$;

revoke all on table public.pilot_provisioning_requests from public, anon, authenticated;
revoke all on table public.organization_settings from public, anon, authenticated;
revoke all on table public.organization_provider_policies from public, anon, authenticated;
revoke all on table public.organization_provider_usage from public, anon, authenticated;
grant select, insert, update on table public.organization_settings to authenticated;
grant select on table public.organization_provider_policies to authenticated;
grant select, insert, update on table public.pilot_provisioning_requests to service_role;
grant select, insert, update on table public.organization_settings to service_role;
grant select, insert, update on table public.organization_provider_policies to service_role;
grant select, insert, update on table public.organization_provider_usage to service_role;

revoke all on function public.provision_assisted_pilot(text, text, uuid, text) from public;
revoke all on function public.set_assisted_pilot_status(uuid, text) from public;
revoke all on function public.configure_assisted_pilot_settings(uuid, jsonb) from public;
revoke all on function public.configure_assisted_pilot_provider(uuid, text, boolean, integer, integer) from public;
revoke all on function public.consume_organization_provider_request(uuid, text, integer) from public;
revoke all on function public.persist_assisted_pilot_import(uuid, text, jsonb) from public;
revoke all on function public.export_assisted_pilot_data(uuid) from public;
revoke all on function public.pilot_support_diagnostics(uuid) from public;
grant execute on function public.provision_assisted_pilot(text, text, uuid, text) to service_role;
grant execute on function public.set_assisted_pilot_status(uuid, text) to service_role;
grant execute on function public.configure_assisted_pilot_settings(uuid, jsonb) to service_role;
grant execute on function public.configure_assisted_pilot_provider(uuid, text, boolean, integer, integer) to service_role;
grant execute on function public.consume_organization_provider_request(uuid, text, integer) to service_role;
grant execute on function public.persist_assisted_pilot_import(uuid, text, jsonb) to service_role;
grant execute on function public.export_assisted_pilot_data(uuid) to service_role;
grant execute on function public.pilot_support_diagnostics(uuid) to service_role;
