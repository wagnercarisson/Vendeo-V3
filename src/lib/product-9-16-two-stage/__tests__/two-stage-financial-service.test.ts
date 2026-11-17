import { describe, expect, it, vi } from "vitest";
import { TwoStageFinancialError, TwoStageFinancialService } from "../two-stage-financial-service";
import type { VerticalArtifactProbe } from "../two-stage-financial-service";
import { projectDeliveredCampaign } from "@/lib/product-1-1/orchestration/project-delivered-campaign";
import { projectClosedCampaign } from "@/lib/product-1-1/orchestration/project-closed-campaign";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/product-1-1/orchestration/project-delivered-campaign", () => ({
  projectDeliveredCampaign: vi.fn(async () => ({ projected: true, reason: "projected" })),
}));
vi.mock("@/lib/product-1-1/orchestration/project-closed-campaign", () => ({
  projectClosedCampaign: vi.fn(async () => ({ projected: true, reason: "projected" })),
}));

const authority = {
  campaignId: "c",
  operationId: "o",
  storeId: "s",
  amount: 1,
  status: "reserved" as const,
  terminal: false,
  delivered: false,
  refunded: false,
  reserved: true,
  stateEpoch: 0,
  publicationState: "none",
};

const CONFIGURED_SELECTION = {
  model: "gpt-image-2.5-flare",
  quality: "medium",
  configVersionId: "9b1d3c4e-5f60-4a7b-8c9d-0e1f2a3b4c5d",
  origin: "configured",
} as const;

function viewLookup(contractVersion: 1 | 2) {
  return {
    kind: "found",
    view: {
      campaignId: "c",
      operationId: "o",
      origin: "9_16_two_stage",
      contractVersion,
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
        status: "pending",
        attemptsUsed: 0,
        failureClass: null,
        attemptNumber: null,
        claimedAt: null,
      },
      expansion: {
        stage: "expansion",
        status: "pending",
        attemptsUsed: 0,
        failureClass: null,
        attemptNumber: null,
        claimedAt: null,
      },
      unknown: false,
      failedOutcome: false,
      supportReference: null,
      nextAction: "acquire_base",
      canContinue: true,
      processingPhase: null,
    },
  };
}

function serviceWith(overrides: {
  open?: unknown;
  resume?: unknown;
  epoch?: number;
  probe?: VerticalArtifactProbe;
  credit?: Record<string, unknown>;
  resolvePending?: unknown;
  view?: unknown;
} = {}) {
  const credit = {
    getPublicationEpoch: vi.fn(async () => overrides.epoch ?? 7),
    markArtUploaded: vi.fn(async () => ({ status: "art_uploaded" })),
    deliver: vi.fn(async () => ({ status: "delivered", consumedDefinitive: true })),
    closeFailedOperation: vi.fn(async () => ({ status: "refunded", idempotent: false })),
    ...(overrides.credit ?? {}),
  };
  const control = {
    getOperationView: vi.fn(async () => overrides.view ?? { kind: "absent" }),
    open: vi.fn(async () => overrides.open ?? {
      success: true,
      contractVersion: 2,
      selection: CONFIGURED_SELECTION,
      idempotent: false,
      status: "reserved",
      campaignId: "c",
      operationId: "o",
      origin: "9_16_two_stage",
      steps: [],
    }),
    resume: vi.fn(async () => overrides.resume ?? {
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
    }),
  };
  const probe = overrides.probe ?? {
    probeVerticalArtifact: vi.fn(async () => ({
      kind: "integral" as const,
      format: "9:16" as const,
      width: 1080 as const,
      height: 1920 as const,
      mimeType: "image/jpeg" as const,
      storagePath: "path",
      evidenceRef: "ref",
    })),
  };
  const resolvePending = overrides.resolvePending ?? vi.fn(async () => ({
    campaignId: "c",
    operationId: "o",
    action: "refund_once",
    status: "refunded",
    artifactKind: "absent",
    idempotent: false,
  }));
  const client = { rpc: vi.fn(), from: vi.fn() } as never;
  const service = new TwoStageFinancialService({
    client,
    credit: credit as never,
    control: control as never,
    repository: {} as never,
    resolvePending: resolvePending as never,
  });
  return { service, client, credit, control, probe, resolvePending };
}

