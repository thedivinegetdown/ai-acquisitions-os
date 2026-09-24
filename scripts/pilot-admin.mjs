import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { createServer } from "vite";

const COMMANDS = new Set([
  "provision",
  "status",
  "suspend",
  "reactivate",
  "configure-settings",
  "configure-provider",
  "import-preview",
  "import-apply",
  "export",
]);
const PILOT_DEAL_PAGE_SIZE = 500;
const PILOT_IMPORT_BATCH_SIZE = 200;
const activeOperation = {
  client: null,
  command: "unknown",
  correlationId: randomUUID(),
  organizationId: null,
};

function usage() {
  return `Assisted pilot administration (server credentials required)

  provision --idempotency-key KEY --organization-name NAME --owner-user-id UUID [--slug SLUG]
  status --organization-id UUID
  suspend|reactivate --organization-id UUID
  configure-settings --organization-id UUID --settings FILE.json
  configure-provider --organization-id UUID --provider openai --enabled true|false [--monthly-request-cap N --max-prompt-characters N]
  import-preview --organization-id UUID --csv FILE.csv --plan FILE.json [--default-market MARKET --default-lead-source SOURCE]
  import-apply --plan FILE.json --confirmation-token TOKEN
  export --organization-id UUID --output FILE.json`;
}

function parseArguments(argv) {
  const [command, ...tokens] = argv;
  if (!COMMANDS.has(command)) throw new Error(usage());
  const options = {};
  for (let index = 0; index < tokens.length; index += 2) {
    const key = tokens[index];
    const value = tokens[index + 1];
    if (!key?.startsWith("--") || value === undefined || value.startsWith("--")) {
      throw new Error(`Invalid argument near ${key || "end of command"}.\n\n${usage()}`);
    }
    options[key.slice(2)] = value;
  }
  return { command, options };
}

function required(options, key) {
  const value = String(options[key] || "").trim();
  if (!value) throw new Error(`Missing required --${key}.`);
  return value;
}

