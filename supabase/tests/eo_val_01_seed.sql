-- Synthetic EO-VAL-01 tenants and business rows. No real contact data.

insert into public.organizations (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-00000000000a', 'Test Organization A', 'eo-val-org-a', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-00000000000b', 'Test Organization B', 'eo-val-org-b', 'bbbbbbbb-0000-0000-0000-000000000001');

insert into public.organization_memberships (organization_id, user_id, role, status) values
  ('10000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner', 'active'),
  ('10000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000002', 'analyst', 'active'),
  ('10000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000003', 'viewer', 'active'),
  ('10000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000001', 'owner', 'active');

insert into public.deals (id, organization_id, property_address, phone) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '100 Test Avenue', '5550000001'),
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', '200 Test Avenue', '5550000002');

insert into public.message_logs (id, deal_id, organization_id, phone, message, direction, status)
values ('30000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '5550000001', 'Synthetic message A', 'inbound', 'received');

insert into public.seller_tasks (id, deal_id, organization_id, phone, title)
values ('40000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '5550000001', 'Synthetic task A');

insert into public.buyers (id, organization_id, name, phone)
values ('50000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'Synthetic Buyer A', '5550000003');

insert into public.documents (id, deal_id, organization_id, doc_type, title)
values ('60000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'test', 'Synthetic document A');

insert into public.comps (id, deal_id, organization_id, address)
values ('70000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '300 Test Avenue');

insert into public.sequences (id, deal_id, organization_id, step_day, action_type)
values ('80000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 1, 'synthetic-test');

insert into public.communication_consents (
  id, organization_id, normalized_phone, channel, status, source, provider
) values
  ('90000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '+15550000001', 'sms', 'opted-in', 'eo-val-01', 'twilio'),
  ('90000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', '+15550000002', 'sms', 'opted-in', 'eo-val-01', 'twilio');

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to service_role;