describe("serviço financeiro do fluxo de duas etapas", () => {
  it("abertura confere amount na autoridade e aceita replay entregue", async () => {
    const { service, control } = serviceWith();
    const spy = vi.spyOn(service, "readFinancialAuthority").mockResolvedValue(authority);
    await expect(
      service.reserveOperationOnce({
        storeId: "s",
        campaignId: "c",
        operationId: "o",
        selection: CONFIGURED_SELECTION,
      }),
    ).resolves.toMatchObject({ authority: { amount: 1 } });
    expect(spy).toHaveBeenCalledWith("c", "o");
    expect(control.open).toHaveBeenCalledTimes(1);
    expect(control.open).toHaveBeenCalledWith({
      storeId: "s",
      campaignId: "c",
      operationId: "o",
      selection: CONFIGURED_SELECTION,
    });

    const delivered = serviceWith({
      open: {
        success: true,
        contractVersion: 2,
        selection: CONFIGURED_SELECTION,
        idempotent: true,
        status: "delivered",
        campaignId: "c",
        operationId: "o",
        origin: "9_16_two_stage",
        steps: [],
      },
    });
    vi.spyOn(delivered.service, "readFinancialAuthority").mockResolvedValue({
      ...authority,
      status: "delivered",
      terminal: true,
      delivered: true,
      reserved: false,
    });
    await expect(
      delivered.service.reserveOperationOnce({
        storeId: "s",
        campaignId: "c",
        operationId: "o",
        selection: CONFIGURED_SELECTION,
      }),
    ).resolves.toBeTruthy();
  });

  it("entrega exige base/expansão done e sonda integral vertical", async () => {
    const { service, credit, probe } = serviceWith();
    vi.spyOn(service, "readFinancialAuthority").mockResolvedValue(authority);
    await service.confirmOnVerticalDelivery({
      storeId: "s",
      campaignId: "c",
      operationId: "o",
      publicationToken: "t",
      verticalArtifactProbe: probe,
    });
    expect(credit.markArtUploaded).toHaveBeenCalledWith("c", "o", "t");
    expect(credit.deliver).toHaveBeenCalledWith("c", "o", "t");
  });

  it("entrega recusa sonda não integral e etapa incompleta", async () => {
    const { service } = serviceWith();
    vi.spyOn(service, "readFinancialAuthority").mockResolvedValue(authority);
    const absent: VerticalArtifactProbe = {
      probeVerticalArtifact: vi.fn(async () => ({ kind: "absent" as const })),
    };
    await expect(
      service.confirmOnVerticalDelivery({
        storeId: "s",
        campaignId: "c",
        operationId: "o",
        publicationToken: "t",
        verticalArtifactProbe: absent,
      }),
    ).rejects.toMatchObject({ code: "insufficient_evidence" });

    const incomplete = serviceWith({
      resume: {
        success: true,
        action: "wait",
        nextTarget: null,
        origin: "9_16_two_stage",
        creditStatus: "reserved",
        baseStatus: "done",
        baseAttempts: 1,
        expansionStatus: "pending",
        expansionAttempts: 0,
        unknown: false,
        failedOutcome: false,
      },
    });
    vi.spyOn(incomplete.service, "readFinancialAuthority").mockResolvedValue(authority);
    await expect(
      incomplete.service.confirmOnVerticalDelivery({
        storeId: "s",
        campaignId: "c",
        operationId: "o",
        publicationToken: "t",
        verticalArtifactProbe: incomplete.probe,
      }),
    ).rejects.toBeInstanceOf(TwoStageFinancialError);
  });

  it("entrega NÃO muta quando resume está bloqueado ou com desfecho final", async () => {
    for (const resume of [
      {
        success: true,
        action: "blocked",
        nextTarget: null,
        origin: "9_16_two_stage",
        creditStatus: "reserved",
        baseStatus: "done",
        baseAttempts: 1,
        expansionStatus: "done",
        expansionAttempts: 1,
        unknown: false,
        failedOutcome: false,
      },
      {
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
        failedOutcome: true,
      },
    ]) {
      const { service, credit, probe } = serviceWith({ resume });
      vi.spyOn(service, "readFinancialAuthority").mockResolvedValue(authority);
      await expect(
        service.confirmOnVerticalDelivery({
          storeId: "s",
          campaignId: "c",
          operationId: "o",
          publicationToken: "t",
          verticalArtifactProbe: probe,
        }),
      ).rejects.toMatchObject({ code: "invalid_transition" });
      expect(credit.markArtUploaded).not.toHaveBeenCalled();
      expect(credit.deliver).not.toHaveBeenCalled();
    }
  });

  it("entrega repetida após `delivered` é idempotente e não muta", async () => {
    const creditGet = vi.fn(async () => ({
      campaignId: "c",
      operationId: "o",
      status: "delivered",
      amount: 1,
      creditTxId: "tx",
      refundTxId: null,
      idempotent: true,
      consumedDefinitive: true,
    }));
    const { service, credit, probe } = serviceWith({ credit: { get: creditGet } });
    vi.spyOn(service, "readFinancialAuthority").mockResolvedValue({
      ...authority,
      status: "delivered",
      terminal: true,
      delivered: true,
      reserved: false,
    });

    await expect(
      service.confirmOnVerticalDelivery({
        storeId: "s",
        campaignId: "c",
        operationId: "o",
        publicationToken: "t",
        verticalArtifactProbe: probe,
      }),
    ).resolves.toMatchObject({ status: "delivered", idempotent: true });
    expect(credit.markArtUploaded).not.toHaveBeenCalled();
    expect(credit.deliver).not.toHaveBeenCalled();
  });

  it("entrega recusa operação estornada, loja divergente e evidência incompleta", async () => {
    const refunded = serviceWith();
    vi.spyOn(refunded.service, "readFinancialAuthority").mockResolvedValue({
      ...authority,
      status: "refunded",
      terminal: true,
      refunded: true,
      reserved: false,
    });
    await expect(
      refunded.service.confirmOnVerticalDelivery({
        storeId: "s",
        campaignId: "c",
        operationId: "o",
        publicationToken: "t",
        verticalArtifactProbe: refunded.probe,
      }),
    ).rejects.toMatchObject({ code: "operation_terminal" });
    expect(refunded.credit.deliver).not.toHaveBeenCalled();

    const mismatch = serviceWith();
    vi.spyOn(mismatch.service, "readFinancialAuthority").mockResolvedValue({
      ...authority,
      storeId: "outra-loja",
    });
    const mismatchProbe = vi.fn(async () => ({
      kind: "integral" as const,
      format: "9:16" as const,
      width: 1080 as const,
      height: 1920 as const,
      mimeType: "image/jpeg" as const,
      storagePath: "path",
      evidenceRef: "ref",
    }));
    await expect(
      mismatch.service.confirmOnVerticalDelivery({
        storeId: "s",
        campaignId: "c",
        operationId: "o",
        publicationToken: "t",
        verticalArtifactProbe: { probeVerticalArtifact: mismatchProbe },
      }),
    ).rejects.toMatchObject({ code: "invalid_transition" });
    expect(mismatchProbe).not.toHaveBeenCalled();
    expect(mismatch.credit.markArtUploaded).not.toHaveBeenCalled();

    for (const patch of [{ storagePath: "" }, { evidenceRef: "   " }]) {
      const { service, credit } = serviceWith();
      vi.spyOn(service, "readFinancialAuthority").mockResolvedValue(authority);
      const probe = {
        probeVerticalArtifact: vi.fn(async () => ({
          kind: "integral" as const,
          format: "9:16" as const,
          width: 1080 as const,
          height: 1920 as const,
          mimeType: "image/jpeg" as const,
          storagePath: "path",
          evidenceRef: "ref",
          ...patch,
        })),
      };
      await expect(
        service.confirmOnVerticalDelivery({
          storeId: "s",
          campaignId: "c",
          operationId: "o",
          publicationToken: "t",
          verticalArtifactProbe: probe,
        }),
      ).rejects.toMatchObject({ code: "insufficient_evidence" });
      expect(credit.markArtUploaded).not.toHaveBeenCalled();
      expect(credit.deliver).not.toHaveBeenCalled();
    }
  });

  it("estorno captura epoch antes da sonda e usa artKind real", async () => {
    const { service, credit, probe } = serviceWith();
    vi.spyOn(service, "readFinancialAuthority").mockResolvedValue(authority);
    const absent: VerticalArtifactProbe = {
      probeVerticalArtifact: vi.fn(async () => ({ kind: "absent" as const })),
    };
    await expect(
      service.refundOnDefinitiveFailure({
        storeId: "s",
        campaignId: "c",
        operationId: "o",
        verticalArtifactProbe: absent,
      }),
    ).resolves.toMatchObject({ kind: "refunded" });
    expect(credit.getPublicationEpoch).toHaveBeenCalledWith("c", "o");
    expect(credit.closeFailedOperation).toHaveBeenCalledWith(
      expect.objectContaining({ artKind: "absent", observedEpoch: 7 }),
    );

    const integral = await service.refundOnDefinitiveFailure({
      storeId: "s",
      campaignId: "c",
      operationId: "o",
      verticalArtifactProbe: probe,
    });
    expect(integral).toMatchObject({ kind: "delivery_required" });
    expect(credit.deliver).not.toHaveBeenCalled();
  });

  it("estorno recusa sonda indeterminada sem presumir absent", async () => {
    const { service, credit } = serviceWith();
    vi.spyOn(service, "readFinancialAuthority").mockResolvedValue(authority);
    const indeterminate: VerticalArtifactProbe = {
      probeVerticalArtifact: vi.fn(async () => ({ kind: "indeterminate" as const })),
    };
    await expect(
      service.refundOnDefinitiveFailure({
        storeId: "s",
        campaignId: "c",
        operationId: "o",
        verticalArtifactProbe: indeterminate,
      }),
    ).resolves.toMatchObject({ kind: "insufficient_evidence" });
    expect(credit.closeFailedOperation).not.toHaveBeenCalled();
  });

  it("estorno recusa loja divergente ANTES da sonda e sem encerrar", async () => {
    const { service, credit } = serviceWith();
    vi.spyOn(service, "readFinancialAuthority").mockResolvedValue({
      ...authority,
      storeId: "outra-loja",
    });
    const probe = vi.fn(async () => ({ kind: "absent" as const }));
    await expect(
      service.refundOnDefinitiveFailure({
        storeId: "s",
        campaignId: "c",
        operationId: "o",
        verticalArtifactProbe: { probeVerticalArtifact: probe },
      }),
    ).rejects.toMatchObject({ code: "invalid_transition", message: "store_mismatch" });
    expect(probe).not.toHaveBeenCalled();
    expect(credit.getPublicationEpoch).not.toHaveBeenCalled();
    expect(credit.closeFailedOperation).not.toHaveBeenCalled();
  });

  it("estorno recusa operação inexistente antes da sonda", async () => {
    const { service, credit } = serviceWith();
    vi.spyOn(service, "readFinancialAuthority").mockResolvedValue(null);
    const probe = vi.fn(async () => ({ kind: "absent" as const }));
    await expect(
      service.refundOnDefinitiveFailure({
        storeId: "s",
        campaignId: "c",
        operationId: "o",
        verticalArtifactProbe: { probeVerticalArtifact: probe },
      }),
    ).rejects.toMatchObject({ code: "operation_not_found" });
    expect(probe).not.toHaveBeenCalled();
    expect(credit.closeFailedOperation).not.toHaveBeenCalled();
  });

  it("resolução administrativa usa ator/identidade, cliente injetado e projeção vertical", async () => {
    const { service, client, resolvePending } = serviceWith();
    vi.spyOn(service, "readFinancialAuthority").mockResolvedValue(authority);
    const vertical = {
      probeVerticalArtifact: vi.fn(async () => ({
        kind: "integral" as const,
        format: "9:16" as const,
        width: 1080 as const,
        height: 1920 as const,
        mimeType: "image/jpeg" as const,
        storagePath: "vertical/final.jpg",
        evidenceRef: "vertical:1",
      })),
    };
    await service.resolveUnknown({
      actorId: "admin",
      campaignId: "c",
      operationId: "o",
      decision: "deliver",
      reason: "manual",
      resolutionOperationId: "res",
      verticalArtifactProbe: vertical,
    });
    expect(vertical.probeVerticalArtifact).toHaveBeenCalledWith({
      storeId: "s",
      campaignId: "c",
      operationId: "o",
    });
    expect(resolvePending).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "admin",
        resolutionOperationId: "res",
        action: "deliver_existing_art",
      }),
      expect.anything(),
    );
    const call = (resolvePending as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(call[0]).not.toHaveProperty("evidence");
    const deps = call[1] as {
      client: unknown;
      projectDeliveredCampaign: (input: unknown) => Promise<unknown>;
      projectClosedCampaign: (input: unknown) => Promise<unknown>;
    };
    // O cliente injetado precisa atravessar a resolução (nunca o global).
    expect(deps.client).toBe(client);

    await deps.projectDeliveredCampaign({ storeId: "s", campaignId: "c", operationId: "o" });
    expect(projectDeliveredCampaign).toHaveBeenCalledWith(
      {
        storeId: "s",
        campaignId: "c",
        operationId: "o",
        expectedArtifactPath: "vertical/final.jpg",
      },
      { client },
    );
    await deps.projectClosedCampaign({
      storeId: "s",
      campaignId: "c",
      operationId: "o",
      reason: "closed_neutral",
    });
    expect(projectClosedCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ campaignId: "c", operationId: "o" }),
      { client },
    );
  });

  it("resolução administrativa de entrega falha fechado sem sonda vertical válida", async () => {
    const { service, resolvePending } = serviceWith();
    vi.spyOn(service, "readFinancialAuthority").mockResolvedValue(authority);

    await expect(
      service.resolveUnknown({
        actorId: "admin",
        campaignId: "c",
        operationId: "o",
        decision: "deliver",
        reason: "manual",
        resolutionOperationId: "res",
      }),
    ).rejects.toMatchObject({ code: "insufficient_evidence" });

    for (const probe of [
      { kind: "absent" as const },
      { kind: "invalid" as const },
      { kind: "indeterminate" as const },
    ]) {
      await expect(
        service.resolveUnknown({
          actorId: "admin",
          campaignId: "c",
          operationId: "o",
          decision: "deliver",
          reason: "manual",
          resolutionOperationId: "res",
          verticalArtifactProbe: { probeVerticalArtifact: vi.fn(async () => probe) },
        }),
      ).rejects.toMatchObject({ code: "insufficient_evidence" });
    }
    expect(resolvePending).not.toHaveBeenCalled();
  });

  it("resolução administrativa de estorno não presume caminho de arte", async () => {
    const { service, resolvePending } = serviceWith();
    await service.resolveUnknown({
      actorId: "admin",
      campaignId: "c",
      operationId: "o",
      decision: "refund",
      reason: "manual",
      resolutionOperationId: "res",
    });
    const deps = (resolvePending as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][1] as { projectDeliveredCampaign: (input: unknown) => Promise<unknown> };
    await deps.projectDeliveredCampaign({ storeId: "s", campaignId: "c", operationId: "o" });
    expect(projectDeliveredCampaign).toHaveBeenCalledWith(
      { storeId: "s", campaignId: "c", operationId: "o" },
      expect.objectContaining({ client: expect.anything() }),
    );
  });
});

