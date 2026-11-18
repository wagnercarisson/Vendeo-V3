// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  BaseStepDeps,
  BaseStepInput,
} from "@/lib/product-9-16-two-stage/orchestration/base-step";

const { runBaseStepMock } = vi.hoisted(() => ({
  runBaseStepMock: vi.fn(),
}));

vi.mock("@/lib/product-9-16-two-stage/orchestration/base-step", () => ({
  runBaseStep: runBaseStepMock,
}));

const { runJointBase } = await import("../orchestration/joint-base");

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";
const CLIENT = { marker: "injected-client" };
const CONTENT = { marker: "reconstructed-content" };
const FROZEN = { kind: "absent" };
const BASE = vi.fn();
const CONTROL = { marker: "control" };
const READ_INPUT = vi.fn();
const READ_FROZEN = vi.fn();
const REPAIR = vi.fn();

function input(overrides: Partial<BaseStepInput> = {}): BaseStepInput {
  return {
    storeId: STORE,
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    authorization: { kind: "system" },
    content: CONTENT as never,
    frozenState: FROZEN as never,
    acquisitionId: "acquisition-1",
    attemptReference: "attempt-1",
    attemptTarget: "primary",
    deadlineAtMs: 123456,
    baseStatus: "pending",
    allowNewPaidStep: true,
    ...overrides,
  } as BaseStepInput;
}

function deps(overrides: Partial<BaseStepDeps> = {}): BaseStepDeps {
  return {
    control: CONTROL as never,
    base: BASE as never,
    clock: () => 1,
    client: CLIENT as never,
    readInputBytes: READ_INPUT as never,
    readFrozenState: READ_FROZEN as never,
    repairEvidence: REPAIR as never,
    ...overrides,
  } as BaseStepDeps;
}

beforeEach(() => {
  runBaseStepMock.mockReset();
  BASE.mockReset();
  READ_INPUT.mockReset();
  READ_FROZEN.mockReset();
  REPAIR.mockReset();
});

describe("base conjunta — identidade de controle e repasse", () => {
  it("Teste 1: chama runBaseStep uma vez com operationId de controle", async () => {
    runBaseStepMock.mockResolvedValue({ kind: "completed" });
    const baseInput = input();
    const baseDeps = deps();

    await runJointBase(baseInput, baseDeps);

    expect(runBaseStepMock).toHaveBeenCalledTimes(1);
    expect(runBaseStepMock.mock.calls[0][0].operationId).toBe(OPERATION);
    expect(runBaseStepMock.mock.calls[0][1]).toBe(baseDeps);
  });

  it("Teste 2: mapeia todos os StepExecutionOutcome", async () => {
    const cases: Array<[unknown, unknown]> = [
      [{ kind: "completed" }, { kind: "completed" }],
      [{ kind: "definitive", reason: "x" }, { kind: "definitive", reason: "x" }],
      [{ kind: "retryable", reason: "y" }, { kind: "retryable", reason: "y" }],
      [{ kind: "unknown", reason: "z" }, { kind: "unknown", reason: "z" }],
      [
        { kind: "processing", state: "between_steps", nextStep: "base", canContinue: true },
        { kind: "processing", state: "between_steps", nextStep: "base", canContinue: true },
      ],
      [{ kind: "skipped" }, { kind: "skipped" }],
    ];
    for (const [outcome, expected] of cases) {
      runBaseStepMock.mockResolvedValue(outcome);
      expect(await runJointBase(input(), deps())).toEqual(expected);
    }
  });

  it("Teste 3: repassa content e frozenState sem remontar", async () => {
    runBaseStepMock.mockResolvedValue({ kind: "completed" });
    const baseInput = input();
    await runJointBase(baseInput, deps());
    const passed = runBaseStepMock.mock.calls[0][0];
    expect(passed.content).toBe(CONTENT);
    expect(passed.frozenState).toBe(FROZEN);
  });

  it("Teste 4: repassa base, client e portas de reconstrução idênticas", async () => {
    runBaseStepMock.mockResolvedValue({ kind: "completed" });
    const baseDeps = deps();
    await runJointBase(input(), baseDeps);
    const passed = runBaseStepMock.mock.calls[0][1];
    expect(passed.base).toBe(BASE);
    expect(passed.client).toBe(CLIENT);
    expect(passed.readInputBytes).toBe(READ_INPUT);
    expect(passed.readFrozenState).toBe(READ_FROZEN);
    expect(passed.repairEvidence).toBe(REPAIR);
  });

  it("Teste 5: módulo não referencia a identidade financeira do quadrado nem product-1-1", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/lib/product-two-format/orchestration/joint-base.ts",
      ),
      "utf8",
    );
    expect(source).not.toContain("squareDeliveryId");
    expect(source).not.toContain("@/lib/product-1-1");
    expect(source).not.toContain("deliverFormat");
    expect(source).not.toContain("projectCampaign");
  });

  it("Teste 6: attempt, deadline, allowNewPaidStep e signal são repassados", async () => {
    runBaseStepMock.mockResolvedValue({ kind: "completed" });
    const controller = new AbortController();
    const baseInput = input({
      signal: controller.signal,
      allowNewPaidStep: false,
      attemptTarget: "fallback",
    });
    await runJointBase(baseInput, deps());
    const passed = runBaseStepMock.mock.calls[0][0];
    expect(passed.signal).toBe(controller.signal);
    expect(passed.allowNewPaidStep).toBe(false);
    expect(passed.attemptTarget).toBe("fallback");
    expect(passed.acquisitionId).toBe("acquisition-1");
    expect(passed.attemptReference).toBe("attempt-1");
    expect(passed.deadlineAtMs).toBe(123456);
  });

  it("Teste 7: todas as ReconstructionDeps são repassadas", async () => {
    runBaseStepMock.mockResolvedValue({ kind: "completed" });
    const composePrompt = vi.fn();
    const baseDeps = deps({
      composePrompt: composePrompt as never,
      promptBase: "base",
      deadlineMs: 99,
    });
    await runJointBase(input(), baseDeps);
    const passed = runBaseStepMock.mock.calls[0][1];
    expect(passed.composePrompt).toBe(composePrompt);
    expect(passed.promptBase).toBe("base");
    expect(passed.deadlineMs).toBe(99);
  });
});
