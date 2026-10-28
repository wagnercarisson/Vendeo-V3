import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repo = path.resolve(import.meta.dirname, "../../..");
const orchestrator = path.join(repo, "scripts/f57-2/run-f57-2-proofs.ps1");
const powershell = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
const target = "postgresql://postgres:postgres@127.0.0.1:57782/postgres";
const sha = "acc1ce62227e54b8cf0f2f9178e3b2e77f77b89d4582b904a7c1b11972c1e9a9";

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "f57 2 orchestrator "));
  const scripts = path.join(root, "scripts", "f57-2");
  const evidence = path.join(root, "evidence with spaces");
  write(path.join(root, "node_modules", "vitest", "vitest.mjs"), `
import fs from "node:fs";
const args = process.argv.slice(2);
const suite = args.find((arg) => arg.includes("market-preferences-")) ?? "";
const mode = process.env.SIM_MODE ?? "success";
if (mode === "stderr-zero") console.error("SIM-STDERR-EXIT-0");
if (process.env.F57_2_CLEANUP_MANIFEST) {
  fs.appendFileSync(process.env.F57_2_CLEANUP_MANIFEST, JSON.stringify({ kind: "store", id: "store-1" }) + "\\n");
}
if (mode === "fail-onboarding" && suite.includes("onboarding")) {
  console.log("SIM FAIL ONBOARDING");
  process.exit(1);
}
console.log("SIM VITEST PASS " + suite);
process.exit(0);
`);
  write(path.join(scripts, "proofs-tool.mjs"), `
import fs from "node:fs";
const command = process.argv[2];
const mode = process.env.SIM_MODE ?? "success";
if (command === "status") {
  if (mode === "timeout-status") { setTimeout(() => process.exit(0), 5000); }
  else {
    if (mode === "stderr-zero") console.error("SIM-STATUS-STDERR-EXIT-0");
    console.log(JSON.stringify({ database: "postgres", auth: true, roles: ["anon","authenticated","service_role"], ledger_count: 149, ledger_sha256: "${sha}", f57_2: ["x|f57_2"] }));
  }
} else if (command === "preflight") {
  console.log(JSON.stringify({ stores: 0, users: 0, settings: 0, preferences: 0 }));
} else if (command === "cleanup") {
  const out = process.argv[process.argv.indexOf("--manifest-out") + 1];
  const registry = process.argv[process.argv.indexOf("--registry") + 1];
  const entries = fs.readFileSync(registry, "utf8").split(/\\r?\\n/).filter(Boolean).map(JSON.parse);
  const stores = [...new Set(entries.filter((e) => e.kind === "store").map((e) => e.id))];
  const users = [...new Set(entries.filter((e) => e.kind === "user").map((e) => e.id))];
  fs.writeFileSync(out, JSON.stringify({ stores, users }));
  console.log(JSON.stringify({ stores: 0, users: 0, settings: 0, preferences: 0, registered_store_ids: stores, registered_user_ids: users, failures: [] }));
  if (mode === "cleanup-fail") { console.error("SIM CLEANUP FAIL"); process.exit(2); }
}
`);
  write(path.join(scripts, "comparative-proof.mjs"), `
import fs from "node:fs";
const args = process.argv.slice(2);
if (process.env.SIM_MARKER) fs.appendFileSync(process.env.SIM_MARKER, args[0] + "\\n");
if (args[0] === "emit") {
  const out = args[args.indexOf("--out") + 1];
  fs.writeFileSync(out, "{}");
  const concurrency = args[args.indexOf("--concurrency-out") + 1];
  fs.writeFileSync(concurrency, "{}");
} else if (args[0] === "compare") {
  const out = args[args.indexOf("--out-md") + 1];
  fs.writeFileSync(out, "# SIM COMPARE");
}
console.log("SIM COMPARATIVE " + args[0]);
`);
  write(path.join(scripts, "homolog-snapshot.mjs"), `
import fs from "node:fs";
const args = process.argv.slice(2);
if (args[0] === "snapshot") {
  const out = args[args.indexOf("--out") + 1];
  fs.writeFileSync(out, JSON.stringify({ tables: [] }));
} else if (args[0] === "compare") {
  const out = args[args.indexOf("--out-md") + 1];
  fs.writeFileSync(out, "# SIM S0");
}
console.log("SIM SNAPSHOT " + args[0]);
`);
  for (const name of ["57.2-04-baseline.json", "57.2-01-s0-before.json", "57.2-01-s0-after-01.json", "57.2-01-s0-after-02.json"]) {
    write(path.join(evidence, name), "{}");
  }
  write(path.join(scripts, "run-f57-2-proofs.ps1"), fs.readFileSync(orchestrator, "utf8"));
  return { root, evidence, script: path.join(scripts, "run-f57-2-proofs.ps1") };
}

