import type { EntityId } from "./common";

export type SubscriptionStatus =
  | "Trial"
  | "Active"
  | "Past due"
  | "Canceled"
  | "Incomplete"
  | "Not configured"
  | string;

export type UsageMetric =
  | "leads"
  | "smsMessages"
  | "aiRequests"
  | "teamMembers"
  | "activeMarkets"
  | "storageDocuments";

export type UsageLimit = number | null;

export type BillingPlan = {
  id: string;
  name: string;
  monthlyPrice: number | null;
  description: string;
  limits: Record<UsageMetric, UsageLimit>;
};

export type InvoiceSummary = {
  id?: EntityId;
  amountDue?: number;
  amountPaid?: number;
  status?: string;
  dueDate?: string;
  hostedInvoiceUrl?: string;
};

export type BillingContext = {
  currentPlan: BillingPlan;
  subscriptionStatus: SubscriptionStatus;
  usageSummary: Array<{
    key: UsageMetric;
    label: string;
    used: number;
    limit: UsageLimit;
    percentUsed: number | null;
    warning: boolean;
    overLimit: boolean;
  }>;
  planLimits: Record<UsageMetric, UsageLimit>;
  upgradeRecommendation: string;
  missingBillingSetup: string[];
  futureStripeStatus: string;
  risks: string[];
  summary: string;
  generatedAt: string;
};
