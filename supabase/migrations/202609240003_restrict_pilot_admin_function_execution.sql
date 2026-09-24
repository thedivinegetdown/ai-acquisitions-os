-- Build 6 ACL correction. PostgreSQL defaults to PUBLIC EXECUTE, and hosted
-- defaults can also grant named API roles. Revoking PUBLIC alone is insufficient.
-- Keep the applied Build 6 migration intact; change only these eight exact ACLs.
revoke execute on function public.provision_assisted_pilot(text, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.set_assisted_pilot_status(uuid, text) from public, anon, authenticated;
revoke execute on function public.configure_assisted_pilot_settings(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.configure_assisted_pilot_provider(uuid, text, boolean, integer, integer) from public, anon, authenticated;
revoke execute on function public.consume_organization_provider_request(uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.persist_assisted_pilot_import(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.export_assisted_pilot_data(uuid) from public, anon, authenticated;
revoke execute on function public.pilot_support_diagnostics(uuid) from public, anon, authenticated;

grant execute on function public.provision_assisted_pilot(text, text, uuid, text) to service_role;
grant execute on function public.set_assisted_pilot_status(uuid, text) to service_role;
grant execute on function public.configure_assisted_pilot_settings(uuid, jsonb) to service_role;
grant execute on function public.configure_assisted_pilot_provider(uuid, text, boolean, integer, integer) to service_role;
grant execute on function public.consume_organization_provider_request(uuid, text, integer) to service_role;
grant execute on function public.persist_assisted_pilot_import(uuid, text, jsonb) to service_role;
grant execute on function public.export_assisted_pilot_data(uuid) to service_role;
grant execute on function public.pilot_support_diagnostics(uuid) to service_role;