describe("reserva atômica com seleção congelada (F60.6)", () => {
  it("operação nova sem seleção é recusada ANTES da RPC (zero reserva)", async () => {
    const { service, control } = serviceWith();
    await expect(
      service.reserveOperationOnce({ storeId: "s", campaignId: "c", operationId: "o" }),
    ).rejects.toMatchObject({
      code: "invalid_transition",
      message: "operation_selection_required",
    });
    expect(control.getOperationView).toHaveBeenCalledWith({
      campaignId: "c",
      operationId: "o",
    });
    // Zero chamada à RPC de abertura: nenhum crédito é reservado.
    expect(control.open).not.toHaveBeenCalled();
  });

  it("reabertura de operação v1 existente sem seleção continua permitida", async () => {
    const { service, control } = serviceWith({ view: viewLookup(1) });
    vi.spyOn(service, "readFinancialAuthority").mockResolvedValue(authority);
    await expect(
      service.reserveOperationOnce({ storeId: "s", campaignId: "c", operationId: "o" }),
    ).resolves.toMatchObject({ authority: { amount: 1 } });
    expect(control.open).toHaveBeenCalledTimes(1);
    expect(control.open).toHaveBeenCalledWith({
      storeId: "s",
      campaignId: "c",
      operationId: "o",
    });
  });

  it("operação v2 existente sem seleção é recusada sem sobrescrever", async () => {
    const { service, control } = serviceWith({ view: viewLookup(2) });
    await expect(
      service.reserveOperationOnce({ storeId: "s", campaignId: "c", operationId: "o" }),
    ).rejects.toMatchObject({
      code: "invalid_transition",
      message: "operation_selection_required",
    });
    expect(control.open).not.toHaveBeenCalled();
  });

  it("leitura indeterminada da operação falha fechado antes da RPC", async () => {
    const { service, control } = serviceWith({
      view: { kind: "read_failed", reason: "db_offline" },
    });
    await expect(
      service.reserveOperationOnce({ storeId: "s", campaignId: "c", operationId: "o" }),
    ).rejects.toMatchObject({ message: "operation_selection_required" });
    expect(control.open).not.toHaveBeenCalled();
  });

  it("seleção malformada é recusada antes de qualquer RPC", async () => {
    const { service, control } = serviceWith();
    await expect(
      service.reserveOperationOnce({
        storeId: "s",
        campaignId: "c",
        operationId: "o",
        // `origin` não pertence à lista fechada do contrato de 60.6-01.
        selection: {
          model: "gpt-image-2.5-flare",
          quality: "medium",
          configVersionId: null,
          origin: "default",
        } as never,
      }),
    ).rejects.toMatchObject({ message: "operation_selection_required" });
    expect(control.getOperationView).not.toHaveBeenCalled();
    expect(control.open).not.toHaveBeenCalled();
  });

  it("amount diferente de 1 continua inválido e não há segunda reserva", async () => {
    const { service, control } = serviceWith();
    const authoritySpy = vi
      .spyOn(service, "readFinancialAuthority")
      .mockResolvedValue({ ...authority, amount: 2 });
    await expect(
      service.reserveOperationOnce({
        storeId: "s",
        campaignId: "c",
        operationId: "o",
        selection: CONFIGURED_SELECTION,
      }),
    ).rejects.toMatchObject({ code: "amount_mismatch" });
    expect(authoritySpy).toHaveBeenCalledTimes(1);
    expect(control.open).toHaveBeenCalledTimes(1);
  });

  it("falha de abertura mantém o mapeamento existente e não reserva de novo", async () => {
    for (const [reason, code] of [
      ["operation_terminal", "operation_terminal"],
      ["operation_config_conflict", "invalid_transition"],
      ["operation_origin_conflict", "invalid_transition"],
    ] as const) {
      const { service, control } = serviceWith({
        open: { success: false, reason },
      });
      const authoritySpy = vi.spyOn(service, "readFinancialAuthority");
      await expect(
        service.reserveOperationOnce({
          storeId: "s",
          campaignId: "c",
          operationId: "o",
          selection: CONFIGURED_SELECTION,
        }),
      ).rejects.toMatchObject({ code, message: reason });
      expect(control.open).toHaveBeenCalledTimes(1);
      expect(authoritySpy).not.toHaveBeenCalled();
    }
  });
});
