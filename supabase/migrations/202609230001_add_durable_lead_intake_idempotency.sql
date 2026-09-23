-- Durable intake retries use the importer-owned identity within each organization.
-- Existing deals without an importer identity are unaffected.

create unique index if not exists deals_organization_import_id_uidx
  on public.deals (organization_id, import_id)
  where import_id is not null;
