const { MEMBERSHIP_ROLES, requireTenantContext } = require("./_shared/auth.cjs");
const {
  VOLUSIA_TAX_DEED_DEFAULT_SALE_DATE_LIMIT,
  VOLUSIA_TAX_DEED_MAX_SALE_DATE_LIMIT,
  VOLUSIA_TAX_DEED_SALE_SOURCE,
  fetchVolusiaTaxDeedSalePreview,
} = require("./_shared/volusia-tax-deed-sale.cjs");
const {
  json,
  parseJsonBody,
  requirePost,
  safeErrorMessage,
} = require("./_shared/security.cjs");

function createHandler({
  authorize = requireTenantContext,
  sourceRequest = fetchVolusiaTaxDeedSalePreview,
  clock = () => new Date().toISOString(),
} = {}) {
  return async (event) => {
    const methodResponse = requirePost(event);
    if (methodResponse) return methodResponse;
    const parsed = parseJsonBody(event);
    if (parsed.error) return json(400, { success: false, error: parsed.error });

    const saleDateLimit = Number(
      parsed.body.saleDateLimit ?? VOLUSIA_TAX_DEED_DEFAULT_SALE_DATE_LIMIT
    );
    if (
      !Number.isInteger(saleDateLimit) ||
      saleDateLimit < 1 ||
      saleDateLimit > VOLUSIA_TAX_DEED_MAX_SALE_DATE_LIMIT
    ) {
      return json(400, {
        success: false,
        error: `Sale-date limit must be 1-${VOLUSIA_TAX_DEED_MAX_SALE_DATE_LIMIT}.`,
      });
    }

    const authorization = await authorize(event, { allowedRoles: MEMBERSHIP_ROLES });
    if (authorization.response) return authorization.response;

    try {
      const preview = await sourceRequest({ saleDateLimit, retrievedAt: clock() });
      return json(200, { success: true, ...preview });
    } catch (error) {
      return json(error?.status === 504 ? 504 : 502, {
        success: false,
        status: "unavailable",
        source: VOLUSIA_TAX_DEED_SALE_SOURCE,
        candidates: [],
        rejected: [],
        saleWindow: [],
        error: safeErrorMessage(error, "Volusia Tax Deed Sales are unavailable."),
      });
    }
  };
}

exports.createHandler = createHandler;
exports.handler = createHandler();