function serverClient() {
  const url = String(process.env.SUPABASE_URL || "").trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

async function rpc(client, name, parameters) {
  const { data, error } = await client.rpc(name, parameters);
  if (error) throw new Error(error.message || `${name} failed.`);
  return data;
}

async function recordPilotFailure(client, {
  classification,
  command,
  correlationId,
  organizationId,
}) {
  if (!client || !organizationId) return;
  await rpc(client, "record_pilot_operation_failure", {
    p_organization_id: organizationId,
    p_operation_type: `pilot-${command}`,
    p_error_classification: classification,
    p_correlation_id: correlationId,
  });
}

function classifyAdminFailure(error) {
  const message = String(error?.message || "").toLowerCase();
  if (/not found|missing required/.test(message)) return "not-found";
  if (/permission|forbidden|not authorized|row-level security/.test(message)) return "authorization-rejected";
  if (/duplicate|unique|already/.test(message)) return "conflict";
  if (/limit|cap|disabled|suspended/.test(message)) return "policy-rejected";
  if (/invalid|required|must|match|unsupported/.test(message)) return "validation-rejected";
  return "operation-failed";
}

async function loadAllPilotDeals(client, organizationId) {
  const rows = [];
  let offset = 0;

  while (true) {
    const { data, error } = await client
      .from("deals")
      .select("id, organization_id, phone, email, seller_email, property_address")
      .eq("organization_id", organizationId)
      .order("id", { ascending: true })
      .range(offset, offset + PILOT_DEAL_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);

    const page = data || [];
    rows.push(...page);
    if (page.length < PILOT_DEAL_PAGE_SIZE) break;
    offset += page.length;
  }

  return rows;
}

function stableImportPayload(organizationId, records) {
  return JSON.stringify({ organizationId, records });
}

function confirmationToken(organizationId, records) {
  return createHash("sha256")
    .update(stableImportPayload(organizationId, records))
    .digest("hex");
}

async function loadIntakeServices() {
  const vite = await createServer({
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  try {
    const intake = await vite.ssrLoadModule("/src/services/leadIntake/leadImportService.js");
    const normalization = await vite.ssrLoadModule("/src/services/leadIntake/leadNormalizationService.js");
    return {
      parseCsvLeadText: intake.parseCsvLeadText,
      toDealImportPayload: normalization.toDealImportPayload,
    };
  } finally {
    await vite.close();
  }
}

async function previewImport(client, options) {
  const organizationId = required(options, "organization-id");
  const csvPath = path.resolve(required(options, "csv"));
  const planPath = path.resolve(required(options, "plan"));
  const { data: organization, error: organizationError } = await client
    .from("organizations")
    .select("id, status")
    .eq("id", organizationId)
    .limit(1);
  if (organizationError) throw new Error(organizationError.message);
  if (!organization?.[0] || organization[0].status !== "active") {
    throw new Error("Target pilot organization is not active.");
  }

  const existingDeals = await loadAllPilotDeals(client, organizationId);

  const csvText = await readFile(csvPath, "utf8");
  const { parseCsvLeadText, toDealImportPayload } = await loadIntakeServices();
  const analysis = parseCsvLeadText({
    csvText,
    existingDeals: existingDeals || [],
    defaults: {
      market: String(options["default-market"] || "").trim(),
      leadSource: String(options["default-lead-source"] || "CSV Import").trim(),
    },
  });
  const records = analysis.validLeads.map((lead) => ({
    rowNumber: lead.rowNumber,
    payload: toDealImportPayload(lead),
  }));
  const token = confirmationToken(organizationId, records);
  const outcomes = analysis.parsedLeads.map((lead) => ({
    rowNumber: lead.rowNumber,
    status: lead.valid && !lead.duplicate ? "accepted" : "rejected",
    reasons: [...(lead.warnings || []), ...(lead.duplicateReasons || [])],
  }));
  const plan = {
    format: "ai-acquisitions-os-assisted-import-v1",
    organizationId,
    sourceFile: path.basename(csvPath),
    confirmationToken: token,
    summary: analysis.summary,
    outcomes,
    records,
  };
  await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, { flag: "wx" });
  return {
    plan: planPath,
    organizationId,
    acceptedCount: records.length,
    rejectedCount: outcomes.filter((outcome) => outcome.status === "rejected").length,
    confirmationToken: token,
    outcomes,
  };
}

async function applyImport(client, options) {
  const planPath = path.resolve(required(options, "plan"));
  const suppliedToken = required(options, "confirmation-token");
  const plan = JSON.parse(await readFile(planPath, "utf8"));
  if (plan.format !== "ai-acquisitions-os-assisted-import-v1") {
    throw new Error("Unsupported assisted import plan.");
  }
  const expectedToken = confirmationToken(plan.organizationId, plan.records || []);
  activeOperation.organizationId = plan.organizationId;
  if (suppliedToken !== expectedToken || plan.confirmationToken !== expectedToken) {
    throw new Error("Confirmation token does not match the reviewed import plan.");
  }
  const outcomes = [];
  const records = Array.isArray(plan.records) ? plan.records : [];
  if (records.length === 0) {
    throw new Error("Confirmed import records are required.");
  }
  let importedCount = 0;
  let duplicateCount = 0;
  let failedCount = 0;

  for (let index = 0; index < records.length; index += PILOT_IMPORT_BATCH_SIZE) {
    const batch = await rpc(client, "persist_assisted_pilot_import", {
      p_organization_id: plan.organizationId,
      p_confirmation_token: expectedToken,
      p_records: records.slice(index, index + PILOT_IMPORT_BATCH_SIZE),
    });
    outcomes.push(...(batch.results || []));
    importedCount += Number(batch.importedCount || 0);
    duplicateCount += Number(batch.duplicateCount || 0);
    failedCount += Number(batch.failedCount || 0);
  }

  if (failedCount > 0) {
    await recordPilotFailure(client, {
      classification: "record-rejected",
      command: "import-apply",
      correlationId: activeOperation.correlationId,
      organizationId: plan.organizationId,
    });
  }
  if (outcomes.length !== records.length) {
    throw new Error("Assisted import returned an incomplete result set; retry the same confirmed plan.");
  }

  return {
    organization_id: plan.organizationId,
    confirmation_token: expectedToken,
    results: outcomes,
    importedCount,
    duplicateCount,
    failedCount,
    complete: true,
  };
}

async function run() {
  const { command, options } = parseArguments(process.argv.slice(2));
  const client = serverClient();
  activeOperation.client = client;
  activeOperation.command = command;
  activeOperation.organizationId = options["organization-id"] || null;
  let result;

  if (command === "provision") {
    result = await rpc(client, "provision_assisted_pilot", {
      p_idempotency_key: required(options, "idempotency-key"),
      p_organization_name: required(options, "organization-name"),
      p_owner_user_id: required(options, "owner-user-id"),
      p_slug: options.slug || null,
    });
  } else if (command === "status") {
    result = await rpc(client, "pilot_support_diagnostics", {
      p_organization_id: required(options, "organization-id"),
    });
  } else if (command === "suspend" || command === "reactivate") {
    result = await rpc(client, "set_assisted_pilot_status", {
      p_organization_id: required(options, "organization-id"),
      p_status: command === "suspend" ? "suspended" : "active",
    });
  } else if (command === "configure-settings") {
    const settings = JSON.parse(await readFile(path.resolve(required(options, "settings")), "utf8"));
    result = await rpc(client, "configure_assisted_pilot_settings", {
      p_organization_id: required(options, "organization-id"),
      p_settings: settings,
    });
  } else if (command === "configure-provider") {
    const enabledText = required(options, "enabled").toLowerCase();
    if (!["true", "false"].includes(enabledText)) throw new Error("--enabled must be true or false.");
    result = await rpc(client, "configure_assisted_pilot_provider", {
      p_organization_id: required(options, "organization-id"),
      p_provider: required(options, "provider"),
      p_enabled: enabledText === "true",
      p_monthly_request_cap: options["monthly-request-cap"] ? Number(options["monthly-request-cap"]) : null,
      p_max_prompt_characters: options["max-prompt-characters"] ? Number(options["max-prompt-characters"]) : null,
    });
  } else if (command === "import-preview") {
    result = await previewImport(client, options);
  } else if (command === "import-apply") {
    result = await applyImport(client, options);
  } else if (command === "export") {
    result = await rpc(client, "export_assisted_pilot_data", {
      p_organization_id: required(options, "organization-id"),
    });
    const outputPath = path.resolve(required(options, "output"));
    await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
    result = { output: outputPath, format: result.format, organization: result.organization };
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

run().catch(async (error) => {
  try {
    await recordPilotFailure(activeOperation.client, {
      classification: classifyAdminFailure(error),
      command: activeOperation.command,
      correlationId: activeOperation.correlationId,
      organizationId: activeOperation.organizationId,
    });
  } catch {
    // Failure recording is best-effort and must not mask the original action failure.
  }
  process.stderr.write(`Pilot admin command failed [${activeOperation.correlationId}]: ${error.message}\n`);
  process.exitCode = 1;
});
