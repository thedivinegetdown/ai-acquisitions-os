-- Focused Build 3 lifecycle assertions. Run only against a disposable migrated database.
begin;

insert into public.organizations (id, name)
values ('b3000000-0000-0000-0000-000000000001', 'Build 3 Acceptance');

insert into public.deals (id, organization_id, property_address, phone) values
  ('b3000000-0000-0000-0000-000000000011', 'b3000000-0000-0000-0000-000000000001', '11 Lifecycle Way', '5553000011'),
  ('b3000000-0000-0000-0000-000000000012', 'b3000000-0000-0000-0000-000000000001', '12 Cancellation Way', '5553000012'),
  ('b3000000-0000-0000-0000-000000000013', 'b3000000-0000-0000-0000-000000000001', '13 Rejection Way', '5553000013'),
  ('b3000000-0000-0000-0000-000000000014', 'b3000000-0000-0000-0000-000000000001', '14 Withdrawal Way', '5553000014');

insert into public.buyers (id, organization_id, name)
values ('b3000000-0000-0000-0000-000000000021', 'b3000000-0000-0000-0000-000000000001', 'Selected Buyer');

insert into public.offer_revisions (id, deal_id, organization_id, status, offer_amount, terms, decision_basis)
values ('b3000000-0000-0000-0000-000000000101', 'b3000000-0000-0000-0000-000000000011', 'b3000000-0000-0000-0000-000000000001', 'draft', 100000, '{"offerType":"cash"}', '{"researchRevision":3}');
insert into public.offer_revisions (id, deal_id, organization_id, status, offer_amount, terms, decision_basis, follow_up_date)
values ('b3000000-0000-0000-0000-000000000102', 'b3000000-0000-0000-0000-000000000011', 'b3000000-0000-0000-0000-000000000001', 'sent', 100000, '{"offerType":"cash"}', '{"researchRevision":3}', '2026-10-01');
insert into public.offer_revisions (id, deal_id, organization_id, revision_kind, status, offer_amount, terms, decision_basis)
values ('b3000000-0000-0000-0000-000000000103', 'b3000000-0000-0000-0000-000000000011', 'b3000000-0000-0000-0000-000000000001', 'seller_counter', 'countered', 110000, '{"offerType":"cash"}', '{"researchRevision":3}');
insert into public.offer_revisions (id, deal_id, organization_id, status, offer_amount, terms, decision_basis)
values ('b3000000-0000-0000-0000-000000000104', 'b3000000-0000-0000-0000-000000000011', 'b3000000-0000-0000-0000-000000000001', 'accepted', 110000, '{"offerType":"cash"}', '{"researchRevision":3}');

do $$
begin
  if (select count(*) from public.offer_revisions where deal_id='b3000000-0000-0000-0000-000000000011') <> 4 then
    raise exception 'offer history count failed';
  end if;
  if (select offer_amount from public.offer_revisions where id='b3000000-0000-0000-0000-000000000101') <> 100000 then
    raise exception 'first offer revision was not preserved';
  end if;
  if (select array_agg(status order by revision_number) from public.offer_revisions where deal_id='b3000000-0000-0000-0000-000000000011')
     <> array['draft','sent','countered','accepted'] then
    raise exception 'manual negotiation history failed';
  end if;
  if not exists (
    select 1 from public.offer_revisions
    where deal_id='b3000000-0000-0000-0000-000000000011'
    order by revision_number desc limit 1
  ) then raise exception 'latest offer projection missing'; end if;
  if not exists (
    select 1 from public.deals where id='b3000000-0000-0000-0000-000000000011'
      and latest_offer=110000 and counter_offer=110000 and negotiation_status='Accepted'
  ) then raise exception 'legacy offer projection failed'; end if;
end $$;

insert into public.deal_closing_revisions (
  id, deal_id, organization_id, accepted_offer_revision_id, status, contract_date, closing_date,
  material_deadlines, title_company_reference, selected_buyer_id, assignment_fee, expected_proceeds
) values (
  'b3000000-0000-0000-0000-000000000201', 'b3000000-0000-0000-0000-000000000011',
  'b3000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000104',
  'under_contract', '2026-09-23', '2026-10-23',
  '[{"id":"inspection","label":"Inspection deadline","dueDate":"2026-10-01"}]',
  'Example Title', 'b3000000-0000-0000-0000-000000000021', 15000, 15000
);

insert into public.documents (
  id, deal_id, organization_id, doc_type, title, url, offer_revision_id, closing_revision_id
) values (
  'b3000000-0000-0000-0000-000000000301', 'b3000000-0000-0000-0000-000000000011',
  'b3000000-0000-0000-0000-000000000001', 'Purchase Agreement', 'Executed agreement',
  'https://example.invalid/contract', 'b3000000-0000-0000-0000-000000000104',
  'b3000000-0000-0000-0000-000000000201'
);

insert into public.deal_closing_revisions (
  id, deal_id, organization_id, accepted_offer_revision_id, status, contract_date, closing_date,
  material_deadlines, title_company_reference, selected_buyer_id, assignment_fee, expected_proceeds,
  actual_realized_proceeds, actual_costs
) values (
  'b3000000-0000-0000-0000-000000000202', 'b3000000-0000-0000-0000-000000000011',
  'b3000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000104',
  'closed', '2026-09-23', '2026-10-23',
  '[{"id":"inspection","label":"Inspection deadline","dueDate":"2026-10-01"}]',
  'Example Title', 'b3000000-0000-0000-0000-000000000021', 15000, 15000, 14500, 500
);

