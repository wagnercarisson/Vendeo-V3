// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: new Proxy(
    {},
    {
      get() {
        throw new Error("supabaseAdmin must not be touched by the resolver");
      },
    },
  ),
}));

import type { VerticalArtifactProbeResult } from "@/lib/product-9-16-two-stage/two-stage-financial-service";

import type { TwoFormatReadResult } from "../delivery-reader";
import type {
  TwoFormatDeliverReason,
  TwoFormatDeliverResult,
  TwoFormatRefundReason,
  TwoFormatRefundResult,
} from "../joint-financial-client";
import type { TwoFormatFormatView } from "../read-model";
import type { JointSquareProbeResult } from "../orchestration/square-probe";
import {
  JOINT_AUDIT_ACTION,
  resolveJointPending,
  type JointAuditEntry,
  type JointAuditLookup,
  type JointAuditRecord,
  type JointResolutionDeps,
  type JointResolutionRequest,
  type JointResolutionState,
  type JointResolutionStateResult,
} from "../orchestration/resolve-joint-pending";

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";
const SQUARE_DELIVERY = "44444444-4444-4444-8444-444444444444";
const TOKEN = "55555555-5555-4555-8555-555555555555";
const SQUARE_PATH = `${STORE}/${CAMPAIGN}/${SQUARE_DELIVERY}/square_original.jpg`;
const VERTICAL_PATH = `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg`;

type Behavior<T> = T | Error;

function behavior<T>(value: Behavior<T>): T {
  if (value instanceof Error) throw value;
  return value;
}

function twoFormatError(code: string): Error {
  return Object.assign(new Error(code), {
    name: "TwoFormatDeliveryError",
    code,
  });
}

function creditError(code: string): Error {
  return Object.assign(new Error(code), {
    name: "CreditOperationError",
    code,
  });
}

function attemptStartError(code: string): Error {
  return Object.assign(new Error(code), {
    name: "AttemptStartError",
    code,
  });
}

function uniqueViolation(): Error {
  return Object.assign(
    new Error("duplicate key value violates unique constraint"),
    { code: "23505" },
  );
}

function request(
  overrides: Partial<JointResolutionRequest> = {},
): JointResolutionRequest {
  return {
    actorId: "admin-1",
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    format: "9:16",
    action: "deliver",
    reason: "resolver pendencia",
    ...overrides,
  };
}

function formatView(
  format: "1:1" | "9:16",
  overrides: Partial<TwoFormatFormatView> = {},
): TwoFormatFormatView {
  return {
    format,
    state: "processing",
    creditRefunded: false,
    deliveryOperationId: format === "1:1" ? SQUARE_DELIVERY : OPERATION,
    artifactRole: format === "1:1" ? "square_original" : "vertical",
    artifactPath: null,
    supportReference: null,
    ...overrides,
  };
}

function readFound(
  overrides: {
    square?: Partial<TwoFormatFormatView>;
    vertical?: Partial<TwoFormatFormatView>;
  } = {},
): TwoFormatReadResult {
  return {
    kind: "found",
    view: {
      origin: "two_format_two_stage",
      campaignId: CAMPAIGN,
      operationId: OPERATION,
      square: formatView("1:1", overrides.square),
      vertical: formatView("9:16", overrides.vertical),
      preferredThumbnail: null,
    },
  };
}

function foundState(
  overrides: Partial<JointResolutionState> = {},
): JointResolutionStateResult {
  return {
    kind: "found",
    state: {
      storeId: STORE,
      creditStatus: "reserved",
      outcomeKind: "none",
      sharedOutcomeKind: "none",
      sharedCreditStatus: "reserved",
      activeClaim: false,
      linkComplete: true,
      ...overrides,
    },
  };
}

function squareIntegral(): JointSquareProbeResult {
  return {
    kind: "integral",
    storagePath: SQUARE_PATH,
    artifactId: "square-artifact",
    width: 1024,
    height: 1024,
    mimeType: "image/jpeg",
  };
}

function verticalIntegral(): VerticalArtifactProbeResult {
  return {
    kind: "integral",
    format: "9:16",
    width: 1080,
    height: 1920,
    mimeType: "image/jpeg",
    storagePath: VERTICAL_PATH,
    evidenceRef: "vertical-evidence",
  };
}

function delivered(
  overrides: Partial<Extract<TwoFormatDeliverResult, { success: true }>> = {},
): TwoFormatDeliverResult {
  return {
    success: true,
    idempotent: false,
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    format: "9:16",
    deliveryOperationId: OPERATION,
    artifactRole: "vertical",
    creditStatus: "delivered",
    campaignStatus: "ready",
    storagePath: VERTICAL_PATH,
    preferredFormat: "9:16",
    projected: true,
    alreadyProjected: false,
    ...overrides,
  };
}

function refunded(
  overrides: Partial<Extract<TwoFormatRefundResult, { success: true }>> = {},
): TwoFormatRefundResult {
  return {
    success: true,
    idempotent: false,
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    format: "9:16",
    deliveryOperationId: OPERATION,
    artifactRole: "vertical",
    creditStatus: "refunded",
    campaignStatus: "closed",
    storagePath: null,
    preferredFormat: null,
    projected: true,
    alreadyProjected: false,
    ...overrides,
  };
}

