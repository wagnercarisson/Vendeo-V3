// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { AiInvoker } from "@/lib/ai/gateway";
import type { AiInvocationResult } from "@/lib/ai/types";
import { createDefaultProductOneToOneCopyOps } from "../copy/default-copy-runner";
import {
  ProductOneToOnePilotSpendControl,
  type PilotPaidCallHandle,
  type PilotPaidCallDecision,
  type PilotSpendGate,
} from "../pilot/spend-control";
import type {
  PilotBeginPaidCallInput,
  PilotSpendRepositoryPort,
} from "../pilot/pilot-spend-repository";

/**
 * RPC SIMULADA COM ESTADO — replica as transições da migration
 * `20261017000002` para provar o PROTOCOLO (acumulado, idempotência por chamada,
 * concorrência imagem×copy, bloqueio por `unknown`, proteção de `stale`).
 */
class StatefulFakeRepo implements PilotSpendRepositoryPort {
  cap: number | null = null;
  spent = 0;
  readonly calls = new Map<
    string,
    {
      campaignId: string;
      operationId: string;
      kind: string;
      attemptSeq: number;
      estimated: number;
      state: "in_flight" | "unknown" | "released" | "stale";
      owner: string;
    }
  >();

  async setCap(input: { capUsd: number }): Promise<Record<string, unknown>> {
    this.cap = input.capUsd;
    return { success: true };
  }

  private stream(kind: string): "image" | "copy" {
    return kind.startsWith("image") ? "image" : "copy";
  }

  async beginPaidCall(input: PilotBeginPaidCallInput): Promise<Record<string, unknown>> {
    if (this.blockedCalls.size > 0) throw new Error("pilot_globally_blocked");
    const id = {
      call_id: input.callId,
      campaign_id: input.campaignId,
      operation_id: input.operationId,
      kind: input.kind,
      attempt_seq: input.attemptSeq,
    };
    const existing = this.calls.get(input.callId);
    if (existing) {
      return existing.state === "in_flight"
        ? { success: true, outcome: "existing_in_flight", ...id }
        : { success: true, outcome: "closed", ...id };
    }
    if (this.cap === null) throw new Error("pilot_cap_not_configured");
    if ([...this.calls.values()].some((c) => c.state === "unknown")) {
      throw new Error("pilot_requires_reconciliation");
    }
    const sameStream = [...this.calls.values()].some(
      (c) =>
        c.state === "in_flight" &&
        c.campaignId === input.campaignId &&
        this.stream(c.kind) === this.stream(input.kind),
    );
    if (sameStream) throw new Error("pilot_stream_busy");
    const otherCampaign = [...this.calls.values()].some(
      (c) => c.state === "in_flight" && c.campaignId !== input.campaignId,
    );
    if (otherCampaign) throw new Error("pilot_busy");
    if (this.spent + input.estimatedUsd > this.cap) throw new Error("pilot_cap_reached");

    this.calls.set(input.callId, {
      campaignId: input.campaignId,
      operationId: input.operationId,
      kind: input.kind,
      attemptSeq: input.attemptSeq,
      estimated: input.estimatedUsd,
      state: "in_flight",
      owner: input.ownerToken,
    });
    this.spent += input.estimatedUsd;
    return { success: true, outcome: "acquired", ...id };
  }

  async endPaidCall(input: {
    callId: string;
    ownerToken: string;
    actualEstimatedUsd: number | null;
  }): Promise<Record<string, unknown>> {
    const c = this.calls.get(input.callId);
    if (!c) throw new Error("call_not_found");
    if (c.owner !== input.ownerToken) throw new Error("not_owner");
    if (c.state === "released") return { success: true, idempotent: true, state: "released" };
    if (c.state === "stale") return { success: true, idempotent: true, state: "stale" };
    if (c.state === "unknown") throw new Error("call_is_unknown");
    if (input.actualEstimatedUsd !== null) {
      this.spent += input.actualEstimatedUsd - c.estimated;
      c.estimated = input.actualEstimatedUsd;
    }
    c.state = "released";
    return { success: true, idempotent: false, state: "released" };
  }

  async markUnknown(input: { callId: string; ownerToken: string }): Promise<Record<string, unknown>> {
    if (this.markUnknownFails) throw new Error("db_down");
    const c = this.calls.get(input.callId);
    if (!c) throw new Error("call_not_found");
    if (c.owner !== input.ownerToken) throw new Error("not_owner");
    c.state = "unknown";
    return { success: true, state: "unknown" };
  }
  markUnknownFails = false;

