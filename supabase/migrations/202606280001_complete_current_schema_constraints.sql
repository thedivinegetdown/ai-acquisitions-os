-- Complete relationships and query indexes for the seller_tasks table created
-- by the earlier focused migration. Existing rows are preserved.

alter table public.seller_tasks
  add column if not exists updated_at timestamptz default now();

create index if not exists seller_tasks_deal_id_idx
  on public.seller_tasks (deal_id);

create index if not exists seller_tasks_phone_status_created_at_idx
  on public.seller_tasks (phone, status, created_at desc);

create index if not exists seller_tasks_due_at_idx
  on public.seller_tasks (due_at);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'seller_tasks_deal_id_fkey'
      and conrelid = 'public.seller_tasks'::regclass
  ) then
    alter table public.seller_tasks
      add constraint seller_tasks_deal_id_fkey
      foreign key (deal_id)
      references public.deals (id)
      on delete set null
      not valid;
  end if;
end $$;
