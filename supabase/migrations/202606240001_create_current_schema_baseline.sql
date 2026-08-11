-- EO-DB-01: reproduce only the persistence model used by the current application.
-- Tenant ownership and row-level security are intentionally deferred.

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  property_address text,
  owner_name text,
  seller_name text,
  phone text,
  email text,
  seller_email text,
  stage text,
  status text,
  source text,
  market text,
  city text,
  state text,
  zip text,
  asset_type text,
  property_type text,
  lead_score numeric,
  motivation numeric,
  motivation_score numeric,
  price numeric,
  asking_price numeric,
  arv numeric,
  repairs numeric,
  rent numeric,
  mortgage_balance numeric,
  mortgage_status text,
  seller_timeline text,
  occupancy_status text,
  property_condition text,
  bedrooms numeric,
  bathrooms numeric,
  square_footage numeric,
  square_feet numeric,
  year_built integer,
  lot_size numeric,
  comps jsonb,
  buyer_matches jsonb,
  parcel_id text,
  parcel_number text,
  acreage numeric,
  land_square_feet numeric,
  legal_access text,
  road_frontage numeric,
  zoning text,
  permitted_use text,
  utilities text,
  water_access text,
  sewer_access text,
  septic_feasibility text,
  flood_zone text,
  wetlands text,
  topography text,
  deed_restrictions text,
  subdivision_potential text,
  taxes_and_liens text,
  land_comps jsonb,
  comparable_land_value numeric,
  builder_demand text,
  land_buyer_demand text,
  county text,
  legal_description text,
  latitude double precision,
  longitude double precision,
  next_action text,
  next_action_due_date date,
  due_date date,
  follow_up_date date,
  notes text,
  assignment_fee numeric,
  closing_date date,
  closed_at timestamptz,
  acquisitions_rep text,
  dispositions_rep text,
  seller_ask numeric,
  latest_offer numeric,
  counter_offer numeric,
  objection text,
  negotiation_status text,
  offer_ready boolean,
  exit_strategy text,
  title_company text,
  target_closing_date date,
  earnest_money_deposit numeric,
  contingencies text,
  buyer_assignee text,
  auto_score numeric,
  import_id text,
  imported_at timestamptz,
  data_confidence text,
  confidence_label text,
  data_reliability_grade text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.message_logs (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals (id) on delete set null,
  phone text not null,
  message text not null,
  status text,
  created_at timestamptz not null default now()
);

create table if not exists public.buyers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  target_areas text,
  max_price numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete restrict,
  doc_type text not null,
  title text not null,
  url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comps (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete restrict,
  address text not null,
  sale_price numeric,
  sqft numeric,
  beds numeric,
  baths numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sequences (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete restrict,
  step_day integer not null,
  action_type text not null,
  due_date date,
  status text not null default 'Pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deals_property_address_idx
  on public.deals (property_address);

create index if not exists deals_phone_idx
  on public.deals (phone);

create index if not exists message_logs_created_at_idx
  on public.message_logs (created_at desc);

create index if not exists message_logs_phone_created_at_idx
  on public.message_logs (phone, created_at desc);

create index if not exists message_logs_deal_created_at_idx
  on public.message_logs (deal_id, created_at desc);

create index if not exists buyers_created_at_idx
  on public.buyers (created_at desc);

create index if not exists documents_deal_created_at_idx
  on public.documents (deal_id, created_at desc);

create index if not exists comps_deal_created_at_idx
  on public.comps (deal_id, created_at desc);

create index if not exists sequences_deal_step_day_idx
  on public.sequences (deal_id, step_day);
