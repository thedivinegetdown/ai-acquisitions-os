-- Research-only deals may retain communication history, but cannot create or
-- modify actionable seller outreach sequences. The parent deal is always
-- reloaded inside PostgreSQL so stale clients cannot supply a false scope.

begin;

do $$
begin
  if exists (
    select 1
    from public.sequences sequence_step
    join public.deals deal
      on deal.id = sequence_step.deal_id
     and deal.organization_id = sequence_step.organization_id
    where deal.operating_scope <> 'active_acquisition'
      and lower(coalesce(sequence_step.status, '')) <> 'completed'
  ) then
    raise exception
      'Research-only deals have actionable outreach sequences; resolve them before applying the communication guard.';
  end if;
end;
$$;

create or replace function public.enforce_active_acquisition_sequence_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  parent_scope text;
begin
  select deal.operating_scope
    into parent_scope
  from public.deals deal
  where deal.id = new.deal_id
    and deal.organization_id = new.organization_id
  for update;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Sequence deal does not exist in the selected organization.';
  end if;

  if parent_scope is distinct from 'active_acquisition' then
    raise exception using
      errcode = '42501',
      message = 'Outreach sequences are disabled for this deal operating scope.';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_research_only_scope_transition()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.operating_scope is distinct from 'active_acquisition'
     and new.operating_scope is distinct from old.operating_scope
     and exists (
       select 1
       from public.sequences sequence_step
       where sequence_step.deal_id = new.id
         and sequence_step.organization_id = new.organization_id
         and lower(coalesce(sequence_step.status, '')) <> 'completed'
     ) then
    raise exception using
      errcode = '42501',
      message = 'Complete actionable outreach sequences before restricting this deal to research only.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_active_acquisition_sequence_mutation()
  from public, anon, authenticated;
revoke all on function public.enforce_research_only_scope_transition()
  from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_trigger
    where tgrelid = 'public.sequences'::regclass
      and tgname = 'sequences_active_acquisition_guard'
      and not tgisinternal
  ) then
    create trigger sequences_active_acquisition_guard
      before insert or update on public.sequences
      for each row
      execute function public.enforce_active_acquisition_sequence_mutation();
  end if;
  if not exists (
    select 1
    from pg_catalog.pg_trigger
    where tgrelid = 'public.deals'::regclass
      and tgname = 'deals_research_only_sequence_guard'
      and not tgisinternal
  ) then
    create trigger deals_research_only_sequence_guard
      before update of operating_scope on public.deals
      for each row
      execute function public.enforce_research_only_scope_transition();
  end if;
end;
$$;

comment on function public.enforce_active_acquisition_sequence_mutation() is
  'Rejects sequence writes unless the tenant-owned parent deal is an active acquisition.';
comment on function public.enforce_research_only_scope_transition() is
  'Prevents a scope transition from leaving actionable outreach sequences on a research-only deal.';

commit;
