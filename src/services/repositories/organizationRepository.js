import { repositorySuccess } from "./repositoryResult";
import { buildDefaultOrganization } from "../saas/organizationContextService";

export async function getCurrentOrganization() {
  return repositorySuccess(buildDefaultOrganization(), {
    persistence: "placeholder",
    reason: "Organization context is not persisted until membership schema is approved.",
  });
}
