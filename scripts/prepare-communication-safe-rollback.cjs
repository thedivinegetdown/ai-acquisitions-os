// Local source packaging only. No environment files, credentials, network,
// dependency installation, Netlify commands, or database access.
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { mkdirSync, mkdtempSync, readFileSync, unlinkSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const applicationBase = "aa9726488a312db18a84d63ce3cfe82ab63499cf";
const safetyRevision = "9b20cd60971a3e9668d7680181bef1a31af8562d";
const retainedFiles = Object.freeze([
  "netlify/functions/_shared/auth.cjs",
  "netlify/functions/send-sms.cjs",
  "netlify/functions/send-email.js",
  "src/components/MessageCenter.jsx",
  "src/components/SequenceEngine.jsx",
]);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const git = (args, options = {}) => execFileSync("git", args, { cwd: root, ...options });
const tree = (revision) => new Map(
  git(["ls-tree", "-r", revision], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 })
    .trim().split("\n").map((line) => {
      const [entry, file] = line.split("\t");
      return [file, entry.split(" ")[2]];
    })
);
const blobId = (bytes) => createHash("sha1")
  .update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
const isRuntimeFile = (file) => !file.includes("/__tests__/") &&
  (/^(src\/|netlify\/functions\/)/.test(file) ||
    /^(package(-lock)?\.json|netlify\.toml|vite\.config\..*)$/.test(file));

function prepareRollback() {
  const sourceRevision = git(["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  git(["merge-base", "--is-ancestor", safetyRevision, sourceRevision]);
  const baseTree = tree(applicationBase);
  const safetyTree = tree(safetyRevision);
  const candidateTree = tree(sourceRevision);
  mkdirSync(path.join(root, ".netlify"), { recursive: true });
  // Always create a new directory; never overwrite a reviewed artifact.
  const output = mkdtempSync(path.join(root, ".netlify", `communication-safe-rollback-${sourceRevision}-`));
  const baseArchive = path.join(output, "base-intermediate.tar");
  const source = path.join(output, "source");
  mkdirSync(source);
  git(["-c", "core.autocrlf=false", "archive", "--format=tar", `--output=${baseArchive}`, applicationBase]);
  execFileSync("tar", ["-xf", baseArchive, "-C", source]);
  // Do not leave an unsafe old-function archive beside the safe artifact.
  unlinkSync(baseArchive);
  for (const file of retainedFiles) {
    const pinned = git(["show", `${safetyRevision}:${file}`]);
    assert.equal(candidateTree.get(file), blobId(pinned),
      `Safety file drift: ${file}`);
    writeFileSync(path.join(source, file), pinned);
  }
  const files = [...baseTree.keys()];
  for (const file of candidateTree.keys()) {
    if (isRuntimeFile(file)) {
      assert(baseTree.has(file), `Additional candidate runtime file requires rollback review: ${file}`);
    }
  }
  assert(!files.some((file) => /(^|\/)\.env($|\.)/.test(file) && !file.endsWith(".example")),
    "Refusing to package tracked environment secrets");
  const manifest = files.map((file) => {
    const expectedRevision = retainedFiles.includes(file) ? safetyRevision : applicationBase;
    const actual = readFileSync(path.join(source, file));
    assert.equal(blobId(actual),
      (retainedFiles.includes(file) ? safetyTree : baseTree).get(file), file);
    // Every runtime file must equal the qualified safety application. This
    // prevents a locally packaged fallback from introducing untested app code.
    if (isRuntimeFile(file)) {
      assert.equal(blobId(actual), candidateTree.get(file),
        `Rollback runtime differs from qualified candidate: ${file}`);
    }
    return { file, sha256: sha256(actual), sourceRevision: expectedRevision };
  });
  const archive = path.join(output, "communication-safe-rollback.tar");
  execFileSync("tar", ["-cf", archive, "-C", source, "."]);
  const metadata = {
    applicationBase, safetyRevision, sourceRevision, retainedFiles, files: manifest,
    archive, archiveSha256: sha256(readFileSync(archive)),
    schemaPolicy: "Retain communication guards and canonical identity; never run bundled migrations.",
    publicationPolicy: "Separate authorization and required CI; full build and deploy, never restore the unsafe deploy.",
  };
  const manifestPath = path.join(output, "manifest.json");
  writeFileSync(manifestPath, JSON.stringify(metadata, null, 2) + "\n");
  return { source, manifestPath, manifestSha256: sha256(readFileSync(manifestPath)), ...metadata };
}

if (require.main === module) {
  const result = prepareRollback();
  console.log(JSON.stringify({
    source: result.source, manifestPath: result.manifestPath,
    archive: result.archive, archiveSha256: result.archiveSha256,
    manifestSha256: result.manifestSha256, applicationBase, safetyRevision,
    runtimeEquality: "PASS", trackedFileCount: result.files.length,
  }, null, 2));
}

module.exports = { prepareRollback };
