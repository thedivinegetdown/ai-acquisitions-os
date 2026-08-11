import { getValidatedSession } from "../auth";
import { requireActiveOrganizationContext } from "../organizations";

export async function authenticatedFunctionFetch(url, options = {}) {
  const { session, error } = await getValidatedSession();
  const accessToken = session?.access_token;

  if (error || !accessToken) {
    throw new Error("Authentication is required to call this service.");
  }

  const organization = await requireActiveOrganizationContext();
  if (!organization.organizationId) {
    throw new Error("An active organization is required to call this service.");
  }
  if (organization.warning) {
    throw new Error(
      "Explicit organization selection is required before calling this service."
    );
  }

  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${accessToken}`,
      "X-Organization-Id": organization.organizationId,
    },
  });
}
