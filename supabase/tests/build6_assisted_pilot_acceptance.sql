-- Build 6 targeted acceptance. Uses disposable identities and synthetic data only.

set role service_role;

select public.provision_assisted_pilot(
  'build6-pilot-a-stable-key', 'Build 6 Pilot A',
  'c6000000-0000-0000-0000-000000000001', 'build6-pilot-a'
);
select public.provision_assisted_pilot(
  'build6-pilot-a-stable-key', 'Build 6 Pilot A',
  'c6000000-0000-0000-0000-000000000001', 'build6-pilot-a'
);
select public.provision_assisted_pilot(
  'build6-pilot-b-stable-key', 'Build 6 Pilot B',
  'c6000000-0000-0000-0000-000000000002', 'build6-pilot-b'
);

select test_support.assert_true(
  (select count(*) from public.organizations where slug='build6-pilot-a') = 1
  and (select count(*) from public.organization_memberships where user_id='c6000000-0000-0000-0000-000000000001') = 1,
  'provisioning retry creates exactly one organization and owner membership'
);
select test_support.assert_true(
  (select count(*) from public.organizations where slug in ('build6-pilot-a','build6-pilot-b')) = 2,
  'second disposable pilot is distinct'
);
select test_support.expect_error(
  $$select public.provision_assisted_pilot('build6-different-key', 'Duplicate Owner', 'c6000000-0000-0000-0000-000000000001', 'duplicate-owner')$$,
  'a different retry key cannot duplicate an existing owner organization'
);

select public.configure_assisted_pilot_settings(
  (select organization_id from public.pilot_provisioning_requests where idempotency_key='build6-pilot-a-stable-key'),
  '{"default_market":"Synthetic Market","default_lead_source":"CSV Import","default_timezone":"America/Chicago"}'::jsonb
);
select test_support.assert_true(
  (select default_market from public.organization_settings where organization_id=(
    select organization_id from public.pilot_provisioning_requests where idempotency_key='build6-pilot-a-stable-key'
  )) = 'Synthetic Market',
  'persisted settings survive a separate reload query'
);

select test_support.assert_true(
  (public.consume_organization_provider_request(
    (select organization_id from public.pilot_provisioning_requests where idempotency_key='build6-pilot-a-stable-key'),
    'openai', 20
  )->>'allowed')::boolean is false,
  'providers default disabled and fail closed'
);
select public.configure_assisted_pilot_provider(
  (select organization_id from public.pilot_provisioning_requests where idempotency_key='build6-pilot-a-stable-key'),
  'openai', true, 2, 1000
);
select test_support.assert_true(
  (public.consume_organization_provider_request(
    (select organization_id from public.pilot_provisioning_requests where idempotency_key='build6-pilot-a-stable-key'),
    'openai', 20
  )->>'allowed')::boolean
  and (public.consume_organization_provider_request(
    (select organization_id from public.pilot_provisioning_requests where idempotency_key='build6-pilot-a-stable-key'),
    'openai', 20
  )->>'allowed')::boolean
  and not (public.consume_organization_provider_request(
    (select organization_id from public.pilot_provisioning_requests where idempotency_key='build6-pilot-a-stable-key'),
    'openai', 20
  )->>'allowed')::boolean,
  'explicit provider monthly request cap is enforced'
);

select public.persist_assisted_pilot_import(
  (select organization_id from public.pilot_provisioning_requests where idempotency_key='build6-pilot-a-stable-key'),
  'build6-confirmation-token-a',
  '[{"rowNumber":1,"payload":{"owner_name":"Synthetic Seller A","phone":"5556000001","email":"pilot-a@example.test","property_address":"600 Pilot A Avenue","source":"CSV Import","market":"Synthetic Market","stage":"New Lead","import_id":"lead-intake:v1:phone:5556000001","imported_at":"2026-09-24T12:00:00Z"}}]'::jsonb
);
select public.persist_assisted_pilot_import(
  (select organization_id from public.pilot_provisioning_requests where idempotency_key='build6-pilot-a-stable-key'),
  'build6-confirmation-token-a-retry',
  '[{"rowNumber":1,"payload":{"owner_name":"Synthetic Seller A","phone":"5556000001","email":"pilot-a@example.test","property_address":"600 Pilot A Avenue","source":"CSV Import","market":"Synthetic Market","stage":"New Lead","import_id":"lead-intake:v1:phone:5556000001","imported_at":"2026-09-24T12:00:00Z"}}]'::jsonb
);
select public.persist_assisted_pilot_import(
  (select organization_id from public.pilot_provisioning_requests where idempotency_key='build6-pilot-b-stable-key'),
  'build6-confirmation-token-b',
  '[{"rowNumber":1,"payload":{"owner_name":"Synthetic Seller B","phone":"5556000002","email":"pilot-b@example.test","property_address":"600 Pilot B Avenue","source":"CSV Import","market":"Other Market","stage":"New Lead","import_id":"lead-intake:v1:phone:5556000002","imported_at":"2026-09-24T12:00:00Z"}}]'::jsonb
);

