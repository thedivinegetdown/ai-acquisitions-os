import { assembleResearchContext } from "../research-intelligence/researchResolutionService";
import { normalizePhone } from "../../utils/phone";

function linked(record, deal) {
  const organizationId = record.organizationId || record.organization_id;
  if (organizationId && deal.organization_id && organizationId !== deal.organization_id) return false;
  const id = record.linkedDealId || record.dealId || record.deal_id || record.relatedDeal?.id || record.linkedDeal?.id;
  if (id) return String(id) === String(deal.id);
  const phone = normalizePhone(record.phone || record.sellerReference?.phone);
  return Boolean(phone && phone === normalizePhone(deal.phone));
}

export function assembleDecisionRoomInputs({ deal, decisionContext = {}, conversations = [], sellerTasks = [], sequenceSteps = [], sourceErrors = [], now }) {
  const research = assembleResearchContext(deal, now, decisionContext.evidenceReferences || []);
  const tasks = [
    ...sellerTasks.filter((record) => linked(record, deal)),
    ...sequenceSteps.filter((record) => linked(record, deal)).map((record) => ({ ...record, id: `sequence:${record.id}`, title: record.action_type })),
    ...(deal.next_action ? [{ id: `deal-action:${deal.id}`, deal_id: deal.id, organization_id: deal.organization_id,
      title: deal.next_action, due_at: deal.next_action_due_date || deal.due_date || deal.follow_up_date }] : []),
  ];
  return {
    ...decisionContext, deal, now,
    conversationSignals: [...conversations, ...(decisionContext.conversationSignals || [])].filter((record) => linked(record, deal)),
    tasks: [...tasks, ...(decisionContext.tasks || []).filter((record) => linked(record, deal))],
    evidenceReferences: research.evidenceReferences,
    conflictEvidenceReferences: research.conflictEvidenceReferences,
    conflictResolutions: [...research.conflictResolutions, ...(decisionContext.conflictResolutions || [])],
    sourceErrors: [...sourceErrors, ...(decisionContext.sourceErrors || [])],
  };
}
