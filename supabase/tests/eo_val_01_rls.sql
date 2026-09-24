-- Executed only after the guarded runner applies activate_rls.sql locally.

create schema test_support;

create function test_support.assert_true(condition boolean, message text)
returns void
language plpgsql
as $$
begin
  if condition is not true then
    raise exception 'EO-VAL-01 assertion failed: %', message;
  end if;
end;
$$;

create function test_support.expect_error(command text, message text)
returns void
language plpgsql
as $$
begin
  begin
    execute command;
  exception when others then
    return;
  end;
  raise exception 'EO-VAL-01 expected denial did not occur: %', message;
end;
$$;

grant usage on schema test_support to anon, authenticated, service_role;
grant execute on all functions in schema test_support to anon, authenticated, service_role;

select test_support.assert_true(
  (select count(*) from pg_catalog.pg_policies where schemaname = 'public') = 41,
  'expected 41 tenant policies'
);
select test_support.assert_true(
  (
    select count(*)
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'organizations', 'organization_memberships', 'communication_consents',
        'deals', 'message_logs', 'seller_tasks', 'buyers', 'documents', 'comps', 'sequences',
        'offer_revisions', 'deal_closing_revisions',
        'decision_recommendation_snapshots', 'decision_owner_decisions',
        'pilot_provisioning_requests', 'organization_settings',
        'organization_provider_policies', 'organization_provider_usage'
      )
      and relation.relrowsecurity
  ) = 18,
  'expected RLS enabled on all eighteen tenant and pilot-admin tables'
);

