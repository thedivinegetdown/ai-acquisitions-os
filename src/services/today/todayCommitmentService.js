import { createFailure } from "../api/serviceResult";
import {
  updateOwnedDeal,
  updateSellerTask,
  updateSequenceStep,
} from "../repositories";

function validCommitment(item) {
  return item?.commitment?.sourceType && item?.commitment?.sourceId;
}

export async function completeTodayCommitment(item, { now = Date.now() } = {}) {
  if (!validCommitment(item)) {
    return createFailure("This Today item is not a durable commitment.", "Could not complete item.");
  }

  const updatedAt = new Date(now).toISOString();
  const { sourceType, sourceId } = item.commitment;

  if (sourceType === "deal") {
    return updateOwnedDeal(sourceId, {
      next_action: null,
      next_action_due_date: null,
      due_date: null,
      follow_up_date: null,
      updated_at: updatedAt,
    });
  }
  if (sourceType === "seller-task") {
    return updateSellerTask(sourceId, { status: "completed", updated_at: updatedAt });
  }
  if (sourceType === "sequence-step") {
    return updateSequenceStep(sourceId, { status: "Completed", updated_at: updatedAt });
  }

  return createFailure("Unknown commitment source.", "Could not complete item.");
}

export async function revisitTodayCommitment(item, futureDate, { now = Date.now() } = {}) {
  if (!validCommitment(item)) {
    return createFailure("This Today item is not a durable commitment.", "Could not reschedule item.");
  }

  const date = String(futureDate || "").slice(0, 10);
  const today = new Date(now).toISOString().slice(0, 10);
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  const validDate =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === date;
  if (!validDate || date <= today) {
    return createFailure("Choose a future revisit date.", "Could not reschedule item.");
  }

  const updatedAt = new Date(now).toISOString();
  const { sourceType, sourceId } = item.commitment;
  if (sourceType === "deal") {
    return updateOwnedDeal(sourceId, {
      next_action_due_date: date,
      due_date: date,
      updated_at: updatedAt,
    });
  }
  if (sourceType === "seller-task") {
    return updateSellerTask(sourceId, {
      due_at: `${date}T12:00:00.000Z`,
      status: "open",
      updated_at: updatedAt,
    });
  }
  if (sourceType === "sequence-step") {
    return updateSequenceStep(sourceId, {
      due_date: date,
      status: "Pending",
      updated_at: updatedAt,
    });
  }

  return createFailure("Unknown commitment source.", "Could not reschedule item.");
}
