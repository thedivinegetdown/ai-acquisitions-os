-- EO-PROD-02 review candidate. Never execute against production in this EO.
-- A later execution order must replace the final ROLLBACK only after backup,
-- drift revalidation, and change approval.

begin;

-- Fail before DDL when the observed legacy starting point has changed.
do $$
declare
  mismatch text;
begin
  if to_regclass('public.deals') is null
     or to_regclass('public.message_logs') is null
     or to_regclass('public.buyers') is null
     or to_regclass('public.documents') is null
     or to_regclass('public.comps') is null
     or to_regclass('public.sequences') is null then
    raise exception 'EO-PROD-02 preflight: an observed canonical table is missing';
  end if;

  if to_regclass('public."Deals"') is not null
     and to_regclass('public."Deals"') = to_regclass('public.deals') then
    raise exception 'EO-PROD-02 preflight: unexpected case-sensitive Deals collision';
  end if;

  select format('%I.%I expected %s, found %s', expected.table_name,
                expected.column_name, expected.data_type, columns.data_type)
    into mismatch
  from (values
    ('deals','id','uuid'),
    ('deals','property_address','text'),
    ('deals','beds','integer'),
    ('deals','baths','integer'),
    ('deals','condition','text'),
    ('message_logs','id','uuid'),
    ('message_logs','deal_id','uuid'),
    ('message_logs','direction','text'),
    ('buyers','id','uuid'),
    ('documents','deal_id','uuid'),
    ('comps','deal_id','uuid'),
    ('sequences','deal_id','uuid')
  ) expected(table_name,column_name,data_type)
  join information_schema.columns columns
    on columns.table_schema = 'public'
   and columns.table_name = expected.table_name
   and columns.column_name = expected.column_name
  where columns.data_type <> expected.data_type
  limit 1;

  if mismatch is not null then
    raise exception 'EO-PROD-02 preflight type mismatch: %', mismatch;
  end if;

  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='deals' and column_name='beds')
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='deals' and column_name='baths')
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='deals' and column_name='condition') then
    raise exception 'EO-PROD-02 preflight: required legacy alias source column is missing';
  end if;

  if exists(
    select 1 from pg_constraint
    where connamespace='public'::regnamespace
      and conname='message_logs_direction_check'
      and (pg_get_constraintdef(oid) not ilike '%inbound%'
        or pg_get_constraintdef(oid) not ilike '%outbound%')
  ) then
    raise exception 'EO-PROD-02 preflight: conflicting constraint definition';
  end if;

  if exists (
    select 1 from public.message_logs child
    where child.deal_id is not null
      and not exists (select 1 from public.deals parent where parent.id = child.deal_id)
  ) or exists (
    select 1 from public.documents child
    where child.deal_id is not null
      and not exists (select 1 from public.deals parent where parent.id = child.deal_id)
  ) or exists (
    select 1 from public.comps child
    where child.deal_id is not null
      and not exists (select 1 from public.deals parent where parent.id = child.deal_id)
  ) or exists (
    select 1 from public.sequences child
    where child.deal_id is not null
      and not exists (select 1 from public.deals parent where parent.id = child.deal_id)
  ) then
    raise exception 'EO-PROD-02 preflight: invalid legacy deal reference';
  end if;

  if exists (
    select property_address from public.deals
    where property_address is not null
    group by property_address having count(*) > 1
  ) then
    raise exception 'EO-PROD-02 preflight: duplicate property address conflicts with legacy uniqueness';
  end if;
end $$;

