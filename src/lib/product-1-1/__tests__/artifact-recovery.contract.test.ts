// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ArtifactRecoveryError,
  ProductOneToOneArtifactRecovery,
} from "../artifact/artifact-recovery";
import type { ArtifactProbe } from "../artifact/types";
import type { CreditOperationStatus } from "../credit-operation/types";

// ---------------------------------------------------------------------------
// F56.2b2b — Plano 02 / Task 1 (correção) + Recorte 1 (Plano 08): a recuperação
// CONFIRMA o objeto EXISTENTE via `product_1_1_confirm_existing_art` (SEM token e
// SEM novo upload) — nunca chama `mark`/`deliver` diretamente.
//
// Contract test ESTÁTICO + testes com o cliente ESTRITO REAL e uma RPC simulada.
// ---------------------------------------------------------------------------

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const DIVERGENT_OPERATION_ID = "99999999-9999-4999-8999-999999999999";

const GET_RPC = "product_1_1_get_campaign_credit_operation";
const CONFIRM_RPC = "product_1_1_confirm_existing_art";

const SERVICE_FILE = "src/lib/product-1-1/artifact/artifact-recovery.ts";
const serviceSource = readFileSync(path.resolve(process.cwd(), SERVICE_FILE), "utf8");
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

interface RpcResponse {
  data?: unknown;
  error?: unknown;
}
type Responder = (fn: string, params: Record<string, unknown>) => RpcResponse;

function envelope(status: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    success: true,
    status,
    campaign_id: CAMPAIGN_ID,
    operation_id: OPERATION_ID,
    amount: 1,
    credit_tx_id: null,
    refund_tx_id: null,
    ...over,
  };
}

/** Simula GET + CONFIRM_EXISTING_ART de forma FIEL (não-terminal → delivered). */
function happyResponder(initial: CreditOperationStatus | null): Responder {
  let status = initial;
  return (fn) => {
    if (fn === GET_RPC) return { data: status === null ? null : envelope(status) };
    if (fn === CONFIRM_RPC) {
      if (status === "reserved" || status === "art_uploaded") {
        status = "delivered";
        return { data: envelope("delivered") };
      }
      return { data: { success: false, reason: "invalid_transition" } };
    }
    return { error: { message: `unknown rpc ${fn}` } };
  };
}

function makeRecovery(input: {
  probe: ArtifactProbe;
  responder: Responder;
  projectDeliveredCampaign?: (value: {
    storeId: string;
    campaignId: string;
    operationId: string;
  }) => Promise<unknown>;
}) {
  const rpcCalls: string[] = [];
  const rpc = vi.fn(async (fn: string, params: Record<string, unknown>) => {
    rpcCalls.push(fn);
    const res = input.responder(fn, params);
    return { data: res.data ?? null, error: res.error ?? null };
  });
  const client = { rpc } as unknown as SupabaseClient;
  const probeArtifact = vi.fn(async () => input.probe);
  const recovery = new ProductOneToOneArtifactRecovery(client, {
    artifacts: { probeArtifact },
    ...(input.projectDeliveredCampaign
      ? { projectDeliveredCampaign: input.projectDeliveredCampaign as never }
      : {}),
  });
  return { recovery, rpcCalls, probeArtifact };
}

function recover(recovery: ProductOneToOneArtifactRecovery) {
  return recovery.recoverDelivery({
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
  });
}

