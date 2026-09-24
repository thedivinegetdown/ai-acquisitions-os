-- Build 2: persist the existing RDI-03 EvidenceReference and RDI-02
-- ConflictResolutionReference contracts with their authoritative deal facts.
-- Existing deal tenant policies and ownership protections apply unchanged.
alter table public.deals
  add column research_evidence jsonb not null default '[]'::jsonb,
  add column research_resolutions jsonb not null default '[]'::jsonb,
  add column research_revision integer not null default 0;

alter table public.deals
  add constraint deals_research_evidence_array check (jsonb_typeof(research_evidence) = 'array'),
  add constraint deals_research_resolutions_array check (jsonb_typeof(research_resolutions) = 'array'),
  add constraint deals_research_revision_nonnegative check (research_revision >= 0);
