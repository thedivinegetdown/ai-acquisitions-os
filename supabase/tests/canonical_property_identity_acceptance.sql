-- Disposable canonical property identity acceptance. No provider calls or real data.

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);

create temporary table property_admission_results (
  label text primary key,
  result jsonb not null
);

insert into property_admission_results values (
  'first-path',
  public.admit_verified_property_deal(
    '10000000-0000-0000-0000-00000000000a',
    'us-fl-volusia-county', '2123541', 'volusia-parcel-ownership',
    '2026-10-15T12:00:00Z',
    '{"source":"external-land-research","import_id":"external-land:volusia:2123541:a","property_address":"195 Lake Molly Ave","stage":"New Lead"}'::jsonb
  )
);

insert into property_admission_results values (
  'second-path',
  public.admit_verified_property_deal(
    '10000000-0000-0000-0000-00000000000a',
    'us-fl-volusia-county', '2123541', 'volusia-parcel-ownership',
    '2026-10-15T12:01:00Z',
    '{"source":"volusia-tax-deed-sale","import_id":"volusia-tax-deed:2123541:b","property_address":"195 Lake Molly Ave","stage":"New Lead"}'::jsonb
  )
);

select test_support.assert_true(
  (select result->>'status' from property_admission_results where label='first-path') = 'imported'
  and (select result->>'status' from property_admission_results where label='second-path') = 'existing'
  and (select result->'deal'->>'id' from property_admission_results where label='first-path') =
      (select result->'deal'->>'id' from property_admission_results where label='second-path')
  and (select count(*) from public.deals
       where organization_id='10000000-0000-0000-0000-00000000000a'
         and property_jurisdiction='us-fl-volusia-county'
         and authoritative_parcel_id='2123541'
         and coalesce(lower(btrim(stage)), '') not in ('closed', 'dead lead')) = 1,
  'two intake paths return one active deal for the same verified parcel'
);

select test_support.assert_true(
  (select count(*) from public.deal_intake_sources
   where organization_id='10000000-0000-0000-0000-00000000000a'
     and deal_id=(select (result->'deal'->>'id')::uuid from property_admission_results where label='first-path')) = 2,
  'duplicate admission preserves both independent import identities and sources'
);

select test_support.expect_error(
  $$insert into public.deals (
      organization_id, property_jurisdiction, authoritative_parcel_id,
      property_address, stage, import_id
    ) values (
      '10000000-0000-0000-0000-00000000000a', 'us-fl-volusia-county',
      '2123541', 'Concurrent duplicate fixture', 'New Lead', 'concurrent:duplicate'
    )$$,
  'database uniqueness rejects a concurrent active-deal insert'
);

update public.deals
set stage='Closed', closed_at='2026-10-15T13:00:00Z'
where id=(select (result->'deal'->>'id')::uuid from property_admission_results where label='first-path');

insert into property_admission_results values (
  'after-close',
  public.admit_verified_property_deal(
    '10000000-0000-0000-0000-00000000000a',
    'us-fl-volusia-county', '2123541', 'volusia-parcel-ownership',
    '2026-10-15T14:00:00Z',
    '{"source":"external-land-research","import_id":"external-land:volusia:2123541:new-opportunity","property_address":"195 Lake Molly Ave","stage":"New Lead"}'::jsonb
  )
);

select test_support.assert_true(
  (select result->>'status' from property_admission_results where label='after-close') = 'imported'
  and (select count(*) from public.deals
       where organization_id='10000000-0000-0000-0000-00000000000a'
         and property_jurisdiction='us-fl-volusia-county'
         and authoritative_parcel_id='2123541') = 2
  and (select count(*) from public.deals
       where organization_id='10000000-0000-0000-0000-00000000000a'
         and property_jurisdiction='us-fl-volusia-county'
         and authoritative_parcel_id='2123541'
         and stage='Closed') = 1,
  'closed history remains and a new active opportunity is permitted'
);

insert into property_admission_results values (
  'other-jurisdiction',
  public.admit_verified_property_deal(
    '10000000-0000-0000-0000-00000000000a',
    'us-fl-orange-county', '302430266507203', 'orange-county-property-appraiser',
    '2026-10-15T14:01:00Z',
    '{"source":"orange-county-tax-sale","import_id":"orange-county-tax-sale:test-identity","property_address":"Orange jurisdiction fixture","stage":"New Lead"}'::jsonb
  )
);

select test_support.assert_true(
  (select result->>'status' from property_admission_results where label='other-jurisdiction') = 'imported'
  and (select count(*) from public.property_identities
       where organization_id='10000000-0000-0000-0000-00000000000a') = 2,
  'different jurisdictions remain distinct canonical properties'
);

select test_support.expect_error(
  $$select public.admit_verified_property_deal(
    '10000000-0000-0000-0000-00000000000a',
    'us-fl-volusia-county', '21-23541', 'volusia-parcel-ownership', now(),
    '{"source":"unverified","import_id":"unverified:parcel"}'::jsonb
  )$$,
  'malformed or non-exact Volusia parcel identity fails closed'
);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000001', false);
insert into property_admission_results values (
  'other-tenant',
  public.admit_verified_property_deal(
    '10000000-0000-0000-0000-00000000000b',
    'us-fl-volusia-county', '2123541', 'volusia-parcel-ownership',
    '2026-10-15T14:02:00Z',
    '{"source":"external-land-research","import_id":"external-land:volusia:2123541:tenant-b","property_address":"Tenant B fixture","stage":"New Lead"}'::jsonb
  )
);

select test_support.assert_true(
  (select result->>'status' from property_admission_results where label='other-tenant') = 'imported'
  and (select count(*) from public.deals
       where organization_id='10000000-0000-0000-0000-00000000000b'
         and property_jurisdiction='us-fl-volusia-county'
         and authoritative_parcel_id='2123541') = 1,
  'same parcel is independently admissible in another organization'
);

reset role;
