import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Gates npm audit on *new* advisories. Existing advisories are listed in
// security-audit-baseline.json with their upstream URLs; the baseline is
// expected to shrink as dependencies are upgraded. A missing/invalid audit
// result is a failure, so the gate cannot silently pass.
const baseline = new Set(
  JSON.parse(readFileSync(new URL("./security-audit-baseline.json", import.meta.url), "utf8")),
);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npm, ["audit", "--omit=dev", "--json"], {
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
  // npm.cmd is a batch file, which Node cannot spawn directly on Windows.
  shell: process.platform === "win32",
});

if (result.error) {
  console.error("audit gate: could not run npm audit:", result.error.message);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error("audit gate: npm audit did not return JSON");
  console.error(result.stderr);
  process.exit(1);
}

if (report.error) {
  console.error("audit gate: npm audit failed:", report.error.summary ?? report.error);
  process.exit(1);
}

const found = new Set();
for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vulnerability.via ?? []) {
    if (typeof via === "object" && via.url) found.add(via.url);
  }
}

const fresh = [...found].filter((url) => !baseline.has(url));
console.log(`audit gate: ${found.size} known advisory URLs, ${fresh.length} new`);
for (const url of fresh) console.log(`NEW: ${url}`);
process.exit(fresh.length > 0 ? 1 : 0);
