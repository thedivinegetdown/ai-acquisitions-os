-- EO-COMM-01 additive communications security schema.
-- This migration defines tenant policies but does not enable row-level security.

alter table public.message_logs
  add column if not exists provider text,
  add column if not exists provider_message_id text,
  add column if not exists provider_status text,
  add column if not exists provider_status_updated_at timestamptz,
  add column if not exists error_code text,
  add column if not exists consent_event text,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  alter table public.message_logs
    add constraint message_logs_provider_check
    check (provider is null or provider in ('twilio'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.message_logs
    add constraint message_logs_consent_event_check
    check (consent_event is null or consent_event in ('opted-in', 'opted-out', 'help'));
exception
  when duplicate_object then null;
end $$;

create unique index if not exists message_logs_provider_message_id_uidx
  on public.message_logs (provider, provider_message_id)
  where provider is not null and provider_message_id is not null;

create index if not exists message_logs_org_provider_status_idx
  on public.message_logs (organization_id, provider, provider_status_updated_at desc);

create table if not exists public.communication_consents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  normalized_phone text not null,
  channel text not null default 'sms',
  status text not null default 'unknown',
  source text not null,
  provider text,
  last_event_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint communication_consents_organization_id_fkey
    foreign key (organization_id)
    references public.organizations (id)
    on delete restrict,
  constraint communication_consents_phone_not_blank
    check (btrim(normalized_phone) <> ''),
  constraint communication_consents_channel_check
    check (channel in ('sms')),
  constraint communication_consents_status_check
    check (status in ('opted-in', 'opted-out', 'unknown')),
  constraint communication_consents_provider_check
    check (provider is null or provider in ('twilio')),
  constraint communication_consents_org_phone_channel_key
    unique (organization_id, normalized_phone, channel)
);

create index if not exists communication_consents_org_status_idx
  on public.communication_consents (organization_id, channel, status);

create policy communication_consents_select_member
  on public.communication_consents
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy communication_consents_insert_writer
  on public.communication_consents
  for insert
  to authenticated
  with check (
    public.has_organization_role(organization_id, array['owner', 'admin', 'analyst'])
  );

create policy communication_consents_update_writer
  on public.communication_consents
  for update
  to authenticated
  using (
    public.has_organization_role(organization_id, array['owner', 'admin', 'analyst'])
  )
  with check (
    public.has_organization_role(organization_id, array['owner', 'admin', 'analyst'])
  );

create trigger communication_consents_prevent_organization_transfer
  before update of organization_id on public.communication_consents
  for each row execute function public.prevent_organization_transfer();
