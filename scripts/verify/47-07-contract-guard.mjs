import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const base = "87a96af0";
const frozenPaths = [
  "src/lib/ai/gateway.ts",
  "src/components/flow/campaign-input-form.tsx",
  "src/lib/campaign/",
  "src/lib/campaign-intelligence/",
  "src/lib/image-generation/schema.ts",
  "prompts/",
];

const changed = execFileSync("git", ["diff", "--name-only", base], { cwd: root, encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);
const violations = changed.filter((file) => frozenPaths.some((prefix) => file === prefix || file.startsWith(prefix)));
if (violations.length > 0) {
  console.error(`F47-07 frozen path drift:\n${violations.join("\n")}`);
  process.exit(1);
}

const gateway = fs.readFileSync(path.join(root, "src/lib/ai/gateway.ts"), "utf8");
if (gateway.includes("ai_model_selection") || gateway.includes("PersistedModelResolver")) {
  throw new Error("gateway.ts contains F47 persistence wiring");
}
console.log(`F47-07 contract guard PASS: ${changed.length} changed paths, 0 frozen violations`);
