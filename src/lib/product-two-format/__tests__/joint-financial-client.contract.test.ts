// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  TwoFormatDeliveryError,
  TwoFormatJointFinancialClient,
} from "../joint-financial-client";

const { supabaseAdminMock } = vi.hoisted(() => ({
  supabaseAdminMock: { rpc: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: supabaseAdminMock }));

/**
 * Contrato OFFLINE do cliente financeiro conjunto (F60.7 / Plano 60.7-03).
 *
 * Nenhuma conexão de banco, RPC real, Docker, homolog, Storage ou provider é
 * usada aqui: um fake de `SupabaseClient` registra as chamadas e devolve
 * envelopes controlados. Testes estáticos de SQL não provam atomicidade,
 * isolamento, deadlock nem concorrência — isso é o Gate de banco futuro.
 */

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";
const SQUARE_DELIVERY = "44444444-4444-4444-8444-444444444444";
const CONFIG_VERSION = "9b1d3c4e-5f60-4a7b-8c9d-0e1f2a3b4c5d";
const PUBLICATION_TOKEN = "55555555-5555-4555-8555-555555555555";
const MODEL = "gpt-image-2.5-flare";
const QUALITY = "medium";

const SQUARE_PATH = `${STORE}/${CAMPAIGN}/${OPERATION}/square_original.jpg`;

const OPEN_RPC = "product_two_format_open_delivery";
const DELIVER_RPC = "product_two_format_deliver_format";
const REFUND_RPC = "product_two_format_refund_format";
const PROJECT_RPC = "product_two_format_project_campaign";

interface RpcCall {
  readonly fn: string;
  readonly params: Record<string, unknown>;
}

type Responder =
  | unknown
  | (() => unknown)
  | { readonly errorMessage: string }
  | { readonly errorMessages: readonly string[] };

function fakeClient(responses: Record<string, Responder> = {}) {
  const calls: RpcCall[] = [];
  const counters = new Map<string, number>();
  const rpc = vi.fn(async (fn: string, params: Record<string, unknown>) => {
    calls.push({ fn, params });
    const responder = responses[fn];
    if (responder !== null && typeof responder === "object" && "errorMessage" in (responder as object)) {
      return { data: null, error: { message: (responder as { errorMessage: string }).errorMessage } };
    }
    if (responder !== null && typeof responder === "object" && "errorMessages" in (responder as object)) {
      const queue = (responder as { errorMessages: readonly string[] }).errorMessages;
      const index = counters.get(fn) ?? 0;
      counters.set(fn, index + 1);
      const message = queue[Math.min(index, queue.length - 1)];
      return { data: null, error: { message } };
    }
    const data =
      typeof responder === "function" ? (responder as () => unknown)() : (responder ?? null);
    return { data, error: null };
  });
  return { calls, client: { rpc } as never };
}

function openEnvelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    success: true,
    idempotent: false,
    campaign_id: CAMPAIGN,
    operation_id: OPERATION,
    square_delivery_id: SQUARE_DELIVERY,
    vertical_delivery_operation_id: OPERATION,
    contract_version: "f60.7-two-format-v1",
    expansion_model: MODEL,
    expansion_quality: QUALITY,
    expansion_config_version_id: CONFIG_VERSION,
    expansion_selection_origin: "configured",
    status: "reserved",
    square_status: "reserved",
    steps: [
      { stage: "base", status: "pending", attempts_used: 0, failure_class: null },
      { stage: "expansion", status: "pending", attempts_used: 0, failure_class: null },
    ],
    ...overrides,
  };
}

function deliverEnvelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    success: true,
    idempotent: false,
    campaign_id: CAMPAIGN,
    operation_id: OPERATION,
    format: "1:1",
    delivery_operation_id: SQUARE_DELIVERY,
    artifact_role: "square_original",
    credit_status: "delivered",
    campaign_status: "ready",
    storage_path: SQUARE_PATH,
    preferred_format: "1:1",
    projected: true,
    already_projected: false,
    ...overrides,
  };
}

function refundEnvelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    success: true,
    idempotent: false,
    campaign_id: CAMPAIGN,
    operation_id: OPERATION,
    format: "9:16",
    delivery_operation_id: OPERATION,
    artifact_role: "vertical",
    credit_status: "refunded",
    campaign_status: "error",
    storage_path: null,
    preferred_format: null,
    projected: true,
    already_projected: false,
    ...overrides,
  };
}

function projectEnvelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    success: true,
    campaign_id: CAMPAIGN,
    projected: false,
    already_projected: true,
    campaign_status: "ready",
    storage_path: SQUARE_PATH,
    preferred_format: "1:1",
    ...overrides,
  };
}

function openInput(overrides: Record<string, unknown> = {}) {
  return {
    storeId: STORE,
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    squareDeliveryId: SQUARE_DELIVERY,
    selection: { model: MODEL, quality: QUALITY, configVersionId: CONFIG_VERSION },
    ...overrides,
  };
}

function deliverInput(overrides: Record<string, unknown> = {}) {
  return {
    storeId: STORE,
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    format: "1:1" as const,
    publicationToken: PUBLICATION_TOKEN,
    ...overrides,
  };
}

function refundInput(overrides: Record<string, unknown> = {}) {
  return {
    storeId: STORE,
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    format: "9:16" as const,
    artKind: "absent" as const,
    observedEpoch: 7,
    reason: "two_format_refund",
    ...overrides,
  };
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof TwoFormatDeliveryError) return error.code;
    throw error;
  }
  throw new Error("expected_rejection");
}

beforeEach(() => {
  supabaseAdminMock.rpc.mockReset();
});

