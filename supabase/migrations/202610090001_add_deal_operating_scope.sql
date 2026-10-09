-- Preserve existing acquisition behavior; scope does not modify factual deal state.
alter table public.deals
  add column operating_scope text not null default 'active_acquisition'
  constraint deals_operating_scope_check
  check (operating_scope in ('active_acquisition', 'research_only'));

comment on column public.deals.operating_scope is
  'Owner operating intent. Research only permits research/evidence review, not outreach, paid diligence, or transaction recommendations.';
