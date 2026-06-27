import { repositorySuccess } from "./repositoryResult";

export async function listPersistedNotifications() {
  return repositorySuccess([], {
    persistence: "not_configured",
    reason: "Notifications are currently derived from loaded deals and system health.",
  });
}
