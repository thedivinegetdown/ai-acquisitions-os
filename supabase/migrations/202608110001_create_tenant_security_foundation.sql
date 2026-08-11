-- EO-SEC-01 tenant security foundation.
-- This migration is additive and does not enable row-level security.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text,
  status text not null default 'active',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_not_blank check (btrim(name) <> ''),
  constraint organizations_slug_format check (
    slug is null or slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint organizations_status_check check (
    status in ('active', 'suspended', 'archived')
  )
);

create unique index if not exists organizations_slug_unique_idx
  on public.organizations (lower(slug))
  where slug is not null;

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  role text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_memberships_organization_id_fkey
    foreign key (organization_id)
    references public.organizations (id)
    on delete restrict,
  constraint organization_memberships_role_check check (
    role in ('owner', 'admin', 'analyst', 'viewer')
  ),
  constraint organization_memberships_status_check check (
    status in ('active', 'suspended', 'revoked')
  ),
  constraint organization_memberships_org_user_key
    unique (organization_id, user_id)
);

comment on column public.organizations.created_by is
  'Supabase auth user ID that created the organization; intentionally not a direct auth.users foreign key.';

comment on column public.organization_memberships.user_id is
  'Supabase auth user ID compared to auth.uid() by authorization policies.';

create index if not exists organization_memberships_user_status_org_idx
  on public.organization_memberships (user_id, status, organization_id);

create index if not exists organization_memberships_org_status_role_idx
  on public.organization_memberships (organization_id, status, role);

alter table public.deals add column if not exists organization_id uuid;
alter table public.message_logs add column if not exists organization_id uuid;
alter table public.seller_tasks add column if not exists organization_id uuid;
alter table public.buyers add column if not exists organization_id uuid;
alter table public.documents add column if not exists organization_id uuid;
alter table public.comps add column if not exists organization_id uuid;
alter table public.sequences add column if not exists organization_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'deals_organization_id_fkey') then
    alter table public.deals
      add constraint deals_organization_id_fkey
      foreign key (organization_id) references public.organizations (id)
      on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'message_logs_organization_id_fkey') then
    alter table public.message_logs
      add constraint message_logs_organization_id_fkey
      foreign key (organization_id) references public.organizations (id)
      on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'seller_tasks_organization_id_fkey') then
    alter table public.seller_tasks
      add constraint seller_tasks_organization_id_fkey
      foreign key (organization_id) references public.organizations (id)
      on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'buyers_organization_id_fkey') then
    alter table public.buyers
      add constraint buyers_organization_id_fkey
      foreign key (organization_id) references public.organizations (id)
      on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'documents_organization_id_fkey') then
    alter table public.documents
      add constraint documents_organization_id_fkey
      foreign key (organization_id) references public.organizations (id)
      on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'comps_organization_id_fkey') then
    alter table public.comps
      add constraint comps_organization_id_fkey
      foreign key (organization_id) references public.organizations (id)
      on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sequences_organization_id_fkey') then
    alter table public.sequences
      add constraint sequences_organization_id_fkey
      foreign key (organization_id) references public.organizations (id)
      on delete restrict not valid;
  end if;
end $$;

create unique index if not exists deals_id_organization_id_uidx
  on public.deals (id, organization_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'deals_id_organization_id_key') then
    alter table public.deals
      add constraint deals_id_organization_id_key
      unique using index deals_id_organization_id_uidx;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'message_logs_deal_organization_fkey') then
    alter table public.message_logs
      add constraint message_logs_deal_organization_fkey
      foreign key (deal_id, organization_id)
      references public.deals (id, organization_id)
      on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'seller_tasks_deal_organization_fkey') then
    alter table public.seller_tasks
      add constraint seller_tasks_deal_organization_fkey
      foreign key (deal_id, organization_id)
      references public.deals (id, organization_id)
      on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'documents_deal_organization_fkey') then
    alter table public.documents
      add constraint documents_deal_organization_fkey
      foreign key (deal_id, organization_id)
      references public.deals (id, organization_id)
      on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'comps_deal_organization_fkey') then
    alter table public.comps
      add constraint comps_deal_organization_fkey
      foreign key (deal_id, organization_id)
      references public.deals (id, organization_id)
      on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sequences_deal_organization_fkey') then
    alter table public.sequences
      add constraint sequences_deal_organization_fkey
      foreign key (deal_id, organization_id)
      references public.deals (id, organization_id)
      on delete restrict not valid;
  end if;
