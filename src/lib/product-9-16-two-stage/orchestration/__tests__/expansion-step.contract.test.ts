// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

/**
 * Quick 261120-qvp (T-261120-04): o step não consulta o parâmetro econômico
 * VIGENTE. Espião zerado (comportamento) + conferência estática do fonte.
 */
const economicParameterSpy = vi.hoisted(() => ({ getParameter: vi.fn() }));
vi.mock("@/lib/economic/economic-parameter-service", () => ({
  EconomicParameterService: vi.fn(function () {
    return { getParameter: economicParameterSpy.getParameter };
  }),
}));

import { runExpansionStep } from "../expansion-step";

const sourceArtifact = {
  id: "src",
  storeId: "s",
  campaignId: "c",
  operationId: "o",
  role: "square_prepared",
  format: "1:1",
  origin: "deterministic_preparation",
  derivedFromArtifactId: "orig",
  sourceCampaignId: null,
  storageBucket: "b",
  storagePath: "p",
  width: 1152,
  height: 1152,
  mimeType: "image/jpeg",
  byteSize: 1,
  checksumSha256: "x",
  provenance: {},
  createdAt: "now",
} as never;

const CONFIGURED_SELECTION = {
  model: "gpt-image-2.5-sunburst",
  quality: "low",
  configVersionId: "9b1d3c4e-5f60-4a7b-8c9d-0e1f2a3b4c5d",
  origin: "configured",
} as const;

function expansionInput() {
  return {
    storeId: "s",
    campaignId: "c",
    operationId: "o",
    authorization: { kind: "system" },
    acquisitionId: "22222222-2222-4222-8222-222222222222",
    attemptReference: "ref",
    attemptTarget: "initial",
    deadlineAtMs: 100_000,
    expansionStatus: "pending",
    allowNewPaidStep: true,
    selection: CONFIGURED_SELECTION,
  } as never;
}

function deps(overrides: Record<string, unknown> = {}) {
  const acquire = vi.fn(async () => ({
    acquired: true,
    authorization: "execute",
    reason: null,
    attemptToken: "t",
    attemptNumber: 1,
    stage: "expansion",
    target: "initial",
  }));
  const finish = vi.fn(async () => ({
    success: true,
    idempotent: false,
    status: "completed",
    stage: "expansion",
    attemptNumber: 1,
  }));
  return {
    control: {
      acquire,
      finish,
      getOperationView: vi.fn(async () => ({
        kind: "found",
        view: {
          campaignId: "c",
          operationId: "o",
          origin: "9_16_two_stage",
          contractVersion: 1,
          frozenSelection: null,
          credit: {
            status: "reserved",
            terminal: false,
            delivered: false,
            refunded: false,
            reserved: true,
          },
          base: {
            stage: "base",
            status: "done",
            attemptsUsed: 1,
            failureClass: null,
            attemptNumber: 1,
            claimedAt: null,
          },
          expansion: {
            stage: "expansion",
            status: "in_progress",
            attemptsUsed: 1,
            failureClass: null,
            attemptNumber: 1,
            claimedAt: null,
          },
          unknown: false,
          failedOutcome: false,
          supportReference: null,
          nextAction: "wait",
          canContinue: false,
          processingPhase: "step_in_progress",
        },
      })),
    },
    expand: vi.fn(async () => ({
      kind: "expanded",
      artifact: {},
      bytes: Buffer.alloc(0),
      persistence: "created",
      call: {},
    })),
    retrieve: vi.fn(async () => ({
      kind: "integral",
      artifact: sourceArtifact,
      bytes: Buffer.alloc(0),
    })),
    probe: vi.fn(async () => ({ kind: "proceed" })),
    preflightFrozenExpansion: vi.fn(async (selection: unknown) => ({
      ok: true,
      selection,
    })),
    readEconomicSnapshot: vi.fn(async () => ({
      usdBrlRateAtGeneration: 5.1,
      creditValueBrlAtGeneration: 1,
    })),
    clock: () => 0,
    ...overrides,
  } as never;
}