  async reconcileUnknown(input: { callId: string }): Promise<Record<string, unknown>> {
    const c = this.calls.get(input.callId);
    if (!c) throw new Error("call_not_found");
    const inSet = this.blockedCalls.has(input.callId);
    if (c.state === "stale") {
      if (inSet) this.blockedCalls.delete(input.callId);
      return { success: true, idempotent: true, state: "stale" };
    }
    if (c.state !== "unknown" && !(c.state === "in_flight" && inSet)) {
      throw new Error("call_not_unknown");
    }
    c.state = "stale";
    if (inSet) this.blockedCalls.delete(input.callId);
    return { success: true, idempotent: false, state: "stale" };
  }

  blockedCalls = new Set<string>();
  blockGlobalFails = false;
  async blockGlobal(input: { callId: string }): Promise<Record<string, unknown>> {
    if (this.blockGlobalFails) throw new Error("db_down_block");
    this.blockedCalls.add(input.callId);
    return { success: true, blocked: true };
  }
}

function control(repo: StatefulFakeRepo) {
  let n = 0;
  return new ProductOneToOnePilotSpendControl({ repository: repo, newId: () => `id-${++n}` });
}

const BASE = { campaignId: "camp-a", operationId: "op-a", attemptSeq: 1 };

describe("F56.2b2c — protocolo do serviço com RPC simulada COM ESTADO", () => {
  it("acumula entre operações/lojas e recusa ao atingir o teto", async () => {
    const repo = new StatefulFakeRepo();
    repo.setCap({ capUsd: 0.5 });
    const c = control(repo);
    const img = await c.beginPaidCall({ ...BASE, kind: "image_primary", estimatedUsd: 0.3 });
    expect(img.acquired).toBe(true);
    // copy da MESMA campanha (stream distinto) é permitida e SOMA:
    const copy = await c.beginPaidCall({ ...BASE, kind: "copy_initial", estimatedUsd: 0.2 });
    expect(copy.acquired).toBe(true);
    expect(repo.spent).toBeCloseTo(0.5, 6);
    // Libera as chamadas da camp-a (sem in_flight) para isolar o teste do ACUMULADO.
    await c.endPaidCall({ handle: (img as { handle: PilotPaidCallHandle }).handle, actualEstimatedUsd: 0.3 });
    await c.endPaidCall({ handle: (copy as { handle: PilotPaidCallHandle }).handle, actualEstimatedUsd: 0.2 });
    // Nova operação/loja: o acumulado já está no teto ⇒ recusa.
    const next = await c.beginPaidCall({ campaignId: "camp-b", operationId: "op-b", attemptSeq: 1, kind: "image_primary", estimatedUsd: 0.01 });
    expect(next).toEqual({ acquired: false, outcome: "blocked", reason: "pilot_cap_reached" });
  });

  it("idempotência POR CHAMADA: replay não soma de novo", async () => {
    const repo = new StatefulFakeRepo();
    repo.setCap({ capUsd: 10 });
    const c = control(repo);
    const first = await c.beginPaidCall({ ...BASE, kind: "image_primary", estimatedUsd: 0.3 });
    expect(first.acquired).toBe(true);
    // Outra chamada com call_id NOVO é permitida (stream diferente) — para provar
    // idempotência, reexecutamos o MESMO call_id via a mesma chamada simulada:
    const handle = (first as { handle: PilotPaidCallHandle }).handle;
    repo.calls.set(handle.callId, { ...repo.calls.get(handle.callId)!, state: "in_flight" });
    // replay do mesmo call_id (chamando o repo direto com o mesmo id):
    const replay = await repo.beginPaidCall({
      campaignId: BASE.campaignId,
      operationId: BASE.operationId,
      callId: handle.callId,
      kind: "image_primary",
      attemptSeq: 1,
      estimatedUsd: 0.3,
      ownerToken: handle.ownerToken,
    });
    expect(replay.outcome).toBe("existing_in_flight");
    expect(repo.spent).toBeCloseTo(0.3, 6); // NÃO somou de novo
  });

  it("resultado desconhecido bloqueia retry (mesma campanha) e outra campanha; reconciliação libera", async () => {
    const repo = new StatefulFakeRepo();
    repo.setCap({ capUsd: 10 });
    const c = control(repo);
    const img = await c.beginPaidCall({ ...BASE, kind: "image_primary", estimatedUsd: 0.3 });
    await c.markUnknown({ handle: (img as { handle: PilotPaidCallHandle }).handle, reason: "timeout" });

    const retrySameCampaign = await c.beginPaidCall({ ...BASE, kind: "copy_auto", estimatedUsd: 0.1 });
    expect(retrySameCampaign).toEqual({ acquired: false, outcome: "blocked", reason: "pilot_requires_reconciliation" });
    const otherCampaign = await c.beginPaidCall({ campaignId: "camp-b", operationId: "op-b", attemptSeq: 1, kind: "image_primary", estimatedUsd: 0.1 });
    expect(otherCampaign).toEqual({ acquired: false, outcome: "blocked", reason: "pilot_requires_reconciliation" });

    // Estimativa permanece contabilizada; reconciliação explícita libera.
    const spentBefore = repo.spent;
    await c.reconcileUnknown({ actorId: "admin", callId: (img as { handle: PilotPaidCallHandle }).handle.callId, decision: "keep_accounted_release", reason: "ok", operationId: "rec-1" });
    expect(repo.spent).toBeCloseTo(spentBefore, 6);
    const after = await c.beginPaidCall({ campaignId: "camp-b", operationId: "op-b", attemptSeq: 1, kind: "image_primary", estimatedUsd: 0.1 });
    expect(after.acquired).toBe(true);
  });

  it("resultado TARDIO após reconciliação preserva `stale` (não recalcula)", async () => {
    const repo = new StatefulFakeRepo();
    repo.setCap({ capUsd: 10 });
    const c = control(repo);
    const img = await c.beginPaidCall({ ...BASE, kind: "image_primary", estimatedUsd: 0.3 });
    const handle = (img as { handle: PilotPaidCallHandle }).handle;
    await c.markUnknown({ handle, reason: "timeout" });
    await c.reconcileUnknown({ actorId: "admin", callId: handle.callId, decision: "keep_accounted_release", reason: "ok", operationId: "rec-1" });
    const spent = repo.spent;
    await c.endPaidCall({ handle, actualEstimatedUsd: 0.99 });
    expect(repo.calls.get(handle.callId)!.state).toBe("stale");
    expect(repo.spent).toBeCloseTo(spent, 6); // NÃO recalculou
  });

  it("estimativa ausente/negativa ⇒ bloqueia (não é chamada gratuita)", async () => {
    const repo = new StatefulFakeRepo();
    repo.setCap({ capUsd: 10 });
    const c = control(repo);
    expect(await c.beginPaidCall({ ...BASE, kind: "copy_initial", estimatedUsd: Number.NaN })).toEqual({
      acquired: false,
      outcome: "blocked",
      reason: "estimate_required",
    });
  });

  it("estimativa ZERO/negativa/ausente ⇒ bloqueia (M1: nunca chamada gratuita)", async () => {
    const repo = new StatefulFakeRepo();
    repo.setCap({ capUsd: 10 });
    const c = control(repo);
    for (const value of [0, -1, Number.NaN]) {
      expect(await c.beginPaidCall({ ...BASE, kind: "image_primary", estimatedUsd: value })).toEqual({
        acquired: false,
        outcome: "blocked",
        reason: "estimate_required",
      });
    }
  });

  it("M3: timeout/rede com FALHA DUPLA de marcação/bloqueio NÃO gera nova chamada", async () => {
    const repo = new StatefulFakeRepo();
    repo.setCap({ capUsd: 10 });
    const c = control(repo);
    const img = await c.beginPaidCall({ ...BASE, kind: "image_primary", estimatedUsd: 0.3 });
    const handle = (img as { handle: PilotPaidCallHandle }).handle;
    repo.markUnknownFails = true;
    repo.blockGlobalFails = true;
    // A falha dupla PROPAGA (fail-closed) — não é `catch` silencioso.
    await expect(c.markUnknown({ handle, reason: "network" })).rejects.toThrow();
  });

  it("falha de markUnknown instala BLOQUEIO GLOBAL e a reconciliação da chamada VINCULADA libera", async () => {
    const repo = new StatefulFakeRepo();
    repo.setCap({ capUsd: 10 });
    const c = control(repo);
    const img = await c.beginPaidCall({ ...BASE, kind: "image_primary", estimatedUsd: 0.3 });
    const handle = (img as { handle: PilotPaidCallHandle }).handle;
    repo.markUnknownFails = true;
    await c.markUnknown({ handle, reason: "timeout" });
    expect(repo.blockedCalls.size).toBe(1);
    expect(repo.blockedCalls.has(handle.callId)).toBe(true);
    const other = await c.beginPaidCall({ campaignId: "camp-b", operationId: "op-b", attemptSeq: 1, kind: "copy_initial", estimatedUsd: 0.1 });
    expect(other).toEqual({ acquired: false, outcome: "blocked", reason: "pilot_globally_blocked" });

    // Reconciliação HUMANA da chamada VINCULADA (mesmo em `in_flight`) libera o bloqueio.
    await c.reconcileUnknown({ actorId: "admin", callId: handle.callId, decision: "keep_accounted_release", reason: "ok", operationId: "rec-x" });
    expect(repo.blockedCalls.size).toBe(0);
    expect(repo.calls.get(handle.callId)!.state).toBe("stale");
    const after = await c.beginPaidCall({ campaignId: "camp-b", operationId: "op-b", attemptSeq: 1, kind: "image_primary", estimatedUsd: 0.1 });
    expect(after.acquired).toBe(true);
  });

  it("reconciliar OUTRA chamada NÃO limpa o bloqueio pendente", async () => {
    const repo = new StatefulFakeRepo();
    repo.setCap({ capUsd: 10 });
    const c = control(repo);
    const img = await c.beginPaidCall({ ...BASE, kind: "image_primary", estimatedUsd: 0.3 });
    const copy = await c.beginPaidCall({ ...BASE, kind: "copy_initial", estimatedUsd: 0.2 });
    const imgHandle = (img as { handle: PilotPaidCallHandle }).handle;
    const copyHandle = (copy as { handle: PilotPaidCallHandle }).handle;
    repo.markUnknownFails = true;
    await c.markUnknown({ handle: imgHandle, reason: "timeout" });
    expect(repo.blockedCalls.size).toBe(1);
    // A copy não é a chamada vinculada e está `in_flight` ⇒ recusa.
    await expect(
      c.reconcileUnknown({ actorId: "admin", callId: copyHandle.callId, decision: "keep_accounted_release", reason: "ok", operationId: "rec-y" }),
    ).rejects.toThrow(/call_not_unknown/);
    expect(repo.blockedCalls.size).toBe(1);
  });

  it("imagem+copy inconclusivas (duas falhas de marcação) ⇒ reconciliar UMA não libera", async () => {
    const repo = new StatefulFakeRepo();
    repo.setCap({ capUsd: 10 });
    const c = control(repo);
    const img = await c.beginPaidCall({ ...BASE, kind: "image_primary", estimatedUsd: 0.3 });
    const copy = await c.beginPaidCall({ ...BASE, kind: "copy_initial", estimatedUsd: 0.2 });
    const imgHandle = (img as { handle: PilotPaidCallHandle }).handle;
    const copyHandle = (copy as { handle: PilotPaidCallHandle }).handle;

    repo.markUnknownFails = true;
    await c.markUnknown({ handle: imgHandle, reason: "timeout" });
    await c.markUnknown({ handle: copyHandle, reason: "network" });
    expect(repo.blockedCalls.size).toBe(2); // PRESERVA as DUAS

    // Reconcilia SÓ a imagem ⇒ o bloqueio global permanece (copy ainda inconclusiva).
    await c.reconcileUnknown({ actorId: "admin", callId: imgHandle.callId, decision: "keep_accounted_release", reason: "ok", operationId: "rec-img" });
    expect(repo.blockedCalls.size).toBe(1);
    const stillBlocked = await c.beginPaidCall({ campaignId: "camp-b", operationId: "op-b", attemptSeq: 1, kind: "image_primary", estimatedUsd: 0.1 });
    expect(stillBlocked).toEqual({ acquired: false, outcome: "blocked", reason: "pilot_globally_blocked" });

    // Reconcilia a copy ⇒ conjunto vazio ⇒ libera.
    await c.reconcileUnknown({ actorId: "admin", callId: copyHandle.callId, decision: "keep_accounted_release", reason: "ok", operationId: "rec-copy" });
    expect(repo.blockedCalls.size).toBe(0);
    const released = await c.beginPaidCall({ campaignId: "camp-b", operationId: "op-b", attemptSeq: 1, kind: "image_primary", estimatedUsd: 0.1 });
    expect(released.acquired).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Consumidor REAL da copy (default-copy-runner) com gate + provider simulados.
// ---------------------------------------------------------------------------
function fakeInvoker(behavior: () => AiInvocationResult): AiInvoker {
  return {
    invoke: vi.fn(async () => behavior()),
    hasFallback: vi.fn(async () => false),
  } as unknown as AiInvoker;
}

function spyGate(
  decision: PilotPaidCallDecision,
): PilotSpendGate & { begin: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn>; unknown: ReturnType<typeof vi.fn> } {
  const begin = vi.fn(async () => decision);
  const end = vi.fn(async () => undefined);
  const unknown = vi.fn(async () => undefined);
  return { beginPaidCall: begin, endPaidCall: end, markUnknown: unknown, begin, end, unknown } as never;
}

const COPY_INPUT = {
  campaignId: "camp-a",
  operationId: "op-a",
  storeId: "store-a",
  briefing: {
    product: { name: "P" },
    commercial: { intent: "offer" as const },
  },
  copyContext: { storeName: "Loja", segment: "outros" },
  copyDirectorEnabled: true,
};

describe("F56.2b2c — consumidor REAL da copy com provider SIMULADO", () => {
  it("gate bloqueado ⇒ provider NÃO é chamado", async () => {
    const gate = spyGate({ acquired: false, outcome: "blocked", reason: "pilot_cap_reached" });
    const invoker = fakeInvoker(() => ({ content: "{}" }) as AiInvocationResult);
    const ops = createDefaultProductOneToOneCopyOps(COPY_INPUT, {
      invoker,
      pilotSpend: gate,
      estimatedUsd: 0.05,
    });
    await expect(
      ops.runCopy({ campaignId: "camp-a", operationId: "op-a", signal: new AbortController().signal, commit: async () => undefined }),
    ).rejects.toThrow(/pilot_spend_blocked/);
    expect((invoker.invoke as unknown as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    expect(gate.begin).toHaveBeenCalledTimes(1);
  });

  it("estimativa ausente quando ARMADO ⇒ bloqueia antes do provider", async () => {
    const gate = spyGate({ acquired: true, handle: { callId: "c", ownerToken: "o", kind: "copy_initial" } });
    const invoker = fakeInvoker(() => ({ content: "{}" }) as AiInvocationResult);
    const ops = createDefaultProductOneToOneCopyOps(COPY_INPUT, { invoker, pilotSpend: gate });
    await expect(
      ops.runCopy({ campaignId: "camp-a", operationId: "op-a", signal: new AbortController().signal, commit: async () => undefined }),
    ).rejects.toThrow(/estimate_required/);
    expect((invoker.invoke as unknown as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("gate adquirido ⇒ provider chamado e endPaidCall registrado", async () => {
    const gate = spyGate({ acquired: true, handle: { callId: "c", ownerToken: "o", kind: "copy_initial" } });
    const invoker = fakeInvoker(
      () =>
        ({
          content: JSON.stringify({ title: "T", caption: "Promoção", hashtags: ["#a"], cta_post: "Saiba mais!" }),
        }) as AiInvocationResult,
    );
    const ops = createDefaultProductOneToOneCopyOps(COPY_INPUT, { invoker, pilotSpend: gate, estimatedUsd: 0.05 });
    await ops.runCopy({ campaignId: "camp-a", operationId: "op-a", signal: new AbortController().signal, commit: async () => undefined });
    expect((invoker.invoke as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    expect(gate.end).toHaveBeenCalledTimes(1);
  });

  it("timeout do provider ⇒ markUnknown (não encerra como conhecido)", async () => {
    const gate = spyGate({ acquired: true, handle: { callId: "c", ownerToken: "o", kind: "copy_auto" } });
    const invoker: AiInvoker = {
      invoke: vi.fn(async () => {
        const err = new Error("timed out");
        (err as unknown as { kind: string }).kind = "timeout";
        throw err;
      }),
      hasFallback: vi.fn(async () => false),
    } as unknown as AiInvoker;
    const ops = createDefaultProductOneToOneCopyOps(COPY_INPUT, { invoker, pilotSpend: gate, estimatedUsd: 0.05 });
    await expect(
      ops.runCopy({ campaignId: "camp-a", operationId: "op-a", signal: new AbortController().signal, commit: async () => undefined }),
    ).rejects.toThrow();
    expect(gate.unknown).toHaveBeenCalledTimes(1);
    expect(gate.end).not.toHaveBeenCalled();
  });

  it("falha de REDE (ECONNRESET) ⇒ markUnknown (não encerra como conhecido)", async () => {
    const gate = spyGate({ acquired: true, handle: { callId: "c", ownerToken: "o", kind: "copy_auto" } });
    const invoker: AiInvoker = {
      invoke: vi.fn(async () => {
        const err = new Error("read ECONNRESET");
        (err as unknown as { code: string }).code = "ECONNRESET";
        throw err;
      }),
      hasFallback: vi.fn(async () => false),
    } as unknown as AiInvoker;
    const ops = createDefaultProductOneToOneCopyOps(COPY_INPUT, { invoker, pilotSpend: gate, estimatedUsd: 0.05 });
    await expect(
      ops.runCopy({ campaignId: "camp-a", operationId: "op-a", signal: new AbortController().signal, commit: async () => undefined }),
    ).rejects.toThrow();
    expect(gate.unknown).toHaveBeenCalledTimes(1);
    expect(gate.end).not.toHaveBeenCalled();
  });
});
