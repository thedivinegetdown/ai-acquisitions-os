export const WORKFLOW_TEMPLATES = [
  {
    id: "new-seller-intake",
    name: "New Seller Intake",
    description: "Collect core seller, property, motivation, and timeline details.",
    trigger: "New lead created or seller workspace opened.",
    actions: [
      "Confirm owner and contact details",
      "Capture motivation and timeline",
      "Document property condition",
    ],
  },
  {
    id: "initial-contact",
    name: "Initial Contact",
    description: "Prepare first outreach and log response state.",
    trigger: "Lead has no conversation history.",
    actions: ["Prepare opening message", "Call seller", "Log first response"],
  },
  {
    id: "warm-lead-nurture",
    name: "Warm Lead Nurture",
    description: "Maintain seller engagement while collecting missing information.",
    trigger: "Seller is engaged but not offer-ready.",
    actions: ["Ask one discovery question", "Schedule follow-up", "Update seller notes"],
  },
  {
    id: "offer-preparation",
    name: "Offer Preparation",
    description: "Prepare internal offer analysis before seller presentation.",
    trigger: "Offer readiness score is strong.",
    actions: ["Review offer range", "Compare offer scenarios", "Prepare negotiation script"],
  },
  {
    id: "contract-preparation",
    name: "Contract Preparation",
    description: "Prepare internal contract workflow after seller acceptance.",
    trigger: "Offer accepted or deal moves toward contract.",
    actions: ["Confirm accepted terms", "Review title/closing requirements", "Prepare legal handoff"],
  },
  {
    id: "buyer-matching",
    name: "Buyer Matching",
    description: "Evaluate disposition path and buyer shortlist.",
    trigger: "Wholesale or disposition strategy is viable.",
    actions: ["Review buyer matches", "Validate buyer demand", "Prepare internal shortlist"],
  },
  {
    id: "closing-process",
    name: "Closing Process",
    description: "Coordinate title, funding, buyer assignment, and closing readiness.",
    trigger: "Deal is under contract.",
    actions: ["Order title", "Confirm EMD", "Track closing checklist"],
  },
  {
    id: "dead-lead-reactivation",
    name: "Dead Lead Reactivation",
    description: "Review inactive leads for low-pressure reactivation.",
    trigger: "No recent seller activity.",
    actions: ["Prepare reactivation note", "Review lead quality", "Decide keep/archive"],
  },
  {
    id: "follow-up-sequence",
    name: "Follow-Up Sequence",
    description: "Plan manual follow-up cadence without sending automatically.",
    trigger: "Follow-up is due or recommended.",
    actions: ["Review sequence plan", "Edit suggested message", "Create manual task"],
  },
  {
    id: "custom-workflow",
    name: "Custom Workflow",
    description: "Manual workflow for exceptions or special deal situations.",
    trigger: "User-defined.",
    actions: ["Define goal", "Add manual steps", "Review with team"],
  },
];

export function getWorkflowTemplate(id) {
  return (
    WORKFLOW_TEMPLATES.find((template) => template.id === id) ||
    WORKFLOW_TEMPLATES.find((template) => template.id === "custom-workflow")
  );
}
