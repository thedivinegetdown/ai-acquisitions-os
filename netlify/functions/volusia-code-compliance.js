const { requireTenantContext } = require("./_shared/auth.cjs");
const {
  VOLUSIA_CODE_COMPLIANCE_DEFAULT_WINDOW_DAYS,
  VOLUSIA_CODE_COMPLIANCE_MAX_WINDOW_DAYS,
  VOLUSIA_CODE_COMPLIANCE_SOURCE,
  fetchVolusiaCodeCompliancePreview,
} = require("./_shared/volusia-code-compliance.cjs");
const {
  json,
  parseJsonBody,
  requirePost,
  safeErrorMessage,
  safeTrim,
} = require("./_shared/security.cjs");

const INTERNAL_DISCOVERY_COOLDOWN_MS = 3000;
const lastDiscoveryByOrganization = new Map();

function internalSourceUnavailable() {
  return json(503, {
    success: false,
    error: "Internal source access is not configured.",
  });
}

function internalSourceForbidden() {
  return json(403, {
    success: false,
    error: "Internal owner source access denied.",
  });
}

async function authorizeInternalOwner(
  event,
  { authorize = requireTenantContext, env = process.env } = {}
) {
  const internalOrganizationId = safeTrim(env.INTERNAL_OWNER_ORGANIZATION_ID);
  if (!internalOrganizationId) return { response: internalSourceUnavailable() };

  const authorization = await authorize(event, { allowedRoles: ["owner"] });
  if (authorization.response) return authorization;
  if (authorization.context?.organizationId !== internalOrganizationId) {
    return { response: internalSourceForbidden() };
  }
  return authorization;
}

function claimDiscoveryWindow(organizationId, nowMs) {
  const previous = lastDiscoveryByOrganization.get(organizationId) || 0;
  if (nowMs - previous < INTERNAL_DISCOVERY_COOLDOWN_MS) return false;
  lastDiscoveryByOrganization.set(organizationId, nowMs);
  return true;
}

function createHandler({
  authorize = requireTenantContext,
  env = process.env,
  sourceRequest = fetchVolusiaCodeCompliancePreview,
  clock = () => new Date().toISOString(),
  nowMs = () => Date.now(),
  claimWindow = claimDiscoveryWindow,
} = {}) {
  return async (event) => {
    const methodResponse = requirePost(event);
    if (methodResponse) return methodResponse;
    const parsed = parseJsonBody(event);
    if (parsed.error) return json(400, { success: false, error: parsed.error });

    const authorization = await authorizeInternalOwner(event, { authorize, env });
    if (authorization.response) return authorization.response;

    const action = safeTrim(parsed.body.action) || "discover";
    if (action === "availability") {
      return json(200, {
        success: true,
        available: true,
        access: "internal-only",
        source: VOLUSIA_CODE_COMPLIANCE_SOURCE,
      });
    }
    if (action !== "discover") {
      return json(400, { success: false, error: "Unsupported action." });
    }

    const windowDays = Number(
      parsed.body.windowDays ?? VOLUSIA_CODE_COMPLIANCE_DEFAULT_WINDOW_DAYS
    );
    if (
      !Number.isInteger(windowDays) ||
      windowDays < 1 ||
      windowDays > VOLUSIA_CODE_COMPLIANCE_MAX_WINDOW_DAYS
    ) {
      return json(400, {
        success: false,
        error: `Window days must be 1-${VOLUSIA_CODE_COMPLIANCE_MAX_WINDOW_DAYS}.`,
      });
    }

    if (!claimWindow(authorization.context.organizationId, nowMs())) {
      return json(429, {
        success: false,
        error: "Please wait before refreshing this internal source.",
      });
    }

    const retrievedAt = clock();
    try {
      const preview = await sourceRequest({ windowDays, retrievedAt });
      return json(200, { success: true, ...preview });
    } catch (error) {
      const statusCode = error?.status === 409
        ? 409
        : error?.status === 504
          ? 504
          : 502;
      return json(statusCode, {
        success: false,
        status:
          error?.code === "NARROWER_WINDOW_REQUIRED"
            ? "narrower-window-required"
            : "unavailable",
        access: "internal-only",
        source: VOLUSIA_CODE_COMPLIANCE_SOURCE,
        candidates: [],
        error: safeErrorMessage(
          error,
          "Volusia Code Compliance is unavailable."
        ),
      });
    }
  };
}

exports.authorizeInternalOwner = authorizeInternalOwner;
exports.createHandler = createHandler;
exports.handler = createHandler();
