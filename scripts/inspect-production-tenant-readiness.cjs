const TENANT_TABLES = [
  "deals",
  "message_logs",
  "seller_tasks",
  "buyers",
  "documents",
  "comps",
  "sequences",
  "communication_consents",
];

const CHILD_TABLES = ["message_logs", "seller_tasks", "documents", "comps", "sequences"];
const READ_ONLY_RPCS = new Set([
  "tenant_table_ownership_report",
  "tenant_rls_readiness_report",
  "tenant_rls_is_ready",
]);

const REQUIRED_COLUMNS = {
  organizations: ["id", "name", "status", "created_by", "created_at", "updated_at"],
  organization_memberships: [
    "id",
    "organization_id",
    "user_id",
    "role",
    "status",
    "created_at",
    "updated_at",
  ],
  deals: ["id", "organization_id", "created_at", "updated_at"],
  message_logs: [
    "id",
    "deal_id",
    "organization_id",
    "direction",
    "status",
    "provider",
    "provider_message_id",
    "provider_status",
    "provider_status_updated_at",
    "error_code",
    "consent_event",
    "created_at",
    "updated_at",
  ],
  seller_tasks: ["id", "deal_id", "organization_id", "created_at", "updated_at"],
  buyers: ["id", "organization_id", "created_at", "updated_at"],
  documents: ["id", "deal_id", "organization_id", "created_at", "updated_at"],
  comps: ["id", "deal_id", "organization_id", "created_at", "updated_at"],
  sequences: ["id", "deal_id", "organization_id", "created_at", "updated_at"],
  communication_consents: [
    "id",
    "organization_id",
    "normalized_phone",
    "channel",
    "status",
    "source",
    "provider",
    "last_event_at",
    "created_at",
    "updated_at",
  ],
};

function assertProductionTarget(rawUrl, authorization) {
  if (authorization !== "true") {
    throw new Error("EO_PROD_READ_ONLY=true is required for production inspection.");
  }

  const normalizedUrl = typeof rawUrl === "string" ? rawUrl.trim() : "";
  let url;
  try {
    url = new URL(normalizedUrl);
  } catch {
    throw new Error(
      `SUPABASE_URL is unavailable or malformed (type=${typeof rawUrl}, length=${normalizedUrl.length}, https=${normalizedUrl.startsWith("https://")}).`
    );
  }
  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    !hostname.endsWith(".supabase.co") ||
    hostname === "supabase.co" ||
    hostname.includes("localhost") ||
    hostname.startsWith("127.")
  ) {
    throw new Error("Inspection target must be an explicit production Supabase HTTPS project.");
  }
  return url.origin;
}

function assertReadOnlyRequest(method, pathname) {
  const normalizedMethod = String(method || "GET").toUpperCase();
  if (["GET", "HEAD"].includes(normalizedMethod)) return;

  const rpcMatch = String(pathname).match(/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/);
  if (normalizedMethod === "POST" && rpcMatch && READ_ONLY_RPCS.has(rpcMatch[1])) return;

  throw new Error(`Blocked non-read-only production request: ${normalizedMethod}`);
}

function resolveProductionTarget(env) {
  const serviceOrigin = assertProductionTarget(env.SUPABASE_URL, env.EO_PROD_READ_ONLY);
  if (!env.VITE_SUPABASE_URL) return serviceOrigin;

  const publicOrigin = assertProductionTarget(env.VITE_SUPABASE_URL, env.EO_PROD_READ_ONLY);
  if (publicOrigin !== serviceOrigin) {
    throw new Error("Server and public Supabase project origins do not match.");
  }
  return serviceOrigin;
}

function createClient(baseUrl, serviceKey) {
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };

  return async function request(pathname, options = {}) {
    const method = String(options.method || "GET").toUpperCase();
    assertReadOnlyRequest(method, pathname.split("?")[0]);
    const response = await fetch(new URL(pathname, baseUrl), {
      ...options,
      method,
      headers: { ...headers, ...(options.headers || {}) },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      const error = new Error(`Read-only production request returned HTTP ${response.status}.`);
      error.status = response.status;
      throw error;
    }
    return response;
  };
}

function parseContentRange(value) {
  const match = String(value || "").match(/\/(\d+|\*)$/);
  return match && match[1] !== "*" ? Number(match[1]) : null;
}

async function countRows(request, table, filter = "") {
  const suffix = filter ? `&${filter}` : "";
  const response = await request(`/rest/v1/${table}?select=id${suffix}`, {
    method: "HEAD",
    headers: { Prefer: "count=exact", Range: "0-0" },
  });
  return parseContentRange(response.headers.get("content-range"));
}

async function fetchRows(request, table, columns) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; offset < 100_000; offset += pageSize) {
    const response = await request(`/rest/v1/${table}?select=${columns.join(",")}`, {
      headers: { Range: `${offset}-${offset + pageSize - 1}` },
    });
    const page = await response.json();
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
  throw new Error(`Read-only row scan limit exceeded for ${table}.`);
}

