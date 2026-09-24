-- Astra Priority 8: optional RentCast evidence, disabled by default.

alter table public.organization_provider_policies
  drop constraint organization_provider_policies_provider_check,
  drop constraint organization_provider_policies_enabled_requires_limits,
  drop constraint organization_provider_policies_optional_limits_positive;

alter table public.organization_provider_policies
  add constraint organization_provider_policies_provider_check
    check (provider in ('openai', 'rentcast')),
  add constraint organization_provider_policies_enabled_requires_limits
    check (
      not enabled
      or (
        monthly_request_cap is not null and monthly_request_cap > 0
        and (provider <> 'openai' or max_prompt_characters is not null)
      )
    ),
  add constraint organization_provider_policies_optional_limits_positive
    check (
      (monthly_request_cap is null or monthly_request_cap > 0)
      and (max_prompt_characters is null or max_prompt_characters between 1 and 28000)
    );

insert into public.organization_provider_policies (organization_id, provider, enabled)
select id, 'rentcast', false from public.organizations
on conflict (organization_id, provider) do nothing;

create table if not exists public.property_provider_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  deal_id uuid not null,
  provider text not null,
  property_identity text not null,
  provider_record_id text,
  retrieved_at timestamptz not null,
  expires_at timestamptz not null,
  normalized_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_provider_evidence_deal_organization_fkey
    foreign key (deal_id, organization_id)
    references public.deals (id, organization_id) on delete restrict,
  constraint property_provider_evidence_provider_check
    check (provider = 'rentcast'),
  constraint property_provider_evidence_identity_present
    check (length(btrim(property_identity)) between 1 and 500),
  constraint property_provider_evidence_normalized_object
    check (jsonb_typeof(normalized_data) = 'object'),
  constraint property_provider_evidence_expiry_order
    check (expires_at > retrieved_at),
  constraint property_provider_evidence_org_deal_provider_key
    unique (organization_id, deal_id, provider)
);

create index if not exists property_provider_evidence_org_retrieved_idx
  on public.property_provider_evidence (organization_id, retrieved_at desc);

create trigger property_provider_evidence_prevent_organization_transfer
  before update of organization_id on public.property_provider_evidence
  for each row execute function public.prevent_organization_transfer();

alter table public.property_provider_evidence enable row level security;

create policy property_provider_evidence_select_member
  on public.property_provider_evidence for select to authenticated
  using (public.is_organization_member(organization_id));

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
  if normalized_provider not in ('openai', 'rentcast') then
    raise exception 'Provider is not supported for this pilot.';
  end if;
  if not exists (
    select 1 from public.pilot_provisioning_requests where organization_id = p_organization_id
  ) then
    raise exception 'Pilot organization was not found.';
  end if;
  if p_enabled and (p_monthly_request_cap is null or p_monthly_request_cap <= 0) then
    raise exception 'Enabling a provider requires a positive request limit.';
  end if;
  if p_enabled and normalized_provider = 'openai' and (
    p_max_prompt_characters is null or p_max_prompt_characters not between 1 and 28000
  ) then
    raise exception 'Enabling OpenAI requires a prompt limit.';
  end if;

  insert into public.organization_provider_policies (
    organization_id, provider, enabled, monthly_request_cap,
    max_prompt_characters, updated_at
  ) values (
    p_organization_id, normalized_provider, p_enabled,
    case when p_enabled then p_monthly_request_cap else null end,
    case when p_enabled and normalized_provider = 'openai' then p_max_prompt_characters else null end,
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

create or replace function public.consume_organization_provider_requests(
  p_organization_id uuid,
  p_provider text,
  p_request_count integer
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
  if p_request_count is null or p_request_count <= 0 or p_request_count > 10 then
    return jsonb_build_object('allowed', false, 'reason', 'request-limit-exceeded');
  end if;
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

  insert into public.organization_provider_usage (
    organization_id, provider, period_start, request_count
  ) values (p_organization_id, policy.provider, current_period, p_request_count)
  on conflict (organization_id, provider, period_start) do update
    set request_count = public.organization_provider_usage.request_count + p_request_count,
        updated_at = now()
    where public.organization_provider_usage.request_count + p_request_count
      <= policy.monthly_request_cap
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

revoke all on table public.property_provider_evidence from public, anon, authenticated;
grant select on table public.property_provider_evidence to authenticated;
grant select, insert, update on table public.property_provider_evidence to service_role;

revoke all on function public.consume_organization_provider_requests(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.consume_organization_provider_requests(uuid, text, integer)
  to service_role;
revoke all on function public.configure_assisted_pilot_provider(uuid, text, boolean, integer, integer)
  from public, anon, authenticated;
grant execute on function public.configure_assisted_pilot_provider(uuid, text, boolean, integer, integer)
  to service_role;
