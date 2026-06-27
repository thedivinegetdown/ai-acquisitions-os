create table if not exists public.seller_tasks (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid nullable,
  phone text not null,
  title text not null,
  status text default 'open',
  due_at timestamptz nullable,
  created_at timestamptz default now()
);

create index if not exists seller_tasks_phone_idx
  on public.seller_tasks (phone);

create index if not exists seller_tasks_status_idx
  on public.seller_tasks (status);
