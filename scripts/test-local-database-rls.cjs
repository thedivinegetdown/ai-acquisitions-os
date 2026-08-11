const { readdirSync } = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const migrationsDirectory = path.join(root, "supabase", "migrations");
const activationFile = path.join(root, "supabase", "security", "activate_rls.sql");
const testsDirectory = path.join(root, "supabase", "tests");
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

function listMigrations() {
  return readdirSync(migrationsDirectory)
    .filter((name) => /^\d{12}_[a-z0-9_]+\.sql$/.test(name))
    .sort()
    .map((name) => path.join(migrationsDirectory, name));
}

function assertSafeTarget(rawUrl, allowLocalTests) {
  if (allowLocalTests !== "true") {
    throw new Error("Set ALLOW_LOCAL_DB_TESTS=true to run destructive test-database validation.");
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("A valid local PostgreSQL URL is required.");
  }

  if (!new Set(["postgres:", "postgresql:"]).has(parsed.protocol)) {
    throw new Error("Only PostgreSQL URLs are accepted.");
  }
  if (!localHosts.has(parsed.hostname.toLowerCase())) {
    throw new Error("EO-VAL-01 refuses every non-local database host.");
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!/^eo_val_[a-z0-9_]+$/.test(database)) {
    throw new Error("The database name must start with eo_val_.");
  }

  return {
    database,
    env: {
      PGDATABASE: database,
      PGHOST: parsed.hostname,
      PGPASSWORD: decodeURIComponent(parsed.password),
      PGPORT: parsed.port || "5432",
      PGSSLMODE: "disable",
      PGUSER: decodeURIComponent(parsed.username),
    },
  };
}

function psql(target, { capture = false, expectFailure = false, file, label, sql } = {}) {
  const executable = process.env.PSQL_BIN || "psql";
  const args = ["-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1"];
  if (capture) args.push("--no-align", "--tuples-only");
  if (file) args.push("--file", file);
  if (sql) args.push("--command", sql);

  const result = spawnSync(executable, args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...target.env },
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  if (result.error?.code === "ENOENT") {
    throw new Error("psql is required but was not found. Install PostgreSQL client tooling first.");
  }
  if (expectFailure && result.status === 0) {
    throw new Error(`${label || "Expected SQL failure"} unexpectedly succeeded.`);
  }
  if (!expectFailure && result.status !== 0) {
    const detail = capture ? String(result.stderr || "").trim() : "";
    throw new Error(`${label || "SQL command"} failed.${detail ? ` ${detail}` : ""}`);
  }
  return String(result.stdout || "").trim();
}

function assertEmpty(target) {
  const count = psql(target, {
    capture: true,
    label: "Clean database check",
    sql: "select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p');",
  });
  if (count !== "0") {
    throw new Error(`${target.database} is not empty; refusing to modify it.`);
  }
}

function activationMustFail(target, label) {
  psql(target, { expectFailure: true, file: activationFile, label });
  psql(target, {
    label: `${label} rollback verification`,
    sql: "do $$ begin if exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relrowsecurity) then raise exception 'RLS changed after blocked activation'; end if; end $$;",
  });
}