select test_support.assert_true(
  (select count(*) from public.deals where property_address='600 Pilot A Avenue') = 1,
  'pilot import persists to the target organization and retries idempotently'
);

select test_support.expect_error(
  format(
    'select public.persist_assisted_pilot_import(%L, %L, %L::jsonb)',
    (select organization_id::text from public.pilot_provisioning_requests where idempotency_key='build6-pilot-a-stable-key'),
    'build6-cross-tenant-confirmation',
    jsonb_build_array(jsonb_build_object(
      'rowNumber', 2,
      'payload', jsonb_build_object(
        'organization_id', (select organization_id from public.pilot_provisioning_requests where idempotency_key='build6-pilot-b-stable-key'),
        'property_address', 'Cross Tenant Import',
        'import_id', 'lead-intake:v1:cross-tenant'
      )
    ))::text
  ),
  'cross-tenant assisted import is rejected'
);

select test_support.assert_true(
  public.export_assisted_pilot_data(
    (select organization_id from public.pilot_provisioning_requests where idempotency_key='build6-pilot-a-stable-key')
  )::text like '%600 Pilot A Avenue%'
  and public.export_assisted_pilot_data(
    (select organization_id from public.pilot_provisioning_requests where idempotency_key='build6-pilot-a-stable-key')
  )::text not like '%600 Pilot B Avenue%'
  and public.export_assisted_pilot_data(
    (select organization_id from public.pilot_provisioning_requests where idempotency_key='build6-pilot-a-stable-key')
  )::text not like '%owner_user_id%'
  and public.export_assisted_pilot_data(
    (select organization_id from public.pilot_provisioning_requests where idempotency_key='build6-pilot-a-stable-key')
  )::text not like '%confirmation_token%',
  'export contains only owning tenant records and no auth or admin metadata'
);

select test_support.assert_true(
  public.pilot_support_diagnostics(
    (select organization_id from public.pilot_provisioning_requests where idempotency_key='build6-pilot-a-stable-key')
  )::text !~* '(password|jwt|api[_-]?key|database[_-]?url|service[_-]?role)'
  and public.pilot_support_diagnostics(
    (select organization_id from public.pilot_provisioning_requests where idempotency_key='build6-pilot-a-stable-key')
  )->'record_counts'->>'deals' = '1',
  'support diagnostics are useful, bounded, scoped, and secret-free'
);

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'c6000000-0000-0000-0000-000000000001', false);
select test_support.assert_true(
  (select count(*) from public.deals where property_address='600 Pilot A Avenue') = 1
  and (select count(*) from public.deals where property_address='600 Pilot B Avenue') = 0,
  'pilot A cannot read pilot B'
);
select test_support.assert_true(
  (select default_market from public.organization_settings) = 'Synthetic Market',
  'settings are organization scoped through RLS'
);
select test_support.assert_true(
  (select count(*) from public.pilot_provisioning_requests) = 0
  and (select count(*) from public.organization_provider_usage) = 0,
  'customer role cannot read pilot admin or provider usage internals'
);
select test_support.expect_error(
  $$select public.provision_assisted_pilot('owner-forbidden-key', 'Forbidden', 'c6000000-0000-0000-0000-000000000009', 'forbidden')$$,
  'ordinary owner cannot invoke provisioning'
);

reset role;
set role service_role;
select public.set_assisted_pilot_status(
  (select organization_id from public.pilot_provisioning_requests where idempotency_key='build6-pilot-a-stable-key'),
  'suspended'
);
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'c6000000-0000-0000-0000-000000000001', false);
select test_support.assert_true(
  (select count(*) from public.organizations) = 0
  and (select count(*) from public.deals) = 0
  and (select count(*) from public.organization_settings) = 0,
  'suspension blocks normal customer operation'
);
reset role;
set role service_role;
select test_support.assert_true(
  (select count(*) from public.deals where property_address='600 Pilot A Avenue') = 1,
  'suspension preserves customer data'
);
select public.set_assisted_pilot_status(
  (select organization_id from public.pilot_provisioning_requests where idempotency_key='build6-pilot-a-stable-key'),
  'active'
);
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'c6000000-0000-0000-0000-000000000001', false);
select test_support.assert_true(
  (select count(*) from public.deals where property_address='600 Pilot A Avenue') = 1,
  'reactivation restores customer access'
);

-- Accepted V1.1 owner B workflow remains intact after pilot lifecycle checks.
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000001', false);
select test_support.assert_true(
  (select id from public.deals where property_address='200 Test Avenue') = '20000000-0000-0000-0000-00000000000b',
  'existing V1.1 owner workflow remains tenant-scoped and available'
);
reset role;
