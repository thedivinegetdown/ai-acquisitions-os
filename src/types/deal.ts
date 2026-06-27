import type { EntityId } from "./common";

export type DealStage =
  | "New Lead"
  | "Contacted"
  | "Offer Sent"
  | "Under Contract"
  | "Closed"
  | "Dead Lead"
  | string;

export type Deal = {
  id?: EntityId;
  deal_id?: EntityId;
  lead_id?: EntityId;
  property_id?: EntityId;
  property_address?: string | null;
  address?: string | null;
  owner_name?: string | null;
  seller_name?: string | null;
  phone?: string | null;
  stage?: DealStage | null;
  source?: string | null;
  lead_score?: number | string | null;
  motivation_score?: number | string | null;
  motivation?: number | string | null;
  price?: number | string | null;
  asking_price?: number | string | null;
  askingPrice?: number | string | null;
  arv?: number | string | null;
  after_repair_value?: number | string | null;
  afterRepairValue?: number | string | null;
  repairs?: number | string | null;
  estimated_repairs?: number | string | null;
  repairs_needed?: number | string | null;
  repair_estimate?: number | string | null;
  mortgage_balance?: number | string | null;
  mortgage?: number | string | null;
  loan_balance?: number | string | null;
  seller_timeline?: string | null;
  timeline?: string | null;
  timeline_to_sell?: string | null;
  occupancy_status?: string | null;
  occupancy?: string | null;
  property_condition?: string | null;
  condition?: string | null;
  rent?: number | string | null;
  rent_estimate?: number | string | null;
  monthly_rent?: number | string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

export type DealSummary = {
  id: EntityId | null;
  address: string;
  ownerName: string;
  phone: string;
  stage: DealStage;
};