-- Owner A: own-tenant read/write, cross-tenant denial, immutable ownership.
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
select test_support.assert_true((select count(*) from public.organizations) = 1, 'owner A organization visibility');
select test_support.assert_true((select count(*) from public.deals) = 1, 'owner A deal visibility');
insert into public.deals (id, organization_id, property_address)
values ('21000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'Owner A insert');
update public.deals set notes = 'Owner A update' where id = '21000000-0000-0000-0000-00000000000a';
insert into public.offer_revisions (
  id, deal_id, organization_id, revision_number, revision_kind, status, offer_amount, decision_basis
) values (
  '23000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-00000000000a',
  '10000000-0000-0000-0000-00000000000a', 99, 'offer', 'draft', 100000,
  '{"researchRevision":1}'::jsonb
);
insert into public.offer_revisions (
  id, deal_id, organization_id, revision_number, revision_kind, status, offer_amount, decision_basis
) values (
  '23000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-00000000000a',
  '10000000-0000-0000-0000-00000000000a', 99, 'offer', 'sent', 100000,
  '{"researchRevision":1}'::jsonb
);
insert into public.offer_revisions (
  id, deal_id, organization_id, revision_number, revision_kind, status, offer_amount, decision_basis
) values (
  '23000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-00000000000a',
  '10000000-0000-0000-0000-00000000000a', 99, 'offer', 'accepted', 100000,
  '{"researchRevision":1}'::jsonb
);
select test_support.assert_true(
  (select array_agg(revision_number order by revision_number) from public.offer_revisions) = array[1,2,3],
  'offer revision order is database-owned and deterministic'
);
insert into public.deal_closing_revisions (
  id, deal_id, organization_id, revision_number, accepted_offer_revision_id, status,
  contract_date, closing_date, material_deadlines, selected_buyer_id, assignment_fee
) values (
  '24000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-00000000000a',
  '10000000-0000-0000-0000-00000000000a', 99,
  '23000000-0000-0000-0000-000000000003', 'under_contract', current_date,
  current_date + 30, '[{"id":"inspection","label":"Inspection","dueDate":"2026-12-01"}]'::jsonb,
  '50000000-0000-0000-0000-00000000000a', 15000
);
select test_support.assert_true(
  (select selected_buyer_id from public.deal_closing_revisions where id='24000000-0000-0000-0000-000000000001') = '50000000-0000-0000-0000-00000000000a',
  'selected buyer persists on closing snapshot'
);
insert into public.decision_recommendation_snapshots (
  id, deal_id, organization_id, snapshot_number, memory_contract_version,
  decision_contract_version, recalculation_contract_version, recommendation_result,
  canonical_input_fingerprint, recommendation_basis, evaluated_at, actor_reference
) values (
  '25000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-00000000000a',
  '10000000-0000-0000-0000-00000000000a', 99, 'decision-memory-v1',
  'decision-contract-v1', 'recommendation-recalculation-v1',
  '{"recommendationId":"recommendation-1","label":"Prepare offer"}',
  'fingerprint-1', '{"basisType":"readiness"}', now(),
  'aaaaaaaa-0000-0000-0000-000000000001'
);
insert into public.decision_owner_decisions (
  recommendation_snapshot_id, deal_id, organization_id, decision_type,
  override_flag, actor_reference
) values (
  '25000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-00000000000a',
  '10000000-0000-0000-0000-00000000000a', 'followed', false,
  'aaaaaaaa-0000-0000-0000-000000000001'
);
select test_support.assert_true(
  (select count(*) from public.decision_recommendation_snapshots) = 1
    and (select count(*) from public.decision_owner_decisions) = 1,
  'owner can append tenant-scoped Decision Memory'
);
update public.offer_revisions set offer_amount=1 where id='23000000-0000-0000-0000-000000000001';
update public.deal_closing_revisions set status='cancelled' where id='24000000-0000-0000-0000-000000000001';
select test_support.assert_true(
  (select offer_amount from public.offer_revisions where id='23000000-0000-0000-0000-000000000001') = 100000,
  'offer snapshots remain unchanged without an update policy'
);
select test_support.assert_true(
  (select status from public.deal_closing_revisions where id='24000000-0000-0000-0000-000000000001') = 'under_contract',
  'closing snapshots remain unchanged without an update policy'
);
select test_support.expect_error(
  $$insert into public.deals (organization_id, property_address) values ('10000000-0000-0000-0000-00000000000b', 'Cross tenant')$$,
  'owner A cannot insert for organization B'
);
select test_support.expect_error(
  $$update public.deals set organization_id = '10000000-0000-0000-0000-00000000000b' where id = '20000000-0000-0000-0000-00000000000a'$$,
  'owner A cannot transfer deal ownership'
);
insert into public.organization_memberships (organization_id, user_id, role, status)
values ('10000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000004', 'viewer', 'active');
select test_support.expect_error(
  $$update public.organization_memberships set organization_id = '10000000-0000-0000-0000-00000000000b' where user_id = 'aaaaaaaa-0000-0000-0000-000000000004'$$,
  'membership organization cannot be transferred'
);
reset role;

-- Analyst A: own-tenant business writes, no membership escalation or Org B access.
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', false);
select test_support.assert_true((select count(*) from public.deals) = 2, 'analyst A own-tenant reads');
insert into public.deals (id, organization_id, property_address)
values ('22000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'Analyst A insert');
update public.deals set notes = 'Analyst A update' where id = '22000000-0000-0000-0000-00000000000a';
insert into public.decision_recommendation_snapshots (
  id, deal_id, organization_id, snapshot_number, memory_contract_version,
  decision_contract_version, recalculation_contract_version, recommendation_result,
  canonical_input_fingerprint, recommendation_basis, evaluated_at, actor_reference
) values (
  '25000000-0000-0000-0000-000000000002',
  '22000000-0000-0000-0000-00000000000a',
  '10000000-0000-0000-0000-00000000000a', 99, 'decision-memory-v1',
  'decision-contract-v1', 'recommendation-recalculation-v1',
  '{"recommendationId":"recommendation-2","label":"Review"}',
  'analyst-fingerprint', '{}', now(), 'aaaaaaaa-0000-0000-0000-000000000002'
);
select test_support.expect_error(
  $$insert into public.organization_memberships (organization_id, user_id, role, status) values ('10000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000005', 'owner', 'active')$$,
  'analyst cannot create membership'
);
update public.organization_memberships set role = 'owner'
where organization_id = '10000000-0000-0000-0000-00000000000a'
  and user_id = 'aaaaaaaa-0000-0000-0000-000000000002';
select test_support.expect_error(
  $$insert into public.organization_memberships (organization_id, user_id, role, status) values ('10000000-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000002', 'owner', 'active')$$,
  'analyst cannot self-add to organization B'
);
select test_support.expect_error(
  $$insert into public.decision_owner_decisions (recommendation_snapshot_id, deal_id, organization_id, decision_type, override_flag, actor_reference) values ('25000000-0000-0000-0000-000000000002', '22000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'followed', false, 'analyst')$$,
  'analyst cannot record an owner decision'
);
reset role;
select test_support.assert_true(
  (select role from public.organization_memberships where user_id = 'aaaaaaaa-0000-0000-0000-000000000002') = 'analyst',
  'analyst self-promotion remained denied'
);

-- Viewer A: read-only; insert is rejected and update/delete affect no rows.
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000003', false);
select test_support.assert_true((select count(*) from public.deals) = 3, 'viewer A own-tenant reads');
select test_support.expect_error(
  $$insert into public.deals (organization_id, property_address) values ('10000000-0000-0000-0000-00000000000a', 'Viewer insert')$$,
  'viewer insert denied'
);
update public.deals set notes = 'Viewer mutation' where id = '20000000-0000-0000-0000-00000000000a';
delete from public.deals where id = '20000000-0000-0000-0000-00000000000a';
update public.organization_memberships set role = 'owner'
where user_id = 'aaaaaaaa-0000-0000-0000-000000000003';
reset role;
select test_support.assert_true(
  (select notes from public.deals where id = '20000000-0000-0000-0000-00000000000a') is null,
  'viewer update denied'
);
select test_support.assert_true(
  exists (select 1 from public.deals where id = '20000000-0000-0000-0000-00000000000a'),
  'viewer delete denied'
);
select test_support.assert_true(
  (select role from public.organization_memberships where user_id = 'aaaaaaaa-0000-0000-0000-000000000003') = 'viewer',
  'viewer self-promotion denied'
);

-- Owner B sees only Org B.
set role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000001', false);
select test_support.assert_true((select count(*) from public.organizations) = 1, 'owner B organization visibility');
select test_support.assert_true(
  (select id from public.deals) = '20000000-0000-0000-0000-00000000000b',
  'owner B cannot read organization A deals'
);
reset role;

-- Anonymous access is denied.
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select test_support.assert_true((select count(*) from public.deals) = 0, 'anonymous reads denied');
select test_support.expect_error(
  $$insert into public.deals (organization_id, property_address) values ('10000000-0000-0000-0000-00000000000a', 'Anonymous insert')$$,
  'anonymous writes denied'
);
reset role;

-- Composite tenant/deal constraints reject every cross-tenant child relationship.
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
select test_support.expect_error(
  $$insert into public.message_logs (deal_id, organization_id, phone, message) values ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000a', '5550000099', 'Cross tenant')$$,
  'cross-tenant message deal rejected'
);
select test_support.expect_error(
  $$insert into public.seller_tasks (deal_id, organization_id, phone, title) values ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000a', '5550000099', 'Cross tenant')$$,
  'cross-tenant task deal rejected'
);
select test_support.expect_error(
  $$insert into public.documents (deal_id, organization_id, doc_type, title) values ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000a', 'test', 'Cross tenant')$$,
  'cross-tenant document deal rejected'
);
select test_support.expect_error(
  $$insert into public.comps (deal_id, organization_id, address) values ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000a', 'Cross tenant')$$,
  'cross-tenant comp deal rejected'
);
select test_support.expect_error(
  $$insert into public.sequences (deal_id, organization_id, step_day, action_type) values ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000a', 2, 'cross-tenant')$$,
  'cross-tenant sequence deal rejected'
);
select test_support.expect_error(
  $$insert into public.offer_revisions (deal_id, organization_id, revision_number, status, offer_amount) values ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000a', 1, 'draft', 1)$$,
  'cross-tenant offer rejected'
);
select test_support.expect_error(
  $$insert into public.decision_recommendation_snapshots (deal_id, organization_id, snapshot_number, memory_contract_version, decision_contract_version, recalculation_contract_version, recommendation_result, canonical_input_fingerprint, recommendation_basis, evaluated_at, actor_reference) values ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000a', 1, 'decision-memory-v1', 'decision-contract-v1', 'recommendation-recalculation-v1', '{}', 'cross-tenant', '{}', now(), 'owner-a')$$,
  'cross-tenant recommendation snapshot rejected'
);

-- Communication consent follows the same read/write role and tenant boundaries.
select test_support.assert_true((select count(*) from public.communication_consents) = 1, 'Org A consent visibility');
update public.communication_consents set status = 'opted-out'
where id = '90000000-0000-0000-0000-00000000000a';
select test_support.expect_error(
  $$insert into public.communication_consents (organization_id, normalized_phone, channel, status, source) values ('10000000-0000-0000-0000-00000000000b', '+15550000009', 'sms', 'unknown', 'cross-tenant')$$,
  'cross-tenant consent insert denied'
);
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000003', false);
select test_support.assert_true((select count(*) from public.communication_consents) = 1, 'viewer consent read allowed');
update public.communication_consents set status = 'opted-in'
where id = '90000000-0000-0000-0000-00000000000a';
reset role;
select test_support.assert_true(
  (select status from public.communication_consents where id = '90000000-0000-0000-0000-00000000000a') = 'opted-out',
  'viewer consent update denied'
);

-- Service role is the contained administrative bypass; browser roles are not.
select test_support.assert_true(
  not (select rolbypassrls from pg_roles where rolname = 'authenticated')
    and not (select rolbypassrls from pg_roles where rolname = 'anon')
    and (select rolbypassrls from pg_roles where rolname = 'service_role'),
  'only service_role has bypassrls'
);
set role service_role;
select test_support.assert_true((select count(*) from public.organizations) = 2, 'service role bypasses tenant RLS');
select test_support.expect_error(
  $$update public.offer_revisions set offer_amount=1 where id='23000000-0000-0000-0000-000000000001'$$,
  'offer snapshot trigger rejects service-role mutation'
);
select test_support.expect_error(
  $$delete from public.deal_closing_revisions where id='24000000-0000-0000-0000-000000000001'$$,
  'closing snapshot trigger rejects service-role deletion'
);
select test_support.expect_error(
  $$update public.decision_recommendation_snapshots set canonical_input_fingerprint='changed' where id='25000000-0000-0000-0000-000000000001'$$,
  'recommendation snapshot trigger rejects service-role mutation'
);
select test_support.expect_error(
  $$delete from public.decision_owner_decisions where recommendation_snapshot_id='25000000-0000-0000-0000-000000000001'$$,
  'owner decision trigger rejects service-role deletion'
);
select test_support.expect_error(
  $$update public.deals set organization_id = '10000000-0000-0000-0000-00000000000b' where id = '20000000-0000-0000-0000-00000000000a'$$,
  'service role normal update cannot transfer ownership'
);
reset role;