-- Add canonical deal columns without populating aliases or tightening legacy nulls.
alter table public.deals
  add column if not exists owner_name text,
  add column if not exists seller_name text,
  add column if not exists email text,
  add column if not exists seller_email text,
  add column if not exists status text,
  add column if not exists market text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists zip text,
  add column if not exists asset_type text,
  add column if not exists property_type text,
  add column if not exists lead_score numeric,
  add column if not exists motivation numeric,
  add column if not exists asking_price numeric,
  add column if not exists mortgage_balance numeric,
  add column if not exists mortgage_status text,
  add column if not exists seller_timeline text,
  add column if not exists occupancy_status text,
  add column if not exists property_condition text,
  add column if not exists bedrooms numeric,
  add column if not exists bathrooms numeric,
  add column if not exists square_footage numeric,
  add column if not exists square_feet numeric,
  add column if not exists year_built integer,
  add column if not exists lot_size numeric,
  add column if not exists comps jsonb,
  add column if not exists buyer_matches jsonb,
  add column if not exists parcel_id text,
  add column if not exists parcel_number text,
  add column if not exists acreage numeric,
  add column if not exists land_square_feet numeric,
  add column if not exists legal_access text,
  add column if not exists road_frontage numeric,
  add column if not exists zoning text,
  add column if not exists permitted_use text,
  add column if not exists utilities text,
  add column if not exists water_access text,
  add column if not exists sewer_access text,
  add column if not exists septic_feasibility text,
  add column if not exists flood_zone text,
  add column if not exists wetlands text,
  add column if not exists topography text,
  add column if not exists deed_restrictions text,
  add column if not exists subdivision_potential text,
  add column if not exists taxes_and_liens text,
  add column if not exists land_comps jsonb,
  add column if not exists comparable_land_value numeric,
  add column if not exists builder_demand text,
  add column if not exists land_buyer_demand text,
  add column if not exists county text,
  add column if not exists legal_description text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists next_action_due_date date,
  add column if not exists follow_up_date date,
  add column if not exists closed_at timestamptz,
  add column if not exists offer_ready boolean,
  add column if not exists exit_strategy text,
  add column if not exists title_company text,
  add column if not exists target_closing_date date,
  add column if not exists earnest_money_deposit numeric,
  add column if not exists contingencies text,
  add column if not exists buyer_assignee text,
  add column if not exists auto_score numeric,
  add column if not exists import_id text,
  add column if not exists imported_at timestamptz,
  add column if not exists data_confidence text,
  add column if not exists confidence_label text,
  add column if not exists data_reliability_grade text,
  add column if not exists updated_at timestamptz default now(),
  add column if not exists organization_id uuid;

comment on column public.deals.bedrooms is 'Canonical compatibility field; legacy beds is retained. Population requires a separately reviewed backfill.';
comment on column public.deals.bathrooms is 'Canonical compatibility field; legacy baths is retained. Population requires a separately reviewed backfill.';
comment on column public.deals.property_condition is 'Canonical compatibility field; legacy condition is retained. Population requires a separately reviewed backfill.';

alter table public.message_logs
  add column if not exists organization_id uuid,
  add column if not exists provider text,
  add column if not exists provider_message_id text,
  add column if not exists provider_status text,
  add column if not exists provider_status_updated_at timestamptz,
  add column if not exists error_code text,
  add column if not exists consent_event text,
  add column if not exists updated_at timestamptz default now();

alter table public.buyers add column if not exists updated_at timestamptz default now(), add column if not exists organization_id uuid;
alter table public.documents add column if not exists updated_at timestamptz default now(), add column if not exists organization_id uuid;
alter table public.comps add column if not exists updated_at timestamptz default now(), add column if not exists organization_id uuid;
alter table public.sequences add column if not exists updated_at timestamptz default now(), add column if not exists organization_id uuid;

create table if not exists public.seller_tasks (
  id uuid primary key default gen_random_uuid(), deal_id uuid, phone text not null,
  title text not null, status text default 'open', due_at timestamptz,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  organization_id uuid
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(), name text not null, slug text,
  status text not null default 'active', created_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint organizations_name_not_blank check (btrim(name) <> ''),
  constraint organizations_slug_format check (slug is null or slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint organizations_status_check check (status in ('active','suspended','archived'))
);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null,
  user_id uuid not null, role text not null, status text not null default 'active',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint organization_memberships_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete restrict,
  constraint organization_memberships_role_check check (role in ('owner','admin','analyst','viewer')),
  constraint organization_memberships_status_check check (status in ('active','suspended','revoked')),
  constraint organization_memberships_org_user_key unique (organization_id,user_id)
);

create table if not exists public.communication_consents (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null,
  normalized_phone text not null, channel text not null default 'sms',
  status text not null default 'unknown', source text not null, provider text,
  last_event_at timestamptz not null default now(), created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint communication_consents_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete restrict,
  constraint communication_consents_phone_not_blank check (btrim(normalized_phone) <> ''),
  constraint communication_consents_channel_check check (channel = 'sms'),
  constraint communication_consents_status_check check (status in ('opted-in','opted-out','unknown')),
  constraint communication_consents_provider_check check (provider is null or provider = 'twilio'),
  constraint communication_consents_org_phone_channel_key unique (organization_id,normalized_phone,channel)
);

-- Add only validated-safe foreign keys. Tenant ownership remains nullable.
do $$
declare
  item record;
