import { vi } from "vitest";
import type { RunNineSixteenDeps } from "../../types";
import { durableReconstruction } from "../fixtures";

export const INTEGRATED_VIEW = {
  campaignId: "c",
  operationId: "o",
  origin: "9_16_two_stage" as const,
  credit: { status: "reserved", terminal: false, delivered: false, refunded: false, reserved: true },
  base: { stage: "base" as const, status: "pending" as const, attemptsUsed: 0, failureClass: null, attemptNumber: null, claimedAt: null },
  expansion: { stage: "expansion" as const, status: "pending" as const, attemptsUsed: 0, failureClass: null, attemptNumber: null, claimedAt: null },
  unknown: false,
  failedOutcome: false,
  supportReference: null,
  nextAction: "acquire_base" as const,
  canContinue: true,
  processingPhase: null,
};

export function makeIntegratedDeps(overrides: Record<string, unknown> = {}): RunNineSixteenDeps {
  return {
    control: {
      getOperationView: vi.fn(async () => ({ kind: "absent" })),
      resume: vi.fn(async () => ({
        success: true,
        action: "deliver",
        nextTarget: null,
        origin: "9_16_two_stage",
        creditStatus: "reserved",
        baseStatus: "done",
        baseAttempts: 1,
        expansionStatus: "done",
        expansionAttempts: 1,
        unknown: false,
        failedOutcome: false,
      })),
      acquire: vi.fn(async (request: { stage: string }) => ({
        acquired: true,
        authorization: "execute",
        reason: null,
        attemptToken: "t",
        attemptNumber: 1,
        stage: request.stage,
        target: request.stage === "base" ? "primary" : "initial",
      })),
      finish: vi.fn(async () => ({
        success: true,
        idempotent: false,
        status: "completed",
        stage: "base",
        attemptNumber: 1,
      })),
      recordOutcome: vi.fn(async (request: { outcome: string }) => ({
        success: true,
        idempotent: false,
        outcome: request.outcome,
        stage: "base",
        supportReference: null,
      })),
    },
    financial: {
      reserveOperationOnce: vi.fn(async () => ({ status: "reserved" })),
      confirmOnVerticalDelivery: vi.fn(async () => ({ status: "delivered" })),
      refundOnDefinitiveFailure: vi.fn(async () => ({ kind: "refunded", state: { status: "refunded" } })),
      readFinancialAuthority: vi.fn(async () => ({
        status: "reserved",
        terminal: false,
        delivered: false,
        refunded: false,
        reserved: true,
        storeId: "s",
      })),
    },
    credit: {
      beginPublication: vi.fn(async () => ({ acquired: true, token: "t" })),
      getPublicationEpoch: vi.fn(async () => 1),
      markArtUploaded: vi.fn(),
      deliver: vi.fn(),
    },
    clock: () => 0,
    callIdFactory: () => "call",
    newSupportReference: () => "ref",
    base: vi.fn(async () => ({
      kind: "completed",
      copy: { kind: "not_requested" },
      art: { kind: "created", artifact: {}, snapshotOriginalId: "s" },
      call: null,
    })),
    prepare: vi.fn(async () => ({ kind: "prepared", artifact: {}, bytes: Buffer.alloc(0), persistence: "created" })),
    expand: vi.fn(async () => ({ kind: "expanded", artifact: {}, bytes: Buffer.alloc(0), persistence: "created", call: {} })),
    readFrozenState: vi.fn(async () => ({ kind: "complete" })),
    retrieveCompositionArtifact: vi.fn(async () => ({ kind: "integral", artifact: { id: "p" }, bytes: Buffer.alloc(0) })),
    probeExpansion: vi.fn(async () => ({ kind: "proceed" })),
    projectDelivered: vi.fn(async () => ({ projected: true, reason: "projected" })),
    projectClosed: vi.fn(async () => ({ projected: true, reason: "projected" })),
    probeVertical: {
      probeVerticalArtifact: vi.fn(async () => ({
        kind: "integral",
        format: "9:16",
        width: 1080,
        height: 1920,
        mimeType: "image/jpeg",
        storagePath: "s/c/o/vertical.jpg",
        evidenceRef: "e",
      })),
    },
    generateThumbnail: vi.fn(async () => ({ status: "created" })),
    reconstruction: durableReconstruction(),
    ...overrides,
  } as never;
}
