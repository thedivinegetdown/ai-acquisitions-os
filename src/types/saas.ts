import type { EntityId } from "./common";

export type UserRole =
  | "Owner"
  | "Admin"
  | "Acquisitions Manager"
  | "Dispositions Manager"
  | "Transaction Coordinator"
  | "Viewer"
  | string;

export type OrganizationSettings = {
  timezone?: string;
  aiAssistanceEnabled?: boolean;
  defaultMarket?: string;
  activeMarkets?: string[];
  [key: string]: unknown;
};

export type Organization = {
  id: EntityId;
  tenantId: EntityId;
  name: string;
  activeMarket?: string;
  settings?: OrganizationSettings;
};

export type UserContext = {
  id: EntityId;
  name: string;
  email?: string;
  role: UserRole;
};

export type TenantContext = {
  tenantId: EntityId;
  organizationId: EntityId;
  organization: Organization;
  user: UserContext;
  currentRole: UserRole;
  activeMarket?: string;
  enforcementActive: boolean;
  generatedAt: string;
};

export type TenantScopedRecord = {
  tenant_id?: EntityId;
  tenantId?: EntityId;
  organization_id?: EntityId;
  organizationId?: EntityId;
  [key: string]: unknown;
};
