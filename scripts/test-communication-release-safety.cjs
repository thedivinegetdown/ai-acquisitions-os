// Narrow PostgreSQL installation proof. Refuses non-local or non-disposable
// targets. All fixtures are synthetic; no production configuration is read.
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { assertSafeTarget } = require("./test-local-database-rls.cjs");

const root = path.resolve(__dirname, "..");
const org = "10000000-0000-0000-0000-00000000000a";
const research = "e2500000-0000-0000-0000-000000000001";
const active = "e2500000-0000-0000-0000-000000000002";
const completed = "e2500000-0000-0000-0000-000000000003";
const evidence = JSON.stringify([{ evidenceId: "synthetic-preserve", fact: "Research must remain unchanged" }]);
const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
const migration = readFileSync(path.join(root,
  "supabase/migrations/202610250001_enforce_research_only_communication_safety.sql"), "utf8");
const boundary = migration.indexOf("create or replace function public.enforce_active_acquisition_sequence_mutation()");
assert(boundary > 0);
const prefix = migration.slice(0, boundary);
const suffix = migration.slice(boundary);

async function main() {
  const target = assertSafeTarget(process.env.EO_VAL_DATABASE_URL_A, process.env.ALLOW_LOCAL_DB_TESTS);
  const executable = process.env.PSQL_BIN || "psql";
  const env = { ...process.env, ...target.env, PGOPTIONS: "-c statement_timeout=15000 -c lock_timeout=12000" };
  const args = ["-X", "--no-psqlrc", "-qAt", "-v", "ON_ERROR_STOP=1"];
  function sql(command, failure = false) {
    const result = spawnSync(executable, args, { env, cwd: root, encoding: "utf8", input: command });
    if (result.error) throw result.error;
    if (!failure) assert.equal(result.status, 0, result.stderr);
    return result;
  }
  const sessions = [];
  function session(name, command, close = true) {
    const child = spawn(executable, args, { env: { ...env, PGAPPNAME: name }, cwd: root });
    const result = { child, stdout: "", stderr: "", closed: false };
    result.done = new Promise((resolve, reject) => {
      child.on("error", reject);
      child.stdout.on("data", (chunk) => { result.stdout += chunk; });
      child.stderr.on("data", (chunk) => { result.stderr += chunk; });
      child.on("close", (status) => { result.closed = true; resolve({ ...result, status }); });
    });
    sessions.push(result);
    child.stdin.write(command + "\n");
    if (close) child.stdin.end();
    return result;
  }
  async function until(predicate, label) {
    const start = Date.now();
    while (!predicate()) {
      assert(Date.now() - start < 10000, `Timed out: ${label}`);
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  }
  const waitMarker = (s, marker) => until(() => s.stdout.includes(marker), marker);
  const waitLock = (name) => until(() => sql(
    `select exists(select 1 from pg_stat_activity where application_name=${quote(name)} and wait_event_type='Lock');`
  ).stdout.trim() === "t", `lock wait ${name}`);
  const objects = () => sql(`select count(*) from pg_proc where pronamespace='public'::regnamespace
    and proname in ('enforce_active_acquisition_sequence_mutation','enforce_research_only_scope_transition');`).stdout.trim();
  const fingerprint = () => sql(`select md5(string_agg(value, '' order by value)) from (
    select 'deal:' || to_jsonb(d)::text value from deals d
    union all select 'sequence:' || to_jsonb(s)::text from sequences s
  ) rows;`).stdout.trim();
  const policyFingerprint = () => sql(`select md5(string_agg(value, '' order by value)) from (
    select 'policy:' || policyname || ':' || coalesce(qual,'') || ':' || coalesce(with_check,'') value
    from pg_policies where schemaname='public'
    union all select relname || ':' || relrowsecurity::text || ':' || relforcerowsecurity::text
    from pg_class where relnamespace='public'::regnamespace and relkind='r'
  ) policies;`).stdout.trim();
  const insert = (id = research) => `insert into sequences (organization_id, deal_id, step_day, action_type)
    values ('${org}', '${id}', 0, 'Text');`;
  const reset = () => sql(`
    drop schema public cascade; create schema public;
    create table organizations (id uuid primary key);
    create table deals (id uuid primary key, organization_id uuid not null references organizations(id),
      operating_scope text not null default 'active_acquisition', research_evidence jsonb,
      unique(id, organization_id));
    create table sequences (id uuid primary key default gen_random_uuid(), organization_id uuid not null,
      deal_id uuid not null, step_day integer not null, action_type text not null,
      status text not null default 'Pending', due_date date, updated_at timestamptz default now(),
      foreign key(deal_id, organization_id) references deals(id, organization_id));
    insert into organizations values ('${org}');
    insert into deals values
      ('${research}', '${org}', 'research_only', ${quote(evidence)}::jsonb),
      ('${active}', '${org}', 'active_acquisition', ${quote(evidence)}::jsonb);
    insert into sequences (id, organization_id, deal_id, step_day, action_type, status)
      values ('${completed}', '${org}', '${research}', 0, 'Email', 'Completed');
  `);
  const rejected = async (s, pattern) => {
    const result = await s.done;
    assert.notEqual(result.status, 0, "Unsafe write succeeded");
    assert.match(result.stderr, pattern);
  };

  assert.equal(sql("select count(*) from pg_tables where schemaname='public'").stdout.trim(), "0",
    "Requires an empty disposable database");
  sql(`do $$ begin
    if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
    if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  end $$;`);
  try {
    reset();
    const earlyWriter = session("comm_early_writer", `begin; ${insert()} select 'early_ready';`, false);
    await waitMarker(earlyWriter, "early_ready");
    const waitingMigration = session("comm_waiting_migration", migration);
    await waitLock("comm_waiting_migration");
    earlyWriter.child.stdin.end("commit;\n");
    assert.equal((await earlyWriter.done).status, 0);
    await rejected(waitingMigration, /Research-only deals have actionable outreach sequences/);
    assert.equal(objects(), "0");
    assert.equal(sql("select count(*) from sequences").stdout.trim(), "2");
    console.log("PASS earlier writer commits before lock acquisition; fresh audit rejects conflict and installs nothing");

    reset();
    sql(insert(active));
    const before = fingerprint();
    const policiesBefore = policyFingerprint();
    const installing = session("comm_installing", prefix + "select 'audit_complete_locks_held';", false);
    await waitMarker(installing, "audit_complete_locks_held");
    assert.equal(sql(`select count(*) from pg_locks l join pg_stat_activity a on a.pid=l.pid
      where a.application_name='comm_installing' and l.mode='ShareRowExclusiveLock'
      and l.granted and l.relation in ('deals'::regclass,'sequences'::regclass);`).stdout.trim(), "2");
    assert.equal(objects(), "0", "Uncommitted guard became visible");
    const writers = [
      session("comm_during_insert", `begin; ${insert()} commit;`),
      session("comm_during_reactivate", `begin; update sequences set status='Pending' where id='${completed}'; commit;`),
      session("comm_during_scope", `begin; update deals set operating_scope='research_only' where id='${active}'; commit;`),
    ];
    for (const name of ["comm_during_insert", "comm_during_reactivate", "comm_during_scope"]) await waitLock(name);
    assert.equal(fingerprint(), before, "Blocked writes changed data");
    installing.child.stdin.end(suffix);
    assert.equal((await installing.done).status, 0);
    await rejected(writers[0], /Outreach sequences are disabled/);
    await rejected(writers[1], /Outreach sequences are disabled/);
    await rejected(writers[2], /Complete actionable outreach sequences/);
    assert.equal(fingerprint(), before, "Rejected writes changed history/evidence");
    assert.equal(policyFingerprint(), policiesBefore, "RLS or policies changed");
    console.log("PASS concurrent old-client insert, reactivation, and scope-change COMMIT attempts wait through installation and reject after COMMIT");
    sql(insert(active));
    console.log("PASS active-acquisition insertion remains supported");
    const crossTenant = sql(`insert into sequences (organization_id,deal_id,step_day,action_type)
      values ('10000000-0000-0000-0000-00000000000b','${active}',0,'Text');`, true);
    assert.notEqual(crossTenant.status, 0);
    assert.match(crossTenant.stderr, /selected organization/);
    console.log("PASS cross-tenant relationship denied without changing tenant policies");

    reset();
    const preFailure = fingerprint();
    // Local fault injection between guard creation and COMMIT; production SQL
    // is never modified by this harness.
    const failedInstall = sql(migration.replace(/commit;\s*$/i, "select 1/0; commit;"), true);
    assert.notEqual(failedInstall.status, 0);
    assert.match(failedInstall.stderr, /division by zero/);
    assert.equal(objects(), "0");
    assert.equal(sql("select count(*) from pg_trigger where not tgisinternal").stdout.trim(), "0");
    assert.equal(fingerprint(), preFailure);
    console.log("PASS failure after both trigger definitions rolls back all guards and preserves history/evidence");

    reset();
    const beforeExact = fingerprint();
    sql(migration); // Unmodified exact migration, including its own BEGIN/COMMIT.
    assert.equal(objects(), "2");
    assert.equal(fingerprint(), beforeExact);
    assert.equal(sql("select count(*) from pg_trigger where not tgisinternal and tgenabled='O'").stdout.trim(), "2");
    console.log("PASS exact-file transaction installs both enabled guards with historical/evidence fingerprints unchanged");
  } finally {
    for (const s of sessions) {
      if (!s.closed) { s.child.stdin.destroy(); s.child.kill(); }
    }
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
