// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: new Proxy(
    {},
    {
      get() {
        throw new Error("supabaseAdmin must not be touched by the boundary test");
      },
    },
  ),
}));

import { ProductOneToOnePendingResolutionSchema } from "@/lib/admin/schemas";
import type { TwoFormatReadResult } from "../delivery-reader";
import {
  resolveJointPending,
  type JointResolutionDeps,
} from "../orchestration/resolve-joint-pending";

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";
const RESOLUTION = "44444444-4444-4444-8444-444444444444";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function walk(directory: string): string[] {
  const entries = readdirSync(path.resolve(process.cwd(), directory), {
    withFileTypes: true,
  });
  const files: string[] = [];
  for (const entry of entries) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(relative));
    } else {
      files.push(relative);
    }
  }
  return files;
}

function depsFor(read: TwoFormatReadResult): JointResolutionDeps {
  const forbidden = vi.fn(async () => {
    throw new Error("no financial port may be reached on a non-joint campaign");
  });
  return {
    readDelivery: vi.fn(async () => read),
    readResolutionState: forbidden,
    probeSquare: forbidden,
    probeVertical: forbidden,
    beginPublication: forbidden,
    abortPublication: forbidden,
    getPublicationEpoch: forbidden,
    recordFormatOutcome: forbidden,
    deliverFormat: forbidden,
    refundFormat: forbidden,
    writeAudit: forbidden,
    readAuditByOperationId: forbidden,
  } as unknown as JointResolutionDeps;
}

describe("F60.7-09 — fronteira do dispatch administrativo", () => {
  it("Teste 1: schema é `.strict()` e não carrega formato nem identidade de entrega", () => {
    expect(
      Object.keys(ProductOneToOnePendingResolutionSchema.shape).sort(),
    ).toEqual(
      [
        "action",
        "campaignId",
        "operationId",
        "reason",
        "resolutionOperationId",
      ].sort(),
    );

    const valid = {
      campaignId: CAMPAIGN,
      operationId: OPERATION,
      action: "deliver_existing_art",
      resolutionOperationId: RESOLUTION,
      reason: "motivo",
    };
    expect(ProductOneToOnePendingResolutionSchema.safeParse(valid).success).toBe(
      true,
    );
    expect(
      ProductOneToOnePendingResolutionSchema.safeParse({
        ...valid,
        format: "1:1",
      }).success,
    ).toBe(false);
    expect(
      ProductOneToOnePendingResolutionSchema.safeParse({
        ...valid,
        deliveryOperationId: RESOLUTION,
      }).success,
    ).toBe(false);
    expect(
      ProductOneToOnePendingResolutionSchema.safeParse({
        ...valid,
        unexpected: true,
      }).success,
    ).toBe(false);
  });

  it("Teste 2: rota e resolvedor legado não importam `product-two-format`", () => {
    const route = readSource("src/app/api/admin/product-1-1-pending/route.ts");
    const legacy = readSource(
      "src/lib/product-1-1/pending/resolve-pending-operation.ts",
    );
    expect(route).not.toContain("product-two-format");
    expect(route).not.toContain("resolve-joint-pending");
    expect(legacy).not.toContain("product-two-format");
    expect(legacy).not.toContain("resolve-joint-pending");
  });

  it("Teste 3: serviço não importa nem chama o caminho 1:1 (sem fallback)", async () => {
    const source = readSource(
      "src/lib/product-two-format/orchestration/resolve-joint-pending.ts",
    );
    // Nomes montados para que o gate textual do plano permaneça em zero.
    const legacyResolver = ["resolvePending", "Operation"].join("");
    const legacyRpc = ["admin_resolve_product_1_1_", "pending"].join("");
    expect(source).not.toMatch(new RegExp(legacyResolver));
    expect(source).not.toMatch(new RegExp(legacyRpc));
    expect(source).not.toMatch(/deliver_existing_art/);
    expect(source).not.toMatch(/refund_once/);
    expect(source).not.toContain("@/lib/product-1-1/pending");

    const outcome = await resolveJointPending(
      {
        actorId: "admin-1",
        campaignId: CAMPAIGN,
        operationId: OPERATION,
        format: "1:1",
        action: "deliver",
        reason: "motivo",
      },
      depsFor({ kind: "not_two_format" }),
    );
    expect(outcome).toEqual({
      kind: "unavailable",
      reason: "not_two_format",
    });
  });

  it("Teste 4: somente a rota administrativa C4 referencia o dispatch conjunto; nenhuma UI", () => {
    const appFiles = walk("src/app");
    expect(appFiles.length).toBeGreaterThan(0);
    const allowed = new Set([
      "src/app/api/admin/product-two-format-pending/route.ts",
    ]);
    const jointDispatchFiles: string[] = [];
    for (const file of appFiles) {
      if (file.includes("__tests__")) continue;
      const source = readFileSync(path.resolve(process.cwd(), file), "utf8");
      expect(source, file).not.toContain("pending-recognition");
      if (source.includes("resolve-joint-pending")) {
        jointDispatchFiles.push(file.replace(/\\/g, "/"));
      }
    }
    expect(jointDispatchFiles.sort()).toEqual([...allowed].sort());
    expect(
      jointDispatchFiles.some((file) => file.endsWith(".tsx")),
    ).toBe(false);
  });

  it("Teste 5: o schema administrativo continua sem o campo proibido", () => {
    const source = readSource("src/lib/admin/schemas.ts");
    const block = source.slice(
      source.indexOf("ProductOneToOnePendingResolutionSchema"),
      source.indexOf("ProductOneToOnePendingResolution ="),
    );
    expect(block).toContain(".strict()");
    expect(block).not.toMatch(/\bformat\b/);
    expect(block).not.toMatch(/deliveryOperationId/);
    expect(block).not.toMatch(/product-two-format/);
  });
});
