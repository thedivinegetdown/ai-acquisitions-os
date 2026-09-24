-- Exact Build 6 RPC boundary, including effective inherited privileges.
-- Run after synthetic tenant bootstrap; no mutations even if an ACL regresses.
begin read only;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
do $$
declare
  signature text;
  routine pg_proc%rowtype;
  command text;
begin
  foreach signature in array array[
    'public.provision_assisted_pilot(text,text,uuid,text)',
    'public.set_assisted_pilot_status(uuid,text)',
    'public.configure_assisted_pilot_settings(uuid,jsonb)',
    'public.configure_assisted_pilot_provider(uuid,text,boolean,integer,integer)',
    'public.consume_organization_provider_request(uuid,text,integer)',
    'public.persist_assisted_pilot_import(uuid,text,jsonb)',
    'public.export_assisted_pilot_data(uuid)',
    'public.pilot_support_diagnostics(uuid)'
  ] loop
    select * into strict routine from pg_proc where oid = signature::regprocedure;
    if not routine.prosecdef
      or exists (
        select 1 from aclexplode(coalesce(routine.proacl, acldefault('f', routine.proowner)))
        where grantee = 0 and privilege_type = 'EXECUTE'
      )
      or has_function_privilege('anon', routine.oid, 'EXECUTE')
      or has_function_privilege('authenticated', routine.oid, 'EXECUTE')
      or not has_function_privilege('service_role', routine.oid, 'EXECUTE') then
      raise exception 'Build 6 admin ACL violation: %', signature;
    end if;

    select format('select public.%I(%s)', routine.proname,
      string_agg(format('null::%s', argument_type::regtype), ',' order by ordinal))
    into command from unnest(routine.proargtypes::oid[]) with ordinality as args(argument_type, ordinal);
    set local role authenticated;
    -- This is an ordinary real fixture owner, not merely an anonymous JWT context.
    if not exists (select 1 from public.organization_memberships where user_id=auth.uid() and role='owner' and status='active') then
      raise exception 'Build 6 ACL owner fixture missing';
    end if;
    begin
      execute command;
      raise exception 'Build 6 owner unexpectedly invoked %', signature;
    exception when insufficient_privilege then
      -- Require SQLSTATE 42501, not validation failures inside a callable function.
      null;
    end;
    reset role;
  end loop;
end $$;
rollback;