describe("cliente financeiro conjunto — construção e RPCs", () => {
  it("Teste 1: usa exatamente o client injetado e recorre ao admin apenas como default", async () => {
    const fake = fakeClient({ [OPEN_RPC]: openEnvelope() });
    const client = new TwoFormatJointFinancialClient(fake.client);
    const result = await client.openJointDelivery(openInput());

    expect(result.success).toBe(true);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0].fn).toBe(OPEN_RPC);
    expect(supabaseAdminMock.rpc).not.toHaveBeenCalled();

    supabaseAdminMock.rpc.mockResolvedValueOnce({ data: projectEnvelope(), error: null });
    const defaultClient = new TwoFormatJointFinancialClient();
    const projected = await defaultClient.projectCampaign({ campaignId: CAMPAIGN });

    expect(projected.success).toBe(true);
    expect(supabaseAdminMock.rpc).toHaveBeenCalledTimes(1);
    expect(supabaseAdminMock.rpc.mock.calls[0][0]).toBe(PROJECT_RPC);
  });

  it("Teste 2: abertura envia exatamente os sete parâmetros p_* do contrato", async () => {
    const fake = fakeClient({ [OPEN_RPC]: openEnvelope() });
    const client = new TwoFormatJointFinancialClient(fake.client);

    await client.openJointDelivery(openInput());

    expect(fake.calls[0].params).toEqual({
      p_store_id: STORE,
      p_campaign_id: CAMPAIGN,
      p_operation_id: OPERATION,
      p_square_delivery_id: SQUARE_DELIVERY,
      p_expansion_model: MODEL,
      p_expansion_quality: QUALITY,
      p_expansion_config_version_id: CONFIG_VERSION,
    });
  });

  it("Teste 3: recusa local antes de qualquer RPC", async () => {
    const fake = fakeClient({ [OPEN_RPC]: openEnvelope() });
    const client = new TwoFormatJointFinancialClient(fake.client);

    expect(
      await codeOf(
        client.openJointDelivery(openInput({ squareDeliveryId: OPERATION })),
      ),
    ).toBe("delivery_identity_conflict");

    expect(
      await codeOf(
        client.openJointDelivery(
          openInput({
            selection: { model: MODEL, quality: QUALITY, configVersionId: "not-a-uuid" },
          }),
        ),
      ),
    ).toBe("operation_config_conflict");

    expect(
      await codeOf(
        client.openJointDelivery(
          openInput({
            selection: { model: "gpt-image-3", quality: QUALITY, configVersionId: CONFIG_VERSION },
          }),
        ),
      ),
    ).toBe("operation_config_conflict");

    expect(
      await codeOf(
        client.openJointDelivery(
          openInput({
            selection: { model: MODEL, quality: "ultra", configVersionId: CONFIG_VERSION },
          }),
        ),
      ),
    ).toBe("operation_config_conflict");

    expect(await codeOf(client.openJointDelivery(openInput({ storeId: "not-a-uuid" })))).toBe(
      "identity_mismatch",
    );
    expect(
      await codeOf(client.openJointDelivery(openInput({ campaignId: "campaign" }))),
    ).toBe("identity_mismatch");

    expect(fake.calls).toHaveLength(0);
  });

  it("Teste 4: envelope de abertura válido é projetado e qualquer divergência falha fechado", async () => {
    const fake = fakeClient({ [OPEN_RPC]: openEnvelope({ idempotent: true, status: "reserved" }) });
    const client = new TwoFormatJointFinancialClient(fake.client);

    const success = await client.openJointDelivery(openInput());
    expect(success).toEqual({
      success: true,
      idempotent: true,
      campaignId: CAMPAIGN,
      operationId: OPERATION,
      squareDeliveryId: SQUARE_DELIVERY,
      verticalDeliveryOperationId: OPERATION,
      contractVersion: "f60.7-two-format-v1",
      frozenSelection: {
        model: MODEL,
        quality: QUALITY,
        configVersionId: CONFIG_VERSION,
        origin: "configured",
      },
      creditStatus: "reserved",
      squareCreditStatus: "reserved",
      steps: [
        { stage: "base", status: "pending", attemptsUsed: 0, failureClass: null },
        { stage: "expansion", status: "pending", attemptsUsed: 0, failureClass: null },
      ],
    });

    const invalidEnvelopes: Array<Record<string, unknown>> = [
      openEnvelope({ contract_version: "f60.7-two-format-v2" }),
      openEnvelope({ square_delivery_id: STORE }),
      openEnvelope({ campaign_id: STORE }),
      openEnvelope({ operation_id: STORE }),
      openEnvelope({ steps: "not-an-array" }),
      openEnvelope({ status: "paid" }),
      openEnvelope({ square_status: "paid" }),
      openEnvelope({ idempotent: "true" }),
      openEnvelope({ expansion_model: undefined }),
      openEnvelope({ expansion_selection_origin: "legacy_sunburst_low" }),
      openEnvelope({ expansion_config_version_id: "config" }),
      openEnvelope({ steps: [{ stage: "base" }] }),
    ];

    for (const envelope of invalidEnvelopes) {
      const scoped = fakeClient({ [OPEN_RPC]: envelope });
      const scopedClient = new TwoFormatJointFinancialClient(scoped.client);
      expect(await codeOf(scopedClient.openJointDelivery(openInput()))).toBe("invalid_envelope");
    }

    const divergent = fakeClient({
      [OPEN_RPC]: openEnvelope({ expansion_model: "gpt-image-2.5-sunburst" }),
    });
    const divergentClient = new TwoFormatJointFinancialClient(divergent.client);
    expect(await codeOf(divergentClient.openJointDelivery(openInput()))).toBe(
      "operation_config_conflict",
    );
  });

  it("Teste 5: rejeições de negócio da abertura são devolvidas como união", async () => {
    for (const reason of [
      "joint_contract_required",
      "operation_config_conflict",
      "operation_identity_conflict",
    ]) {
      const fake = fakeClient({ [OPEN_RPC]: { success: false, reason } });
      const client = new TwoFormatJointFinancialClient(fake.client);
      expect(await client.openJointDelivery(openInput())).toEqual({ success: false, reason });
    }

    const malformed = fakeClient({ [OPEN_RPC]: { success: false, reason: "something_else" } });
    const malformedClient = new TwoFormatJointFinancialClient(malformed.client);
    expect(await codeOf(malformedClient.openJointDelivery(openInput()))).toBe("invalid_envelope");
  });

  it("Teste 6: entrega exige token de publicação e formato suportado antes da RPC", async () => {
    const fake = fakeClient({ [DELIVER_RPC]: deliverEnvelope() });
    const client = new TwoFormatJointFinancialClient(fake.client);

    const delivered = await client.deliverFormat(deliverInput());
    expect(delivered.success).toBe(true);
    expect(fake.calls[0].fn).toBe(DELIVER_RPC);
    expect(fake.calls[0].params).toEqual({
      p_store_id: STORE,
      p_campaign_id: CAMPAIGN,
      p_operation_id: OPERATION,
      p_format: "1:1",
      p_publication_token: PUBLICATION_TOKEN,
    });

    expect(
      await codeOf(client.deliverFormat(deliverInput({ publicationToken: null }))),
    ).toBe("missing_publication_token");
    expect(
      await codeOf(client.deliverFormat(deliverInput({ publicationToken: "   " }))),
    ).toBe("missing_publication_token");
    expect(
      await codeOf(
        client.deliverFormat(deliverInput({ publicationToken: 42 as unknown as string })),
      ),
    ).toBe("missing_publication_token");
    // O parâmetro SQL é UUID: token malformado falha local e não chama a RPC.
    expect(
      await codeOf(
        client.deliverFormat(deliverInput({ publicationToken: "publication-token" })),
      ),
    ).toBe("invalid_publication_token");
    expect(
      await codeOf(
        client.deliverFormat(
          deliverInput({ publicationToken: "12345678-1234-1234-1234-12345678901" }),
        ),
      ),
    ).toBe("invalid_publication_token");
    expect(await codeOf(client.deliverFormat(deliverInput({ format: "4:3" })))).toBe(
      "unsupported_format",
    );

    expect(fake.calls).toHaveLength(1);
  });

  it("Teste 7: não há upload, confirmação separada nem cliente global escondido", () => {
    const sourcePath = path.join(
      process.cwd(),
      "src/lib/product-two-format/joint-financial-client.ts",
    );
    const source = readFileSync(sourcePath, "utf8");

    expect(source.includes("mark" + "_campaign_credit_art_uploaded")).toBe(false);
    expect(source.includes("deliver" + "_campaign_credit_operation")).toBe(false);
    expect(source.includes("." + "upload(")).toBe(false);
    expect(source.includes("store" + "Artifact")).toBe(false);

    const rpcNames = source.match(
      /product_two_format_(?:open_delivery|deliver_format|refund_format|project_campaign)/g,
    );
    expect(rpcNames).not.toBeNull();
    expect(new Set(rpcNames ?? [])).toEqual(new Set([OPEN_RPC, DELIVER_RPC, REFUND_RPC, PROJECT_RPC]));
    expect((rpcNames ?? []).length).toBe(4);

    // A ordem de publicação precisa estar documentada no cabeçalho.
    expect(source).toContain("beginPublication");
    expect(source).toContain("persistido");
    expect(source).toContain("verificado");
  });

  it("Teste 8: replay idempotente só é aceito com estado terminal coerente", async () => {
    const coherent = fakeClient({
      [DELIVER_RPC]: deliverEnvelope({ idempotent: true, credit_status: "delivered" }),
    });
    const coherentClient = new TwoFormatJointFinancialClient(coherent.client);
    const replay = await coherentClient.deliverFormat(deliverInput());
    expect(replay.success).toBe(true);
    if (replay.success) {
      expect(replay.idempotent).toBe(true);
      expect(replay.creditStatus).toBe("delivered");
    }

    const incoherent = fakeClient({
      [DELIVER_RPC]: deliverEnvelope({ idempotent: true, credit_status: "refunded" }),
    });
    const incoherentClient = new TwoFormatJointFinancialClient(incoherent.client);
    expect(await codeOf(incoherentClient.deliverFormat(deliverInput()))).toBe("invalid_envelope");

    const wrongRole = fakeClient({
      [DELIVER_RPC]: deliverEnvelope({ artifact_role: "vertical" }),
    });
    const wrongRoleClient = new TwoFormatJointFinancialClient(wrongRole.client);
    expect(await codeOf(wrongRoleClient.deliverFormat(deliverInput()))).toBe("invalid_envelope");
  });

  it("Teste 9: erros do PostgREST são mapeados para códigos estáveis", async () => {
    const mappedCodes = [
      "publication_not_owner",
      "operation_origin_conflict",
      "delivery_identity_conflict",
      "publication_in_progress",
      "finality_not_recorded",
      "operation_in_progress",
      "evidence_stale",
      "absent_not_confirmed",
      "operation_terminal",
      "credit_reservation_failed",
      "square_credit_reservation_failed",
      "delivered_not_refundable",
      "invalid_transition",
      "operation_not_found",
      "delivery_links_inconsistent",
      "shared_operation_not_final",
    ];

    for (const code of mappedCodes) {
      const fake = fakeClient({
        [PROJECT_RPC]: { errorMessage: `postgres error: ${code}` },
      });
      const client = new TwoFormatJointFinancialClient(fake.client);
      expect(await codeOf(client.projectCampaign({ campaignId: CAMPAIGN }))).toBe(code);
    }

    const unknown = fakeClient({
      [PROJECT_RPC]: { errorMessage: "connection reset by peer" },
    });
    const unknownClient = new TwoFormatJointFinancialClient(unknown.client);
    try {
      await unknownClient.projectCampaign({ campaignId: CAMPAIGN });
      throw new Error("expected_rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(TwoFormatDeliveryError);
      const typed = error as TwoFormatDeliveryError;
      expect(typed.code).toBe("unknown");
      expect(typed.message).toContain("connection reset by peer");
      expect(typed.detail).toContain("connection reset by peer");
    }
  });

  it("Teste 9b: exceções de vínculo/finalidade nunca são aceitas como rejeição de negócio", async () => {
    for (const reason of ["delivery_links_inconsistent", "shared_operation_not_final"]) {
      const asEnvelope = fakeClient({ [DELIVER_RPC]: { success: false, reason } });
      const envelopeClient = new TwoFormatJointFinancialClient(asEnvelope.client);
      expect(await codeOf(envelopeClient.deliverFormat(deliverInput()))).toBe(
        "invalid_envelope",
      );

      const asRefundEnvelope = fakeClient({ [REFUND_RPC]: { success: false, reason } });
      const refundClient = new TwoFormatJointFinancialClient(asRefundEnvelope.client);
      expect(await codeOf(refundClient.refundFormat(refundInput()))).toBe("invalid_envelope");

      const asException = fakeClient({
        [REFUND_RPC]: { errorMessage: `plpgsql raised ${reason}` },
      });
      const exceptionClient = new TwoFormatJointFinancialClient(asException.client);
      expect(await codeOf(exceptionClient.refundFormat(refundInput()))).toBe(reason);
    }
  });

  it("Teste 13: motivos por RPC — repassados, faltantes, desconhecidos e cruzados", async () => {
    // Motivos que a abertura realmente devolve (próprios + repassados pela v2).
    for (const reason of [
      "operation_origin_conflict",
      "operation_in_progress",
      "joint_open_failed",
    ]) {
      const fake = fakeClient({ [OPEN_RPC]: { success: false, reason } });
      const client = new TwoFormatJointFinancialClient(fake.client);
      expect(await client.openJointDelivery(openInput())).toEqual({ success: false, reason });
    }

    // `missing_publication_token` é rejeição de negócio do SQL de entrega.
    const tokenEnvelope = fakeClient({
      [DELIVER_RPC]: { success: false, reason: "missing_publication_token" },
    });
    expect(
      await new TwoFormatJointFinancialClient(tokenEnvelope.client).deliverFormat(deliverInput()),
    ).toEqual({ success: false, reason: "missing_publication_token" });

    // Motivo legítimo de OUTRA RPC continua sendo envelope inválido.
    const crossOpen = fakeClient({ [OPEN_RPC]: { success: false, reason: "artifact_present" } });
    expect(
      await codeOf(new TwoFormatJointFinancialClient(crossOpen.client).openJointDelivery(openInput())),
    ).toBe("invalid_envelope");

    const crossDeliver = fakeClient({
      [DELIVER_RPC]: { success: false, reason: "operation_in_progress" },
    });
    expect(
      await codeOf(
        new TwoFormatJointFinancialClient(crossDeliver.client).deliverFormat(deliverInput()),
      ),
    ).toBe("invalid_envelope");

    const crossRefund = fakeClient({
      [REFUND_RPC]: { success: false, reason: "joint_open_failed" },
    });
    expect(
      await codeOf(
        new TwoFormatJointFinancialClient(crossRefund.client).refundFormat(refundInput()),
      ),
    ).toBe("invalid_envelope");

    // Exceção recebida como envelope na projeção também falha fechado.
    for (const reason of ["delivery_links_inconsistent", "shared_operation_not_final"]) {
      const asProjectionEnvelope = fakeClient({ [PROJECT_RPC]: { success: false, reason } });
      expect(
        await codeOf(
          new TwoFormatJointFinancialClient(asProjectionEnvelope.client).projectCampaign({
            campaignId: CAMPAIGN,
          }),
        ),
      ).toBe("invalid_envelope");
    }

    // Motivo desconhecido em qualquer RPC é envelope inválido.
    const unknownProject = fakeClient({
      [PROJECT_RPC]: { success: false, reason: "not_a_real_reason" },
    });
    expect(
      await codeOf(
        new TwoFormatJointFinancialClient(unknownProject.client).projectCampaign({
          campaignId: CAMPAIGN,
        }),
      ),
    ).toBe("invalid_envelope");
  });

  it("Teste 10: estorno envia evidência de ausência e devolve a união discriminada", async () => {
    const fake = fakeClient({ [REFUND_RPC]: refundEnvelope() });
    const client = new TwoFormatJointFinancialClient(fake.client);

    const refunded = await client.refundFormat(refundInput());
    expect(refunded.success).toBe(true);
    if (refunded.success) expect(refunded.creditStatus).toBe("refunded");
    expect(fake.calls[0].params).toEqual({
      p_store_id: STORE,
      p_campaign_id: CAMPAIGN,
      p_operation_id: OPERATION,
      p_format: "9:16",
      p_art_kind: "absent",
      p_observed_epoch: 7,
      p_reason: "two_format_refund",
    });

    for (const reason of ["delivered_not_refundable", "insufficient_evidence"]) {
      const rejected = fakeClient({ [REFUND_RPC]: { success: false, reason } });
      const rejectedClient = new TwoFormatJointFinancialClient(rejected.client);
      expect(await rejectedClient.refundFormat(refundInput())).toEqual({
        success: false,
        reason,
      });
    }

    const replay = fakeClient({ [REFUND_RPC]: refundEnvelope({ idempotent: true }) });
    const replayClient = new TwoFormatJointFinancialClient(replay.client);
    const replayed = await replayClient.refundFormat(refundInput());
    expect(replayed.success).toBe(true);
    if (replayed.success) expect(replayed.idempotent).toBe(true);

    const refusedCalls = fakeClient({ [REFUND_RPC]: refundEnvelope() });
    const refusedClient = new TwoFormatJointFinancialClient(refusedCalls.client);
    expect(await codeOf(refusedClient.refundFormat(refundInput({ artKind: "unknown" })))).toBe(
      "insufficient_evidence",
    );
    expect(await codeOf(refusedClient.refundFormat(refundInput({ observedEpoch: -1 })))).toBe(
      "insufficient_evidence",
    );
    expect(await codeOf(refusedClient.refundFormat(refundInput({ observedEpoch: 1.5 })))).toBe(
      "insufficient_evidence",
    );
    expect(refusedCalls.calls).toHaveLength(0);
  });

  it("Teste 11: projeção devolve o estado projetado e recusa preferred_format inválido", async () => {
    const fake = fakeClient({ [PROJECT_RPC]: projectEnvelope({ preferred_format: null }) });
    const client = new TwoFormatJointFinancialClient(fake.client);

    const result = await client.projectCampaign({ campaignId: CAMPAIGN });
    expect(result).toEqual({
      success: true,
      campaignId: CAMPAIGN,
      projected: false,
      alreadyProjected: true,
      campaignStatus: "ready",
      storagePath: SQUARE_PATH,
      preferredFormat: null,
    });
    expect(fake.calls[0].params).toEqual({ p_campaign_id: CAMPAIGN });

    const invalid = fakeClient({ [PROJECT_RPC]: projectEnvelope({ preferred_format: "2:1" }) });
    const invalidClient = new TwoFormatJointFinancialClient(invalid.client);
    expect(await codeOf(invalidClient.projectCampaign({ campaignId: CAMPAIGN }))).toBe(
      "invalid_envelope",
    );
  });
});