end $$;

create index if not exists deals_organization_created_at_idx
  on public.deals (organization_id, created_at desc);
create index if not exists message_logs_organization_created_at_idx
  on public.message_logs (organization_id, created_at desc);
create index if not exists seller_tasks_organization_created_at_idx
  on public.seller_tasks (organization_id, created_at desc);
create index if not exists buyers_organization_created_at_idx
  on public.buyers (organization_id, created_at desc);
create index if not exists documents_organization_created_at_idx
  on public.documents (organization_id, created_at desc);
create index if not exists comps_organization_created_at_idx
  on public.comps (organization_id, created_at desc);
create index if not exists sequences_organization_created_at_idx
  on public.sequences (organization_id, created_at desc);

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.organization_memberships membership
      join public.organizations organization
        on organization.id = membership.organization_id
      where membership.organization_id = target_organization_id
        and membership.user_id = auth.uid()
        and membership.status = 'active'
        and organization.status = 'active'
    );
$$;

create or replace function public.has_organization_role(
  target_organization_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.organization_memberships membership
      join public.organizations organization
        on organization.id = membership.organization_id
      where membership.organization_id = target_organization_id
        and membership.user_id = auth.uid()
        and membership.status = 'active'
        and membership.role = any (allowed_roles)
        and organization.status = 'active'
    );
$$;

revoke all on function public.is_organization_member(uuid) from public;
revoke all on function public.has_organization_role(uuid, text[]) from public;
grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.has_organization_role(uuid, text[]) to authenticated;

