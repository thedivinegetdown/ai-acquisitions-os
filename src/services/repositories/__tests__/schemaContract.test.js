import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const repositoryRoot = process.cwd();
const migrationsDirectory = path.join(repositoryRoot, "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith(".sql"))
  .sort();
const migrationSql = migrationFiles
  .map((file) => readFileSync(path.join(migrationsDirectory, file), "utf8"))
  .join("\n")
  .toLowerCase();

const persistedTables = [
  "buyers",
  "comps",
  "deals",
  "documents",
  "message_logs",
  "organization_memberships",
  "seller_tasks",
  "sequences",
];

function tableDefinition(table) {
  const match = migrationSql.match(
    new RegExp(`create table if not exists public\\.${table} \\(([\\s\\S]*?)\\n\\);`)
  );

  return match?.[1] || "";
}

function expectColumns(table, columns) {
  const definition = tableDefinition(table);
  expect(definition, `${table} must have a committed create-table definition`).not.toBe("");

  columns.forEach((column) => {
    expect(definition, `${table}.${column} must be represented`).toMatch(
      new RegExp(`(^|\\n)\\s*${column}\\s+`, "m")
    );
  });
}

function queryTablesFrom(file) {
  const source = readFileSync(path.join(repositoryRoot, file), "utf8");
  return [...source.matchAll(/\.from\(["']([^"']+)["']\)/g)].map(
    (match) => match[1]
  );
}

describe("Supabase schema baseline", () => {
  it("keeps migration versions unique and deterministically ordered", () => {
    expect(migrationFiles).toEqual([...migrationFiles].sort());
    expect(new Set(migrationFiles.map((file) => file.slice(0, 12))).size).toBe(
      migrationFiles.length
    );
    migrationFiles.forEach((file) => {
      expect(file).toMatch(/^\d{12}_[a-z0-9_]+\.sql$/);
    });
  });

  it("defines every table queried by repositories and Supabase functions", () => {
    const repositoryFiles = readdirSync(
      path.join(repositoryRoot, "src", "services", "repositories")
    )
      .filter((file) => file.endsWith(".js"))
      .map((file) => `src/services/repositories/${file}`);
    const queryFiles = [
      ...repositoryFiles,
      "src/services/conversations/conversationRepository.js",
      "src/services/conversations/messageRepository.js",
      "netlify/functions/inbound-v2.cjs",
      "netlify/functions/send-sms.cjs",
    ];
    const queriedTables = [...new Set(queryFiles.flatMap(queryTablesFrom))].sort();

    expect(queriedTables).toEqual(persistedTables);
    queriedTables.forEach((table) => {
      expect(tableDefinition(table), `${table} is queried but not created`).not.toBe("");
    });
  });

  it("represents the high-value repository column contracts", () => {
    expectColumns("deals", [
      "id",
      "property_address",
      "owner_name",
      "phone",
      "email",
      "stage",
      "source",
      "price",
      "asking_price",
      "arv",
      "repairs",
      "next_action",
      "due_date",
      "assignment_fee",
      "closing_date",
      "created_at",
      "updated_at",
    ]);
    expectColumns("message_logs", [
      "id",
      "deal_id",
      "phone",
      "message",
      "status",
      "created_at",
    ]);
    expectColumns("seller_tasks", [
      "id",
      "deal_id",
      "phone",
      "title",
      "status",
      "due_at",
      "created_at",
    ]);
    expectColumns("buyers", [
      "id",
      "name",
      "email",
      "phone",
      "target_areas",
      "max_price",
      "notes",
      "created_at",
    ]);
    expectColumns("documents", [
      "id",
      "deal_id",
      "doc_type",
      "title",
      "url",
      "notes",
      "created_at",
    ]);
    expectColumns("comps", [
      "id",
      "deal_id",
      "address",
      "sale_price",
      "sqft",
      "beds",
      "baths",
      "created_at",
    ]);
    expectColumns("sequences", [
      "id",
      "deal_id",
      "step_day",
      "action_type",
      "due_date",
      "status",
      "created_at",
    ]);

    expect(migrationSql).toMatch(
      /alter table public\.message_logs\s+add column if not exists direction text/
    );
    expect(migrationSql).toMatch(
      /alter table public\.seller_tasks\s+add column if not exists updated_at timestamptz/
    );
  });

  it("captures proven relationships and query indexes without destructive cascades", () => {
    expect(tableDefinition("message_logs")).toMatch(
      /deal_id uuid references public\.deals \(id\) on delete set null/
    );
    ["documents", "comps", "sequences"].forEach((table) => {
      expect(tableDefinition(table)).toMatch(
        /deal_id uuid not null references public\.deals \(id\) on delete restrict/
      );
    });
    expect(migrationSql).toContain("seller_tasks_deal_id_fkey");
    [
      "deals_phone_idx",
      "message_logs_phone_created_at_idx",
      "message_logs_deal_created_at_idx",
      "documents_deal_created_at_idx",
      "comps_deal_created_at_idx",
      "sequences_deal_step_day_idx",
      "seller_tasks_phone_status_created_at_idx",
    ].forEach((index) => expect(migrationSql).toContain(index));

    expect(migrationSql).not.toMatch(/on delete cascade/);
    expect(migrationSql).not.toMatch(/\bdrop\s+(table|column|schema)\b|\btruncate\b/);
  });

  it("defines tenant ownership and policies without activating RLS in migrations", () => {
    expect(migrationSql).toMatch(/\borganization_id\b/);
    expect(migrationSql).toMatch(/create policy/);
    expect(migrationSql).not.toMatch(
      /enable row level security|force row level security/
    );
  });
});
