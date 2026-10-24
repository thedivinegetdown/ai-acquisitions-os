// Narrow, disposable PostgreSQL proof for legacy admission and retained-schema rollback.
// Requires the existing local-only target contract; never reads production settings.
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync, execFileSync } = require("node:child_process");
const { assertSafeTarget, listMigrations } = require("./test-local-database-rls.cjs");

const root = path.resolve(__dirname, "..");
const servingHead = "3ee559bb90c3b5039c6ec247d1cf3478b4299271";
const org = "10000000-0000-0000-0000-00000000000a";
const user = "aaaaaaaa-0000-0000-0000-000000000001";
const migrationName = "202610150001_add_canonical_property_identity.sql";
const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const gitSource = (file) => execFileSync("git", ["show", `${servingHead}:${file}`], { cwd: root, encoding: "utf8" });

async function main() {
  const target = assertSafeTarget(process.env.EO_VAL_DATABASE_URL_A, process.env.ALLOW_LOCAL_DB_TESTS);
  const env = { ...process.env, ...target.env, PGOPTIONS: "-c statement_timeout=15000", PGAPPNAME: "property_guard_local" };
  const executable = process.env.PSQL_BIN || "psql";
  const args = ["-X", "--no-psqlrc", "-qAt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"];
  function sql(command, { failure = false, file } = {}) {
    const result = spawnSync(executable, args, { env, cwd: root, encoding: "utf8", input: file ? readFileSync(file, "utf8") : command });
    if (result.error) throw result.error;
    if (!failure) assert.equal(result.status, 0, result.stderr);
    return result;
  }
  function asyncSql(command, applicationName = "property_guard_local", onOutput = () => {}) {
    const child = spawn(executable, args, { env: { ...env, PGAPPNAME: applicationName }, cwd: root });
    let stdout = "", stderr = "";
    const done = new Promise((resolve, reject) => {
      child.on("error", reject);
      child.stdout.on("data", (chunk) => { stdout += chunk; onOutput(stdout); });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.on("close", (status) => resolve({ status, stdout, stderr }));
    });
    child.stdin.end(command);
    return done;
  }
  const asOwner = (command) => `begin; set local role authenticated; select set_config('request.jwt.claim.sub', '${user}', true); ${command}; commit;`;
  function expectGuard(command, label) {
    const result = sql(asOwner(command), { failure: true });
    assert.notEqual(result.status, 0, `${label}: unsafe write succeeded`);
    assert.match(result.stderr, /23514:/, `${label}: wrong rejection: ${result.stderr}`);
    console.log(`PASS ${label}`);
    return result;
  }
  function insert(payload) {
    const columns = Object.keys(payload);
    assert(columns.every((column) => /^[a-z_]+$/.test(column)));
    return `insert into public.deals (${columns.join(",")}) select ${columns.join(",")} from jsonb_populate_record(null::public.deals, ${quote(JSON.stringify(payload))}::jsonb) returning id`;
  }
  function admission(parcel, importId, extra = {}) {
    const payload = { source: "orange-county-tax-sale", parcel_number: parcel, research_evidence: evidence, stage: "New Lead", import_id: importId, ...extra };
    return `select public.admit_verified_property_deal('${org}', 'us-fl-orange-county', '${parcel}', 'orange-county-property-appraiser', '2026-10-15T12:00:00Z', ${quote(JSON.stringify(payload))}::jsonb)`;
  }
  const normalization = gitSource("src/services/leadIntake/leadNormalizationService.js");
  // Execute the actual serving serializer's county branch, including its import ID.
  const toLegacyPayload = new Function(normalization.slice(normalization.indexOf("export function toDealPreviewPayload")).replaceAll(/^export /gm, "") + "; return toDealImportPayload;")();
  const evidence = [
    { sourceSystem: "orange-county-tax-sale", verificationState: "unverified", sourceRecordId: "synthetic-case" },
    { sourceSystem: "orange-county-property-appraiser", verificationState: "verified", sourceRecordId: "synthetic-parcel", provenanceDetails: { parcelId: "302430266507203" } },
  ];
  const legacy = { ...toLegacyPayload({ countyResearch: true, leadSource: "orange-county-tax-sale", tdaNumber: "synthetic-case", parcelNumber: "30-24-30-2665-07-203", propertyAddress: "Synthetic legacy county fixture", researchEvidence: evidence }), organization_id: org };

  assert.equal(sql("select count(*) from pg_tables where schemaname='public'").stdout.trim(), "0", "Disposable database must be empty");
  sql(null, { file: path.join(root, "supabase/tests/eo_val_01_platform.sql") });
  for (const migration of listMigrations().filter((file) => path.basename(file) !== migrationName)) sql(null, { file: migration });
  sql(null, { file: path.join(root, "supabase/tests/eo_val_01_seed.sql") });
  const fixture = (id, stage, parcel = legacy.parcel_number) => ({ ...legacy, id, stage, parcel_number: parcel, import_id: `guard-history:${id}` });
  const closedId = "e0000000-0000-0000-0000-000000000011";
  const deadId = "e0000000-0000-0000-0000-000000000012";
  const unbackfilledId = "e0000000-0000-0000-0000-000000000013";
  const conflictId = "e0000000-0000-0000-0000-000000000014";
  const conflictId2 = "e0000000-0000-0000-0000-000000000015";
  sql([fixture(closedId, "Closed"), fixture(deadId, "Dead Lead"), fixture(unbackfilledId, "Closed", null), fixture(conflictId, "New Lead"), fixture(conflictId2, "New Lead")].map(insert).join(";"));
  const before = sql("select md5(string_agg(to_jsonb(d)::text, '' order by id)) from public.deals d").stdout.trim();
  const migration = readFileSync(path.join(root, "supabase/migrations", migrationName), "utf8");
  const conflict = sql(migration, { failure: true });
  assert.notEqual(conflict.status, 0);
  assert.match(conflict.stderr, /active verified parcel conflict/);
  assert.equal(sql("select to_regclass('public.property_identities') is null and not exists(select 1 from pg_attribute where attrelid='public.deals'::regclass and attname='authoritative_parcel_id' and not attisdropped)").stdout.trim(), "t");
  assert.equal(sql("select md5(string_agg(to_jsonb(d)::text, '' order by id)) from public.deals d").stdout.trim(), before);
  console.log("PASS conflict abort rolls back the entire foundation and preserves every fixture");
  // Synthetic local disposition only; production is never a target of this runner.
  sql(`delete from public.deals where id in ('${conflictId}', '${conflictId2}')`);

  let waitingWrite;
  let transitionObservation;
  let observedLock = false;
  const migrated = await asyncSql(migration.replace(/commit;\s*$/i, "select 'guard_installed_before_commit'; select pg_sleep(2); commit;"), "property_guard_migration", (output) => {
    if (waitingWrite || !output.includes("guard_installed_before_commit")) return;
    waitingWrite = asyncSql(insert({ ...legacy, import_id: "guard:transition" }) + ";", "property_guard_transition");
    transitionObservation = (async () => {
      const visibility = await asyncSql("select to_regclass('public.property_identities') is null");
      assert.equal(visibility.status, 0, visibility.stderr);
      assert.equal(visibility.stdout.trim(), "t", "Foundation must not be visible before the guard transaction commits");
      for (let attempt = 0; attempt < 10; attempt++) {
        const lock = await asyncSql("select count(*) from pg_stat_activity where application_name='property_guard_transition' and wait_event_type='Lock'");
        assert.equal(lock.status, 0, lock.stderr);
        if (lock.stdout.trim() === "1") {
          observedLock = true;
          break;
        }
      }
    })();
  });
  assert.equal(migrated.status, 0, migrated.stderr);
  assert(waitingWrite, "Transition write must be submitted before migration commits");
  const transition = await waitingWrite;
  await transitionObservation;
  assert.notEqual(transition.status, 0);
  assert.match(transition.stderr, /23514:/);
  assert(observedLock, "Legacy writer must wait on the migration lock until the guard commits");
  assert.equal(sql("select tgdeferrable and tginitdeferred from pg_trigger where tgname='deals_verified_property_admission_guard'").stdout.trim(), "t");
  console.log("PASS foundation and guard commit atomically; pre-commit submitted legacy write is rejected");
  sql(null, { file: path.join(root, "supabase/security/activate_rls.sql") });

  expectGuard(insert(legacy), "actual serving payload with omitted canonical fields");
  expectGuard(insert({ ...legacy, property_jurisdiction: null, authoritative_parcel_id: null }), "explicit NULL canonical fields");
  expectGuard(insert({ ...legacy, parcel_number: null }), "verified source cannot downgrade through a missing parcel");
  expectGuard(insert({ ...legacy, property_jurisdiction: "us-fl-orange-county", authoritative_parcel_id: "302430266507203" }), "copied canonical columns without admission/source history");
  const crossTenant = sql(asOwner(insert({ ...legacy, organization_id: "10000000-0000-0000-0000-00000000000b" })), { failure: true });
  assert.notEqual(crossTenant.status, 0);
  assert.match(crossTenant.stderr, /42501:/);
  const directTrigger = sql(asOwner("select public.enforce_verified_property_admission()"), { failure: true });
  assert.notEqual(directTrigger.status, 0);
  assert.match(directTrigger.stderr, /trigger functions can only be called as triggers/);
  console.log("PASS row-bound trigger adds no callable admission path and does not bypass tenant RLS");

  sql(asOwner(admission("302430266507203", "guard:canonical")));
  sql(asOwner(admission("302430266507203", "guard:duplicate")));
  assert.equal(sql(`select count(*) from public.deals where organization_id='${org}' and authoritative_parcel_id='302430266507203' and stage='New Lead'`).stdout.trim(), "1");
  assert.equal(sql(`select count(*) from public.deal_intake_sources where import_id in ('guard:canonical','guard:duplicate') and organization_id='${org}'`).stdout.trim(), "2");
  console.log("PASS canonical admission and duplicate preserve tenant identity and independent sources");
  sql(asOwner(admission("302430266507205", "guard:other-property")));
  const activeWhere = `organization_id='${org}' and import_id='guard:canonical'`;
  expectGuard(`update public.deals set property_jurisdiction=null, authoritative_parcel_id=null, source='manual', research_evidence='[]' where ${activeWhere}`, "identity/evidence removal cannot downgrade an established property");
  // Close the other property so neither a missing FK nor active uniqueness can
  // mask the guard's identity-immutability rejection.
  sql(asOwner("update public.deals set stage='Closed' where import_id='guard:other-property'"));
  expectGuard(`update public.deals set authoritative_parcel_id='302430266507205' where ${activeWhere}`, "established property cannot be reassigned");
  expectGuard(`update public.deals set parcel_number='30-24-30-2665-07-204' where ${activeWhere}`, "covered parcel cannot diverge from canonical identity");
  sql(asOwner(`update public.deals set notes='retained history' where id in ('${closedId}','${deadId}','${unbackfilledId}')`));
  const reactivation = sql(asOwner(`update public.deals set stage='New Lead' where id='${closedId}'`), { failure: true });
  assert.notEqual(reactivation.status, 0);
  assert.match(reactivation.stderr, /23505:/);
  expectGuard(`update public.deals set stage='New Lead', source='manual', research_evidence='[]' where id='${unbackfilledId}'`, "unbackfilled terminal cannot reactivate by stripping verification");
  expectGuard(`update public.deals set property_jurisdiction=null, authoritative_parcel_id=null where id='${deadId}'`, "terminal identities cannot be removed");
  sql(asOwner(`update public.deals set stage='Dead Lead' where ${activeWhere}`));
  sql(asOwner(`update public.deals set stage='New Lead' where id='${closedId}'`));
  sql(asOwner(`update public.deals set stage='Closed' where id='${closedId}'`));
  sql(asOwner(admission("302430266507203", "guard:after-close")));
  assert.equal(sql(`select count(*) from public.deals where id in ('${closedId}','${deadId}','${unbackfilledId}')`).stdout.trim(), "3");
  sql(asOwner(insert({ organization_id: org, source: "manual", property_address: "Unknown property", stage: "New Lead" })));
  sql(asOwner(insert({ organization_id: org, source: "manual", property_address: "Unknown property", stage: "New Lead" })));
  sql(asOwner(insert({ organization_id: org, source: "orange-county-tax-sale", parcel_number: legacy.parcel_number, research_evidence: [evidence[0]], stage: "New Lead" })));
  expectGuard(`update public.deals set source='orange-county-tax-sale', parcel_number=${quote(legacy.parcel_number)}, research_evidence=${quote(JSON.stringify(evidence))}::jsonb where property_address='Unknown property'`, "unverified update cannot acquire covered verification without canonical admission");
  console.log("PASS updates/reactivation enforce identity and uniqueness; terminal history and unverified leads remain supported");

  const concurrent = await Promise.all([
    asyncSql(asOwner(admission("302430266507204", "guard:concurrent:a") + ";select pg_sleep(0.2)")),
    asyncSql(asOwner(admission("302430266507204", "guard:concurrent:b"))),
    asyncSql(asOwner(insert({ ...legacy, parcel_number: "302430266507204", import_id: "guard:concurrent:legacy" }))),
  ]);
  assert.equal(concurrent[0].status, 0, concurrent[0].stderr);
  assert.equal(concurrent[1].status, 0, concurrent[1].stderr);
  assert.notEqual(concurrent[2].status, 0);
  assert.match(concurrent[2].stderr, /23514:/);
  assert.equal(sql(`select count(*) from public.deals where organization_id='${org}' and authoritative_parcel_id='302430266507204'`).stdout.trim(), "1");
  assert.equal(sql("select count(*) from public.deal_intake_sources where import_id in ('guard:concurrent:a','guard:concurrent:b')").stdout.trim(), "2");
  console.log("PASS real concurrent canonical callers create one deal/two sources; concurrent legacy write fails");

  let attempts = 0;
  const repository = gitSource("src/services/repositories/dealRepository.js");
  const persistLegacy = new Function("supabase", "requireActiveOrganizationContext", "stripOrganizationOwnership", "runRepositoryOperation", "repositorySuccess", "repositoryFailure", "recordOperationalFailure", repository.slice(repository.indexOf("export async function persistImportedDeals")).replace(/^export /, "") + ";return persistImportedDeals;")(
    { from: () => ({ insert: (payload) => ({ select: () => ({ limit: async () => {
      attempts++;
      const result = sql(asOwner(insert(payload)), { failure: true });
      assert.notEqual(result.status, 0);
      return { data: null, error: { code: result.stderr.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1], message: "local guard rejection" } };
    } }) }) }) },
    async () => ({ organizationId: org }),
    (payload) => Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "organization_id")),
    async (operation) => operation(), (data) => ({ success: true, data }), () => ({ success: false }), async () => {},
  );
  const result = await persistLegacy([{ rowNumber: 1, payload: legacy }]);
  assert.equal(result.data.importedCount, 0);
  assert.equal(result.data.failedCount, 1);
  assert.equal(result.data.duplicateCount, 0);
  assert.equal(result.data.results[0].status, "failed");
  assert.equal(attempts, 1, "Serving caller must not retry through an unsafe path");
  const ui = gitSource("src/components/LeadImporter.jsx");
  assert.match(ui, /if \(!saved\?\.id\)/);
  assert.match(ui, /The research lead was not confirmed as saved/);
  assert.match(ui, /if \(result\.data\.failedCount > 0\) setConfirmationError/);
  console.log("PASS actual serving caller classifies guard rejection as failed, without retry; UI does not report a saved lead");
  console.log("Canonical admission guard: focused disposable PostgreSQL proof PASS. No full suite/build or production access.");
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
