-- Ownership may be assigned once during an explicit legacy backfill, but a
-- tenant-owned row cannot later be transferred to another organization.

create or replace function public.prevent_organization_transfer()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.organization_id is not null
    and new.organization_id is distinct from old.organization_id then
    raise exception 'Organization ownership cannot be transferred.';
  end if;

  return new;
end;
$$;

create trigger deals_prevent_organization_transfer
  before update of organization_id on public.deals
  for each row execute function public.prevent_organization_transfer();
create trigger message_logs_prevent_organization_transfer
  before update of organization_id on public.message_logs
  for each row execute function public.prevent_organization_transfer();
create trigger seller_tasks_prevent_organization_transfer
  before update of organization_id on public.seller_tasks
  for each row execute function public.prevent_organization_transfer();
create trigger buyers_prevent_organization_transfer
  before update of organization_id on public.buyers
  for each row execute function public.prevent_organization_transfer();
create trigger documents_prevent_organization_transfer
  before update of organization_id on public.documents
  for each row execute function public.prevent_organization_transfer();
create trigger comps_prevent_organization_transfer
  before update of organization_id on public.comps
  for each row execute function public.prevent_organization_transfer();
create trigger sequences_prevent_organization_transfer
  before update of organization_id on public.sequences
  for each row execute function public.prevent_organization_transfer();
create trigger organization_memberships_prevent_organization_transfer
  before update of organization_id on public.organization_memberships
  for each row execute function public.prevent_organization_transfer();
