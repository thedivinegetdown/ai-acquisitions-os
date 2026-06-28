alter table public.message_logs
  add column if not exists direction text;

alter table public.message_logs
  alter column direction set default 'inbound';

update public.message_logs
set direction = case
  when lower(coalesce(status, '')) in (
    'accepted',
    'delivered',
    'failed',
    'queued',
    'sending',
    'sent',
    'test',
    'undelivered'
  ) then 'outbound'
  else 'inbound'
end
where direction is null;

do $$
begin
  alter table public.message_logs
    add constraint message_logs_direction_check
    check (direction in ('inbound', 'outbound'));
exception
  when duplicate_object then null;
end $$;