begin
  for item in select * from (values
    ('message_logs_deal_id_fkey','message_logs','deal_id','deals','id'),
    ('seller_tasks_deal_id_fkey','seller_tasks','deal_id','deals','id'),
    ('deals_organization_id_fkey','deals','organization_id','organizations','id'),
    ('message_logs_organization_id_fkey','message_logs','organization_id','organizations','id'),
    ('seller_tasks_organization_id_fkey','seller_tasks','organization_id','organizations','id'),
    ('buyers_organization_id_fkey','buyers','organization_id','organizations','id'),
    ('documents_organization_id_fkey','documents','organization_id','organizations','id'),
    ('comps_organization_id_fkey','comps','organization_id','organizations','id'),
    ('sequences_organization_id_fkey','sequences','organization_id','organizations','id')
  ) v(constraint_name,table_name,column_name,parent_table,parent_column)
  loop
    if not exists (select 1 from pg_constraint where conname = item.constraint_name and connamespace = 'public'::regnamespace) then
      execute format('alter table public.%I add constraint %I foreign key (%I) references public.%I(%I) on delete restrict not valid',
        item.table_name,item.constraint_name,item.column_name,item.parent_table,item.parent_column);
    end if;
  end loop;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='message_logs_provider_check' and connamespace='public'::regnamespace) then
    alter table public.message_logs add constraint message_logs_provider_check check (provider is null or provider='twilio') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='message_logs_consent_event_check' and connamespace='public'::regnamespace) then
    alter table public.message_logs add constraint message_logs_consent_event_check check (consent_event is null or consent_event in ('opted-in','opted-out','help')) not valid;
  end if;
end $$;

create index if not exists deals_property_address_idx on public.deals(property_address);
create index if not exists deals_phone_idx on public.deals(phone);
create index if not exists message_logs_created_at_idx on public.message_logs(created_at desc);
create index if not exists message_logs_phone_created_at_idx on public.message_logs(phone,created_at desc);
create index if not exists message_logs_deal_created_at_idx on public.message_logs(deal_id,created_at desc);
create index if not exists buyers_created_at_idx on public.buyers(created_at desc);
create index if not exists documents_deal_created_at_idx on public.documents(deal_id,created_at desc);
create index if not exists comps_deal_created_at_idx on public.comps(deal_id,created_at desc);
create index if not exists sequences_deal_step_day_idx on public.sequences(deal_id,step_day);
create index if not exists seller_tasks_phone_status_created_at_idx on public.seller_tasks(phone,status,created_at desc);
create index if not exists seller_tasks_deal_id_idx on public.seller_tasks(deal_id);
create unique index if not exists organizations_slug_unique_idx on public.organizations(lower(slug)) where slug is not null;
create index if not exists organization_memberships_user_status_org_idx on public.organization_memberships(user_id,status,organization_id);
create index if not exists organization_memberships_org_status_role_idx on public.organization_memberships(organization_id,status,role);
create index if not exists deals_organization_created_at_idx on public.deals(organization_id,created_at desc);
create index if not exists message_logs_organization_created_at_idx on public.message_logs(organization_id,created_at desc);
create index if not exists seller_tasks_organization_created_at_idx on public.seller_tasks(organization_id,created_at desc);
create index if not exists buyers_organization_created_at_idx on public.buyers(organization_id,created_at desc);
create index if not exists documents_organization_created_at_idx on public.documents(organization_id,created_at desc);
create index if not exists comps_organization_created_at_idx on public.comps(organization_id,created_at desc);
create index if not exists sequences_organization_created_at_idx on public.sequences(organization_id,created_at desc);
create unique index if not exists message_logs_provider_message_id_uidx on public.message_logs(provider,provider_message_id) where provider is not null and provider_message_id is not null;
create index if not exists message_logs_org_provider_status_idx on public.message_logs(organization_id,provider,provider_status_updated_at desc);
create index if not exists communication_consents_org_status_idx on public.communication_consents(organization_id,channel,status);
create unique index if not exists deals_id_organization_id_uidx on public.deals(id,organization_id);

do $$
declare
  item record;
begin
  for item in select * from (values
    ('message_logs_deal_organization_fkey','message_logs'),
    ('seller_tasks_deal_organization_fkey','seller_tasks'),
    ('documents_deal_organization_fkey','documents'),
    ('comps_deal_organization_fkey','comps'),
    ('sequences_deal_organization_fkey','sequences')
  ) v(constraint_name,table_name)
  loop
    if not exists(select 1 from pg_constraint where conname=item.constraint_name and connamespace='public'::regnamespace) then
      execute format('alter table public.%I add constraint %I foreign key (deal_id,organization_id) references public.deals(id,organization_id) on delete restrict not valid',item.table_name,item.constraint_name);
    end if;
  end loop;
