-- Permit the one-time NULL -> organization_id bootstrap while keeping
-- established ownership immutable. This corrects the reconciliation baseline's
-- stricter function body without weakening any existing table trigger.

create or replace function public.prevent_organization_transfer()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.organization_id is not null
    and new.organization_id is distinct from old.organization_id then
    raise exception 'Organization ownership cannot be transferred or cleared.';
  end if;

  return new;
end;
$$;

comment on function public.prevent_organization_transfer() is
  'Allows one initial NULL-to-organization assignment; rejects later transfer or clearing.';
