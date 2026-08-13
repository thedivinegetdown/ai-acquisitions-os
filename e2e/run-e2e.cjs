const { spawnSync } = require("node:child_process");

const executable = process.platform === "win32" ? "npm.cmd" : "npm";
const env = {
  ...process.env,
  VITE_SUPABASE_URL: "http://127.0.0.1:4173/e2e-supabase",
  VITE_SUPABASE_ANON_KEY: "eo-e2e-01-public-test-key",
  VITE_NETLIFY_FUNCTIONS_BASE: "/.netlify/functions",
  SMS_TEST_MODE: "true",
};

function run(args) {
  const result = spawnSync(executable, args, { env, shell: process.platform === "win32", stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

run(["run", "build"]);
run(["exec", "--", "playwright", "test", ...process.argv.slice(2)]);
