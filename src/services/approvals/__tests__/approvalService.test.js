import { describe, expect, it } from "vitest";
import {
  APPROVAL_RESULT_LIMIT,
  APPROVAL_TYPES,
  buildApprovalReadModel,
  getApprovalItemsForFilter,
  normalizeApprovalItem,
} from "../index";

const NOW = new Date("2026-07-31T12:00:00.000Z").getTime();

function deal(overrides = {}) {
  return {
    id: "deal-1",
    organization_id: "org-1",
    tenant_id: "tenant-1",
    owner_name: "Alex Seller",
    property_address: "123 Main Street",
    stage: "New Lead",
    ...overrides,
  };
}

describe("approval contract", () => {
  it("normalizes status, context, actions, and compatibility metadata", () => {
    const item = normalizeApprovalItem(
      {
        id: "approval-1",
        approvalType: APPROVAL_TYPES.WORKFLOW_ACTION,
        title: "Review next action",
        relatedDeal: { id: "deal-1", label: "123 Main Street" },
        targetRoute: "/deals/deal-1",
      },
      { now: NOW }
    );

    expect(item).toEqual(
      expect.objectContaining({
        id: "approval-1",
        status: "pending",
        executionMode: "manual-review",
        manualCompletionRequired: true,
      })
    );
    expect(item.availableActions.map((action) => action.id)).toEqual([
      "open-context",
      "defer",
    ]);
  });

  it("represents deterministic offer review notifications", () => {
    const model = buildApprovalReadModel({
      deals: [deal({ offer_ready: true, next_action: "Call seller" })],
      now: NOW,
      organizationId: "org-1",
      tenantId: "tenant-1",
    });

    expect(model.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          approvalType: APPROVAL_TYPES.OFFER_REVIEW,
          sourceSystem: "Action Inbox",
          targetRoute: "/deals/deal-1#numbers",
        }),
      ])
    );
  });

  it("represents current workflow approval signals without executable approval actions", () => {
    const model = buildApprovalReadModel({ deals: [deal({ next_action: "" })], now: NOW });
    const workflow = model.items.find(
      (item) => item.approvalType === APPROVAL_TYPES.WORKFLOW_ACTION
    );

    expect(workflow).toBeDefined();
    expect(workflow.availableActions.map((action) => action.id)).not.toContain("approve");
    expect(workflow.manualCompletionRequired).toBe(true);
  });

  it("represents existing message draft contracts and provider cost metadata", () => {
    const model = buildApprovalReadModel({
      dealNotifications: [],
      messageDrafts: [
        {
          id: "draft-1",
          channel: "sms",
          body: "Hi Alex, is now a good time to talk?",
          to: "+15551234567",
          updatedAt: "2026-07-31T10:00:00.000Z",
        },
      ],
      now: NOW,
    });

    expect(model.items[0]).toEqual(
      expect.objectContaining({
        approvalType: APPROVAL_TYPES.COMMUNICATION_DRAFT,
        freeFirst: expect.objectContaining({
          provider: "MessagingProvider",
          providerConfigured: false,
          providerRequired: false,
        }),
      })
    );
  });

  it("represents buyer campaigns only when the source explicitly requires approval", () => {
    const model = buildApprovalReadModel({
      campaigns: [
        { id: "ignored", campaignName: "Analytics only", channel: "Direct mail" },
        {
          id: "campaign-1",
          campaignName: "Buyer shortlist",
          channel: "Email campaign",
          approvalRequired: true,
          audienceCount: 12,
        },
      ],
      dealNotifications: [],
      now: NOW,
      role: "Owner",
    });

    expect(model.items).toHaveLength(1);
    expect(model.items[0]).toEqual(
      expect.objectContaining({
        approvalType: APPROVAL_TYPES.BUYER_CAMPAIGN,
        freeFirst: expect.objectContaining({ provider: "EmailProvider" }),
      })
    );
  });

  it("deduplicates the same underlying request", () => {
    const duplicate = {
      id: "workflow-1",
      workflowId: "workflow-1",
      workflowName: "Lead follow-up",
      action: "Create follow-up task",
      approvalRequired: true,
    };
    const model = buildApprovalReadModel({
      dealNotifications: [],
      workflowApprovals: [duplicate, { ...duplicate }],
      now: NOW,
    });

    expect(model.items).toHaveLength(1);
  });

  it("orders high-risk work, then communications, offers, workflows, and campaigns", () => {
    const model = buildApprovalReadModel({
      campaigns: [
        { id: "campaign", campaignName: "Buyers", approvalRequired: true },
      ],
      dealNotifications: [
        {
          id: "offer",
          title: "Offer ready",
          category: "Offers ready for review",
          priority: "Medium",
          deal: deal({ id: "offer-deal" }),
        },
      ],
      messageDrafts: [
        { id: "draft", channel: "sms", body: "Draft", riskLevel: "Critical" },
        { id: "draft-2", channel: "email", body: "Ordinary draft" },
      ],
      workflowApprovals: [
        { id: "workflow", action: "Create task", approvalRequired: true },
      ],
      now: NOW,
    });

    expect(model.items[0].riskLevel).toBe("Critical");
    expect(model.items.map((item) => item.approvalType)).toEqual([
      APPROVAL_TYPES.COMMUNICATION_DRAFT,
      APPROVAL_TYPES.COMMUNICATION_DRAFT,
      APPROVAL_TYPES.OFFER_REVIEW,
      APPROVAL_TYPES.WORKFLOW_ACTION,
      APPROVAL_TYPES.BUYER_CAMPAIGN,
    ]);
  });

  it("bounds result size and safely ignores malformed inputs", () => {
    const drafts = Array.from({ length: 80 }, (_, index) => ({
      id: `draft-${index}`,
      channel: "sms",
      body: `Message ${index}`,
    }));
    const model = buildApprovalReadModel({
      dealNotifications: [],
      limit: 12,
      messageDrafts: [null, ...drafts],
      now: NOW,
    });

    expect(model.items).toHaveLength(12);
    expect(APPROVAL_RESULT_LIMIT).toBe(50);
  });

  it("applies tenant and role visibility without treating UI visibility as execution authority", () => {
    const drafts = [
      {
        id: "org-1-draft",
        organizationId: "org-1",
        tenantId: "tenant-1",
        channel: "sms",
        body: "Review me",
      },
      {
        id: "org-2-draft",
        organizationId: "org-2",
        tenantId: "tenant-2",
        channel: "sms",
        body: "Do not show me",
      },
    ];

    const ownerModel = buildApprovalReadModel({
      dealNotifications: [],
      messageDrafts: drafts,
      organizationId: "org-1",
      tenantId: "tenant-1",
      role: "Owner",
      now: NOW,
    });
    const viewerModel = buildApprovalReadModel({
      dealNotifications: [],
      messageDrafts: drafts,
      organizationId: "org-1",
      tenantId: "tenant-1",
      role: "Viewer",
      now: NOW,
    });

    expect(ownerModel.items.map((item) => item.id)).toEqual(["approval:draft:org-1-draft"]);
    expect(viewerModel.items).toHaveLength(0);
  });

  it("applies session-only defer state and exposes represented filters", () => {
    const id = "approval:draft:draft-1";
    const model = buildApprovalReadModel({
      dealNotifications: [],
      decisionStateById: {
        [id]: {
          status: "deferred",
          deferredUntil: "2026-08-03",
          sessionOnly: true,
        },
      },
      messageDrafts: [{ id: "draft-1", channel: "sms", body: "Draft" }],
      now: NOW,
    });

    expect(model.items[0]).toEqual(
      expect.objectContaining({
        status: "deferred",
        deferredUntil: "2026-08-03",
        decisionMetadata: expect.objectContaining({ sessionOnly: true }),
      })
    );
    expect(getApprovalItemsForFilter(model, "communications")).toHaveLength(1);
    expect(model.filters.map((filter) => filter.id)).toEqual(["all", "communications"]);
  });

  it("reports source failures without discarding successful approval items", () => {
    const model = buildApprovalReadModel({
      dealNotifications: [],
      errors: [new Error("Campaign source unavailable")],
      messageDrafts: [{ id: "draft-1", channel: "template", body: "Draft" }],
      now: NOW,
    });

    expect(model.sourceStatus).toBe("partial");
    expect(model.sourceWarnings).toEqual(["Campaign source unavailable"]);
    expect(model.items).toHaveLength(1);
  });
});
