// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { ModelPricing } from "@/lib/ai-cost/ai-model-pricing";

import type { FrozenEconomics } from "../frozen-economics";
import {
  FORMAT_ADDITION_DELIVER_REASONS,
  FORMAT_ADDITION_OPEN_REASONS,
  FORMAT_ADDITION_REFUND_REASONS,
  FormatAdditionClientError,
  FormatAdditionFinancialClient,
  type FormatAdditionOpenInput,
} from "../financial-client";

const STORE = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const CAMPAIGN = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const OPERATION = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";
const PRIMARY = "4d5e6f7a-4d5e-4f6a-8b8c-4d5e6f7a8b9c";
const ARTIFACT = "5e6f7a8b-5e6f-4a8b-9c8d-5e6f7a8b9c0d";
const REQUEST = "6f7a8b9c-6f7a-4b9c-8d9e-6f7a8b9c0d1e";
const CONFIG_VERSION = "11111111-1111-4111-8111-111111111111";
const PRICING_VERSION = "22222222-2222-4222-8222-222222222222";
const CHECKSUM = "a".repeat(64);

const PRICING: ModelPricing = {
  inputCostUsd: 1,
  cachedInputCostUsd: 0.5,
  imageInputTokenUsdPer1M: 2,
  imageTokenUsdPer1M: 30,
  imageCachedInputTokenUsdPer1M: 1,
  imageUnitCostUsd: 0.03,
};

const FROZEN: FrozenEconomics = {
  selection: {
    model: "gpt-image-2.5-flare",
    quality: "low",
    configVersionId: CONFIG_VERSION,
    selectionOrigin: "configured",
  },
  pricingVersionId: PRICING_VERSION,
  pricing: PRICING,
  usdBrlRateAtGeneration: 5.5,
  creditValueBrlAtGeneration: 1.2,
  capturedAt: "2026-11-23T12:00:00.000Z",
};

const OPEN_INPUT: FormatAdditionOpenInput = {
  storeId: STORE,
  campaignId: CAMPAIGN,
  operationId: OPERATION,
  requestId: REQUEST,
  sourceOrigin: "new_flow_1_1",
  sourceOperationId: PRIMARY,
  sourceRegistrationOperationId: PRIMARY,
  sourceArtifactId: ARTIFACT,
  sourceChecksumSha256: CHECKSUM,
  frozen: FROZEN,
};

function fakeClient(response: unknown, error: unknown = null) {
  const rpc = vi.fn(async () => ({ data: response, error }));
  return { rpc } as never;
}

function openSuccess(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    idempotent: false,
    state: "open",
    operationId: OPERATION,
    sourceOrigin: "new_flow_1_1",
    sourceRegistrationOperationId: PRIMARY,
    squareArtifactId: ARTIFACT,
    requestId: REQUEST,
    credits: 1,
    selection: {
      model: "gpt-image-2.5-flare",
      quality: "low",
      configVersionId: CONFIG_VERSION,
      selectionOrigin: "configured",
    },
    ...overrides,
  };
}

async function expectClientError(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  await expect(promise).rejects.toMatchObject({
    name: "FormatAdditionClientError",
    code,
  });
}