describe("F56.2b2b — artifact-recovery (fonte estática, SEM regeneração/assinatura)", () => {
  it("é server-only e consome a sonda EXISTENTE (`probeArtifact`), sem reimplementá-la", () => {
    expect(activeServiceSource).toMatch(/import "server-only";/);
    expect(activeServiceSource).toMatch(/probeArtifact/);
    expect(activeServiceSource).toMatch(/from "\.\/artifact-store"/);
    expect(activeServiceSource).not.toMatch(/\.download\(/);
    expect(activeServiceSource).not.toMatch(/createSignedUrl/);
  });

  it("NUNCA regenera arte nem assina URL; NÃO altera/usar o cliente COMPARTILHADO", () => {
    expect(activeServiceSource).not.toMatch(/storeArtifact/);
    expect(activeServiceSource).not.toMatch(/getSignedArtifactUrl/);
    expect(activeServiceSource).not.toMatch(/defaultAiGateway|generateImage|resizeToJpeg1024/);
    expect(activeServiceSource).not.toMatch(/credit-operation-client/);
    // Recorte 1: confirma objeto EXISTENTE (nunca `mark`/`deliver` com token).
    expect(activeServiceSource).toMatch(/confirm_existing_art/);
  });
});

describe("F56.2b2b — artifact-recovery: caminho feliz (RPC simulada, cliente estrito REAL)", () => {
  it("`integral` + `reserved` ⇒ GET → CONFIRM_EXISTING_ART, anuncia `delivered`", async () => {
    const { recovery, rpcCalls } = makeRecovery({
      probe: INTEGRAL_PROBE,
      responder: happyResponder("reserved"),
    });
    const result = await recover(recovery);
    expect(rpcCalls).toEqual([GET_RPC, CONFIRM_RPC]);
    expect(result).toMatchObject({ outcome: "delivered", kind: "integral", status: "delivered" });
    expect(result.ref).not.toBeNull();
  });

  it("`integral` + `art_uploaded` ⇒ confirma a entrega uma vez", async () => {
    const { recovery, rpcCalls } = makeRecovery({
      probe: INTEGRAL_PROBE,
      responder: happyResponder("art_uploaded"),
    });
    const result = await recover(recovery);
    expect(rpcCalls).toEqual([GET_RPC, CONFIRM_RPC]);
    expect(result.outcome).toBe("delivered");
  });

  it("`integral` + `delivered` (terminal) ⇒ `operation_terminal`, ZERO mutação", async () => {
    const { recovery, rpcCalls } = makeRecovery({
      probe: INTEGRAL_PROBE,
      responder: happyResponder("delivered"),
    });
    const result = await recover(recovery);
    expect(rpcCalls).toEqual([GET_RPC]);
    expect(result).toMatchObject({ outcome: "operation_terminal", status: "delivered" });
  });

  it("`integral` + `refunded` (terminal) ⇒ `operation_terminal` (NÃO reabre)", async () => {
    const { recovery, rpcCalls } = makeRecovery({
      probe: INTEGRAL_PROBE,
      responder: happyResponder("refunded"),
    });
    const result = await recover(recovery);
    expect(rpcCalls).toEqual([GET_RPC]);
    expect(result).toMatchObject({ outcome: "operation_terminal", status: "refunded" });
  });
});

describe("F56.2b2b/261017-cdi — artifact-recovery: projeção da campanha", () => {
  it("entrega recuperada (`delivered`) projeta a campanha", async () => {
    const project = vi.fn(async () => ({ projected: true, reason: "projected" }));
    const { recovery } = makeRecovery({
      probe: INTEGRAL_PROBE,
      responder: happyResponder("reserved"),
      projectDeliveredCampaign: project,
    });
    const result = await recover(recovery);
    expect(result.outcome).toBe("delivered");
    expect(project).toHaveBeenCalledWith({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
    });
  });

  it("terminal `delivered` também projeta (reparo idempotente)", async () => {
    const project = vi.fn(async () => ({ projected: true, reason: "already_projected" }));
    const { recovery } = makeRecovery({
      probe: INTEGRAL_PROBE,
      responder: happyResponder("delivered"),
      projectDeliveredCampaign: project,
    });
    const result = await recover(recovery);
    expect(result.outcome).toBe("operation_terminal");
    expect(project).toHaveBeenCalledTimes(1);
  });

  it("terminal `refunded` NÃO projeta", async () => {
    const project = vi.fn(async () => ({ projected: false, reason: "operation_not_delivered" }));
    const { recovery } = makeRecovery({
      probe: INTEGRAL_PROBE,
      responder: happyResponder("refunded"),
      projectDeliveredCampaign: project,
    });
    const result = await recover(recovery);
    expect(result.outcome).toBe("operation_terminal");
    expect(project).not.toHaveBeenCalled();
  });

  it("falha da projeção NÃO reclassifica a entrega confirmada", async () => {
    const project = vi.fn(async () => {
      throw new Error("projection boom");
    });
    const { recovery } = makeRecovery({
      probe: INTEGRAL_PROBE,
      responder: happyResponder("reserved"),
      projectDeliveredCampaign: project,
    });
    const result = await recover(recovery);
    expect(result).toMatchObject({ outcome: "delivered", status: "delivered" });
  });
});

describe("F56.2b2b — artifact-recovery: fronteira de confirmação", () => {
  it("operação AUSENTE (`get` ⇒ null) ⇒ NÃO prossegue, ZERO mutação", async () => {
    const { recovery, rpcCalls } = makeRecovery({
      probe: INTEGRAL_PROBE,
      responder: happyResponder(null),
    });
    const result = await recover(recovery);
    expect(result).toMatchObject({ outcome: "unresolved", kind: "integral", status: null });
    expect(rpcCalls).toEqual([GET_RPC]);
    expect(rpcCalls).not.toContain(CONFIRM_RPC);
  });

  it("identidade DIVERGENTE na leitura ⇒ LANÇA (`credit_identity_mismatch`), ZERO mutação", async () => {
    const { recovery, rpcCalls } = makeRecovery({
      probe: INTEGRAL_PROBE,
      responder: (fn) => {
        if (fn === GET_RPC) return { data: envelope("reserved", { operation_id: DIVERGENT_OPERATION_ID }) };
        return { data: envelope("delivered") };
      },
    });
    await expect(recover(recovery)).rejects.toMatchObject({
      code: "credit_identity_mismatch",
    });
    expect(rpcCalls).toEqual([GET_RPC]);
  });

  it("`success:false`/ausente na leitura ⇒ LANÇA (`invalid_credit_response`), ZERO mutação", async () => {
    for (const bad of [{ status: "reserved" }, { success: false, reason: "x" }, "not-an-object"]) {
      const { recovery, rpcCalls } = makeRecovery({
        probe: INTEGRAL_PROBE,
        responder: (fn) => (fn === GET_RPC ? { data: bad } : { data: envelope("delivered") }),
      });
      await expect(recover(recovery)).rejects.toBeInstanceOf(ArtifactRecoveryError);
      expect(rpcCalls).toEqual([GET_RPC]);
    }
  });

  it("status CONTRADITÓRIO na leitura (fora do union) ⇒ LANÇA, ZERO mutação", async () => {
    const { recovery, rpcCalls } = makeRecovery({
      probe: INTEGRAL_PROBE,
      responder: (fn) => (fn === GET_RPC ? { data: envelope("weird_status") } : { data: envelope("delivered") }),
    });
    await expect(recover(recovery)).rejects.toMatchObject({ code: "credit_status_unexpected" });
    expect(rpcCalls).toEqual([GET_RPC]);
  });

  it("`confirm_existing_art` com `success:false` ⇒ LANÇA (`invalid_credit_response`)", async () => {
    const { recovery, rpcCalls } = makeRecovery({
      probe: INTEGRAL_PROBE,
      responder: (fn) => {
        if (fn === GET_RPC) return { data: envelope("reserved") };
        if (fn === CONFIRM_RPC) return { data: { success: false, reason: "publication_not_owner" } };
        return { data: envelope("delivered") };
      },
    });
    await expect(recover(recovery)).rejects.toMatchObject({ code: "invalid_credit_response" });
    expect(rpcCalls).toEqual([GET_RPC, CONFIRM_RPC]);
  });

  it("`confirm_existing_art` com status CONTRADITÓRIO ⇒ LANÇA (entrega NÃO anunciada)", async () => {
    const { recovery } = makeRecovery({
      probe: INTEGRAL_PROBE,
      responder: (fn) => {
        if (fn === GET_RPC) return { data: envelope("art_uploaded") };
        return { data: envelope("art_uploaded") }; // esperado delivered
      },
    });
    await expect(recover(recovery)).rejects.toMatchObject({ code: "credit_status_unexpected" });
  });
});

describe("F56.2b2b — artifact-recovery: sonda não-integral (sem crédito)", () => {
  it("`absent` ⇒ `absent`, ZERO RPC", async () => {
    const { recovery, rpcCalls } = makeRecovery({
      probe: { kind: "absent" },
      responder: happyResponder("reserved"),
    });
    const result = await recover(recovery);
    expect(result).toMatchObject({ outcome: "absent", kind: "absent", status: null, ref: null });
    expect(rpcCalls).toEqual([]);
  });

  it("`invalid`/`indeterminate` ⇒ `unresolved`, ZERO RPC (nunca ausência)", async () => {
    for (const probe of [{ kind: "invalid" } as ArtifactProbe, { kind: "indeterminate" } as ArtifactProbe]) {
      const { recovery, rpcCalls } = makeRecovery({ probe, responder: happyResponder("reserved") });
      const result = await recover(recovery);
      expect(result).toMatchObject({ outcome: "unresolved", kind: probe.kind, ref: null });
      expect(rpcCalls).toEqual([]);
    }
  });
});