-- Independent cancellation history.
insert into public.offer_revisions (id, deal_id, organization_id, status, offer_amount)
values ('b3000000-0000-0000-0000-000000000111', 'b3000000-0000-0000-0000-000000000012', 'b3000000-0000-0000-0000-000000000001', 'draft', 80000);
insert into public.offer_revisions (id, deal_id, organization_id, status, offer_amount)
values ('b3000000-0000-0000-0000-000000000112', 'b3000000-0000-0000-0000-000000000012', 'b3000000-0000-0000-0000-000000000001', 'sent', 80000);
insert into public.offer_revisions (id, deal_id, organization_id, status, offer_amount)
values ('b3000000-0000-0000-0000-000000000113', 'b3000000-0000-0000-0000-000000000012', 'b3000000-0000-0000-0000-000000000001', 'accepted', 80000);
insert into public.deal_closing_revisions (id, deal_id, organization_id, accepted_offer_revision_id, status, closing_date)
values ('b3000000-0000-0000-0000-000000000211', 'b3000000-0000-0000-0000-000000000012', 'b3000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000113', 'under_contract', '2026-11-01');
insert into public.deal_closing_revisions (id, deal_id, organization_id, accepted_offer_revision_id, status, closing_date)
values ('b3000000-0000-0000-0000-000000000212', 'b3000000-0000-0000-0000-000000000012', 'b3000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000113', 'cancelled', '2026-11-01');

insert into public.offer_revisions (id, deal_id, organization_id, status, offer_amount) values
  ('b3000000-0000-0000-0000-000000000121', 'b3000000-0000-0000-0000-000000000013', 'b3000000-0000-0000-0000-000000000001', 'draft', 70000),
  ('b3000000-0000-0000-0000-000000000131', 'b3000000-0000-0000-0000-000000000014', 'b3000000-0000-0000-0000-000000000001', 'draft', 60000);
insert into public.offer_revisions (id, deal_id, organization_id, status, offer_amount) values
  ('b3000000-0000-0000-0000-000000000122', 'b3000000-0000-0000-0000-000000000013', 'b3000000-0000-0000-0000-000000000001', 'sent', 70000),
  ('b3000000-0000-0000-0000-000000000132', 'b3000000-0000-0000-0000-000000000014', 'b3000000-0000-0000-0000-000000000001', 'sent', 60000);
insert into public.offer_revisions (id, deal_id, organization_id, status, offer_amount) values
  ('b3000000-0000-0000-0000-000000000123', 'b3000000-0000-0000-0000-000000000013', 'b3000000-0000-0000-0000-000000000001', 'rejected', 70000),
  ('b3000000-0000-0000-0000-000000000133', 'b3000000-0000-0000-0000-000000000014', 'b3000000-0000-0000-0000-000000000001', 'withdrawn', 60000);

insert into public.seller_tasks (deal_id, organization_id, phone, title, due_at, source_type, source_key)
values ('b3000000-0000-0000-0000-000000000011', 'b3000000-0000-0000-0000-000000000001', '5553000011', 'Closing date', '2026-10-23T12:00:00Z', 'closing-lifecycle', 'closing-date')
on conflict (organization_id, deal_id, source_type, source_key)
do update set due_at=excluded.due_at, title=excluded.title, status='open';
insert into public.seller_tasks (deal_id, organization_id, phone, title, due_at, source_type, source_key)
values ('b3000000-0000-0000-0000-000000000011', 'b3000000-0000-0000-0000-000000000001', '5553000011', 'Closing date', '2026-10-23T12:00:00Z', 'closing-lifecycle', 'closing-date')
on conflict (organization_id, deal_id, source_type, source_key)
do update set due_at=excluded.due_at, title=excluded.title, status='open';

do $$
begin
  if not exists (
    select 1 from public.deal_closing_revisions where id='b3000000-0000-0000-0000-000000000201'
      and selected_buyer_id='b3000000-0000-0000-0000-000000000021'
      and material_deadlines->0->>'dueDate'='2026-10-01'
  ) then raise exception 'closing milestones or selected buyer failed'; end if;
  if not exists (
    select 1 from public.deal_closing_revisions where id='b3000000-0000-0000-0000-000000000202'
      and actual_realized_proceeds=14500 and actual_costs=500 and status='closed'
  ) then raise exception 'realized result failed'; end if;
  if (select count(*) from public.deal_closing_revisions where deal_id='b3000000-0000-0000-0000-000000000012') <> 2 then
    raise exception 'cancellation did not preserve prior history';
  end if;
  if (select array_agg(status order by deal_id, revision_number) from public.offer_revisions where deal_id in ('b3000000-0000-0000-0000-000000000013','b3000000-0000-0000-0000-000000000014'))
     <> array['draft','sent','rejected','draft','sent','withdrawn'] then
    raise exception 'rejected/withdrawn offer history failed';
  end if;
  if not exists (
    select 1 from public.documents where id='b3000000-0000-0000-0000-000000000301'
      and offer_revision_id is not null and closing_revision_id is not null
  ) then raise exception 'document lifecycle association failed'; end if;
  if (select count(*) from public.seller_tasks where deal_id='b3000000-0000-0000-0000-000000000011' and source_type='closing-lifecycle' and source_key='closing-date') <> 1 then
    raise exception 'lifecycle commitment dedupe failed';
  end if;
  if not exists (
    select 1 from public.deals where id='b3000000-0000-0000-0000-000000000011'
      and stage='Closed' and buyer_assignee='Selected Buyer' and closing_date='2026-10-23'
  ) then raise exception 'pipeline closing projection failed'; end if;
end $$;

rollback;