function calls(d: unknown, path: string): unknown[] {
  const value = path.split(".").reduce<Record<string, unknown>>(
    (current, key) => current[key] as Record<string, unknown>,
    d as Record<string, unknown>,
  );
  return (value as { mock: { calls: unknown[] } }).mock.calls;
}

describe("runExpansionStep", () => {
  it("acquires expansion once and completes on expanded", async () => {
    const d = deps();
    await expect(runExpansionStep(expansionInput(), d)).resolves.toEqual({ kind: "completed" });
    expect(calls(d, "control.acquire")).toHaveLength(1);
    expect(calls(d, "control.finish")).toHaveLength(1);
  });

  it("encaminha a seleção do input ao expansor (nunca monta seleção própria)", async () => {
    const d = deps();
    await expect(runExpansionStep(expansionInput(), d)).resolves.toEqual({
      kind: "completed",
    });

    const expandCalls = calls(d, "expand") as Array<
      [{ source: { role: string } }, { selection: unknown }]
    >;
    expect(expandCalls).toHaveLength(1);
    expect(expandCalls[0][0].source.role).toBe("square_prepared");
    expect(expandCalls[0][1]).toEqual({ selection: CONFIGURED_SELECTION });
  });

  it("does not advance when finish is refused", async () => {    const d = deps({
      control: {
        acquire: vi.fn(async () => ({
          acquired: true,
          authorization: "execute",
          reason: null,
          attemptToken: "t",
          attemptNumber: 1,
          stage: "expansion",
          target: "initial",
        })),
        finish: vi.fn(async () => ({ success: false, reason: "operation_terminal" })),
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: {
            campaignId: "c",
            operationId: "o",
            origin: "9_16_two_stage",
            contractVersion: 1,
            frozenSelection: null,
            credit: {
              status: "reserved",
              terminal: false,
              delivered: false,
              refunded: false,
              reserved: true,
            },
            base: {
              stage: "base",
              status: "done",
              attemptsUsed: 1,
              failureClass: null,
              attemptNumber: 1,
              claimedAt: null,
            },
            expansion: {
              stage: "expansion",
              status: "in_progress",
              attemptsUsed: 1,
              failureClass: null,
              attemptNumber: 1,
              claimedAt: null,
            },
            unknown: false,
            failedOutcome: false,
            supportReference: null,
            nextAction: "wait",
            canContinue: false,
            processingPhase: "step_in_progress",
          },
        })),
      },
    });
    const result = await runExpansionStep(expansionInput(), d);
    expect(result).toMatchObject({ kind: "unknown" });
    expect(result).not.toMatchObject({ kind: "completed" });
    expect(calls(d, "control.getOperationView")).toHaveLength(1);
  });

  it("treats an indeterminate prepared source as recoverable pre-call processing", async () => {
    const d = deps({
      retrieve: vi.fn(async () => ({ kind: "indeterminate" })),
    });
    const result = await runExpansionStep(expansionInput(), d);
    expect(result).toMatchObject({
      kind: "processing",
      state: "between_steps",
      nextStep: "expansion",
      canContinue: true,
    });
    expect(calls(d, "control.acquire")).toHaveLength(0);
    expect(calls(d, "expand")).toHaveLength(0);
  });

  it("rechecks cancellation after the source read and before acquire", async () => {
    const controller = new AbortController();
    const d = deps({
      retrieve: vi.fn(async () => {
        controller.abort();
        return { kind: "integral", artifact: sourceArtifact, bytes: Buffer.alloc(0) };
      }),
    });
    const result = await runExpansionStep(
      { ...(expansionInput() as object), signal: controller.signal } as never,
      d,
    );
    expect(result).toMatchObject({
      kind: "processing",
      reason: "aborted",
      canContinue: true,
    });
    expect(calls(d, "control.acquire")).toHaveLength(0);
    expect(calls(d, "expand")).toHaveLength(0);
  });
});

