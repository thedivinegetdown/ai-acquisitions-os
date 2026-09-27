const { MEMBERSHIP_ROLES, requireTenantContext } = require("./_shared/auth.cjs");
const {
  VOLUSIA_CIRCUIT_FORECLOSURE_DEFAULT_REPORT_LIMIT,
  VOLUSIA_CIRCUIT_FORECLOSURE_MAX_REPORT_LIMIT,
  fetchVolusiaCircuitForeclosurePreview,
} = require("./_shared/volusia-circuit-foreclosure.cjs");
const {
  json,
  parseJsonBody,
  requirePost,
  safeErrorMessage,
} = require("./_shared/security.cjs");

function createHandler({
  authorize = requireTenantContext,
  sourceRequest = fetchVolusiaCircuitForeclosurePreview,
  clock = () => new Date().toISOString(),
} = {}) {
  return async (event) => {
    const methodResponse = requirePost(event);
    if (methodResponse) return methodResponse;
    const parsed = parseJsonBody(event);
    if (parsed.error) return json(400, { success: false, error: parsed.error });

    const reportLimit = Number(
      parsed.body.reportLimit ?? VOLUSIA_CIRCUIT_FORECLOSURE_DEFAULT_REPORT_LIMIT
    );
    if (
      !Number.isInteger(reportLimit) ||
      reportLimit < 1 ||
      reportLimit > VOLUSIA_CIRCUIT_FORECLOSURE_MAX_REPORT_LIMIT
    ) {
      return json(400, {
        success: false,
        error: `Report limit must be 1-${VOLUSIA_CIRCUIT_FORECLOSURE_MAX_REPORT_LIMIT}.`,
      });
    }

    const authorization = await authorize(event, { allowedRoles: MEMBERSHIP_ROLES });
    if (authorization.response) return authorization.response;

    try {
      const preview = await sourceRequest({ reportLimit, retrievedAt: clock() });
      return json(200, { success: true, ...preview });
    } catch (error) {
      return json(error?.status === 504 ? 504 : 502, {
        success: false,
        status: "unavailable",
        source: "volusia-circuit-foreclosure",
        candidates: [],
        rejected: [],
        reports: [],
        error: safeErrorMessage(
          error,
          "Volusia weekly circuit foreclosure reports are unavailable."
        ),
      });
    }
  };
}

exports.createHandler = createHandler;
exports.handler = createHandler();
