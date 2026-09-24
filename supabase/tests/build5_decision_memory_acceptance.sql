-- Focused Build 5 / DI-07 assertions. Run only against a disposable migrated database.
begin;

insert into public.organizations (id, name) values
  ('b5000000-0000-0000-0000-000000000001', 'Build 5 Org A'),
  ('b5000000-0000-0000-0000-000000000002', 'Build 5 Org B');
insert into public.deals (id, organization_id, property_address) values
  ('b5000000-0000-0000-0000-000000000011', 'b5000000-0000-0000-0000-000000000001', '11 Memory Lane'),
  ('b5000000-0000-0000-0000-000000000012', 'b5000000-0000-0000-0000-000000000002', '12 Tenant Boundary');

insert into public.decision_recommendation_snapshots (
  id, deal_id, organization_id, snapshot_number, memory_contract_version,
  decision_contract_version, recalculation_contract_version, recommendation_result,
  canonical_input_fingerprint, recommendation_basis, evaluated_at, actor_id, actor_reference
) values (
  'b5000000-0000-0000-0000-000000000101',
  'b5000000-0000-0000-0000-000000000011',
  'b5000000-0000-0000-0000-000000000001', 99, 'decision-memory-v1',
  'decision-contract-v1', 'recommendation-recalculation-v1',
  '{"recommendationId":"recommendation-1","label":"Verify seller timeline","status":"evaluated","evaluatedTimestamp":"2026-09-24T14:00:00Z"}',
  'fingerprint-1', '{"basisType":"missing-information"}', '2026-09-24T14:00:00Z',
  'b5000000-0000-0000-0000-000000000901', 'owner-a'
);

-- Same current boundary is ignored, including a concurrent/reload attempt with a new id.
insert into public.decision_recommendation_snapshots (
  id, deal_id, organization_id, snapshot_number, memory_contract_version,
  decision_contract_version, recalculation_contract_version, recommendation_result,
  canonical_input_fingerprint, recommendation_basis, evaluated_at, actor_id, actor_reference
) values (
  'b5000000-0000-0000-0000-000000000102',
  'b5000000-0000-0000-0000-000000000011',
  'b5000000-0000-0000-0000-000000000001', 99, 'decision-memory-v1',
  'decision-contract-v1', 'recommendation-recalculation-v1',
  '{"recommendationId":"recommendation-1","label":"Verify seller timeline","status":"evaluated","evaluatedTimestamp":"2026-09-24T14:30:00Z"}',
  'fingerprint-1', '{"basisType":"missing-information"}', '2026-09-24T14:30:00Z',
  'b5000000-0000-0000-0000-000000000901', 'owner-a'
);

insert into public.decision_owner_decisions (
  id, recommendation_snapshot_id, deal_id, organization_id, decision_type,
  override_flag, actor_id, actor_reference, decided_at
) values (
  'b5000000-0000-0000-0000-000000000201',
  'b5000000-0000-0000-0000-000000000101',
  'b5000000-0000-0000-0000-000000000011',
  'b5000000-0000-0000-0000-000000000001', 'followed', false,
  'b5000000-0000-0000-0000-000000000901', 'owner-a', '2026-09-24T14:05:00Z'
);

-- A materially changed DI-06 boundary appends the next snapshot.
insert into public.decision_recommendation_snapshots (
  id, deal_id, organization_id, snapshot_number, memory_contract_version,
  decision_contract_version, recalculation_contract_version, recommendation_result,
  canonical_input_fingerprint, recommendation_basis, evaluated_at, actor_id, actor_reference
) values (
  'b5000000-0000-0000-0000-000000000103',
  'b5000000-0000-0000-0000-000000000011',
  'b5000000-0000-0000-0000-000000000001', 99, 'decision-memory-v1',
  'decision-contract-v1', 'recommendation-recalculation-v1',
  '{"recommendationId":"recommendation-2","label":"Prepare offer","status":"evaluated"}',
  'fingerprint-2', '{"basisType":"offer-readiness"}', '2026-09-24T15:00:00Z',
  'b5000000-0000-0000-0000-000000000902', 'owner-b'
);
insert into public.decision_owner_decisions (
  id, recommendation_snapshot_id, deal_id, organization_id, decision_type,
  override_flag, alternative_result, reason, actor_id, actor_reference, decided_at
) values (
  'b5000000-0000-0000-0000-000000000202',
  'b5000000-0000-0000-0000-000000000103',
  'b5000000-0000-0000-0000-000000000011',
  'b5000000-0000-0000-0000-000000000001', 'alternative', true,
  '{"label":"Request title review first"}', 'Unreleased lien needs review',
  'b5000000-0000-0000-0000-000000000902', 'owner-b', '2026-09-24T15:05:00Z'
);