function exerciseActivationSafety(target) {
  const orgA = "10000000-0000-0000-0000-00000000000a";
  const orgBDeal = "20000000-0000-0000-0000-00000000000b";

  psql(target, {
    label: "Legacy null fixture",
    sql: "insert into public.deals (id, property_address) values ('e0000000-0000-0000-0000-000000000001', 'Synthetic legacy row');",
  });
  activationMustFail(target, "Missing ownership activation");
  psql(target, {
    label: "Explicit synthetic backfill",
    sql: `do $$ begin if not exists (select 1 from public.tenant_table_ownership_report() where subject='deals' and null_organization_count=1) then raise exception 'legacy null not detected'; end if; update public.deals set organization_id='${orgA}' where id='e0000000-0000-0000-0000-000000000001'; perform public.assert_tenant_rls_ready(); delete from public.deals where id='e0000000-0000-0000-0000-000000000001'; end $$;`,
  });

  psql(target, {
    label: "Orphan ownership fixture",
    sql: "alter table public.deals disable trigger all; insert into public.deals (id, organization_id, property_address) values ('e0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000099', 'Synthetic orphan'); alter table public.deals enable trigger all;",
  });
  activationMustFail(target, "Orphan organization activation");
  psql(target, { label: "Orphan cleanup", sql: "delete from public.deals where id='e0000000-0000-0000-0000-000000000002';" });

  psql(target, {
    label: "Ownerless organization fixture",
    sql: "insert into public.organizations (id, name) values ('10000000-0000-0000-0000-00000000000c', 'Synthetic ownerless organization');",
  });
  activationMustFail(target, "Ownerless organization activation");
  psql(target, { label: "Ownerless organization cleanup", sql: "delete from public.organizations where id='10000000-0000-0000-0000-00000000000c';" });

  psql(target, {
    label: "Cross-tenant child fixture",
    sql: `alter table public.message_logs disable trigger all; insert into public.message_logs (id, deal_id, organization_id, phone, message) values ('e0000000-0000-0000-0000-000000000003', '${orgBDeal}', '${orgA}', '5550000099', 'Synthetic cross tenant'); alter table public.message_logs enable trigger all;`,
  });
  activationMustFail(target, "Cross-tenant child activation");
  psql(target, { label: "Cross-tenant child cleanup", sql: "delete from public.message_logs where id='e0000000-0000-0000-0000-000000000003';" });

  psql(target, { label: "Missing policy fixture", sql: "drop policy deals_select_member on public.deals;" });
  activationMustFail(target, "Missing policy activation");
  psql(target, {
    label: "Missing policy restoration",
    sql: "create policy deals_select_member on public.deals for select to authenticated using (public.is_organization_member(organization_id));",
  });

  psql(target, { label: "Clean readiness assertion", sql: "select public.assert_tenant_rls_ready();" });
  psql(target, { file: activationFile, label: "Clean RLS activation" });
}

const fingerprintSql = `
select md5(string_agg(item, E'\\n' order by item))
from (
  select 'table:' || c.relname || ':rls=' || c.relrowsecurity as item
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p')
  union all
  select 'column:' || table_name || '.' || column_name || ':' || data_type || ':null=' || is_nullable
  from information_schema.columns where table_schema='public'
  union all
  select 'constraint:' || conname || ':' || pg_get_constraintdef(oid)
  from pg_constraint where connamespace='public'::regnamespace
  union all
  select 'index:' || indexname || ':' || indexdef from pg_indexes where schemaname='public'
  union all
  select 'policy:' || tablename || '.' || policyname || ':' || cmd || ':' || coalesce(qual,'') || ':' || coalesce(with_check,'')
  from pg_policies where schemaname='public'
) fingerprint;
`;

function validateTarget(target) {
  assertEmpty(target);
  psql(target, { file: path.join(testsDirectory, "eo_val_01_platform.sql"), label: "Local Supabase compatibility bootstrap" });
  for (const migration of listMigrations()) {
    psql(target, { file: migration, label: `Migration ${path.basename(migration)}` });
  }
  psql(target, { file: path.join(testsDirectory, "eo_val_01_schema.sql"), label: "Schema smoke checks" });
  psql(target, { file: path.join(testsDirectory, "eo_val_01_seed.sql"), label: "Synthetic tenant bootstrap" });
  exerciseActivationSafety(target);
  psql(target, { file: path.join(testsDirectory, "eo_val_01_rls.sql"), label: "Authenticated RLS assertions" });
  return psql(target, { capture: true, label: "Schema fingerprint", sql: fingerprintSql });
}

function main(env = process.env) {
  const targetA = assertSafeTarget(env.EO_VAL_DATABASE_URL_A, env.ALLOW_LOCAL_DB_TESTS);
  const targetB = assertSafeTarget(env.EO_VAL_DATABASE_URL_B, env.ALLOW_LOCAL_DB_TESTS);
  if (targetA.database === targetB.database) {
    throw new Error("Two distinct clean eo_val_ databases are required for rebuild comparison.");
  }

  const version = spawnSync(env.PSQL_BIN || "psql", ["--version"], { encoding: "utf8" });
  if (version.error?.code === "ENOENT") {
    throw new Error("psql is required but was not found. Install PostgreSQL client tooling first.");
  }

  const fingerprintA = validateTarget(targetA);
  const fingerprintB = validateTarget(targetB);
  if (!fingerprintA || fingerprintA !== fingerprintB) {
    throw new Error("Clean rebuild fingerprints differ.");
  }

  console.log(`EO-VAL-01 passed: ${listMigrations().length} migrations, two clean local databases, matching schema fingerprint.`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`EO-VAL-01 blocked or failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { assertSafeTarget, listMigrations, main };