describe("contrato SQL ↔ cliente", () => {
  const migrationsDir = path.join(process.cwd(), "supabase/migrations");
  const matches = readdirSync(migrationsDir).filter((name) =>
    name.endsWith("_f60_7_two_format_foundation.sql"),
  );
  const fileName = matches.length === 1 ? matches[0] : "";
  const sql = fileName
    ? readFileSync(path.join(migrationsDir, fileName), "utf8")
        .split(/\r?\n/)
        .map((line) => line.replace(/--.*$/, ""))
        .join("\n")
        .replace(/\s+/g, " ")
    : "";

  function signature(name: string): string {
    const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
    if (start < 0) return "";
    const end = sql.indexOf(")", start);
    return end < 0 ? "" : sql.slice(start, end + 1);
  }

  function paramsOf(name: string): string[] {
    return Array.from(signature(name).matchAll(/\bp_[a-z_]+/g)).map((match) => match[0]);
  }

  function normalized(fileName: string): string {
    return readFileSync(path.join(migrationsDir, fileName), "utf8")
      .split(/\r?\n/)
      .map((line) => line.replace(/--.*$/, ""))
      .join("\n")
      .replace(/\s+/g, " ");
  }

  function functionBody(source: string, name: string): string {
    const marker = `FUNCTION public.${name}(`;
    const start = source.indexOf(marker);
    expect(start).toBeGreaterThan(-1);
    const next = source.indexOf("CREATE OR REPLACE FUNCTION", start + marker.length);
    return source.slice(start, next < 0 ? source.length : next);
  }

  function returnedReasons(source: string, name: string): string[] {
    return Array.from(
      new Set(
        Array.from(
          functionBody(source, name).matchAll(/'reason',\s*'([a-z_]+)'/g),
          (match) => match[1],
        ),
      ),
    );
  }

  it("Teste 12: nomes e parâmetros do cliente existem nas assinaturas autoradas", () => {
    expect(fileName).not.toBe("");

    const expected: Record<string, string[]> = {
      [OPEN_RPC]: [
        "p_store_id",
        "p_campaign_id",
        "p_operation_id",
        "p_square_delivery_id",
        "p_expansion_model",
        "p_expansion_quality",
        "p_expansion_config_version_id",
      ],
      [DELIVER_RPC]: [
        "p_store_id",
        "p_campaign_id",
        "p_operation_id",
        "p_format",
        "p_publication_token",
      ],
      [REFUND_RPC]: [
        "p_store_id",
        "p_campaign_id",
        "p_operation_id",
        "p_format",
        "p_art_kind",
        "p_observed_epoch",
        "p_reason",
      ],
      [PROJECT_RPC]: ["p_campaign_id"],
    };

    for (const [name, params] of Object.entries(expected)) {
      expect(paramsOf(name)).toEqual(params);
    }

    const openFunction = sql.slice(sql.indexOf(`FUNCTION public.${OPEN_RPC}(`));
    for (const key of [
      "expansion_model",
      "expansion_quality",
      "expansion_config_version_id",
      "expansion_selection_origin",
      "f60.7-two-format-v1",
    ]) {
      expect(openFunction).toContain(key);
    }

    expect(sql).toContain("RAISE EXCEPTION 'delivery_links_inconsistent'");
    expect(sql).toContain("RAISE EXCEPTION 'shared_operation_not_final'");
  });

  it("Teste 14: motivos devolvidos por função (incluindo os repassados pela v2) são aceitos", async () => {
    const v2Sql = normalized("20261117170916_f60_6_nine_sixteen_expansion_model_config.sql");

    const openOwn = returnedReasons(sql, OPEN_RPC);
    const openForwarded = returnedReasons(v2Sql, "product_9_16_open_operation_v2");
    expect(openOwn.length).toBeGreaterThan(0);
    expect(openForwarded.length).toBeGreaterThan(0);
    // Fronteira explícita: a abertura repassa estes motivos verbatim da v2.
    expect(openForwarded).toEqual(
      expect.arrayContaining(["operation_origin_conflict", "operation_in_progress"]),
    );

    for (const reason of [...openOwn, ...openForwarded]) {
      const fake = fakeClient({ [OPEN_RPC]: { success: false, reason } });
      await expect(
        new TwoFormatJointFinancialClient(fake.client).openJointDelivery(openInput()),
      ).resolves.toEqual({ success: false, reason });
    }

    const deliverReasons = returnedReasons(sql, DELIVER_RPC);
    expect(deliverReasons).toEqual(
      expect.arrayContaining(["unsupported_format", "missing_publication_token"]),
    );
    for (const reason of deliverReasons) {
      const fake = fakeClient({ [DELIVER_RPC]: { success: false, reason } });
      await expect(
        new TwoFormatJointFinancialClient(fake.client).deliverFormat(deliverInput()),
      ).resolves.toEqual({ success: false, reason });
    }

    const refundReasons = returnedReasons(sql, REFUND_RPC);
    expect(refundReasons).toEqual(
      expect.arrayContaining(["artifact_present", "delivered_not_refundable"]),
    );
    for (const reason of refundReasons) {
      const fake = fakeClient({ [REFUND_RPC]: { success: false, reason } });
      await expect(
        new TwoFormatJointFinancialClient(fake.client).refundFormat(refundInput()),
      ).resolves.toEqual({ success: false, reason });
    }

    const projectReasons = returnedReasons(sql, PROJECT_RPC);
    expect(projectReasons).toEqual(["campaign_not_found"]);
    for (const reason of projectReasons) {
      const fake = fakeClient({ [PROJECT_RPC]: { success: false, reason } });
      await expect(
        new TwoFormatJointFinancialClient(fake.client).projectCampaign({ campaignId: CAMPAIGN }),
      ).resolves.toEqual({ success: false, reason });
    }

    // O inverso: exceção nunca é devolvida como motivo de negócio no SQL.
    const returned = new Set([...openOwn, ...deliverReasons, ...refundReasons, ...projectReasons]);
    expect(returned.has("delivery_links_inconsistent")).toBe(false);
    expect(returned.has("shared_operation_not_final")).toBe(false);
  });
});