describe("runExpansionStep — preflight da seleção congelada antes de acquire", () => {
  it("executa retrieve -> probe -> gate -> preflight -> recheck -> acquire -> expand -> finish", async () => {
    const order: string[] = [];
    let now = 0;
    const d = deps({
      retrieve: vi.fn(async () => {
        order.push("retrieve");
        return { kind: "integral", artifact: sourceArtifact, bytes: Buffer.alloc(0) };
      }),
      probe: vi.fn(async () => {
        order.push("probe");
        return { kind: "proceed" };
      }),
      preflightFrozenExpansion: vi.fn(async (selection: unknown) => {
        order.push("preflight");
        return { ok: true, selection };
      }),
      control: {
        acquire: vi.fn(async () => {
          order.push("acquire");
          return {
            acquired: true,
            authorization: "execute",
            reason: null,
            attemptToken: "t",
            attemptNumber: 1,
            stage: "expansion",
            target: "initial",
          };
        }),
        finish: vi.fn(async () => {
          order.push("finish");
          return {
            success: true,
            idempotent: false,
            status: "completed",
            stage: "expansion",
            attemptNumber: 1,
          };
        }),
        getOperationView: vi.fn(),
      },
      expand: vi.fn(async () => {
        order.push("expand");
        return {
          kind: "expanded",
          artifact: {},
          bytes: Buffer.alloc(0),
          persistence: "created",
          call: {},
        };
      }),
      clock: () => {
        order.push("clock");
        return now;
      },
    });

    const result = await runExpansionStep(expansionInput(), d);

    expect(result).toEqual({ kind: "completed" });
    expect(order.filter((entry) => entry !== "clock")).toEqual([
      "retrieve",
      "probe",
      "preflight",
      "acquire",
      "expand",
      "finish",
    ]);
    // O recheck (leitura de relógio) acontece DEPOIS do preflight e ANTES do acquire.
    const acquireIndex = order.indexOf("acquire");
    const preflightIndex = order.indexOf("preflight");
    expect(preflightIndex).toBeGreaterThan(order.indexOf("probe"));
    expect(order.lastIndexOf("clock", acquireIndex)).toBeGreaterThan(preflightIndex);
    // Uma única invocação do preflight por etapa paga.
    expect(calls(d, "preflightFrozenExpansion")).toHaveLength(1);
    expect((calls(d, "preflightFrozenExpansion") as Array<[unknown]>)[0][0]).toBe(
      CONFIGURED_SELECTION,
    );
    now = 0;
  });

  it("configuração comprovadamente inválida encerra definitivo sem acquire/provider", async () => {
    for (const failure of ["model_unavailable", "pricing_unavailable"] as const) {
      const d = deps({
        preflightFrozenExpansion: vi.fn(async () => ({
          ok: false,
          failure,
          reason: failure === "model_unavailable" ? "catalog_row_missing" : "incomplete_coverage",
          missing: failure === "pricing_unavailable" ? ["imageTokenUsdPer1M"] : [],
        })),
      });

      const result = await runExpansionStep(expansionInput(), d);

      expect(result).toEqual({
        kind: "definitive",
        reason: `${failure}:${failure === "model_unavailable" ? "catalog_row_missing" : "incomplete_coverage"}`,
      });
      expect(calls(d, "control.acquire")).toHaveLength(0);
      expect(calls(d, "control.finish")).toHaveLength(0);
      expect(calls(d, "expand")).toHaveLength(0);
      expect(calls(d, "preflightFrozenExpansion")).toHaveLength(1);
    }
  });

  it("leitura indeterminada permanece recuperável sem acquire/desfecho/estorno", async () => {
    const d = deps({
      preflightFrozenExpansion: vi.fn(async () => ({
        ok: false,
        failure: "configuration_read_failed",
        reason: "catalog_read_failed",
        missing: [],
      })),
    });

    const result = await runExpansionStep(expansionInput(), d);

    expect(result).toMatchObject({
      kind: "processing",
      state: "between_steps",
      nextStep: "expansion",
      canContinue: true,
      reason: "configuration_read_failed",
    });
    expect(calls(d, "control.acquire")).toHaveLength(0);
    expect(calls(d, "control.finish")).toHaveLength(0);
    expect(calls(d, "expand")).toHaveLength(0);
  });

  it("exceção inesperada do preflight é indeterminação (recuperável, sem acquire)", async () => {
    const d = deps({
      preflightFrozenExpansion: vi.fn(async () => {
        throw new Error("db down");
      }),
    });

    const result = await runExpansionStep(expansionInput(), d);

    expect(result).toMatchObject({
      kind: "processing",
      canContinue: true,
      reason: "configuration_read_failed",
    });
    expect(calls(d, "control.acquire")).toHaveLength(0);
    expect(calls(d, "expand")).toHaveLength(0);
  });

  it.each(["reused", "adopted"] as const)(
    "vertical já comprovado (%s) não consulta pricing e confirma a etapa pelo caminho normal",
    async (kind) => {
      const d = deps({
        probe: vi.fn(async () => ({
          kind,
          artifact: sourceArtifact,
          bytes: Buffer.alloc(0),
        })),
        // Se o step consultar pricing para um artefato já comprovado, este fake
        // falha o teste de forma observável.
        preflightFrozenExpansion: vi.fn(async () => {
          throw new Error("pricing must not be called for a reusable artifact");
        }),
        expand: vi.fn(async () => ({
          kind: "reused",
          artifact: sourceArtifact,
          bytes: Buffer.alloc(0),
          adoption: kind === "adopted",
          call: null,
        })),
      });

      const result = await runExpansionStep(expansionInput(), d);

      expect(result).toEqual({ kind: "completed" });
      expect(calls(d, "preflightFrozenExpansion")).toHaveLength(0);
      expect(calls(d, "control.acquire")).toHaveLength(1);
      expect(calls(d, "expand")).toHaveLength(1);
      expect(calls(d, "control.finish")).toHaveLength(1);
    },
  );

  it("recheck após preflight: deadline esgotado não adquire nem expande", async () => {
    let now = 0;
    const d = deps({
      preflightFrozenExpansion: vi.fn(async (selection: unknown) => {
        // O preflight "demora": o prazo deixa de cobrir o piso da expansão.
        now = 95_000;
        return { ok: true, selection };
      }),
      clock: () => now,
    });

    const result = await runExpansionStep(expansionInput(), d);

    expect(result).toMatchObject({
      kind: "processing",
      state: "between_steps",
      canContinue: true,
      reason: "deadline_exceeded",
    });
    expect(calls(d, "control.acquire")).toHaveLength(0);
    expect(calls(d, "control.finish")).toHaveLength(0);
    expect(calls(d, "expand")).toHaveLength(0);
    now = 0;
  });

  it("preflightFrozenExpansion é obrigatória no step", async () => {
    const complete = deps();
    const withoutPreflight = {
      ...(complete as unknown as Record<string, unknown>),
    };
    delete withoutPreflight.preflightFrozenExpansion;

    // @ts-expect-error — `preflightFrozenExpansion` é obrigatória em `ExpansionStepDeps`.
    await runExpansionStep(expansionInput(), withoutPreflight);

    const source = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const text = source.readFileSync(
      fileURLToPath(new URL("../expansion-step.ts", import.meta.url)),
      "utf8",
    );
    expect(text).not.toMatch(/nine_sixteen_expansion_model_config|readNineSixteenExpansionConfig/);
  });
});

