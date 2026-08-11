-- Define tenant policies without activating RLS.
-- Enforcement is enabled only by supabase/security/activate_rls.sql after
-- explicit ownership backfill and readiness validation.

create policy organizations_select_member
  on public.organizations
  for select
  to authenticated
  using (public.is_organization_member(id));

create policy organizations_update_owner
  on public.organizations
  for update
  to authenticated
  using (public.has_organization_role(id, array['owner']))
  with check (public.has_organization_role(id, array['owner']));

create policy organization_memberships_select_member
  on public.organization_memberships
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy organization_memberships_insert_owner
  on public.organization_memberships
  for insert
  to authenticated
  with check (
    public.has_organization_role(organization_id, array['owner'])
    and role in ('owner', 'admin', 'analyst', 'viewer')
    and status in ('active', 'suspended', 'revoked')
  );

create policy organization_memberships_update_owner
  on public.organization_memberships
  for update
  to authenticated
  using (public.has_organization_role(organization_id, array['owner']))
  with check (public.has_organization_role(organization_id, array['owner']));

create policy deals_select_member
  on public.deals
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy deals_insert_writer
  on public.deals
  for insert
  to authenticated
  with check (
    public.has_organization_role(organization_id, array['owner', 'admin', 'analyst'])
  );

create policy deals_update_writer
  on public.deals
  for update
  to authenticated
  using (
    public.has_organization_role(organization_id, array['owner', 'admin', 'analyst'])
  )
  with check (
    public.has_organization_role(organization_id, array['owner', 'admin', 'analyst'])
  );

create policy message_logs_select_member
  on public.message_logs
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy message_logs_insert_writer
  on public.message_logs
  for insert
  to authenticated
  with check (
    public.has_organization_role(organization_id, array['owner', 'admin', 'analyst'])
  );

create policy message_logs_update_writer
  on public.message_logs
  for update
  to authenticated
  using (
    public.has_organization_role(organization_id, array['owner', 'admin', 'analyst'])
  )
  with check (
    public.has_organization_role(organization_id, array['owner', 'admin', 'analyst'])
  );

create policy seller_tasks_select_member
  on public.seller_tasks
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy seller_tasks_insert_writer
  on public.seller_tasks
  for insert
  to authenticated
  with check (
    public.has_organization_role(organization_id, array['owner', 'admin', 'analyst'])
  );

create policy seller_tasks_update_writer
  on public.seller_tasks
  for update
  to authenticated
  using (
    public.has_organization_role(organization_id, array['owner', 'admin', 'analyst'])
  )
  with check (
    public.has_organization_role(organization_id, array['owner', 'admin', 'analyst'])
  );

create policy buyers_select_member
  on public.buyers
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy buyers_insert_writer
  on public.buyers
  for insert
  to authenticated
  with check (
    public.has_organization_role(organization_id, array['owner', 'admin', 'analyst'])
  );

create policy buyers_update_writer
  on public.buyers
  for update
  to authenticated
  using (
    public.has_organization_role(organization_id, array['owner', 'admin', 'analyst'])
  )
  with check (
    public.has_organization_role(organization_id, array['owner', 'admin', 'analyst'])
  );

create policy documents_select_member
  on public.documents
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy documents_insert_writer
  on public.documents
  for insert
  to authenticated
  with check (
    public.has_organization_role(organization_id, array['owner', 'admin', 'analyst'])
  );

create policy documents_update_writer
  on public.documents
  for update
  to authenticated
  using (
    public.has_organization_role(organization_id, array['owner', 'admin', 'analyst'])
  )
  with check (
    public.has_organization_role(organization_id, array['owner', 'admin', 'analyst'])
  );

create policy comps_select_member
  on public.comps
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy comps_insert_writer
  on public.comps
  for insert
  to authenticated
  with check (
    public.has_organization_role(organization_id, array['owner', 'admin', 'analyst'])
  );

create policy comps_update_writer
  on public.comps
  for update
  to authenticated
  using (
    public.has_organization_role(organization_id, array['owner', 'admin', 'analyst'])
  )
  with check (
    public.has_organization_role(organization_id, array['owner', 'admin', 'analyst'])
  );

create policy sequences_select_member
  on public.sequences
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy sequences_insert_writer
  on public.sequences
  for insert
  to authenticated
  with check (
    public.has_organization_role(organization_id, array['owner', 'admin', 'analyst'])
  );

create policy sequences_update_writer
  on public.sequences
  for update
  to authenticated
  using (
    public.has_organization_role(organization_id, array['owner', 'admin', 'analyst'])
  )
  with check (
    public.has_organization_role(organization_id, array['owner', 'admin', 'analyst'])
  );

-- Intentionally no DELETE policies. Current client repositories do not delete.
-- Intentionally no RLS enablement. Activation is a separately reviewed action.
