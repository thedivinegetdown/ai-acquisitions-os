const { MEMBERSHIP_ROLES, requireTenantContext } = require("./_shared/auth.cjs");
const {
  WATER_CASE_MAX_PAGE_SIZE,
  fetchOrangeCountyWaterCasePage,
} = require("./_shared/orange-county-water-case.cjs");
const {
  json,
  parseJsonBody,
  requirePost,
  safeErrorMessage,
} = require("./_shared/security.cjs");

function createHandler({
  authorize = requireTenantContext,
  sourceRequest = fetchOrangeCountyWaterCasePage,
  clock = () => new Date().toISOString(),
} = {}) {
  return async (event) => {
    const methodResponse = requirePost(event);
    if (methodResponse) return methodResponse;
    const parsed = parseJsonBody(event);
    if (parsed.error) return json(400, { success: false, error: parsed.error });

    const cursor = Number(parsed.body.cursor ?? 0);
    const pageSize = Number(parsed.body.pageSize ?? 100);
    if (
      !Number.isInteger(cursor) ||
      cursor < 0 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > WATER_CASE_MAX_PAGE_SIZE
    ) {
      return json(400, {
        success: false,
        error: `Cursor must be non-negative and page size must be 1-${WATER_CASE_MAX_PAGE_SIZE}.`,
      });
    }

    const authorization = await authorize(event, { allowedRoles: MEMBERSHIP_ROLES });
    if (authorization.response) return authorization.response;

    try {
      const page = await sourceRequest({ cursor, pageSize, retrievedAt: clock() });
      return json(200, { success: true, ...page });
    } catch (error) {
      return json(error?.status === 504 ? 504 : 502, {
        success: false,
        status: "unavailable",
        source: "orange-county-water-case",
        candidates: [],
        rejected: [],
        error: safeErrorMessage(error, "Orange County Active Water Cases are unavailable."),
      });
    }
  };
}

exports.createHandler = createHandler;
exports.handler = createHandler();