create or replace function public.create_personal_organization(organization_name text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid := auth.uid();
  new_organization_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to create an organization.';
  end if;

  if nullif(btrim(organization_name), '') is null then
    raise exception 'Organization name is required.';
  end if;

  perform pg_advisory_xact_lock(hashtext(current_user_id::text));

  if exists (
    select 1
    from public.organization_memberships membership
    where membership.user_id = current_user_id
      and membership.status = 'active'
  ) then
    raise exception 'An active organization membership already exists.';
  end if;

  insert into public.organizations (name, created_by)
  values (btrim(organization_name), current_user_id)
  returning id into new_organization_id;

  insert into public.organization_memberships (
    organization_id,
    user_id,
    role,
    status
  ) values (
    new_organization_id,
    current_user_id,
    'owner',
    'active'
  );

  return new_organization_id;
end;
$$;

revoke all on function public.create_personal_organization(text) from public;
grant execute on function public.create_personal_organization(text) to authenticated;

create or replace function public.tenant_table_ownership_report()
returns table (
  subject text,
  row_count bigint,
  null_organization_count bigint
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select 'deals', count(*), count(*) filter (where organization_id is null) from public.deals
  union all select 'message_logs', count(*), count(*) filter (where organization_id is null) from public.message_logs
  union all select 'seller_tasks', count(*), count(*) filter (where organization_id is null) from public.seller_tasks
  union all select 'buyers', count(*), count(*) filter (where organization_id is null) from public.buyers
  union all select 'documents', count(*), count(*) filter (where organization_id is null) from public.documents
  union all select 'comps', count(*), count(*) filter (where organization_id is null) from public.comps
  union all select 'sequences', count(*), count(*) filter (where organization_id is null) from public.sequences;
$$;

comment on function public.tenant_table_ownership_report() is
  'Reports total and unowned row counts without assigning legacy ownership.';

revoke all on function public.tenant_table_ownership_report() from public;
grant execute on function public.tenant_table_ownership_report() to service_role;

-- Violation-only report consumed by the fail-closed activation guard. The
-- companion ownership report supplies total and null counts for rollout review.

create or replace function public.tenant_rls_readiness_report()
returns table (
  check_name text,
  subject text,
  violation_count bigint
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select 'null_organization_id', 'deals', count(*) from public.deals where organization_id is null
  union all select 'null_organization_id', 'message_logs', count(*) from public.message_logs where organization_id is null
  union all select 'null_organization_id', 'seller_tasks', count(*) from public.seller_tasks where organization_id is null
  union all select 'null_organization_id', 'buyers', count(*) from public.buyers where organization_id is null
  union all select 'null_organization_id', 'documents', count(*) from public.documents where organization_id is null
  union all select 'null_organization_id', 'comps', count(*) from public.comps where organization_id is null
  union all select 'null_organization_id', 'sequences', count(*) from public.sequences where organization_id is null
  union all select 'orphan_organization_id', 'deals', count(*) from public.deals tenant_row left join public.organizations organization on organization.id = tenant_row.organization_id where tenant_row.organization_id is not null and organization.id is null
  union all select 'orphan_organization_id', 'message_logs', count(*) from public.message_logs tenant_row left join public.organizations organization on organization.id = tenant_row.organization_id where tenant_row.organization_id is not null and organization.id is null
  union all select 'orphan_organization_id', 'seller_tasks', count(*) from public.seller_tasks tenant_row left join public.organizations organization on organization.id = tenant_row.organization_id where tenant_row.organization_id is not null and organization.id is null
  union all select 'orphan_organization_id', 'buyers', count(*) from public.buyers tenant_row left join public.organizations organization on organization.id = tenant_row.organization_id where tenant_row.organization_id is not null and organization.id is null
  union all select 'orphan_organization_id', 'documents', count(*) from public.documents tenant_row left join public.organizations organization on organization.id = tenant_row.organization_id where tenant_row.organization_id is not null and organization.id is null
  union all select 'orphan_organization_id', 'comps', count(*) from public.comps tenant_row left join public.organizations organization on organization.id = tenant_row.organization_id where tenant_row.organization_id is not null and organization.id is null
  union all select 'orphan_organization_id', 'sequences', count(*) from public.sequences tenant_row left join public.organizations organization on organization.id = tenant_row.organization_id where tenant_row.organization_id is not null and organization.id is null
  union all select 'cross_tenant_deal', 'message_logs', count(*) from public.message_logs child join public.deals parent on parent.id = child.deal_id where child.organization_id is not null and parent.organization_id is distinct from child.organization_id
  union all select 'cross_tenant_deal', 'seller_tasks', count(*) from public.seller_tasks child join public.deals parent on parent.id = child.deal_id where child.organization_id is not null and parent.organization_id is distinct from child.organization_id
  union all select 'cross_tenant_deal', 'documents', count(*) from public.documents child join public.deals parent on parent.id = child.deal_id where child.organization_id is not null and parent.organization_id is distinct from child.organization_id
  union all select 'cross_tenant_deal', 'comps', count(*) from public.comps child join public.deals parent on parent.id = child.deal_id where child.organization_id is not null and parent.organization_id is distinct from child.organization_id
  union all select 'cross_tenant_deal', 'sequences', count(*) from public.sequences child join public.deals parent on parent.id = child.deal_id where child.organization_id is not null and parent.organization_id is distinct from child.organization_id
  union all
  select 'active_organization_without_owner', 'organizations', count(*)
  from public.organizations organization
  where organization.status = 'active'
    and not exists (
      select 1
      from public.organization_memberships membership
      where membership.organization_id = organization.id
        and membership.role = 'owner'
        and membership.status = 'active'
    );
$$;

create or replace function public.tenant_rls_is_ready()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select not exists (
    select 1
    from public.tenant_rls_readiness_report()
    where violation_count > 0
  );
$$;

create or replace function public.assert_tenant_rls_ready()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.tenant_rls_is_ready() then
    raise exception 'Tenant RLS readiness failed. Review tenant_rls_readiness_report().';
  end if;
end;
$$;

revoke all on function public.tenant_rls_readiness_report() from public;
revoke all on function public.tenant_rls_is_ready() from public;
revoke all on function public.assert_tenant_rls_ready() from public;
grant execute on function public.tenant_rls_readiness_report() to service_role;
grant execute on function public.tenant_rls_is_ready() to service_role;
grant execute on function public.assert_tenant_rls_ready() to service_role;