describe("F62-03 — cliente financeiro server-only", () => {
  it("abertura nova envia a seleção/economia congeladas e aceita o envelope", async () => {
    const client = fakeClient(openSuccess());
    const service = new FormatAdditionFinancialClient(client);

    const result = await service.open(OPEN_INPUT);

    expect(result).toMatchObject({
      success: true,
      idempotent: false,
      state: "open",
      operationId: OPERATION,
      requestId: REQUEST,
      credits: 1,
    });
    const [name, params] = (client as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc.mock.calls[0];
    expect(name).toBe("campaign_format_add_open");
    expect(params).toEqual({
      p_store_id: STORE,
      p_campaign_id: CAMPAIGN,
      p_operation_id: OPERATION,
      p_request_id: REQUEST,
      p_source_origin: "new_flow_1_1",
      p_source_operation_id: PRIMARY,
      p_source_registration_operation_id: PRIMARY,
      p_source_artifact_id: ARTIFACT,
      p_source_checksum_sha256: CHECKSUM,
      p_selection: {
        model: "gpt-image-2.5-flare",
        quality: "low",
        configVersionId: CONFIG_VERSION,
        selectionOrigin: "configured",
      },
      p_frozen_economics: {
        pricingVersionId: PRICING_VERSION,
        pricing: PRICING,
        usdBrlRateAtGeneration: 5.5,
        creditValueBrlAtGeneration: 1.2,
        capturedAt: "2026-11-23T12:00:00.000Z",
      },
    });
  });

  it("replay idempotente aceita a identidade durável retornada", async () => {
    const otherOperation = "7a8b9c0d-7a8b-4c0d-9e1f-7a8b9c0d1e2f";
    const otherRequest = "8b9c0d1e-8b9c-4d1e-8f0a-8b9c0d1e2f3a";
    const client = fakeClient(
      openSuccess({
        idempotent: true,
        state: "delivered",
        operationId: otherOperation,
        requestId: otherRequest,
      }),
    );

    const result = await new FormatAdditionFinancialClient(client).open(OPEN_INPUT);

    expect(result).toMatchObject({
      success: true,
      idempotent: true,
      state: "delivered",
      operationId: otherOperation,
      requestId: otherRequest,
    });
  });

  it("abertura nova rejeita identidade/seleção divergente do envelope", async () => {
    for (const overrides of [
      { operationId: "7a8b9c0d-7a8b-4c0d-9e1f-7a8b9c0d1e2f" },
      { requestId: "8b9c0d1e-8b9c-4d1e-8f0a-8b9c0d1e2f3a" },
      { credits: 2 },
      { state: "delivered" },
      { selection: { ...openSuccess().selection, quality: "medium" } },
    ]) {
      const client = fakeClient(openSuccess(overrides));
      await expectClientError(
        new FormatAdditionFinancialClient(client).open(OPEN_INPUT),
        "invalid_envelope",
      );
    }
  });

  it("aceita somente motivos da allowlist de abertura", async () => {
    for (const reason of [
      "source_path_missing",
      "source_operation_artifact_mismatch",
      "source_path_mismatch",
      "source_provenance_mismatch",
      "operation_origin_conflict",
    ]) {
      const client = fakeClient({ success: false, reason });
      await expect(
        new FormatAdditionFinancialClient(client).open(OPEN_INPUT),
      ).resolves.toEqual({ success: false, reason });
    }

    for (const reason of [
      "vertical_artifact_invalid",
      "vertical_provenance_invalid",
      "delivered_not_refundable",
      "motivo_desconhecido",
    ]) {
      const client = fakeClient({ success: false, reason });
      await expectClientError(
        new FormatAdditionFinancialClient(client).open(OPEN_INPUT),
        "invalid_envelope",
      );
    }
  });

  it("valida abertura antes de qualquer RPC", async () => {
    const client = fakeClient(openSuccess());
    const service = new FormatAdditionFinancialClient(client);

    for (const patch of [
      { storeId: "not-uuid" },
      { sourceChecksumSha256: "not-checksum" },
      { sourceOperationId: null },
      { campaignId: "not-uuid" },
      { sourceRegistrationOperationId: "not-uuid" },
    ]) {
      await expect(
        service.open({ ...OPEN_INPUT, ...patch } as FormatAdditionOpenInput),
      ).rejects.toBeInstanceOf(FormatAdditionClientError);
    }

    await expect(
      service.open({
        ...OPEN_INPUT,
        sourceOrigin: "legacy_campaign",
        sourceOperationId: PRIMARY,
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });

    await expect(
      service.open({
        ...OPEN_INPUT,
        frozen: {
          ...FROZEN,
          selection: { ...FROZEN.selection, selectionOrigin: "legacy" as never },
        },
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });

    expect(
      (client as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc,
    ).not.toHaveBeenCalled();
  });

  it("entrega exige token local e envia parâmetros exatos", async () => {
    const token = "9c0d1e2f-9c0d-4e2f-8a1b-9c0d1e2f3a4b";
    const client = fakeClient({
      success: true,
      idempotent: false,
      state: "delivered",
      operationId: OPERATION,
    });
    const service = new FormatAdditionFinancialClient(client);

    await expect(
      service.deliver({ storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION, publicationToken: null }),
    ).rejects.toMatchObject({ code: "missing_publication_token" });
    await expect(
      service.deliver({ storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION, publicationToken: "not-uuid" }),
    ).rejects.toMatchObject({ code: "invalid_publication_token" });
    expect(
      (client as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc,
    ).not.toHaveBeenCalled();

    await expect(
      service.deliver({
        storeId: STORE,
        campaignId: CAMPAIGN,
        operationId: OPERATION,
        publicationToken: token,
      }),
    ).resolves.toMatchObject({ success: true, state: "delivered" });
    expect(
      (client as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc,
    ).toHaveBeenCalledWith("campaign_format_add_deliver", {
      p_store_id: STORE,
      p_campaign_id: CAMPAIGN,
      p_operation_id: OPERATION,
      p_publication_token: token,
    });
  });

  it("entrega rejeita estado/identidade divergentes e motivo de outra RPC", async () => {
    const token = "9c0d1e2f-9c0d-4e2f-8a1b-9c0d1e2f3a4b";
    for (const response of [
      { success: true, idempotent: false, state: "refunded", operationId: OPERATION },
      { success: true, idempotent: false, state: "delivered", operationId: PRIMARY },
    ]) {
      const client = fakeClient(response);
      await expectClientError(
        new FormatAdditionFinancialClient(client).deliver({
          storeId: STORE,
          campaignId: CAMPAIGN,
          operationId: OPERATION,
          publicationToken: token,
        }),
        "invalid_envelope",
      );
    }

    const wrongReason = fakeClient({ success: false, reason: "source_path_missing" });
    await expectClientError(
      new FormatAdditionFinancialClient(wrongReason).deliver({
        storeId: STORE,
        campaignId: CAMPAIGN,
        operationId: OPERATION,
        publicationToken: token,
      }),
      "invalid_envelope",
    );

    for (const reason of ["vertical_artifact_invalid", "vertical_provenance_invalid", "stale_publication"]) {
      expect(FORMAT_ADDITION_DELIVER_REASONS).toContain(reason);
    }
  });

  it("estorno valida epoch/motivo e aceita o envelope fechado", async () => {
    const client = fakeClient({
      success: true,
      idempotent: true,
      state: "refunded",
      operationId: OPERATION,
    });
    const service = new FormatAdditionFinancialClient(client);

    await expect(
      service.refund({ storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION, observedEpoch: -1, reason: "falha" }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    await expect(
      service.refund({ storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION, observedEpoch: 1, reason: "  " }),
    ).rejects.toMatchObject({ code: "invalid_input" });

    await expect(
      service.refund({ storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION, observedEpoch: 3, reason: "falha definitiva" }),
    ).resolves.toMatchObject({ success: true, state: "refunded" });
    expect(
      (client as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc,
    ).toHaveBeenCalledWith("campaign_format_add_refund", {
      p_store_id: STORE,
      p_campaign_id: CAMPAIGN,
      p_operation_id: OPERATION,
      p_observed_epoch: 3,
      p_reason: "falha definitiva",
    });
  });

  it("estorno rejeita motivo de outra RPC e estado divergente", async () => {
    for (const response of [
      { success: false, reason: "source_path_missing" },
      { success: true, idempotent: false, state: "delivered", operationId: OPERATION },
    ]) {
      const client = fakeClient(response);
      await expectClientError(
        new FormatAdditionFinancialClient(client).refund({
          storeId: STORE,
          campaignId: CAMPAIGN,
          operationId: OPERATION,
          observedEpoch: 1,
          reason: "falha",
        }),
        "invalid_envelope",
      );
    }

    for (const reason of [
      "vertical_artifact_present",
      "operation_unknown",
      "finality_not_recorded",
      "publication_in_progress",
      "refund_failed",
    ]) {
      expect(FORMAT_ADDITION_REFUND_REASONS).toContain(reason);
    }
    for (const reason of ["source_path_missing", "vertical_artifact_invalid"]) {
      expect(FORMAT_ADDITION_REFUND_REASONS).not.toContain(reason);
    }
  });

  it("erro de transporte nunca vira sucesso; código conhecido é preservado", async () => {
    const client = fakeClient(null, { message: "campaign_format_add_open: source_path_mismatch" });
    await expectClientError(
      new FormatAdditionFinancialClient(client).open(OPEN_INPUT),
      "source_path_mismatch",
    );

    const unknown = fakeClient(null, { message: "connection refused" });
    await expectClientError(
      new FormatAdditionFinancialClient(unknown).open(OPEN_INPUT),
      "transport_error",
    );
  });

  it("não expõe motivo de outra RPC nem aceita envelope incompleto", async () => {
    expect(FORMAT_ADDITION_OPEN_REASONS).not.toContain("vertical_artifact_invalid");
    expect(FORMAT_ADDITION_DELIVER_REASONS).not.toContain("source_path_missing");
    expect(FORMAT_ADDITION_REFUND_REASONS).not.toContain("delivered");

    const incomplete = fakeClient({ success: true });
    await expectClientError(
      new FormatAdditionFinancialClient(incomplete).open(OPEN_INPUT),
      "invalid_envelope",
    );
    await expectClientError(
      new FormatAdditionFinancialClient(fakeClient({ success: false })).open(OPEN_INPUT),
      "invalid_envelope",
    );
  });

  it("módulo é server-only e não escreve direto em tabela nem chama provider", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync(
      "src/lib/campaign/format-addition/financial-client.ts",
      "utf8",
    );

    expect(source).toContain('import "server-only"');
    expect(source).not.toMatch(/@\/lib\/ai\/(?:gateway|providers?)\//);
    expect(source).not.toMatch(/from\s+["'][^"']*provider/i);
    expect(source).not.toMatch(/product_two_format/);
    expect(source).not.toMatch(/\.from\(["']campaigns["']\)/);
    expect(source).not.toMatch(/INSERT\s+INTO|UPDATE\s+public\./i);
  });
});
