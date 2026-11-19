// @vitest-environment node
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { ProductOneToOnePendingResolutionSchema } from "@/lib/admin/schemas";
import { NewFlowGenerateImageRequestSchema } from "@/lib/image-generation/schema";

const ROOT = process.cwd();
const FORBIDDEN_CONSUMER_DIRS = [
  "src/app",
  "src/components",
  "src/lib/campaign",
  "src/lib/dashboard",
  "src/lib/product-1-1",
  "src/lib/product-9-16-two-stage",
  "src/lib/product-vertical-9-16",
  "src/lib/admin",
];

const C1_PRODUCTION_CONSUMERS = new Set([
  "src/app/api/campaign/generate-image/route.ts",
  "src/app/api/campaign/[id]/continue/route.ts",
  "src/app/api/campaign/generation-status/route.ts",
]);

/**
 * C2 — consumidores de UI/restauração autorizados por par EXATO. A UI não
 * importa orquestração/server; `display.ts` importa apenas o classificador
 * puro para decidir o formato persistido antes do resolvedor legado.
 */
const C2_PRODUCTION_CONSUMERS = new Set([
  "src/lib/campaign/display.ts",
  "src/lib/campaign/list.ts",
  "src/lib/dashboard/campaigns.ts",
  "src/app/(app)/campanhas/nova/page.tsx",
  "src/app/(app)/campanhas/page.tsx",
  "src/app/(app)/campanhas/client.tsx",
  "src/app/(app)/campanhas/[id]/page.tsx",
  "src/app/(app)/campanhas/[id]/client.tsx",
  "src/app/api/campaign/[id]/download/route.ts",
  "src/components/dashboard/available-campaign-card.tsx",
  "src/components/dashboard/dashboard-campaigns.tsx",
  "src/components/flow/campaign-brief-review.tsx",
  "src/components/flow/campaign-format-selector.tsx",
  "src/components/flow/campaign-input-form.tsx",
  "src/components/flow/generation-progress.tsx",
  "src/components/flow/unknown-result-panel.tsx",
  "src/components/flow/use-campaign-form.ts",
  "src/components/flow/use-two-format-polling.ts",
]);

function walk(directory: string): string[] {
  const absolute = path.join(ROOT, directory);
  const entries = readdirSync(absolute);
  const files: string[] = [];
  for (const entry of entries) {
    const relative = path.join(directory, entry).split(path.sep).join("/");
    const full = path.join(ROOT, relative);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      files.push(...walk(relative));
    } else if (
      /\.(ts|tsx)$/.test(entry) &&
      !/\.(test|spec)\./.test(entry)
    ) {
      files.push(relative);
    }
  }
  return files;
}

function read(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8");
}

function gitStatus(paths: readonly string[]): string {
  return execFileSync("git", ["status", "--porcelain", "--", ...paths], {
    cwd: ROOT,
    encoding: "utf8",
  }).trim();
}

function jointImporterEntries(source: string): string[] {
  return [...source.matchAll(/\[?"(src\/lib\/product-two-format\/[^"]+)"\]?:/g)].map(
    (match) => match[1],
  );
}

