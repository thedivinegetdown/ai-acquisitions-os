const { readFileSync } = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

function assertSafeTarget(rawUrl, allow) {
  if (allow !== "true") throw new Error("Set ALLOW_LOCAL_DB_TESTS=true for disposable reconciliation validation.");
  const parsed = new URL(rawUrl);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !localHosts.has(parsed.hostname.toLowerCase())) {
    throw new Error("EO-PROD-02 accepts only a local PostgreSQL target.");
  }
  const database = decodeURIComponent(parsed.pathname.slice(1));
  if (!/^eo_prod_02_[a-z0-9_]+$/.test(database)) throw new Error("Database name must start with eo_prod_02_.");
  return { database, url: rawUrl };
}

function psql(target, args, input) {
  const result = spawnSync(process.env.PSQL_BIN || "psql", [target.url, "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", ...args], {
    cwd: root, encoding: "utf8", input, stdio: input === undefined ? "inherit" : ["pipe", "inherit", "inherit"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`psql failed with exit ${result.status}`);
}

function committedCandidate() {
  const file = path.join(root, "supabase", "security", "production_schema_reconciliation.sql");
  const source = readFileSync(file, "utf8");
  if (!/rollback;\s*$/i.test(source)) throw new Error("Reconciliation candidate must end in ROLLBACK.");
  return source.replace(/rollback;\s*$/i, "commit;\n");
}

function main(env = process.env) {
  const target = assertSafeTarget(env.EO_PROD_02_DATABASE_URL, env.ALLOW_LOCAL_DB_TESTS);
  const fixture = path.join(root, "supabase", "tests", "eo_prod_02_legacy_fixture.sql");
  const assertions = path.join(root, "supabase", "tests", "eo_prod_02_reconciliation_assertions.sql");
  psql(target, ["--command", "do $$ begin if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')) then raise exception 'target is not empty'; end if; end $$;"]);
  psql(target, ["--file", fixture]);
  const candidate = committedCandidate();
  psql(target, [], candidate);
  psql(target, ["--file", assertions]);
  psql(target, [], candidate);
  psql(target, ["--file", assertions]);
  console.log(`EO-PROD-02 passed on disposable database ${target.database}: reconciliation applied twice and synthetic rows were preserved.`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(`EO-PROD-02 blocked or failed: ${error.message}`); process.exitCode = 1; }
}

module.exports = { assertSafeTarget, committedCandidate, main };