insert into public.offer_revisions (id, deal_id, organization_id, status, offer_amount) values
  ('b5000000-0000-0000-0000-000000000301', 'b5000000-0000-0000-0000-000000000011', 'b5000000-0000-0000-0000-000000000001', 'draft', 100000),
  ('b5000000-0000-0000-0000-000000000302', 'b5000000-0000-0000-0000-000000000011', 'b5000000-0000-0000-0000-000000000001', 'sent', 100000),
  ('b5000000-0000-0000-0000-000000000303', 'b5000000-0000-0000-0000-000000000011', 'b5000000-0000-0000-0000-000000000001', 'accepted', 100000);
insert into public.deal_closing_revisions (
  id, deal_id, organization_id, accepted_offer_revision_id, status,
  actual_realized_proceeds, actual_costs
) values (
  'b5000000-0000-0000-0000-000000000401',
  'b5000000-0000-0000-0000-000000000011',
  'b5000000-0000-0000-0000-000000000001',
  'b5000000-0000-0000-0000-000000000303', 'under_contract', null, null
), (
  'b5000000-0000-0000-0000-000000000402',
  'b5000000-0000-0000-0000-000000000011',
  'b5000000-0000-0000-0000-000000000001',
  'b5000000-0000-0000-0000-000000000303', 'closed', 14500, 500
);

do $$
begin
  if (select count(*) from public.decision_recommendation_snapshots where deal_id='b5000000-0000-0000-0000-000000000011') <> 2 then
    raise exception 'unchanged recommendation boundary was duplicated';
  end if;
  if (select array_agg(snapshot_number order by snapshot_number) from public.decision_recommendation_snapshots where deal_id='b5000000-0000-0000-0000-000000000011') <> array[1,2] then
    raise exception 'material recalculation did not append a distinct ordered snapshot';
  end if;
  if not exists (select 1 from public.decision_owner_decisions where decision_type='followed' and not override_flag) then
    raise exception 'followed recommendation was not persisted';
  end if;
  if not exists (select 1 from public.decision_owner_decisions where override_flag and reason='Unreleased lien needs review' and actor_reference='owner-b') then
    raise exception 'override reason or actor was not preserved';
  end if;
  if not exists (select 1 from public.deal_closing_revisions where status='closed' and accepted_offer_revision_id='b5000000-0000-0000-0000-000000000303' and actual_realized_proceeds=14500) then
    raise exception 'Build 3 lifecycle truth is unavailable for reference';
  end if;

  begin
    update public.decision_recommendation_snapshots set recommendation_result='{}' where id='b5000000-0000-0000-0000-000000000101';
    raise exception 'snapshot mutation unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'snapshot mutation unexpectedly succeeded' then raise; end if;
  end;

  begin
    insert into public.decision_recommendation_snapshots (
      deal_id, organization_id, snapshot_number, memory_contract_version,
      decision_contract_version, recalculation_contract_version, recommendation_result,
      canonical_input_fingerprint, recommendation_basis, evaluated_at, actor_id
    ) values (
      'b5000000-0000-0000-0000-000000000012',
      'b5000000-0000-0000-0000-000000000001', 1, 'decision-memory-v1',
      'decision-contract-v1', 'recommendation-recalculation-v1', '{}',
      'cross-tenant', '{}', now(), 'b5000000-0000-0000-0000-000000000901'
    );
    raise exception 'cross-tenant recommendation unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'cross-tenant recommendation unexpectedly succeeded' then raise; end if;
  end;
end $$;

rollback;
