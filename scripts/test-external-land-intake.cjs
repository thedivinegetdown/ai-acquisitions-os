// Synthetic local PostgreSQL acceptance for the external land vertical slice.
// Consumes the actual payload emitted by the focused intake-service test.
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { assertSafeTarget, listMigrations } = require("./test-local-database-rls.cjs");
const root = path.resolve(__dirname, "..");
const orgA = "10000000-0000-0000-0000-00000000000a";
const orgB = "10000000-0000-0000-0000-00000000000b";
const userA = "aaaaaaaa-0000-0000-0000-000000000001";
const userB = "bbbbbbbb-0000-0000-0000-000000000001";
const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";

async function main() {
  const target = assertSafeTarget(process.env.EO_VAL_DATABASE_URL_A, process.env.ALLOW_LOCAL_DB_TESTS);
  const env = { ...process.env, ...target.env, PGOPTIONS: "-c statement_timeout=15000" };
  for (const key of ["PGSERVICE", "PGSERVICEFILE", "PGPASSFILE"]) delete env[key];
  const bin = process.env.PSQL_BIN || "psql";
  const args = ["-X", "--no-psqlrc", "-qAt", "-v", "ON_ERROR_STOP=1"];
  function sql(command, failure = false) {
    const result = spawnSync(bin, args, { cwd: root, env, input: command, encoding: "utf8" });
    if (result.error) throw result.error;
    if (!failure) assert.equal(result.status, 0, result.stderr);
    return result;
  }
  function concurrent(command) {
    return new Promise((resolve, reject) => {
      const child = spawn(bin, args, { cwd: root, env });
      let stdout = "", stderr = "";
      child.on("error", reject);
      child.stdout.on("data", (data) => { stdout += data; });
      child.stderr.on("data", (data) => { stderr += data; });
      child.on("close", (status) => resolve({ status, stdout, stderr }));
      child.stdin.end(command);
    });
  }
  const asUser = (command, user = userA) => `begin; set local role authenticated; select set_config('request.jwt.claim.sub', '${user}', true); ${command}; commit;`;
  const fixture = JSON.parse(readFileSync(process.env.EXTERNAL_LAND_LOCAL_FIXTURE_FILE, "utf8"));
  assert.equal(fixture.payload.operating_scope, "research_only");
  const payload = { ...fixture.payload, research_evidence: fixture.payload.research_evidence.map((entry) => ({ ...entry, organizationId: orgA })) };
  const identity = fixture.verifiedPropertyIdentity;
  const admit = (suffix, overrides = {}, org = orgA, parcel = identity.authoritativeParcelId) => `select public.admit_verified_property_deal('${org}', '${identity.jurisdiction}', '${parcel}', '${identity.verificationSource}', '${identity.verifiedAt}', ${quote(JSON.stringify({ ...payload, import_id: `external-land:local:${suffix}`, ...overrides }))}::jsonb)`;
  assert.equal(sql("select count(*) from pg_tables where schemaname='public'").stdout.trim(), "0", "Refusing a nonempty test database");
  sql(readFileSync(path.join(root, "supabase/tests/eo_val_01_platform.sql"), "utf8"));
  for (const file of listMigrations()) sql(readFileSync(file, "utf8"));
  sql(readFileSync(path.join(root, "supabase/tests/eo_val_01_seed.sql"), "utf8"));
  sql(readFileSync(path.join(root, "supabase/security/activate_rls.sql"), "utf8"));
  const parseAdmission = (result) => JSON.parse(result.stdout.trim().split("\n").at(-1));
  // Compete on the actual service-produced parcel before either deal exists.
  const initial = await Promise.all([
    concurrent(asUser(admit("first") + ";select pg_sleep(0.2)")),
    concurrent(asUser(admit("second-path", { source: "manual-verified-parcel" }))),
  ]);
  for (const result of initial) assert.equal(result.status, 0, result.stderr);
  const admissions = initial.map(parseAdmission);
  assert.deepEqual(admissions.map((result) => result.status).sort(), ["existing", "imported"]);
  const first = admissions.find((result) => result.status === "imported");
  assert.equal(admissions[0].deal.id, admissions[1].deal.id);
  const deal = first.deal;
  assert.equal(deal.operating_scope, "research_only");
  assert.equal(deal.asset_type, "vacant-residential-land");
  for (const field of ["owner_name", "seller_name", "phone", "email", "seller_email", "asking_price", "price", "arv", "repairs", "motivation", "seller_timeline", "zoning", "acreage"]) assert.equal(deal[field], null, field);
  assert.deepEqual(deal.research_evidence, payload.research_evidence);
  const before = sql(`select md5(to_jsonb(d)::text) from public.deals d where id='${deal.id}'`).stdout.trim();
  const duplicate = parseAdmission(sql(asUser(admit("second-path", { source: "manual-verified-parcel" }))));
  assert.equal(duplicate.status, "existing");
  assert.equal(duplicate.deal.id, deal.id);
  assert.equal(sql(`select md5(to_jsonb(d)::text) from public.deals d where id='${deal.id}'`).stdout.trim(), before, "Duplicate must not overwrite facts/evidence");
  const results = await Promise.all([
    concurrent(asUser(admit("concurrent-a") + ";select pg_sleep(0.2)")),
    concurrent(asUser(admit("concurrent-b"))),
  ]);
  for (const result of results) { assert.equal(result.status, 0, result.stderr); assert.equal(parseAdmission(result).deal.id, deal.id); }
  assert.equal(sql(`select count(*) from public.deals where organization_id='${orgA}' and authoritative_parcel_id='${identity.authoritativeParcelId}'`).stdout.trim(), "1");
  assert.equal(sql(`select count(*) from public.deal_intake_sources where deal_id='${deal.id}'`).stdout.trim(), "4");
  console.log("PASS actual service payload: unknown seller/finances, research-only land, atomic evidence, independent sources, first-save concurrency");

  const cross = sql(asUser(admit("foreign", {}, orgB)), true);
  assert.notEqual(cross.status, 0);
  const other = parseAdmission(sql(asUser(admit("other-tenant", {}, orgB), userB)));
  assert.notEqual(other.deal.id, deal.id);
  assert.equal(sql(asUser(`select count(*) from public.deals where id='${deal.id}'`, userB)).stdout.trim().split("\n").at(-1), "0");
  assert.equal(sql(asUser(`select count(*) from public.deal_intake_sources where deal_id='${deal.id}'`, userB)).stdout.trim().split("\n").at(-1), "0");
  const foreignAppend = sql(asUser(`update public.deals set research_revision=1 where id='${deal.id}' returning id`, userB));
  assert(!foreignAppend.stdout.includes(deal.id));
  console.log("PASS real tenant RLS: foreign admission rejected, foreign deals/sources invisible, foreign evidence update affects zero rows, independent same-parcel tenant");

  const evidence = [...deal.research_evidence, { ...deal.research_evidence[0], evidenceId: "explicit-append-fixture" }];
  const append = `update public.deals set research_evidence=${quote(JSON.stringify(evidence))}::jsonb, research_revision=1 where id='${deal.id}' and organization_id='${orgA}' and research_revision=0 returning id`;
  assert(sql(asUser(append)).stdout.includes(deal.id));
  assert(!sql(asUser(append)).stdout.includes(deal.id), "Stale append must not overwrite a newer revision");
  assert.equal(sql(`select owner_name is null and asking_price is null and operating_scope='research_only' and jsonb_array_length(research_evidence)=${evidence.length} from public.deals where id='${deal.id}'`).stdout.trim(), "t");
  const failed = sql(asUser(admit("invalid", { asking_price: "invalid-numeric" }, orgA, "9999999")), true);
  assert.notEqual(failed.status, 0);
  assert.equal(sql("select count(*) from public.property_identities where authoritative_parcel_id='9999999'").stdout.trim(), "0");
  assert.equal(sql("select count(*) from public.deal_intake_sources where import_id='external-land:local:invalid'").stdout.trim(), "0");
  console.log("PASS explicit append CAS preserves facts; failed admission rolls back identity/deal/source/evidence atomically");
  console.log("External land disposable PostgreSQL acceptance PASS; no production access or provider calls.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
