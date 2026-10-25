do $$
declare
  org_a uuid := '10000000-0000-0000-0000-00000000000a';
  org_b uuid := '10000000-0000-0000-0000-00000000000b';
  active_deal uuid := 'e2500000-0000-0000-0000-000000000001';
  research_deal uuid := 'e2500000-0000-0000-0000-000000000002';
  other_tenant_deal uuid := 'e2500000-0000-0000-0000-000000000003';
  active_sequence uuid;
begin
  insert into public.deals (
    id, organization_id, property_address, operating_scope
  ) values
    (active_deal, org_a, 'Synthetic active communication fixture', 'active_acquisition'),
    (research_deal, org_a, 'Synthetic research-only communication fixture', 'research_only'),
    (other_tenant_deal, org_b, 'Synthetic other-tenant fixture', 'active_acquisition');

  insert into public.sequences (
    organization_id, deal_id, step_day, action_type, due_date
  ) values (
    org_a, active_deal, 0, 'Text', current_date
  ) returning id into active_sequence;

  begin
    insert into public.sequences (
      organization_id, deal_id, step_day, action_type, due_date
    ) values (
      org_a, research_deal, 0, 'Text', current_date
    );
    raise exception 'Research-only sequence insert unexpectedly succeeded';
  exception
    when insufficient_privilege then
      if sqlerrm not like '%disabled for this deal operating scope%' then
        raise;
      end if;
  end;

  begin
    update public.sequences
      set deal_id = research_deal
    where id = active_sequence;
    raise exception 'Research-only sequence update unexpectedly succeeded';
  exception
    when insufficient_privilege then
      if sqlerrm not like '%disabled for this deal operating scope%' then
        raise;
      end if;
  end;

  begin
    update public.deals
      set operating_scope = 'research_only'
    where id = active_deal;
    raise exception 'Scope transition with an actionable sequence unexpectedly succeeded';
  exception
    when insufficient_privilege then
      if sqlerrm not like '%Complete actionable outreach sequences%' then
        raise;
      end if;
  end;

  update public.sequences
    set status = 'Completed'
  where id = active_sequence;

  update public.deals
    set operating_scope = 'research_only'
  where id = active_deal;

  begin
    update public.sequences
      set status = 'Pending'
    where id = active_sequence;
    raise exception 'Research-only sequence reactivation unexpectedly succeeded';
  exception
    when insufficient_privilege then
      if sqlerrm not like '%disabled for this deal operating scope%' then
        raise;
      end if;
  end;

  begin
    insert into public.sequences (
      organization_id, deal_id, step_day, action_type, due_date
    ) values (
      org_a, other_tenant_deal, 0, 'Text', current_date
    );
    raise exception 'Cross-tenant sequence insert unexpectedly succeeded';
  exception
    when foreign_key_violation then null;
  end;

  if not exists (
    select 1 from public.sequences
    where id = active_sequence
      and organization_id = org_a
      and deal_id = active_deal
      and status = 'Completed'
  ) then
    raise exception 'Completed sequence history was not preserved';
  end if;

  delete from public.sequences where id = active_sequence;
  delete from public.deals where id in (active_deal, research_deal, other_tenant_deal);
end;
$$;
