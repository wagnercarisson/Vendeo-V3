// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ProductOneToOneArtifactRecovery,
  type ArtifactRecoveryCreditOps,
  type ArtifactRecoveryProbe,
} from "../artifact/artifact-recovery";
import type { ArtifactProbe } from "../artifact/types";
import type { CreditOperationStatus } from "../credit-operation/types";

// ---------------------------------------------------------------------------
// F56.2b2b — Plano 02 / Task 1: serviço de recuperação de arte
// (B2B-D1/D2 / REQ-56.2.4-01..03, -10). Contract test ESTÁTICO (fonte sem
// regeneração/assinatura) + SIMULADO (sonda/cliente de crédito falsos, sem
// banco, sem provider, sem crédito real).
// ---------------------------------------------------------------------------

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";

const SERVICE_FILE = "src/lib/product-1-1/artifact/artifact-recovery.ts";
const serviceSource = readFileSync(path.resolve(process.cwd(), SERVICE_FILE), "utf8");
// Fonte ATIVA (sem comentários de bloco/linha): as asserções de código NUNCA
// podem depender de texto comentado.
const activeServiceSource = serviceSource
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith("//"))
  .join("\n");

const INTEGRAL_PROBE: ArtifactProbe = Object.freeze({
  kind: "integral" as const,
  ref: Object.freeze({
    storagePath: "store/campaign/product-1-1/op/art-1024.jpg",
    width: 1024,
    height: 1024,
    mimeType: "image/jpeg",
  }),
  width: 1024,
  height: 1024,
  mimeType: "image/jpeg",
  storagePath: "store/campaign/product-1-1/op/art-1024.jpg",
});

function makeRecovery(input: {
  probe: ArtifactProbe;
  status: CreditOperationStatus | null;
}) {
  const calls: string[] = [];
  let status = input.status;
  const probeArtifact = vi.fn(async () => input.probe);
  const artifacts: ArtifactRecoveryProbe = { probeArtifact };
  const credit: ArtifactRecoveryCreditOps = {
    get: vi.fn(async () => (status === null ? null : { status })),
    markArtUploaded: vi.fn(async () => {
      calls.push("markArtUploaded");
      status = "art_uploaded";
      return { status: "art_uploaded" as const };
    }),
    deliver: vi.fn(async () => {
      calls.push("deliver");
      status = "delivered";
      return { status: "delivered" as const };
    }),
  };
  const recovery = new ProductOneToOneArtifactRecovery({} as SupabaseClient, {
    artifacts,
    credit,
  });
  return { recovery, artifacts, credit, calls };
}

describe("F56.2b2b — artifact-recovery (fonte estática, SEM regeneração/assinatura)", () => {
  it("é server-only e consome a sonda EXISTENTE (`probeArtifact`), sem reimplementá-la", () => {
    expect(activeServiceSource).toMatch(/import "server-only";/);
    expect(activeServiceSource).toMatch(/probeArtifact/);
    // Reusa a sonda existente do `artifact-store` (não reimplementa download).
    expect(activeServiceSource).toMatch(/from "\.\/artifact-store"/);
    expect(activeServiceSource).not.toMatch(/\.download\(/);
    expect(activeServiceSource).not.toMatch(/createSignedUrl/);
  });

  it("NUNCA regenera arte nem assina URL na recuperação", () => {
    expect(activeServiceSource).not.toMatch(/storeArtifact/);
    expect(activeServiceSource).not.toMatch(/getSignedArtifactUrl/);
    expect(activeServiceSource).not.toMatch(/defaultAiGateway|generateImage|resizeToJpeg1024/);
  });
});

describe("F56.2b2b — artifact-recovery: recuperação sem regenerar (simulado)", () => {
  it("`integral` + `reserved` ⇒ conclui a entrega (markArtUploaded → deliver) UMA vez", async () => {
    const { recovery, artifacts, credit, calls } = makeRecovery({
      probe: INTEGRAL_PROBE,
      status: "reserved",
    });
    const result = await recovery.recoverDelivery({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
    });
    expect(artifacts.probeArtifact).toHaveBeenCalledWith({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
    });
    expect(credit.markArtUploaded).toHaveBeenCalledWith(CAMPAIGN_ID, OPERATION_ID);
    expect(credit.deliver).toHaveBeenCalledWith(CAMPAIGN_ID, OPERATION_ID);
    expect(calls).toEqual(["markArtUploaded", "deliver"]);
    expect(result).toMatchObject({ outcome: "delivered", kind: "integral", status: "delivered" });
    expect(result.ref).not.toBeNull();
  });

  it("`integral` + `art_uploaded` ⇒ conclui a entrega (idempotente em markArtUploaded)", async () => {
    const { recovery, credit, calls } = makeRecovery({
      probe: INTEGRAL_PROBE,
      status: "art_uploaded",
    });
    const result = await recovery.recoverDelivery({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
    });
    expect(calls).toEqual(["markArtUploaded", "deliver"]);
    expect(credit.deliver).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe("delivered");
  });

  it("`integral` + `delivered` (terminal) ⇒ `operation_terminal`, ZERO efeito de ledger", async () => {
    const { recovery, credit } = makeRecovery({ probe: INTEGRAL_PROBE, status: "delivered" });
    const result = await recovery.recoverDelivery({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
    });
    expect(result).toMatchObject({ outcome: "operation_terminal", kind: "integral", status: "delivered" });
    expect(credit.markArtUploaded).not.toHaveBeenCalled();
    expect(credit.deliver).not.toHaveBeenCalled();
  });

  it("`integral` + `refunded` (terminal) ⇒ `operation_terminal` (NÃO retorna a delivered)", async () => {
    const { recovery, credit } = makeRecovery({ probe: INTEGRAL_PROBE, status: "refunded" });
    const result = await recovery.recoverDelivery({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
    });
    expect(result).toMatchObject({ outcome: "operation_terminal", status: "refunded" });
    expect(credit.markArtUploaded).not.toHaveBeenCalled();
    expect(credit.deliver).not.toHaveBeenCalled();
  });

  it("`absent` ⇒ `absent`, sem fechamento/estorno (a camada NÃO decide o PF)", async () => {
    const { recovery, credit } = makeRecovery({ probe: { kind: "absent" }, status: "reserved" });
    const result = await recovery.recoverDelivery({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
    });
    expect(result).toMatchObject({ outcome: "absent", kind: "absent", status: null, ref: null });
    expect(credit.get).not.toHaveBeenCalled();
    expect(credit.markArtUploaded).not.toHaveBeenCalled();
    expect(credit.deliver).not.toHaveBeenCalled();
  });

  it("`invalid` ⇒ `unresolved` (nunca ausência), sem estorno/efeito", async () => {
    const { recovery, credit } = makeRecovery({ probe: { kind: "invalid" }, status: "reserved" });
    const result = await recovery.recoverDelivery({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
    });
    expect(result).toMatchObject({ outcome: "unresolved", kind: "invalid", ref: null });
    expect(credit.get).not.toHaveBeenCalled();
    expect(credit.deliver).not.toHaveBeenCalled();
  });

  it("`indeterminate` ⇒ `unresolved` (erro de Storage ≠ ausência), sem estorno/efeito", async () => {
    const { recovery, credit } = makeRecovery({
      probe: { kind: "indeterminate" },
      status: "reserved",
    });
    const result = await recovery.recoverDelivery({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
    });
    expect(result).toMatchObject({ outcome: "unresolved", kind: "indeterminate", ref: null });
    expect(credit.deliver).not.toHaveBeenCalled();
  });
});
