-- Astra Priority #7 targeted acceptance. Synthetic data only.

set role service_role;

with pilot as (
  select organization_id
  from public.pilot_provisioning_requests
  where idempotency_key='build6-pilot-a-stable-key'
), records as (
  select jsonb_agg(jsonb_build_object(
    'rowNumber', value,
    'payload', jsonb_build_object(
      'owner_name', 'Priority 7 Synthetic Seller ' || value,
      'phone', '5557' || lpad(value::text, 6, '0'),
      'email', 'priority7-' || value || '@example.test',
      'property_address', value || ' Priority 7 Scale Avenue',
      'source', 'CSV Import',
      'market', 'Synthetic Market',
      'stage', 'New Lead',
      'import_id', 'lead-intake:v1:priority7:' || value,
      'imported_at', '2026-09-24T15:00:00Z'
    )
  ) order by value) payload
  from generate_series(1, 600) value
)
select test_support.assert_true(
  (public.persist_assisted_pilot_import(
    pilot.organization_id, 'priority7-large-import-first', records.payload
  )->>'importedCount')::integer = 600,
  'large assisted import accepts every synthetic record'
)
from pilot cross join records;

with pilot as (
  select organization_id
  from public.pilot_provisioning_requests
  where idempotency_key='build6-pilot-a-stable-key'
), records as (
  select jsonb_agg(jsonb_build_object(
    'rowNumber', value,
    'payload', jsonb_build_object(
      'owner_name', 'Priority 7 Synthetic Seller ' || value,
      'phone', '5557' || lpad(value::text, 6, '0'),
      'email', 'priority7-' || value || '@example.test',
      'property_address', value || ' Priority 7 Scale Avenue',
      'source', 'CSV Import',
      'market', 'Synthetic Market',
      'stage', 'New Lead',
      'import_id', 'lead-intake:v1:priority7:' || value,
      'imported_at', '2026-09-24T15:00:00Z'
    )
  ) order by value) payload
  from generate_series(1, 600) value
)
select test_support.assert_true(
  (public.persist_assisted_pilot_import(
    pilot.organization_id, 'priority7-large-import-retry', records.payload
  )->>'duplicateCount')::integer = 600,
  'large assisted import retry classifies every record as a duplicate'
)
from pilot cross join records;

select test_support.assert_true(
  (select count(*) from public.deals
    where organization_id=(select organization_id from public.pilot_provisioning_requests where idempotency_key='build6-pilot-a-stable-key')
      and import_id like 'lead-intake:v1:priority7:%') = 600,
  'large assisted import persists every accepted record exactly once across retry'
);

select public.record_pilot_operation_failure(
  (select organization_id from public.deals where import_id='lead-intake:v1:priority7:1'),
  'pilot-import-apply', 'record-rejected', 'priority7-safe-reference'
);

select test_support.assert_true(
  public.pilot_support_diagnostics(
    (select organization_id from public.pilot_provisioning_requests where idempotency_key='build6-pilot-a-stable-key')
  )->'recent_failures'->>'available' = 'true'
  and public.pilot_support_diagnostics(
    (select organization_id from public.pilot_provisioning_requests where idempotency_key='build6-pilot-a-stable-key')
  )::text like '%priority7-safe-reference%'
  and (public.pilot_support_diagnostics(
    (select organization_id from public.pilot_provisioning_requests where idempotency_key='build6-pilot-a-stable-key')
  )->'recent_failures')::text !~* '(password|token|secret|payload|message[_-]?body|database[_-]?url|api[_-]?key)',
  'failed-action diagnostic persists bounded safe metadata without secrets or payloads'
);

select test_support.assert_true(
  not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='operational_failure_diagnostics'
      and column_name in ('password','token','secret','payload','message','error_message','database_url','api_key')
  ),
  'diagnostic schema has no secret, raw error, message, or payload fields'
);

select test_support.assert_true(
  jsonb_array_length(public.export_assisted_pilot_data(
    (select organization_id from public.pilot_provisioning_requests where idempotency_key='build6-pilot-a-stable-key')
  )->'deals') = 601
  and public.export_assisted_pilot_data(
    (select organization_id from public.pilot_provisioning_requests where idempotency_key='build6-pilot-a-stable-key')
  )::text not like '%600 Pilot B Avenue%',
  'pilot export is complete and tenant scoped at larger volume'
);

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'c6000000-0000-0000-0000-000000000001', false);
select test_support.assert_true(
  (select count(*) from public.deals where import_id like 'lead-intake:v1:priority7:%') = 600,
  'large imported rows remain visible through the canonical tenant deal path'
);
insert into public.operational_failure_diagnostics (
  organization_id, operation_type, error_classification, correlation_id
) values (
  (select organization_id from public.deals where import_id='lead-intake:v1:priority7:1'),
  'today-complete', 'persistence-failed', 'priority7-authenticated-reference'
);
select test_support.assert_true(
  (select count(*) from public.operational_failure_diagnostics) = 0,
  'customer role cannot read support diagnostics through RLS'
);
reset role;
set role service_role;
select test_support.assert_true(
  public.pilot_support_diagnostics(
    (select organization_id from public.pilot_provisioning_requests where idempotency_key='build6-pilot-a-stable-key')
  )::text like '%priority7-authenticated-reference%',
  'authenticated lifecycle diagnostic is durable and support-visible'
);
reset role;