interface AuditRecordParams {
  readonly kind?: "resolution" | "reconciliation";
  readonly action?: "deliver" | "refund";
  readonly format?: "1:1" | "9:16";
  readonly deliveryOperationId?: string;
  readonly controlOperationId?: string;
  readonly targetType?: string;
  readonly targetId?: string;
  readonly recordOperationId?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

function auditRecord(params: AuditRecordParams = {}): JointAuditRecord {
  const kind = params.kind ?? "resolution";
  const action = params.action ?? "deliver";
  const format = params.format ?? "9:16";
  const deliveryOperationId = params.deliveryOperationId ?? OPERATION;
  return {
    action: JOINT_AUDIT_ACTION,
    targetType: params.targetType ?? "campaign",
    targetId: params.targetId ?? CAMPAIGN,
    operationId:
      params.recordOperationId === undefined
        ? deliveryOperationId
        : params.recordOperationId,
    metadata: {
      flow: "two_format",
      kind,
      action,
      format,
      campaign_id: CAMPAIGN,
      control_operation_id: params.controlOperationId ?? OPERATION,
      delivery_operation_id: deliveryOperationId,
      art_kind: kind === "resolution" ? "integral" : null,
      authorship: kind === "resolution" ? "admin" : "unverified",
      atomicity: "effect_then_audit",
      ...params.metadata,
    },
  };
}

interface AuditStore {
  record: JointAuditRecord | null;
  writes: JointAuditEntry[];
  reads: string[];
  readCount: number;
  failReadAt: number | null;
  readError: Error | null;
  writeError: Error | null;
  read: (operationId: string) => Promise<JointAuditLookup>;
  write: (entry: JointAuditEntry) => Promise<void>;
}

function makeAuditStore(initial: JointAuditRecord | null = null): AuditStore {
  const store: AuditStore = {
    record: initial,
    writes: [],
    reads: [],
    readCount: 0,
    failReadAt: null,
    readError: null,
    writeError: null,
    async read(operationId) {
      store.reads.push(operationId);
      store.readCount += 1;
      if (store.readError !== null || store.readCount === store.failReadAt) {
        throw new Error("audit_read_failed");
      }
      return store.record === null
        ? { kind: "absent" }
        : { kind: "found", record: store.record };
    },
    async write(entry) {
      if (store.writeError !== null) throw store.writeError;
      store.writes.push(entry);
      store.record = {
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        operationId: entry.operationId,
        metadata: entry.metadata,
      };
    },
  };
  return store;
}

interface DepsConfig {
  readonly read?: TwoFormatReadResult;
  readonly state?: JointResolutionStateResult;
  readonly stateSequence?: readonly JointResolutionStateResult[];
  readonly squareProbe?: Behavior<JointSquareProbeResult>;
  readonly verticalProbe?: Behavior<VerticalArtifactProbeResult>;
  readonly publication?: Behavior<{
    acquired: boolean;
    token: string | null;
    publicationState: string;
  }>;
  readonly epoch?: Behavior<number>;
  readonly deliver?: Behavior<TwoFormatDeliverResult>;
  readonly refund?: Behavior<TwoFormatRefundResult>;
  readonly outcomeThrows?: Error;
  readonly abortThrows?: Error;
  readonly onDeliver?: (audit: AuditStore) => void;
  readonly onRefund?: (audit: AuditStore) => void;
}

interface DepsRun {
  readonly deps: JointResolutionDeps;
  readonly order: string[];
  readonly audit: AuditStore;
}

function makeDeps(
  config: DepsConfig = {},
  audit: AuditStore = makeAuditStore(),
): DepsRun {
  const order: string[] = [];
  let stateReadIndex = 0;
  const deps: JointResolutionDeps = {
    readDelivery: vi.fn(async () => {
      order.push("read");
      return config.read ?? readFound();
    }),
    readResolutionState: vi.fn(async () => {
      order.push("state");
      const sequence = config.stateSequence;
      if (sequence !== undefined && sequence.length > 0) {
        const index = Math.min(stateReadIndex, sequence.length - 1);
        stateReadIndex += 1;
        return sequence[index];
      }
      return config.state ?? foundState();
    }),
    probeSquare: vi.fn(async () => {
      order.push("probe:square");
      return behavior(config.squareProbe ?? squareIntegral());
    }),
    probeVertical: vi.fn(async () => {
      order.push("probe:vertical");
      return behavior(config.verticalProbe ?? verticalIntegral());
    }),
    beginPublication: vi.fn(async () => {
      order.push("beginPublication");
      return behavior(
        config.publication ?? {
          acquired: true,
          token: TOKEN,
          publicationState: "acquired",
        },
      );
    }),
    abortPublication: vi.fn(async () => {
      order.push("abort");
      if (config.abortThrows !== undefined) throw config.abortThrows;
      return { success: true };
    }),
    getPublicationEpoch: vi.fn(async () => {
      order.push("epoch");
      return behavior(config.epoch ?? 11);
    }),
    recordFormatOutcome: vi.fn(async () => {
      order.push("outcome");
      if (config.outcomeThrows !== undefined) throw config.outcomeThrows;
    }),
    deliverFormat: vi.fn(async () => {
      order.push("deliver");
      config.onDeliver?.(audit);
      return behavior(config.deliver ?? delivered());
    }),
    refundFormat: vi.fn(async () => {
      order.push("refund");
      config.onRefund?.(audit);
      return behavior(config.refund ?? refunded());
    }),
    writeAudit: vi.fn(async (entry) => {
      order.push("audit:write");
      await audit.write(entry);
    }),
    readAuditByOperationId: vi.fn(async (operationId) => {
      order.push("audit:read");
      return audit.read(operationId);
    }),
  };
  return { deps, order, audit };
}

function indexOf(order: readonly string[], step: string): number {
  return order.indexOf(step);
}

function expectNoFinancialEffect(run: DepsRun): void {
  expect(run.deps.beginPublication).not.toHaveBeenCalled();
  expect(run.deps.deliverFormat).not.toHaveBeenCalled();
  expect(run.deps.refundFormat).not.toHaveBeenCalled();
  expect(run.deps.recordFormatOutcome).not.toHaveBeenCalled();
}

function expectNoAuditWrite(run: DepsRun): void {
  expect(run.audit.writes).toHaveLength(0);
}

describe("F60.7-09 — resolução administrativa por formato", () => {
  it("Teste 1: validação rejeita request inválido sem leitura, RPC ou auditoria", async () => {
    const cases: readonly [Partial<JointResolutionRequest>, string][] = [
      [{ actorId: "  " }, "missing_actor_id"],
      [{ reason: "   " }, "missing_reason"],
      [{ campaignId: "" }, "missing_campaign_id"],
      [{ operationId: "" }, "missing_operation_id"],
      [{ format: "4:5" as "9:16" }, "unsupported_format"],
    ];
    for (const [overrides, reason] of cases) {
      const run = makeDeps();
      expect(await resolveJointPending(request(overrides), run.deps)).toEqual({
        kind: "invalid_request",
        reason,
      });
      expect(run.deps.readDelivery).not.toHaveBeenCalled();
      expect(run.deps.readResolutionState).not.toHaveBeenCalled();
      expect(run.order).toEqual([]);
      expectNoFinancialEffect(run);
      expectNoAuditWrite(run);
    }
  });

  it("Teste 2: leitura indisponível é `unavailable`, nunca bloqueio financeiro ou fallback 1:1", async () => {
    const reads: readonly TwoFormatReadResult[] = [
      { kind: "not_two_format" },
      { kind: "not_found" },
      { kind: "inconsistent", reason: "par_incoerente" },
      { kind: "read_failed", reason: "db_down" },
    ];
    for (const read of reads) {
      const run = makeDeps({ read });
      expect(await resolveJointPending(request(), run.deps)).toEqual({
        kind: "unavailable",
        reason: read.kind,
      });
      expect(run.deps.readResolutionState).not.toHaveBeenCalled();
      expectNoFinancialEffect(run);
      expectNoAuditWrite(run);
    }

    const absent = makeDeps({ state: { kind: "absent" } });
    expect(await resolveJointPending(request(), absent.deps)).toEqual({
      kind: "unavailable",
      reason: "not_found",
    });
    expectNoFinancialEffect(absent);
    expectNoAuditWrite(absent);

    const failed = makeDeps({
      state: { kind: "read_failed", reason: "db_down" },
    });
    expect(await resolveJointPending(request(), failed.deps)).toEqual({
      kind: "unavailable",
      reason: "read_failed",
    });
    expectNoFinancialEffect(failed);
    expectNoAuditWrite(failed);
  });

  it("Teste 3: deliver feliz segue probe → beginPublication → deliverFormat → audit", async () => {
    const run = makeDeps();
    const outcome = await resolveJointPending(request(), run.deps);

    expect(outcome).toEqual({
      kind: "resolved",
      action: "deliver",
      format: "9:16",
      idempotent: false,
      auditRecorded: true,
    });
    expect(
      indexOf(run.order, "probe:vertical") <
        indexOf(run.order, "beginPublication"),
    ).toBe(true);
    expect(
      indexOf(run.order, "beginPublication") < indexOf(run.order, "deliver"),
    ).toBe(true);
    expect(indexOf(run.order, "deliver") < indexOf(run.order, "audit:write")).toBe(
      true,
    );
    expect(run.deps.beginPublication).toHaveBeenCalledWith(CAMPAIGN, OPERATION);
    expect(run.deps.deliverFormat).toHaveBeenCalledWith({
      storeId: STORE,
      campaignId: CAMPAIGN,
      operationId: OPERATION,
      format: "9:16",
      publicationToken: TOKEN,
    });
    expect(run.audit.writes).toHaveLength(1);
  });

  it("Teste 3b: deliver do quadrado usa a identidade financeira própria no token", async () => {
    const run = makeDeps({ read: readFound() });
    const outcome = await resolveJointPending(
      request({ format: "1:1" }),
      run.deps,
    );

    expect(outcome.kind).toBe("resolved");
    expect(run.deps.beginPublication).toHaveBeenCalledWith(
      CAMPAIGN,
      SQUARE_DELIVERY,
    );
    expect(run.deps.deliverFormat).toHaveBeenCalledWith({
      storeId: STORE,
      campaignId: CAMPAIGN,
      operationId: OPERATION,
      format: "1:1",
      publicationToken: TOKEN,
    });
    expect(run.audit.writes[0]?.operationId).toBe(SQUARE_DELIVERY);
  });

  it("Teste 4: deliver sem token é `publication_pending`, sem RPC de crédito e sem auditoria", async () => {
    const run = makeDeps({
      publication: { acquired: false, token: null, publicationState: "busy" },
    });
    expect(await resolveJointPending(request(), run.deps)).toEqual({
      kind: "publication_pending",
    });
    expect(run.deps.deliverFormat).not.toHaveBeenCalled();
    expectNoAuditWrite(run);
  });

  it("Teste 5: replay terminal do deliver com auditoria equivalente não repete efeito", async () => {
    const audit = makeAuditStore(auditRecord());
    const run = makeDeps({ state: foundState({ creditStatus: "delivered" }) }, audit);

    expect(await resolveJointPending(request(), run.deps)).toEqual({
      kind: "resolved",
      action: "deliver",
      format: "9:16",
      idempotent: true,
      auditRecorded: true,
      alreadyAudited: true,
    });
    expect(run.deps.getPublicationEpoch).not.toHaveBeenCalled();
    expect(run.deps.probeVertical).not.toHaveBeenCalled();
    expectNoFinancialEffect(run);
    expectNoAuditWrite(run);
  });

  it("Teste 5b: terminal sem prova grava reconciliação, nunca resolução do ator", async () => {
    const run = makeDeps({ state: foundState({ creditStatus: "delivered" }) });
    expect(await resolveJointPending(request(), run.deps)).toEqual({
      kind: "reconciled",
      action: "deliver",
      format: "9:16",
      auditRecorded: true,
      authorship: "unverified",
    });
    expect(run.deps.probeVertical).not.toHaveBeenCalled();
    expectNoFinancialEffect(run);
    expect(run.audit.writes).toHaveLength(1);
    expect(run.audit.writes[0]?.metadata).toMatchObject({
      kind: "reconciliation",
      authorship: "unverified",
      art_kind: null,
    });
  });

  it("Teste 5c: auditoria divergente bloqueia ANTES de token/RPC", async () => {
    const audit = makeAuditStore(auditRecord({ action: "refund" }));
    const run = makeDeps({}, audit);

    expect(await resolveJointPending(request(), run.deps)).toEqual({
      kind: "audit_conflict",
    });
    expect(run.deps.getPublicationEpoch).not.toHaveBeenCalled();
    expect(run.deps.probeVertical).not.toHaveBeenCalled();
    expectNoFinancialEffect(run);
    expectNoAuditWrite(run);

    const equivalent = makeDeps(
      {
        stateSequence: [
          foundState(),
          foundState({ creditStatus: "delivered" }),
        ],
      },
      makeAuditStore(auditRecord()),
    );
    expect(await resolveJointPending(request(), equivalent.deps)).toEqual({
      kind: "resolved",
      action: "deliver",
      format: "9:16",
      idempotent: true,
      auditRecorded: true,
      alreadyAudited: true,
    });
    expect(equivalent.order.filter((step) => step === "state")).toHaveLength(2);
    expectNoFinancialEffect(equivalent);
    expectNoAuditWrite(equivalent);

    const nonTerminal = makeDeps({}, makeAuditStore(auditRecord()));
    expect(await resolveJointPending(request(), nonTerminal.deps)).toEqual({
      kind: "audit_conflict",
    });
    expect(nonTerminal.order.filter((step) => step === "state")).toHaveLength(2);
    expectNoFinancialEffect(nonTerminal);
    expectNoAuditWrite(nonTerminal);

    const reconciled = makeDeps(
      {
        stateSequence: [
          foundState(),
          foundState({ creditStatus: "delivered" }),
        ],
      },
      makeAuditStore(auditRecord({ kind: "reconciliation" })),
    );
    expect(await resolveJointPending(request(), reconciled.deps)).toEqual({
      kind: "reconciled",
      action: "deliver",
      format: "9:16",
      auditRecorded: true,
      authorship: "unverified",
      alreadyReconciled: true,
    });
    expectNoFinancialEffect(reconciled);
    expectNoAuditWrite(reconciled);

    const rereadFailed = makeDeps(
      {
        stateSequence: [
          foundState(),
          { kind: "read_failed", reason: "db_down" },
        ],
      },
      makeAuditStore(auditRecord()),
    );
    expect(await resolveJointPending(request(), rereadFailed.deps)).toEqual({
      kind: "audit_unavailable",
      code: "audit_read_failed",
    });
    expectNoFinancialEffect(rereadFailed);
    expectNoAuditWrite(rereadFailed);
  });

  it("Teste 6: deliver de crédito refundido é bloqueio terminal sem efeito nem auditoria", async () => {
    const run = makeDeps({ state: foundState({ creditStatus: "refunded" }) });
    expect(await resolveJointPending(request(), run.deps)).toEqual({
      kind: "blocked",
      block: "operation_terminal",
      outcomeRecorded: false,
    });
    expect(run.deps.beginPublication).not.toHaveBeenCalled();
    expect(run.deps.deliverFormat).not.toHaveBeenCalled();
    expectNoAuditWrite(run);
  });

  it("Teste 7: refund feliz lê epoch antes da sonda e audita depois", async () => {
    const state = foundState({
      outcomeKind: "failed",
      sharedOutcomeKind: "failed",
      sharedCreditStatus: "reserved",
    });
    const run = makeDeps(
      { state, verticalProbe: { kind: "absent" }, epoch: 23 },
    );

    expect(
      await resolveJointPending(request({ action: "refund" }), run.deps),
    ).toEqual({
      kind: "resolved",
      action: "refund",
      format: "9:16",
      idempotent: false,
      auditRecorded: true,
    });
    expect(
      indexOf(run.order, "epoch") < indexOf(run.order, "probe:vertical"),
    ).toBe(true);
    expect(
      indexOf(run.order, "probe:vertical") < indexOf(run.order, "refund"),
    ).toBe(true);
    expect(indexOf(run.order, "refund") < indexOf(run.order, "audit:write")).toBe(
      true,
    );
    expect(run.deps.getPublicationEpoch).toHaveBeenCalledWith(
      CAMPAIGN,
      OPERATION,
    );
    expect(run.deps.refundFormat).toHaveBeenCalledWith({
      storeId: STORE,
      campaignId: CAMPAIGN,
      operationId: OPERATION,
      format: "9:16",
      artKind: "absent",
      observedEpoch: 23,
      reason: "resolver pendencia",
    });
    expect(run.audit.writes[0]?.metadata.art_kind).toBe("absent");
  });

  it("Teste 7b: refund sem finalidade compartilhada é bloqueado pelo guard", async () => {
    const state = foundState({
      sharedOutcomeKind: "none",
      sharedCreditStatus: "reserved",
    });
    const run = makeDeps({ state, verticalProbe: { kind: "absent" } });

    expect(
      await resolveJointPending(request({ action: "refund" }), run.deps),
    ).toEqual({
      kind: "blocked",
      block: "shared_operation_not_final",
      outcomeRecorded: false,
    });
    expect(run.deps.recordFormatOutcome).not.toHaveBeenCalled();
    expect(run.deps.refundFormat).not.toHaveBeenCalled();
    expectNoAuditWrite(run);
  });

  it("Teste 7c: refund do quadrado confirma outcome antes da RPC", async () => {
    const state = foundState({
      outcomeKind: "failed",
      sharedCreditStatus: "refunded",
    });
    const run = makeDeps({
      state,
      squareProbe: { kind: "absent" },
      epoch: 31,
      refund: refunded({
        format: "1:1",
        deliveryOperationId: SQUARE_DELIVERY,
        artifactRole: "square_original",
        storagePath: null,
        preferredFormat: null,
      }),
    });

    expect(
      await resolveJointPending(
        request({ action: "refund", format: "1:1" }),
        run.deps,
      ),
    ).toEqual({
      kind: "resolved",
      action: "refund",
      format: "1:1",
      idempotent: false,
      auditRecorded: true,
    });
    expect(
      indexOf(run.order, "probe:square") < indexOf(run.order, "outcome"),
    ).toBe(true);
    expect(
      indexOf(run.order, "outcome") < indexOf(run.order, "refund"),
    ).toBe(true);
    expect(run.deps.recordFormatOutcome).toHaveBeenCalledWith({
      campaignId: CAMPAIGN,
      operationId: SQUARE_DELIVERY,
      outcome: "failed",
    });
    expect(run.deps.refundFormat).toHaveBeenCalledWith({
      storeId: STORE,
      campaignId: CAMPAIGN,
      operationId: OPERATION,
      format: "1:1",
      artKind: "absent",
      observedEpoch: 31,
      reason: "resolver pendencia",
    });
    expect(run.audit.writes).toHaveLength(1);
    expect(run.audit.writes[0]?.operationId).toBe(SQUARE_DELIVERY);
  });

  it("Teste 7d: outcome desconhecido do quadrado bloqueia antes de outcome/refund", async () => {
    const state = foundState({
      outcomeKind: "unknown",
      sharedCreditStatus: "refunded",
    });
    const run = makeDeps({ state, squareProbe: { kind: "absent" } });

    expect(
      await resolveJointPending(
        request({ action: "refund", format: "1:1" }),
        run.deps,
      ),
    ).toEqual({
      kind: "blocked",
      block: "unknown_outcome",
      outcomeRecorded: false,
    });
    expect(run.deps.recordFormatOutcome).not.toHaveBeenCalled();
    expect(run.deps.refundFormat).not.toHaveBeenCalled();
    expectNoAuditWrite(run);
  });

  it("Teste 7e: outcome do quadrado não confirmado vira bloqueio sem refund", async () => {
    const state = foundState({
      outcomeKind: "failed",
      sharedCreditStatus: "refunded",
    });
    const run = makeDeps({
      state,
      squareProbe: { kind: "absent" },
      outcomeThrows: attemptStartError("operation_terminal"),
    });

    expect(
      await resolveJointPending(
        request({ action: "refund", format: "1:1" }),
        run.deps,
      ),
    ).toEqual({
      kind: "blocked",
      block: "operation_terminal",
      outcomeRecorded: false,
    });
    expect(run.deps.refundFormat).not.toHaveBeenCalled();
    expectNoAuditWrite(run);
  });

  it("Teste 7f: replay terminal do refund não lê epoch, sonda nem executa RPC", async () => {
    const audit = makeAuditStore(auditRecord({ action: "refund" }));
    const run = makeDeps(
      { state: foundState({ creditStatus: "refunded" }) },
      audit,
    );

    expect(
      await resolveJointPending(request({ action: "refund" }), run.deps),
    ).toEqual({
      kind: "resolved",
      action: "refund",
      format: "9:16",
      idempotent: true,
      auditRecorded: true,
      alreadyAudited: true,
    });
    expect(run.deps.getPublicationEpoch).not.toHaveBeenCalled();
    expect(run.deps.probeVertical).not.toHaveBeenCalled();
    expect(run.deps.recordFormatOutcome).not.toHaveBeenCalled();
    expect(run.deps.refundFormat).not.toHaveBeenCalled();
    expectNoAuditWrite(run);
  });

  it("Teste 8: refund com arte presente é bloqueado", async () => {
    const state = foundState({ sharedCreditStatus: "refunded" });
    const run = makeDeps({ state, verticalProbe: verticalIntegral() });

    expect(
      await resolveJointPending(request({ action: "refund" }), run.deps),
    ).toEqual({
      kind: "blocked",
      block: "artifact_present",
      outcomeRecorded: false,
    });
    expect(run.deps.refundFormat).not.toHaveBeenCalled();
    expectNoAuditWrite(run);
  });

  it("Teste 9: refund indeterminado ou inválido bloqueia com evidência distinta", async () => {
    const state = foundState({ sharedCreditStatus: "refunded" });
    const indeterminate = makeDeps({
      state,
      verticalProbe: { kind: "indeterminate" },
    });
    expect(
      await resolveJointPending(
        request({ action: "refund" }),
        indeterminate.deps,
      ),
    ).toEqual({
      kind: "blocked",
      block: "insufficient_evidence",
      outcomeRecorded: false,
    });
    expect(indeterminate.deps.refundFormat).not.toHaveBeenCalled();
    expectNoAuditWrite(indeterminate);

    const invalid = makeDeps({ state, verticalProbe: { kind: "invalid" } });
    expect(
      await resolveJointPending(request({ action: "refund" }), invalid.deps),
    ).toEqual({
      kind: "blocked",
      block: "invalid_evidence",
      outcomeRecorded: false,
    });
    expect(invalid.deps.refundFormat).not.toHaveBeenCalled();
    expectNoAuditWrite(invalid);
  });

  it("Teste 9b: leitura parcial bloqueia mesmo com alvo íntegro", async () => {
    const sibling = makeDeps({
      read: readFound({ vertical: { state: "unavailable" } }),
    });
    expect(await resolveJointPending(request({ format: "1:1" }), sibling.deps)).toEqual({
      kind: "blocked",
      block: "delivery_link_incomplete",
      outcomeRecorded: false,
    });
    expectNoFinancialEffect(sibling);
    expectNoAuditWrite(sibling);

    const linkIncomplete = makeDeps({
      state: foundState({ linkComplete: false }),
    });
    expect(await resolveJointPending(request(), linkIncomplete.deps)).toEqual({
      kind: "blocked",
      block: "delivery_link_incomplete",
      outcomeRecorded: false,
    });
    expectNoFinancialEffect(linkIncomplete);
    expectNoAuditWrite(linkIncomplete);
  });

  it("Teste 10: claim ativo bloqueia antes de qualquer efeito", async () => {
    const run = makeDeps({ state: foundState({ activeClaim: true }) });
    expect(await resolveJointPending(request(), run.deps)).toEqual({
      kind: "blocked",
      block: "operation_in_progress",
      outcomeRecorded: false,
    });
    expectNoFinancialEffect(run);
    expectNoAuditWrite(run);
  });

  it("Teste 11: refund de crédito entregue não é permitido", async () => {
    const run = makeDeps({
      state: foundState({ creditStatus: "delivered" }),
      verticalProbe: { kind: "absent" },
    });
    expect(
      await resolveJointPending(request({ action: "refund" }), run.deps),
    ).toEqual({
      kind: "blocked",
      block: "delivered_not_refundable",
      outcomeRecorded: false,
    });
    expect(run.deps.refundFormat).not.toHaveBeenCalled();
    expectNoAuditWrite(run);
  });

  it("Teste 12: bloqueios tipados preservam a união 09; códigos não mapeados falham", async () => {
    const deliverBlocks: readonly TwoFormatDeliverReason[] = [
      "delivery_link_missing",
      "credit_operation_missing",
      "invalid_transition",
    ];
    for (const reason of deliverBlocks) {
      const run = makeDeps({ deliver: { success: false, reason } });
      expect(await resolveJointPending(request(), run.deps)).toEqual({
        kind: "blocked",
        block: reason,
        outcomeRecorded: false,
      });
      expectNoAuditWrite(run);
    }

    const incompatible = makeDeps({
      deliver: { success: false, reason: "artifact_incompatible" },
    });
    expect(await resolveJointPending(request(), incompatible.deps)).toEqual({
      kind: "failed",
      code: "artifact_incompatible",
    });
    expectNoAuditWrite(incompatible);

    const refundBlocks: readonly TwoFormatRefundReason[] = [
      "delivered_not_refundable",
      "artifact_present",
      "insufficient_evidence",
      "invalid_transition",
      "delivery_link_missing",
      "credit_operation_missing",
    ];
    for (const reason of refundBlocks) {
      const run = makeDeps({
        state: foundState({ sharedCreditStatus: "refunded" }),
        verticalProbe: { kind: "absent" },
        refund: { success: false, reason },
      });
      expect(
        await resolveJointPending(request({ action: "refund" }), run.deps),
      ).toEqual({
        kind: "blocked",
        block: reason,
        outcomeRecorded: false,
      });
      expectNoAuditWrite(run);
    }

    const creditBlocks: readonly string[] = [
      "finality_not_recorded",
      "shared_operation_not_final",
      "operation_in_progress",
      "publication_in_progress",
      "evidence_stale",
      "stale_publication",
      "publication_not_owner",
    ];
    for (const code of creditBlocks) {
      const run = makeDeps({
        state: foundState({ sharedCreditStatus: "refunded" }),
        verticalProbe: { kind: "absent" },
        refund: creditError(code),
      });
      expect(
        await resolveJointPending(request({ action: "refund" }), run.deps),
      ).toEqual({
        kind: "blocked",
        block: code,
        outcomeRecorded: false,
      });
      expectNoAuditWrite(run);
    }

    const absentNotConfirmed = makeDeps({
      state: foundState({ sharedCreditStatus: "refunded" }),
      verticalProbe: { kind: "absent" },
      refund: creditError("absent_not_confirmed"),
    });
    expect(
      await resolveJointPending(
        request({ action: "refund" }),
        absentNotConfirmed.deps,
      ),
    ).toEqual({
      kind: "blocked",
      block: "insufficient_evidence",
      outcomeRecorded: false,
    });
    expectNoAuditWrite(absentNotConfirmed);

    const failedCodes: readonly string[] = [
      "invalid_envelope",
      "delivery_links_inconsistent",
      "unknown",
      "mystery_code",
    ];
    for (const code of failedCodes) {
      const run = makeDeps({
        state: foundState({ sharedCreditStatus: "refunded" }),
        verticalProbe: { kind: "absent" },
        refund: twoFormatError(code),
      });
      expect(
        await resolveJointPending(request({ action: "refund" }), run.deps),
      ).toEqual({ kind: "failed", code });
      expectNoAuditWrite(run);
    }
  });

  it("Teste 12c: abort restrito à allowlist; ambíguo preserva o fence", async () => {
    const abortable = makeDeps({
      deliver: { success: false, reason: "artifact_incompatible" },
    });
    expect(await resolveJointPending(request(), abortable.deps)).toEqual({
      kind: "failed",
      code: "artifact_incompatible",
    });
    expect(abortable.deps.abortPublication).toHaveBeenCalledTimes(1);
    expect(abortable.deps.abortPublication).toHaveBeenCalledWith(
      CAMPAIGN,
      OPERATION,
      TOKEN,
      "before_upload",
    );
    expectNoAuditWrite(abortable);

    const invalidEnvelope = makeDeps({
      deliver: twoFormatError("invalid_envelope"),
    });
    expect(await resolveJointPending(request(), invalidEnvelope.deps)).toEqual({
      kind: "failed",
      code: "invalid_envelope",
    });
    expect(invalidEnvelope.deps.abortPublication).not.toHaveBeenCalled();
    expectNoAuditWrite(invalidEnvelope);

    const transport = makeDeps({ deliver: new Error("socket") });
    expect(await resolveJointPending(request(), transport.deps)).toEqual({
      kind: "failed",
      code: "unknown",
    });
    expect(transport.deps.abortPublication).not.toHaveBeenCalled();
    expectNoAuditWrite(transport);
  });

  it("Teste 12d: falha de leitura da auditoria é `audit_unavailable` antes de qualquer efeito", async () => {
    const audit = makeAuditStore();
    audit.readError = new Error("audit_down");
    const run = makeDeps({}, audit);

    expect(await resolveJointPending(request(), run.deps)).toEqual({
      kind: "audit_unavailable",
      code: "audit_read_failed",
    });
    expect(run.deps.getPublicationEpoch).not.toHaveBeenCalled();
    expect(run.deps.probeVertical).not.toHaveBeenCalled();
    expectNoFinancialEffect(run);
    expectNoAuditWrite(run);
  });

  it("Teste 13: auditoria usa identidade determinística e motivo trim", async () => {
    const run = makeDeps();
    await resolveJointPending(request({ reason: "  motivo  " }), run.deps);

    const entry = run.audit.writes[0];
    expect(entry).toBeDefined();
    expect(entry?.actorId).toBe("admin-1");
    expect(entry?.action).toBe("product_1_1_pending_resolution");
    expect(entry?.targetType).toBe("campaign");
    expect(entry?.targetId).toBe(CAMPAIGN);
    expect(entry?.reason).toBe("motivo");
    expect(entry?.operationId).toBe(OPERATION);
    expect(entry?.metadata).toMatchObject({
      flow: "two_format",
      kind: "resolution",
      action: "deliver",
      format: "9:16",
      campaign_id: CAMPAIGN,
      control_operation_id: OPERATION,
      delivery_operation_id: OPERATION,
      art_kind: "integral",
      authorship: "admin",
      atomicity: "effect_then_audit",
    });
  });

  it("Teste 14: unique violation revalida equivalência e nunca promove divergência", async () => {
    const equivalentAudit = makeAuditStore();
    equivalentAudit.writeError = uniqueViolation();
    const equivalent = makeDeps(
      { onDeliver: (audit) => { audit.record = auditRecord(); } },
      equivalentAudit,
    );
    expect(await resolveJointPending(request(), equivalent.deps)).toEqual({
      kind: "resolved",
      action: "deliver",
      format: "9:16",
      idempotent: true,
      auditRecorded: true,
      alreadyAudited: true,
    });
    expectNoAuditWrite(equivalent);

    const divergentAudit = makeAuditStore();
    divergentAudit.writeError = uniqueViolation();
    const divergent = makeDeps(
      {
        onDeliver: (audit) => {
          audit.record = auditRecord({ action: "refund" });
        },
      },
      divergentAudit,
    );
    expect(await resolveJointPending(request(), divergent.deps)).toEqual({
      kind: "audit_conflict",
    });
    expectNoAuditWrite(divergent);

    const reconciledAudit = makeAuditStore();
    reconciledAudit.writeError = uniqueViolation();
    const reconciliationCollision = makeDeps(
      {
        onDeliver: (audit) => {
          audit.record = auditRecord({ kind: "reconciliation" });
        },
      },
      reconciledAudit,
    );
    expect(
      await resolveJointPending(request(), reconciliationCollision.deps),
    ).toEqual({
      kind: "reconciled",
      action: "deliver",
      format: "9:16",
      auditRecorded: true,
      authorship: "unverified",
      alreadyReconciled: true,
    });
    expectNoAuditWrite(reconciliationCollision);

    const rereadFailure = makeAuditStore();
    rereadFailure.writeError = uniqueViolation();
    rereadFailure.failReadAt = 2;
    const resolutionReread = makeDeps({}, rereadFailure);
    expect(await resolveJointPending(request(), resolutionReread.deps)).toEqual({
      kind: "audit_unavailable",
      code: "audit_read_failed",
    });
    expect(resolutionReread.deps.deliverFormat).toHaveBeenCalledTimes(1);

    const reconciliationReread = makeAuditStore();
    reconciliationReread.writeError = uniqueViolation();
    reconciliationReread.failReadAt = 2;
    const reconciliationRun = makeDeps(
      { state: foundState({ creditStatus: "delivered" }) },
      reconciliationReread,
    );
    expect(
      await resolveJointPending(request(), reconciliationRun.deps),
    ).toEqual({
      kind: "audit_unavailable",
      code: "audit_read_failed",
    });
    expectNoFinancialEffect(reconciliationRun);
  });

  it("Teste 15: falha de auditoria deixa `audit_pending` e retry só audita", async () => {
    const audit = makeAuditStore();
    audit.writeError = new Error("insert_failed");
    const first = makeDeps({}, audit);
    expect(await resolveJointPending(request(), first.deps)).toEqual({
      kind: "audit_pending",
      code: "audit_write_failed",
    });

    audit.writeError = null;
    const replay = makeDeps(
      { state: foundState({ creditStatus: "delivered" }) },
      audit,
    );
    expect(await resolveJointPending(request(), replay.deps)).toEqual({
      kind: "reconciled",
      action: "deliver",
      format: "9:16",
      auditRecorded: true,
      authorship: "unverified",
    });
    expect(replay.deps.getPublicationEpoch).not.toHaveBeenCalled();
    expect(replay.deps.probeVertical).not.toHaveBeenCalled();
    expectNoFinancialEffect(replay);
    expect(audit.writes).toHaveLength(1);
    expect(audit.writes[0]?.metadata.kind).toBe("reconciliation");
  });

  it("Teste 16: o serviço não muta crédito nem projeta", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "src/lib/product-two-format/orchestration/resolve-joint-pending.ts",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/\.update\(/);
    expect(source).not.toMatch(/\.insert\(/);
    expect(source).not.toMatch(/\.rpc\("product_1_1_/);
    expect(source).not.toMatch(/product_1_1_reserve/);
    expect(source).not.toMatch(/product_1_1_deliver/);
    expect(source).not.toMatch(/product_1_1_mark/);
    expect(source).not.toMatch(/projectDelivered\(/);
    expect(source).not.toMatch(/projectClosed\(/);
    expect(source).not.toMatch(/projectCampaign\(/);
    expect(source).not.toMatch(/generateCampaignThumbnail\(/);
    expect(source).not.toMatch(/markArtUploaded/);
  });

  it("Teste 17: paridade com o guard — próprio `none` + compartilhado `unknown` bloqueia", async () => {
    const run = makeDeps({
      state: foundState({
        outcomeKind: "none",
        sharedOutcomeKind: "unknown",
      }),
      squareProbe: squareIntegral(),
    });
    expect(await resolveJointPending(request({ format: "1:1" }), run.deps)).toEqual({
      kind: "blocked",
      block: "unknown_outcome",
      outcomeRecorded: false,
    });
    expectNoFinancialEffect(run);
    expectNoAuditWrite(run);
  });

  it("Teste 18: equivalência inclui target e operação de controle", async () => {
    const variants: readonly AuditRecordParams[] = [
      { targetType: "store" },
      { targetId: "outra-campanha" },
      { controlOperationId: "outra-operacao" },
      { metadata: { control_operation_id: "outra-operacao" } },
    ];
    for (const variant of variants) {
      const run = makeDeps({}, makeAuditStore(auditRecord(variant)));
      expect(await resolveJointPending(request(), run.deps)).toEqual({
        kind: "audit_conflict",
      });
      expectNoFinancialEffect(run);
      expectNoAuditWrite(run);
    }
  });

  it("Teste 19: `idempotent:true` não presume autoria desta execução", async () => {
    const equivalentAudit = makeAuditStore();
    const equivalent = makeDeps(
      {
        deliver: delivered({ idempotent: true }),
        onDeliver: (audit) => {
          audit.record = auditRecord();
        },
      },
      equivalentAudit,
    );
    expect(await resolveJointPending(request(), equivalent.deps)).toEqual({
      kind: "resolved",
      action: "deliver",
      format: "9:16",
      idempotent: true,
      auditRecorded: true,
      alreadyAudited: true,
    });
    expect(equivalentAudit.writes).toHaveLength(0);

    const absentAudit = makeAuditStore();
    const absent = makeDeps(
      { deliver: delivered({ idempotent: true }) },
      absentAudit,
    );
    expect(await resolveJointPending(request(), absent.deps)).toEqual({
      kind: "reconciled",
      action: "deliver",
      format: "9:16",
      auditRecorded: true,
      authorship: "unverified",
    });
    expect(absentAudit.writes).toHaveLength(1);
    expect(absentAudit.writes[0]?.metadata).toMatchObject({
      kind: "reconciliation",
      authorship: "unverified",
      art_kind: null,
    });
  });

  it("Teste 20: replay de reconciliação não cria novo INSERT nem conflito por kind", async () => {
    const audit = makeAuditStore();
    const first = makeDeps(
      { state: foundState({ creditStatus: "delivered" }) },
      audit,
    );
    expect(await resolveJointPending(request(), first.deps)).toEqual({
      kind: "reconciled",
      action: "deliver",
      format: "9:16",
      auditRecorded: true,
      authorship: "unverified",
    });
    expect(audit.writes).toHaveLength(1);
    expect(audit.writes[0]?.metadata).toMatchObject({
      kind: "reconciliation",
      authorship: "unverified",
      art_kind: null,
    });

    const replay = makeDeps(
      { state: foundState({ creditStatus: "delivered" }) },
      audit,
    );
    expect(await resolveJointPending(request(), replay.deps)).toEqual({
      kind: "reconciled",
      action: "deliver",
      format: "9:16",
      auditRecorded: true,
      authorship: "unverified",
      alreadyReconciled: true,
    });
    expect(audit.writes).toHaveLength(1);
    expect(replay.deps.probeVertical).not.toHaveBeenCalled();
    expectNoFinancialEffect(replay);

    const structural = makeDeps(
      {
        state: foundState({
          creditStatus: "delivered",
          linkComplete: false,
        }),
      },
      audit,
    );
    expect(await resolveJointPending(request(), structural.deps)).toEqual({
      kind: "blocked",
      block: "delivery_link_incomplete",
      outcomeRecorded: false,
    });
    expect(audit.writes).toHaveLength(1);
    expectNoFinancialEffect(structural);
  });
});