end $$;

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select auth.uid() is not null and exists (
    select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id
    where m.organization_id=target_organization_id and m.user_id=auth.uid()
      and m.status='active' and o.status='active');
$$;

create or replace function public.has_organization_role(target_organization_id uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select auth.uid() is not null and exists (
    select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id
    where m.organization_id=target_organization_id and m.user_id=auth.uid()
      and m.status='active' and m.role=any(allowed_roles) and o.status='active');
$$;

create or replace function public.create_personal_organization(organization_name text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  current_user_id uuid := auth.uid();
  new_organization_id uuid;
begin
  if current_user_id is null then raise exception 'Authentication is required to create an organization.'; end if;
  if nullif(btrim(organization_name),'') is null then raise exception 'Organization name is required.'; end if;
  perform pg_advisory_xact_lock(hashtext(current_user_id::text));
  if exists(select 1 from public.organization_memberships where user_id=current_user_id and status='active') then
    raise exception 'An active organization membership already exists.';
  end if;
  insert into public.organizations(name,created_by) values(btrim(organization_name),current_user_id) returning id into new_organization_id;
  insert into public.organization_memberships(organization_id,user_id,role,status) values(new_organization_id,current_user_id,'owner','active');
  return new_organization_id;
end $$;

create or replace function public.prevent_organization_transfer()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  if old.organization_id is distinct from new.organization_id then
    raise exception 'organization_id is immutable';
  end if;
  return new;
end $$;

create or replace function public.tenant_table_ownership_report()
returns table(subject text,row_count bigint,null_organization_count bigint)
language sql stable security definer set search_path=pg_catalog,public as $$
  select 'deals',count(*),count(*) filter(where organization_id is null) from public.deals
  union all select 'message_logs',count(*),count(*) filter(where organization_id is null) from public.message_logs
  union all select 'seller_tasks',count(*),count(*) filter(where organization_id is null) from public.seller_tasks
  union all select 'buyers',count(*),count(*) filter(where organization_id is null) from public.buyers
  union all select 'documents',count(*),count(*) filter(where organization_id is null) from public.documents
  union all select 'comps',count(*),count(*) filter(where organization_id is null) from public.comps
  union all select 'sequences',count(*),count(*) filter(where organization_id is null) from public.sequences;
$$;

create or replace function public.tenant_rls_readiness_report()
returns table(check_name text,subject text,violation_count bigint)
language sql stable security definer set search_path=pg_catalog,public as $$
  select 'null_organization_id','deals',count(*) from public.deals where organization_id is null
  union all select 'null_organization_id','message_logs',count(*) from public.message_logs where organization_id is null
  union all select 'null_organization_id','seller_tasks',count(*) from public.seller_tasks where organization_id is null
  union all select 'null_organization_id','buyers',count(*) from public.buyers where organization_id is null
  union all select 'null_organization_id','documents',count(*) from public.documents where organization_id is null
  union all select 'null_organization_id','comps',count(*) from public.comps where organization_id is null
  union all select 'null_organization_id','sequences',count(*) from public.sequences where organization_id is null
  union all select 'orphan_organization_id','deals',count(*) from public.deals t left join public.organizations o on o.id=t.organization_id where t.organization_id is not null and o.id is null
  union all select 'orphan_organization_id','message_logs',count(*) from public.message_logs t left join public.organizations o on o.id=t.organization_id where t.organization_id is not null and o.id is null
  union all select 'orphan_organization_id','seller_tasks',count(*) from public.seller_tasks t left join public.organizations o on o.id=t.organization_id where t.organization_id is not null and o.id is null
  union all select 'orphan_organization_id','buyers',count(*) from public.buyers t left join public.organizations o on o.id=t.organization_id where t.organization_id is not null and o.id is null
  union all select 'orphan_organization_id','documents',count(*) from public.documents t left join public.organizations o on o.id=t.organization_id where t.organization_id is not null and o.id is null
  union all select 'orphan_organization_id','comps',count(*) from public.comps t left join public.organizations o on o.id=t.organization_id where t.organization_id is not null and o.id is null
  union all select 'orphan_organization_id','sequences',count(*) from public.sequences t left join public.organizations o on o.id=t.organization_id where t.organization_id is not null and o.id is null
  union all select 'cross_tenant_deal','message_logs',count(*) from public.message_logs c join public.deals p on p.id=c.deal_id where c.organization_id is not null and p.organization_id is distinct from c.organization_id
  union all select 'cross_tenant_deal','seller_tasks',count(*) from public.seller_tasks c join public.deals p on p.id=c.deal_id where c.organization_id is not null and p.organization_id is distinct from c.organization_id
  union all select 'cross_tenant_deal','documents',count(*) from public.documents c join public.deals p on p.id=c.deal_id where c.organization_id is not null and p.organization_id is distinct from c.organization_id
  union all select 'cross_tenant_deal','comps',count(*) from public.comps c join public.deals p on p.id=c.deal_id where c.organization_id is not null and p.organization_id is distinct from c.organization_id
  union all select 'cross_tenant_deal','sequences',count(*) from public.sequences c join public.deals p on p.id=c.deal_id where c.organization_id is not null and p.organization_id is distinct from c.organization_id
  union all select 'active_organization_without_owner','organizations',count(*)
    from public.organizations o where o.status='active' and not exists(
      select 1 from public.organization_memberships m where m.organization_id=o.id and m.role='owner' and m.status='active');
$$;

create or replace function public.tenant_rls_is_ready()
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select not exists(select 1 from public.tenant_rls_readiness_report() where violation_count > 0);
$$;

create or replace function public.assert_tenant_rls_ready()
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if not public.tenant_rls_is_ready() then
    raise exception 'Tenant RLS readiness failed. Review tenant_rls_readiness_report().';
  end if;
end $$;

revoke all on function public.is_organization_member(uuid) from public;
revoke all on function public.has_organization_role(uuid,text[]) from public;
revoke all on function public.create_personal_organization(text) from public;
revoke all on function public.tenant_table_ownership_report() from public;
revoke all on function public.tenant_rls_readiness_report() from public;
revoke all on function public.tenant_rls_is_ready() from public;
revoke all on function public.assert_tenant_rls_ready() from public;
grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.has_organization_role(uuid,text[]) to authenticated;
grant execute on function public.create_personal_organization(text) to authenticated;
grant execute on function public.tenant_table_ownership_report() to service_role;
grant execute on function public.tenant_rls_readiness_report() to service_role;
grant execute on function public.tenant_rls_is_ready() to service_role;
grant execute on function public.assert_tenant_rls_ready() to service_role;

do $$
declare table_name text;
begin
  foreach table_name in array array['deals','message_logs','seller_tasks','buyers','documents','comps','sequences','communication_consents'] loop
    if not exists(select 1 from pg_trigger where tgrelid=format('public.%I',table_name)::regclass and tgname=table_name || '_prevent_organization_transfer' and not tgisinternal) then
      execute format('create trigger %I before update of organization_id on public.%I for each row execute function public.prevent_organization_transfer()',table_name || '_prevent_organization_transfer',table_name);
    end if;
  end loop;
end $$;

do $$ begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='organizations' and policyname='organizations_select_member') then
    create policy organizations_select_member on public.organizations for select to authenticated using(public.is_organization_member(id));
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='organization_memberships' and policyname='organization_memberships_select_member') then
    create policy organization_memberships_select_member on public.organization_memberships for select to authenticated using(public.is_organization_member(organization_id));
  end if;
end $$;

-- Define tenant policies but keep current RLS flags and legacy policies unchanged.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['deals','message_logs','seller_tasks','buyers','documents','comps','sequences','communication_consents']
  loop
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=table_name and policyname=table_name || '_select_member') then
      execute format('create policy %I on public.%I for select to authenticated using (public.is_organization_member(organization_id))', table_name || '_select_member',table_name);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=table_name and policyname=table_name || '_insert_writer') then
      execute format('create policy %I on public.%I for insert to authenticated with check (public.has_organization_role(organization_id,array[''owner'',''admin'',''analyst'']))', table_name || '_insert_writer',table_name);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=table_name and policyname=table_name || '_update_writer') then
      execute format('create policy %I on public.%I for update to authenticated using (public.has_organization_role(organization_id,array[''owner'',''admin'',''analyst''])) with check (public.has_organization_role(organization_id,array[''owner'',''admin'',''analyst'']))', table_name || '_update_writer',table_name);
    end if;
  end loop;
end $$;

-- Intentionally absent: migration-ledger writes, alias/tenant backfill, policy
-- removal, RLS enable/disable, organization creation, and ownership assignment.
rollback;