describe("F60.7-10 — fronteiras de não conexão", () => {
  it("Teste 1: nenhum consumidor de produção importa product-two-format", () => {
    const offenders: string[] = [];
    for (const directory of FORBIDDEN_CONSUMER_DIRS) {
      for (const file of walk(directory)) {
        if (
          C1_PRODUCTION_CONSUMERS.has(file) ||
          C2_PRODUCTION_CONSUMERS.has(file)
        ) {
          continue;
        }
        const source = read(file);
        if (/@\/lib\/product-two-format/.test(source)) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("Teste 2: C1 não criou UI; C2 usa somente os consumidores exatos", () => {
    const allowedChanged = new Set([
      ...C1_PRODUCTION_CONSUMERS,
      ...C2_PRODUCTION_CONSUMERS,
      "src/app/api/campaign/[id]/continue/__tests__/route.test.ts",
      "src/app/api/campaign/generation-status/__tests__/route.test.ts",
    ]);
    const changed = gitStatus(["src/app", "src/components"])
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => line.trim().replace(/^\S+\s+/, ""))
      .filter((file) => !file.includes("/__tests__/"));
    expect(changed.every((file) => allowedChanged.has(file))).toBe(true);
    const appFiles = walk("src/app");
    expect(appFiles.some((file) => file.endsWith(".tsx"))).toBe(true);
    expect(appFiles.some((file) => /\/joint|two-format/i.test(file))).toBe(false);
  });

  it("Teste 3: schema aceita o par conjunto exato sem promover campos extras", () => {
    expect(Object.keys(ProductOneToOnePendingResolutionSchema.shape).sort()).toEqual(
      ["action", "campaignId", "operationId", "reason", "resolutionOperationId"],
    );
    const base = {
      storeId: "11111111-1111-4111-8111-111111111111",
      campaignId: "22222222-2222-4222-8222-222222222222",
      operationId: "33333333-3333-4333-8333-333333333333",
      productName: "Produto",
      backgroundDirection: "studio",
      campaignIntent: "offer",
      productImages: [
        {
          role: "primary",
          source: "upload",
          mimeType: "image/jpeg",
          dataUrl: "data:image/jpeg;base64,AA==",
        },
      ],
    };
    expect(
      NewFlowGenerateImageRequestSchema.safeParse({
        ...base,
        campaignFormat: "1:1",
      }).success,
    ).toBe(true);
    expect(
      NewFlowGenerateImageRequestSchema.safeParse({
        ...base,
        campaignFormat: "1:1+9:16",
      }).success,
    ).toBe(true);
    expect(
      NewFlowGenerateImageRequestSchema.safeParse({
        ...base,
        campaignFormat: "1:1+9:16",
        squareDeliveryId: "44444444-4444-4444-8444-444444444444",
      }).success,
    ).toBe(false);
    expect(read("src/lib/admin/schemas.ts")).not.toContain("1:1+9:16");
    expect(read("src/lib/image-generation/schema.ts")).toContain("1:1+9:16");
  });

  it("Teste 4: exatamente uma migration F60.7, sem alteração/aplicação", () => {
    const migrations = readdirSync(path.join(ROOT, "supabase/migrations")).filter(
      (file) => file.includes("f60_7"),
    );
    expect(migrations).toEqual(["20261118002139_f60_7_two_format_foundation.sql"]);
    expect(gitStatus(["supabase/migrations"])).toBe("");
  });

  it("Teste 5: nenhum provider/DB real nos módulos conjuntos", () => {
    const serverImports: string[] = [];
    for (const file of walk("src/lib/product-two-format")) {
      if (read(file).includes("@/lib/supabase/server")) serverImports.push(file);
    }
    expect(serverImports.sort()).toEqual(
      [
        "src/lib/product-two-format/control-reader.ts",
        "src/lib/product-two-format/delivery-reader.ts",
        "src/lib/product-two-format/joint-financial-client.ts",
        "src/lib/product-two-format/orchestration/handle-joint-generate.ts",
        "src/lib/product-two-format/orchestration/joint-deps.ts",
        "src/lib/product-two-format/orchestration/run-two-format-deps.ts",
        "src/lib/product-two-format/orchestration/square-probe.ts",
      ].sort(),
    );
    for (const file of walk("src/lib/product-two-format")) {
      expect(read(file), file).not.toMatch(/createClient\(|fetch\(/);
    }
  });

  it("Teste 6: allowlist conjunta é mínima, por arquivo e sem prefixo amplo", () => {
    const guard = read("src/lib/product-1-1/__tests__/non-activation.contract.test.ts");
    const entries = jointImporterEntries(guard);
    expect(entries.sort()).toEqual(
      [
        "src/lib/product-two-format/orchestration/deliver-joint-vertical.ts",
        "src/lib/product-two-format/orchestration/deliver-square.ts",
        "src/lib/product-two-format/orchestration/finalize-joint-failure.ts",
        "src/lib/product-two-format/orchestration/joint-deps.ts",
        "src/lib/product-two-format/orchestration/joint-initial-snapshot.ts",
        "src/lib/product-two-format/orchestration/resolve-joint-pending.ts",
        "src/lib/product-two-format/orchestration/run-two-format-deps.ts",
      ].sort(),
    );
    expect(entries).not.toContain("@/lib/product-two-format/");
    expect(guard).toContain("@/lib/product-1-1/credit-operation/types");
    expect(guard).toContain("é violação");
  });
});
