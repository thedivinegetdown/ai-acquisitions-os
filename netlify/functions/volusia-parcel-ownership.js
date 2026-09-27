const { MEMBERSHIP_ROLES, requireTenantContext } = require("./_shared/auth.cjs");
const {
  VOLUSIA_PARCEL_OWNERSHIP_SOURCE,
  fetchVolusiaParcelOwnership,
  normalizeVerifiedParcelId,
} = require("./_shared/volusia-parcel-ownership.cjs");
const {
  json,
  parseJsonBody,
  requirePost,
  safeErrorMessage,
} = require("./_shared/security.cjs");

function createHandler({
  authorize = requireTenantContext,
  sourceRequest = fetchVolusiaParcelOwnership,
  clock = () => new Date().toISOString(),
} = {}) {
  return async (event) => {
    const methodResponse = requirePost(event);
    if (methodResponse) return methodResponse;
    const parsed = parseJsonBody(event);
    if (parsed.error) return json(400, { success: false, error: parsed.error });

    const verifiedParcelId = normalizeVerifiedParcelId(parsed.body.verifiedParcelId);
    if (!verifiedParcelId) {
      return json(400, {
        success: false,
        status: "invalid",
        source: VOLUSIA_PARCEL_OWNERSHIP_SOURCE,
        error: "A verified seven-digit Volusia PARID is required.",
      });
    }

    const authorization = await authorize(event, { allowedRoles: MEMBERSHIP_ROLES });
    if (authorization.response) return authorization.response;

    try {
      const result = await sourceRequest({
        verifiedParcelId,
        retrievedAt: clock(),
      });
      return json(200, { success: true, ...result });
    } catch (error) {
      return json(error?.status === 504 ? 504 : 502, {
        success: false,
        status: "unavailable",
        source: VOLUSIA_PARCEL_OWNERSHIP_SOURCE,
        verifiedParcelId,
        propertyVerificationState: "UNVERIFIED",
        parcel: null,
        error: safeErrorMessage(
          error,
          "Volusia Parcel Ownership data is unavailable."
        ),
      });
    }
  };
}

exports.createHandler = createHandler;
exports.handler = createHandler();
