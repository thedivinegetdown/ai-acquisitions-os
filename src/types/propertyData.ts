import type { ConfidenceLevel, ServiceResult } from "./common";

export type PropertyDataConfidence = ConfidenceLevel | "Unknown";

export type PropertyRecord = {
  id?: string;
  address: string;
  normalizedAddress: string;
  city?: string;
  state?: string;
  zip?: string;
  propertyType?: string;
  beds?: number | null;
  baths?: number | null;
  squareFeet?: number | null;
  yearBuilt?: number | null;
  lotSize?: number | null;
  source?: string;
};

export type OwnerRecord = {
  ownerName?: string;
  mailingAddress?: string;
  ownershipLengthYears?: number | null;
  absenteeOwner?: boolean | null;
  source?: string;
};

export type TaxRecord = {
  assessedValue?: number | null;
  annualTaxes?: number | null;
  taxYear?: number | null;
  delinquentTaxes?: boolean | null;
  source?: string;
};

export type ValuationRecord = {
  estimatedValue?: number | null;
  lowValue?: number | null;
  highValue?: number | null;
  arvEstimate?: number | null;
  rentEstimate?: number | null;
  confidence: PropertyDataConfidence;
  source?: string;
};

export type ComparableSale = {
  address: string;
  soldPrice?: number | null;
  soldDate?: string | null;
  beds?: number | null;
  baths?: number | null;
  squareFeet?: number | null;
  distanceMiles?: number | null;
  similarityScore?: number | null;
  source?: string;
};

export type PropertyDataResult = {
  property: PropertyRecord;
  owner: OwnerRecord | null;
  tax: TaxRecord | null;
  valuation: ValuationRecord | null;
  comps: ComparableSale[];
  confidence: PropertyDataConfidence;
  missingData: string[];
  source: "manual" | "mock" | "api-placeholder";
  generatedAt: string;
};

export type PropertyDataProvider = {
  id: string;
  label: string;
  lookupPropertyData: (input: {
    address?: string;
    deal?: Record<string, unknown>;
    manualData?: Partial<PropertyDataResult>;
  }) => Promise<ServiceResult<PropertyDataResult>>;
};
