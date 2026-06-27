import type { EntityId } from "./common";

export type SellerTaskStatus = "open" | "completed" | "cancelled" | string;

export type SellerTask = {
  id?: EntityId;
  deal_id?: EntityId | null;
  phone: string;
  title: string;
  status?: SellerTaskStatus;
  due_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CreateSellerTaskInput = {
  deal_id?: EntityId | null;
  phone: string;
  title: string;
  due_at?: string | null;
};