async function callReportingRpc(request, name) {
  try {
    const response = await request(`/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    return { available: true, result: await response.json() };
  } catch (error) {
    if ([404, 405].includes(error.status)) return { available: false, result: null };
    throw error;
  }
}

function inspectOpenApi(openApi) {
  const definitions = openApi.definitions || openApi.components?.schemas || {};
  const actualTables = Object.keys(definitions).filter((name) => definitions[name]?.properties);
  const missingTables = Object.keys(REQUIRED_COLUMNS).filter((name) => !actualTables.includes(name));
  const missingColumns = [];
  for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
    const properties = definitions[table]?.properties || {};
    for (const column of columns) {
      if (!Object.prototype.hasOwnProperty.call(properties, column)) {
        missingColumns.push(`${table}.${column}`);
      }
    }
  }
  return {
    committedRequiredTables: Object.keys(REQUIRED_COLUMNS),
    missingTables,
    missingColumns,
    productionOnlyTables: actualTables.filter((name) => !REQUIRED_COLUMNS[name]).sort(),
    limitations: [
      "REST metadata cannot prove migration-ledger head, constraint validation, indexes, policy definitions, or relrowsecurity state.",
    ],
  };
}

async function inspectProduction(env = process.env) {
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is unavailable for read-only inspection.");
  const baseUrl = resolveProductionTarget(env);
  const request = createClient(baseUrl, serviceKey);

  const openApiResponse = await request("/rest/v1/", {
    headers: { Accept: "application/openapi+json" },
  });
  const schemaDrift = inspectOpenApi(await openApiResponse.json());

  const organizations = await fetchRows(request, "organizations", ["id", "name", "status", "created_by"]);
  const memberships = await fetchRows(request, "organization_memberships", [
    "organization_id",
    "user_id",
    "role",
    "status",
  ]);
  const organizationIds = new Set(organizations.map((row) => row.id));
  const ownership = {};
  const rowSets = {};

  for (const table of TENANT_TABLES) {
    const columns = ["id", "organization_id"];
    if (CHILD_TABLES.includes(table)) columns.push("deal_id");
    const rows = await fetchRows(request, table, columns);
    rowSets[table] = rows;
    ownership[table] = {
      total: await countRows(request, table),
      nonNullOrganization: await countRows(request, table, "organization_id=not.is.null"),
      nullOrganization: await countRows(request, table, "organization_id=is.null"),
      distinctOrganizationIds: [...new Set(rows.map((row) => row.organization_id).filter(Boolean))].sort(),
      orphanOrganizationCount: rows.filter(
        (row) => row.organization_id && !organizationIds.has(row.organization_id)
      ).length,
    };
  }

  const dealOrganizations = new Map(
    rowSets.deals.map((row) => [row.id, row.organization_id || null])
  );
  const childRelationships = {};
  for (const table of CHILD_TABLES) {
    const rows = rowSets[table];
    childRelationships[table] = {
      missingDealCount: rows.filter((row) => row.deal_id && !dealOrganizations.has(row.deal_id)).length,
      crossTenantCount: rows.filter(
        (row) =>
          row.deal_id &&
          dealOrganizations.has(row.deal_id) &&
          row.organization_id &&
          dealOrganizations.get(row.deal_id) !== row.organization_id
      ).length,
    };
  }

  const activeMemberships = memberships.filter((row) => row.status === "active");
  const activeOwners = activeMemberships.filter((row) => row.role === "owner");
  const activeOrganizations = organizations.filter((row) => row.status === "active");
  const ownerlessActiveOrganizations = activeOrganizations.filter(
    (organization) =>
      !activeOwners.some((membership) => membership.organization_id === organization.id)
  );
  const conflictingAssignments = Object.values(ownership).some(
    (table) => table.distinctOrganizationIds.length > 1
  );
  const proposedTarget =
    activeOrganizations.length === 1 &&
    activeOwners.length === 1 &&
    ownerlessActiveOrganizations.length === 0 &&
    !conflictingAssignments
      ? {
          organizationId: activeOrganizations[0].id,
          organizationName: activeOrganizations[0].name,
          ownerUserId: activeOwners[0].user_id,
        }
      : null;

  const reporting = {};
  for (const name of READ_ONLY_RPCS) reporting[name] = await callReportingRpc(request, name);

  return {
    inspectedAs: "production-read-only",
    requestBoundary: "GET/HEAD plus allowlisted stable reporting RPCs only",
    schemaDrift,
    ownership,
    childRelationships,
    organizations: organizations.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      createdBy: row.created_by,
    })),
    memberships: {
      total: memberships.length,
      active: activeMemberships.length,
      roles: activeMemberships.reduce((counts, row) => {
        counts[row.role] = (counts[row.role] || 0) + 1;
        return counts;
      }, {}),
      activeOwners: activeOwners.map((row) => ({
        organizationId: row.organization_id,
        userId: row.user_id,
      })),
      ownerlessActiveOrganizationIds: ownerlessActiveOrganizations.map((row) => row.id),
    },
    proposedTarget,
    reporting,
    unresolvedMetadata: [
      "migration ledger head",
      "constraint validation state",
      "index definitions",
      "policy definitions",
      "RLS enabled/disabled state",
      "identity of the currently authenticated browser owner session",
    ],
  };
}

module.exports = {
  READ_ONLY_RPCS,
  assertProductionTarget,
  assertReadOnlyRequest,
  inspectOpenApi,
  inspectProduction,
  parseContentRange,
  resolveProductionTarget,
};

if (require.main === module) {
  inspectProduction()
    .then((report) => console.log(JSON.stringify(report, null, 2)))
    .catch((error) => {
      console.error(`Production inspection stopped safely: ${error.message}`);
      process.exit(1);
    });
}
