-- Astra Priority #7: bounded, metadata-only diagnostics for failed business
-- actions. No payload, message body, credential, or raw error columns exist.

create table if not exists public.operational_failure_diagnostics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  operation_type text not null,
  error_classification text not null,
  correlation_id text,
  status text not null default 'open',
  occurred_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint operational_failure_diagnostics_organization_fkey
    foreign key (organization_id) references public.organizations (id) on delete restrict,
  constraint operational_failure_diagnostics_operation_type_bounded
    check (length(operation_type) between 1 and 64 and operation_type ~ '^[a-z0-9-]+$'),
  constraint operational_failure_diagnostics_classification_bounded
    check (length(error_classification) between 1 and 64 and error_classification ~ '^[a-z0-9-]+$'),
  constraint operational_failure_diagnostics_correlation_bounded
    check (correlation_id is null or length(correlation_id) between 1 and 120),
  constraint operational_failure_diagnostics_status_check
    check (status in ('open', 'resolved')),
  constraint operational_failure_diagnostics_resolution_consistent
    check ((status = 'open' and resolved_at is null) or (status = 'resolved' and resolved_at is not null))
);

create index if not exists operational_failure_diagnostics_org_occurred_idx
  on public.operational_failure_diagnostics (organization_id, occurred_at desc, id desc);

create policy operational_failure_diagnostics_insert_writer
  on public.operational_failure_diagnostics
  for insert
  to authenticated
  with check (
    public.has_organization_role(organization_id, array['owner', 'admin', 'analyst'])
  );

create trigger operational_failure_diagnostics_prevent_organization_transfer
  before update of organization_id on public.operational_failure_diagnostics
  for each row execute function public.prevent_organization_transfer();

alter table public.operational_failure_diagnostics enable row level security;

revoke all on table public.operational_failure_diagnostics from public, anon, authenticated;
grant insert on table public.operational_failure_diagnostics to authenticated;
grant select, insert, update on table public.operational_failure_diagnostics to service_role;

create or replace function public.record_pilot_operation_failure(
  p_organization_id uuid,
  p_operation_type text,
  p_error_classification text,
  p_correlation_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  diagnostic_id uuid;
  normalized_operation text := lower(btrim(coalesce(p_operation_type, '')));
  normalized_classification text := lower(btrim(coalesce(p_error_classification, '')));
  normalized_correlation text := nullif(left(btrim(coalesce(p_correlation_id, '')), 120), '');
begin
  if not exists (
    select 1 from public.pilot_provisioning_requests
    where organization_id = p_organization_id
  ) then
    raise exception 'Pilot organization was not found.';
  end if;

  insert into public.operational_failure_diagnostics (
    organization_id, operation_type, error_classification, correlation_id
  ) values (
    p_organization_id, normalized_operation, normalized_classification, normalized_correlation
  ) returning id into diagnostic_id;

  return diagnostic_id;
end;
$$;

revoke all on function public.record_pilot_operation_failure(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.record_pilot_operation_failure(uuid, text, text, text) to service_role;

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
    'schema_version', '202609240004',
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
    'export', jsonb_build_object('ready', true, 'format', 'ai-acquisitions-os-pilot-export-v1', 'complete', true),
    'record_counts', jsonb_build_object(
      'deals', (select count(*) from public.deals d where d.organization_id=o.id),
      'buyers', (select count(*) from public.buyers b where b.organization_id=o.id),
      'messages', (select count(*) from public.message_logs m where m.organization_id=o.id)
    ),
    'recent_failures', jsonb_build_object(
      'available', true,
      'limit', 20,
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'operation_type', recent.operation_type,
          'error_classification', recent.error_classification,
          'occurred_at', recent.occurred_at,
          'correlation_id', recent.correlation_id,
          'status', recent.status
        ) order by recent.occurred_at desc, recent.id desc)
        from (
          select d.id, d.operation_type, d.error_classification, d.occurred_at,
            d.correlation_id, d.status
          from public.operational_failure_diagnostics d
          where d.organization_id=o.id
          order by d.occurred_at desc, d.id desc
          limit 20
        ) recent
      ), '[]'::jsonb)
    )
  ) into result
  from public.organizations o
  left join public.organization_settings s on s.organization_id=o.id
  where o.id=p_organization_id;

  if result is null then raise exception 'Pilot organization was not found.'; end if;
  return result;
end;
$$;

revoke all on function public.pilot_support_diagnostics(uuid) from public, anon, authenticated;
grant execute on function public.pilot_support_diagnostics(uuid) to service_role;