function run(ctx, extra = [], mode = "success") {
  const env = { ...process.env, TEST_DATABASE_URL: target, SIM_MODE: mode, SIM_MARKER: path.join(ctx.root, "emit.marker") };
  return spawnSync(powershell, [
    "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
    "-File", ctx.script,
    "-Action", "prove",
    "-EvidenceDir", ctx.evidence,
    "-ExpectedLedgerCount", "149",
    "-ExpectedLedgerSha256", sha,
    "-CommandTimeoutSeconds", "2",
    ...extra,
  ], { cwd: ctx.root, env, encoding: "utf8", timeout: 30_000 });
}

function cleanup(ctx) {
  fs.rmSync(ctx.root, { recursive: true, force: true });
}

test("orquestrador succeeds com paths com espaços e JSON do status", () => {
  const ctx = setup();
  try {
    const result = run(ctx);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(fs.existsSync(path.join(ctx.evidence, "57.2-05-db-evidence.json")));
    assert.ok(fs.existsSync(path.join(ctx.evidence, "57.2-05-s0-final.md")));
    assert.ok(fs.existsSync(path.join(ctx.evidence, "57.2-05-cleanup-manifest.json")));
  } finally {
    cleanup(ctx);
  }
});

test("stderr com exit 0 não reprova", () => {
  const ctx = setup();
  try {
    const result = run(ctx, [], "stderr-zero");
    assert.equal(result.status, 0, result.stderr);
  } finally {
    cleanup(ctx);
  }
});

test("falha de suíte impede emit/compare", () => {
  const ctx = setup();
  try {
    const result = run(ctx, [], "fail-onboarding");
    assert.notEqual(result.status, 0);
    assert.equal(fs.existsSync(path.join(ctx.root, "emit.marker")), false);
    assert.ok(fs.existsSync(path.join(ctx.evidence, "57.2-05-cleanup-manifest.json")));
  } finally {
    cleanup(ctx);
  }
});

test("timeout do status é identificável", () => {
  const ctx = setup();
  try {
    const env = { ...process.env, TEST_DATABASE_URL: target, SIM_MODE: "timeout-status" };
    const result = spawnSync(powershell, [
      "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
      "-File", ctx.script,
      "-Action", "status",
      "-ExpectedLedgerCount", "149",
      "-ExpectedLedgerSha256", sha,
      "-CommandTimeoutSeconds", "1",
    ], { cwd: ctx.root, env, encoding: "utf8", timeout: 15_000 });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /timeout/i);
  } finally {
    cleanup(ctx);
  }
});

test("falha de cleanup preserva manifesto/IDs e ainda captura S0 final", () => {
  const ctx = setup();
  try {

    const result = run(ctx, [], "cleanup-fail");
    assert.notEqual(result.status, 0);
    const manifest = JSON.parse(fs.readFileSync(path.join(ctx.evidence, "57.2-05-cleanup-manifest.json"), "utf8"));
    assert.deepEqual(manifest, { stores: ["store-1"], users: [] });
    assert.ok(fs.existsSync(path.join(ctx.evidence, "57.2-05-s0-final.md")));
    const evidence = JSON.parse(fs.readFileSync(path.join(ctx.evidence, "57.2-05-db-evidence.json"), "utf8"));
    assert.match(String(evidence.cleanup_error), /cleanup falhou/);
  } finally {
    cleanup(ctx);
  }
});