describe("runExpansionStep — snapshot econômico durável (D-01/D-02/D-08)", () => {
  const SNAPSHOT = { usdBrlRateAtGeneration: 5.1, creditValueBrlAtGeneration: 1 } as const;

  function sourcePath(relative: string): string {
    return fileURLToPath(new URL(relative, import.meta.url));
  }

  it("leitura única quando chega ao acquire", async () => {
    const read = vi.fn(async () => ({ ...SNAPSHOT }));
    const d = deps({ readEconomicSnapshot: read });

    await expect(runExpansionStep(expansionInput(), d)).resolves.toEqual({ kind: "completed" });

    expect(read).toHaveBeenCalledTimes(1);
    expect(calls(d, "control.acquire")).toHaveLength(1);
  });

  it.each([
    ["allowNewPaidStep falso", { input: { allowNewPaidStep: false }, deps: {} }],
    ["expansionStatus done", { input: { expansionStatus: "done" }, deps: {} }],
    ["expansionStatus in_progress", { input: { expansionStatus: "in_progress" }, deps: {} }],
    ["gate inicial: sinal abortado", { input: { signal: "aborted" }, deps: {} }],
    ["gate inicial: prazo esgotado", { input: {}, deps: { clock: () => 999_999 } }],
    [
      "falha de retrieve",
      {
        input: {},
        deps: {
          retrieve: vi.fn(async () => {
            throw new Error("read_failed");
          }),
        },
      },
    ],
    [
      "fonte indeterminada",
      { input: {}, deps: { retrieve: vi.fn(async () => ({ kind: "indeterminate" })) } },
    ],
    [
      "fonte não-integral definitiva",
      { input: {}, deps: { retrieve: vi.fn(async () => ({ kind: "absent" })) } },
    ],
    [
      "falha de probe",
      {
        input: {},
        deps: {
          probe: vi.fn(async () => {
            throw new Error("probe_failed");
          }),
        },
      },
    ],
    ["probe bloqueado", { input: {}, deps: { probe: vi.fn(async () => ({ kind: "blocked" })) } }],
    [
      "probe em conflito",
      {
        input: {},
        deps: { probe: vi.fn(async () => ({ kind: "conflict", reason: "identity_conflict" })) },
      },
    ],
    [
      "preflight inválido",
      {
        input: {},
        deps: {
          preflightFrozenExpansion: vi.fn(async () => ({
            ok: false,
            failure: "model_unavailable",
            reason: "catalog_row_missing",
            missing: [],
          })),
        },
      },
    ],
  ])("não lê o snapshot em retorno antecipado (%s)", async (_label, scenario) => {
    const read = vi.fn(async () => ({ ...SNAPSHOT }));
    const controller = new AbortController();
    const inputOverrides: Record<string, unknown> = { ...scenario.input };
    if (inputOverrides.signal === "aborted") {
      controller.abort();
      inputOverrides.signal = controller.signal;
    }

    const d = deps({ readEconomicSnapshot: read, ...scenario.deps });

    await runExpansionStep({ ...(expansionInput() as object), ...inputOverrides } as never, d);

    expect(read).not.toHaveBeenCalled();
  });

  it("gate pós-leituras (deadline após retrieve/probe) não lê o snapshot", async () => {
    let now = 0;
    const read = vi.fn(async () => ({ ...SNAPSHOT }));
    const d = deps({
      readEconomicSnapshot: read,
      probe: vi.fn(async () => {
        now = 95_000;
        return { kind: "proceed" };
      }),
      clock: () => now,
    });

    const result = await runExpansionStep(expansionInput(), d);

    expect(result).toMatchObject({ kind: "processing", reason: "deadline_exceeded" });
    expect(read).not.toHaveBeenCalled();
    expect(calls(d, "control.acquire")).toHaveLength(0);
  });

  it.each(["reused", "adopted"] as const)(
    "caminho reusableArtifact (%s): lê 1x, preflight 0x, 1 acquire/expand/finish",
    async (kind) => {
      const read = vi.fn(async () => ({ ...SNAPSHOT }));
      const d = deps({
        probe: vi.fn(async () => ({
          kind,
          artifact: sourceArtifact,
          bytes: Buffer.alloc(0),
        })),
        preflightFrozenExpansion: vi.fn(async () => {
          throw new Error("pricing must not be called for a reusable artifact");
        }),
        expand: vi.fn(async () => ({
          kind: "reused",
          artifact: sourceArtifact,
          bytes: Buffer.alloc(0),
          adoption: kind === "adopted",
          call: null,
        })),
        readEconomicSnapshot: read,
      });

      const result = await runExpansionStep(expansionInput(), d);

      expect(result).toEqual({ kind: "completed" });
      expect(read).toHaveBeenCalledTimes(1);
      expect(calls(d, "preflightFrozenExpansion")).toHaveLength(0);
      expect(calls(d, "control.acquire")).toHaveLength(1);
      expect(calls(d, "expand")).toHaveLength(1);
      expect(calls(d, "control.finish")).toHaveLength(1);
    },
  );

  it("ordem contratual: acquire é a interação imediatamente seguinte à leitura", async () => {
    const order: string[] = [];
    const d = deps({
      retrieve: vi.fn(async () => {
        order.push("retrieve");
        return { kind: "integral", artifact: sourceArtifact, bytes: Buffer.alloc(0) };
      }),
      probe: vi.fn(async () => {
        order.push("probe");
        return { kind: "proceed" };
      }),
      preflightFrozenExpansion: vi.fn(async (selection: unknown) => {
        order.push("preflight");
        return { ok: true, selection };
      }),
      readEconomicSnapshot: vi.fn(async () => {
        order.push("economy-read");
        return { ...SNAPSHOT };
      }),
      control: {
        acquire: vi.fn(async () => {
          order.push("acquire");
          return {
            acquired: true,
            authorization: "execute",
            reason: null,
            attemptToken: "t",
            attemptNumber: 1,
            stage: "expansion",
            target: "initial",
          };
        }),
        finish: vi.fn(async () => {
          order.push("finish");
          return {
            success: true,
            idempotent: false,
            status: "completed",
            stage: "expansion",
            attemptNumber: 1,
          };
        }),
        getOperationView: vi.fn(),
      },
      expand: vi.fn(async () => {
        order.push("expand");
        return { kind: "expanded", artifact: {}, bytes: Buffer.alloc(0), persistence: "created", call: {} };
      }),
      clock: () => {
        order.push("clock");
        return 0;
      },
    });

    const result = await runExpansionStep(expansionInput(), d);

    expect(result).toEqual({ kind: "completed" });
    const interactions = order.filter((entry) => entry !== "clock");
    expect(interactions).toEqual([
      "retrieve",
      "probe",
      "preflight",
      "economy-read",
      "acquire",
      "expand",
      "finish",
    ]);
    // Índices estritamente crescentes e acquire imediatamente após a leitura.
    for (let index = 1; index < interactions.length; index += 1) {
      expect(order.indexOf(interactions[index])).toBeGreaterThan(
        order.indexOf(interactions[index - 1]),
      );
    }
    const economyIndex = interactions.indexOf("economy-read");
    expect(interactions[economyIndex + 1]).toBe("acquire");
  });

  it("recheck final é a última verificação: leitura que esgota o prazo suspende sem acquire", async () => {
    let now = 0;
    const read = vi.fn(async () => {
      now = 95_000;
      return { ...SNAPSHOT };
    });
    const d = deps({ readEconomicSnapshot: read, clock: () => now });

    const result = await runExpansionStep(expansionInput(), d);

    expect(result).toMatchObject({
      kind: "processing",
      state: "between_steps",
      canContinue: true,
      reason: "deadline_exceeded",
    });
    expect(read).toHaveBeenCalledTimes(1);
    expect(calls(d, "control.acquire")).toHaveLength(0);
    expect(calls(d, "expand")).toHaveLength(0);
    expect(calls(d, "control.finish")).toHaveLength(0);
  });

  it("encaminha os valores lidos ao expansor", async () => {
    const d = deps({ readEconomicSnapshot: vi.fn(async () => ({ ...SNAPSHOT })) });

    await expect(runExpansionStep(expansionInput(), d)).resolves.toEqual({ kind: "completed" });

    const expandCalls = calls(d, "expand") as Array<
      [{ usdBrlRateAtGeneration: unknown; creditValueBrlAtGeneration: unknown }]
    >;
    expect(expandCalls).toHaveLength(1);
    expect(expandCalls[0][0].usdBrlRateAtGeneration).toBe(5.1);
    expect(expandCalls[0][0].creditValueBrlAtGeneration).toBe(1);
  });

  it.each([
    ["ausência", vi.fn(async () => ({ usdBrlRateAtGeneration: null, creditValueBrlAtGeneration: null }))],
    [
      "malformação",
      vi.fn(async () => ({ usdBrlRateAtGeneration: undefined, creditValueBrlAtGeneration: "x" })),
    ],
    [
      "exceção",
      vi.fn(async () => {
        throw new Error("snapshot_down");
      }),
    ],
    ["rejeição", vi.fn(() => Promise.reject(new Error("snapshot_down")))],
    [
      "resultado inválido",
      vi.fn(async () => ({ usdBrlRateAtGeneration: Number.NaN, creditValueBrlAtGeneration: {} })),
    ],
  ])("degradação (%s): expand recebe null/null e o desfecho continua completed", async (_label, read) => {
    const d = deps({ readEconomicSnapshot: read });

    const result = await runExpansionStep(expansionInput(), d);

    expect(result).toEqual({ kind: "completed" });
    const expandCalls = calls(d, "expand") as Array<
      [{ usdBrlRateAtGeneration: unknown; creditValueBrlAtGeneration: unknown }]
    >;
    expect(expandCalls).toHaveLength(1);
    expect(expandCalls[0][0].usdBrlRateAtGeneration).toBeNull();
    expect(expandCalls[0][0].creditValueBrlAtGeneration).toBeNull();
    expect(calls(d, "control.acquire")).toHaveLength(1);
    expect(calls(d, "control.finish")).toHaveLength(1);
    const finishCalls = calls(d, "control.finish") as Array<[{ status: string }]>;
    expect(finishCalls[0][0].status).toBe("completed");
  });

  it("timeout da leitura: expand recebe null/null, sem consumir tentativa extra", async () => {
    const read = vi.fn(() => new Promise<never>(() => {}));
    const d = deps({ readEconomicSnapshot: read, economicSnapshotTimeoutMs: 15 });

    const result = await runExpansionStep(expansionInput(), d);

    expect(result).toEqual({ kind: "completed" });
    expect(read).toHaveBeenCalledTimes(1);
    const expandCalls = calls(d, "expand") as Array<
      [{ usdBrlRateAtGeneration: unknown; creditValueBrlAtGeneration: unknown }]
    >;
    expect(expandCalls[0][0].usdBrlRateAtGeneration).toBeNull();
    expect(expandCalls[0][0].creditValueBrlAtGeneration).toBeNull();
    expect(calls(d, "control.acquire")).toHaveLength(1);
    expect(calls(d, "control.finish")).toHaveLength(1);
  });

  it("não consulta o parâmetro econômico vigente (comportamental + estático)", async () => {
    const d = deps();
    await runExpansionStep(expansionInput(), d);

    expect(economicParameterSpy.getParameter).not.toHaveBeenCalled();

    const source = readFileSync(sourcePath("../expansion-step.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(source).not.toMatch(/@\/lib\/economic/);
    expect(source).not.toMatch(/EconomicParameterService/);
  });
});
