import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { apiHandler } from "@/lib/auth/api-handler";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { requireApiUser } from "@/lib/auth/require-user";
import { requireOwnership } from "@/lib/auth/store-ownership";
import { notFound } from "@/lib/api-error-response";
import { getCampaign } from "@/lib/campaign/persistence";
import { resolveCampaignFormat } from "@/lib/campaign/format-resolution";
import {
  deriveFormatAdditionEligibility,
} from "@/lib/campaign/format-addition/eligibility";
import { readFormatAdditionByCampaign, readFormatAdditionByIdentity } from "@/lib/campaign/format-addition/delivery-reader";
import {
  createFormatAdditionConfirmationToken,
  verifyFormatAdditionConfirmationToken,
} from "@/lib/campaign/format-addition/confirmation-token";
import type {
  FormatAdditionDurableRead,
  FormatAdditionEligibility,
  FormatAdditionSourceOrigin,
  FormatAdditionSourceRead,
} from "@/lib/campaign/format-addition/types";
import type { ResolveSquareSourceReason } from "@/lib/campaign/composition-artifacts/types";
import { resolveReusableSquareSource } from "@/lib/campaign/composition-artifacts/resolve-source";
import {
  createProductionFormatAdditionDeps,
} from "@/lib/campaign/format-addition/orchestration/deps";
import { runFormatAddition } from "@/lib/campaign/format-addition/orchestration/run-addition";
import { continueFormatAddition } from "@/lib/campaign/format-addition/orchestration/resume-addition";
import type { FormatAdditionRunResult } from "@/lib/campaign/format-addition/orchestration/types";
import { readNineSixteenExpansionConfig } from "@/lib/ai/nine-sixteen-expansion-model-config-service";
import {
  isCampaignFormatAdditionEnabled,
  isProduct9_16TwoStageEnabled,
} from "@/lib/feature-flags/feature-flag-service";
import { resolveEligibilityContext } from "@/lib/product-1-1/submission/eligibility-context";
import { resolveProductFlowAuthorization } from "@/lib/product-1-1/authorization/authorization-service";
import { resolvePilotSpendGate } from "@/lib/product-1-1/pilot/resolve-pilot-spend-gate";
import { computeInvocationDeadline } from "@/lib/product-9-16-two-stage/orchestration/deadline-budget";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FORMAT_ADDITION_BODY = z
  .object({
    format: z.literal("9:16"),
    confirmationToken: z.string().min(1).max(4096),
  })
  .strict();

type AdditionState =
  | "eligible"
  | "incompatible"
  | "processing"
  | "delivered"
  | "unknown"
  | "refunded"
  | "unavailable";

interface SourceResolution {
  readonly origin: FormatAdditionSourceOrigin | null;
  readonly checksum: string | null;
  readonly read: FormatAdditionSourceRead;
}

function durableFrom(
  read: Awaited<ReturnType<typeof readFormatAdditionByCampaign>>,
): FormatAdditionDurableRead {
  if (read.kind === "none") return { kind: "none" };
  if (read.kind === "read_failed") return { kind: "read_failed" };
  switch (read.addition.state) {
    case "delivered":
      return { kind: "delivered" };
    case "processing":
      return { kind: "processing" };
    case "unknown":
      return { kind: "unknown" };
    case "refunded":
      return { kind: "refunded" };
  }
}

function loadedSource(
  origin: string,
  overrides: Partial<Extract<FormatAdditionSourceRead, { kind: "loaded" }>> = {},
): Extract<FormatAdditionSourceRead, { kind: "loaded" }> {
  return {
    kind: "loaded",
    origin,
    width: 1024,
    height: 1024,
    mimeType: "image/jpeg",
    integrity: "valid",
    checksum: "verified",
    pathCanonical: true,
    ...overrides,
  };
}

function sourceReadFromFailure(
  reason: ResolveSquareSourceReason,
  origin: FormatAdditionSourceOrigin,
): FormatAdditionSourceRead {
  switch (reason) {
    case "artifact_absent":
      return { kind: "absent" };
    case "artifact_indeterminate":
      return { kind: "indeterminate" };
    case "metadata_conflict":
      return { kind: "read_failed" };
    case "not_owner":
    case "store_mismatch":
    case "identity_conflict":
      return { kind: "identity_conflict" };
    case "unsupported_dimensions":
      return loadedSource(origin, { width: 0, height: 0 });
    case "unsupported_mime":
      return loadedSource(origin, { mimeType: "application/octet-stream" });
    case "artifact_invalid":
      return loadedSource(origin, { integrity: "invalid" });
    case "path_not_canonical":
      return loadedSource(origin, { pathCanonical: false });
    case "role_not_reusable":
    case "source_origin_invalid":
      return loadedSource("invalid");
    case "campaign_not_ready":
    case "format_not_square":
      return loadedSource(origin);
  }
}

/**
 * Resolve a fonte reutilizável sem persistir nada. Tenta a origem conhecida ou,
 * quando ainda não há vínculo, novo fluxo e legado opt-in 1024 (somente leitura).
 * C9: preserva a MAIOR incerteza entre as tentativas; uma rejeição de path da
 * outra origem não pode transformar leitura indeterminada em incompatibilidade.
 */
async function resolveAdditionSource(
  campaignId: string,
  storeId: string,
  userId: string,
  knownOrigin: FormatAdditionSourceOrigin | null,
): Promise<SourceResolution> {
  const origins: FormatAdditionSourceOrigin[] = knownOrigin
    ? [knownOrigin]
    : ["new_flow_1_1", "legacy_campaign"];
  const failures: Array<{
    origin: FormatAdditionSourceOrigin;
    reason: ResolveSquareSourceReason;
  }> = [];

  for (const origin of origins) {
    const result = await resolveReusableSquareSource(
      {
        kind: origin,
        storeId,
        campaignId,
        authorization: { kind: "owner", userId },
      },
      { client: supabaseAdmin },
      origin === "legacy_campaign" ? { acceptLegacy1024: true } : {},
    );
    if (result.kind === "reusable") {
      return {
        origin,
        checksum: result.source.checksumSha256,
        read: loadedSource(origin, {
          width: result.source.width,
          height: result.source.height,
          mimeType: result.source.mimeType,
        }),
      };
    }
    failures.push({ origin, reason: result.reason });
  }

  const selected = pickSourceFailure(failures);
  return {
    origin: selected?.origin ?? null,
    checksum: null,
    read: selected
      ? sourceReadFromFailure(selected.reason, selected.origin)
      : { kind: "read_failed" },
  };
}

const UNCERTAIN_SOURCE_REASONS: ReadonlySet<ResolveSquareSourceReason> = new Set([
  "artifact_indeterminate",
  "metadata_conflict",
  "not_owner",
  "store_mismatch",
  "identity_conflict",
]);

const ARTIFACT_SOURCE_REASONS: ReadonlySet<ResolveSquareSourceReason> = new Set([
  "artifact_absent",
  "artifact_invalid",
  "unsupported_dimensions",
  "unsupported_mime",
]);

function sourceFailureRank(reason: ResolveSquareSourceReason): number {
  if (UNCERTAIN_SOURCE_REASONS.has(reason)) return 0;
  if (ARTIFACT_SOURCE_REASONS.has(reason)) return 1;
  return 2;
}

function pickSourceFailure(
  failures: ReadonlyArray<{
    origin: FormatAdditionSourceOrigin;
    reason: ResolveSquareSourceReason;
  }>,
): { origin: FormatAdditionSourceOrigin; reason: ResolveSquareSourceReason } | null {
  let selected: {
    origin: FormatAdditionSourceOrigin;
    reason: ResolveSquareSourceReason;
  } | null = null;
  for (const failure of failures) {
    if (
      selected === null ||
      sourceFailureRank(failure.reason) < sourceFailureRank(selected.reason)
    ) {
      selected = failure;
    }
  }
  return selected;
}

async function readDurableChecksum(
  storeId: string,
  campaignId: string,
  requestId: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("campaign_format_additions")
      .select("source_checksum_sha256")
      .eq("store_id", storeId.toLowerCase())
      .eq("campaign_id", campaignId.toLowerCase())
      .eq("request_id", requestId.toLowerCase())
      .maybeSingle();
    if (error || data === null || typeof data !== "object") return null;
    const checksum = (data as Record<string, unknown>).source_checksum_sha256;
    return typeof checksum === "string" ? checksum : null;
  } catch {
    return null;
  }
}

function stateFromEligibility(
  eligibility: FormatAdditionEligibility,
  additionRefunded: boolean,
): { state: AdditionState; reason?: string; refunded?: boolean } {
  switch (eligibility.kind) {
    case "eligible":
      return { state: "eligible" };
    case "incompatible":
      return { state: "incompatible", reason: eligibility.reason };
    case "unavailable":
      return { state: "unavailable", reason: eligibility.reason };
    case "delivered":
      return { state: "delivered" };
    case "processing":
      return {
        state: eligibility.state === "unknown" ? "unknown" : "processing",
      };
    case "absent":
      return additionRefunded
        ? { state: "refunded", refunded: true }
        : { state: "unavailable", reason: "artifact_absent" };
  }
}

function additionDto(
  state: AdditionState,
  sourceOrigin: FormatAdditionSourceOrigin | null,
  options: {
    readonly reason?: string;
    readonly refunded?: boolean;
    readonly requestId?: string;
    readonly confirmationToken?: string;
    readonly expiresAt?: string;
  } = {},
): Record<string, unknown> {
  return {
    state,
    sourceOrigin,
    costCredits: 1,
    ...(options.reason === undefined ? {} : { reason: options.reason }),
    ...(options.refunded === true ? { refunded: true } : {}),
    ...(options.requestId === undefined
      ? {}
      : { requestId: options.requestId }),
    ...(options.confirmationToken === undefined
      ? {}
      : {
          confirmationToken: options.confirmationToken,
          expiresAt: options.expiresAt,
        }),
  };
}

async function readFlag(): Promise<boolean> {
  try {
    return await isCampaignFormatAdditionEnabled();
  } catch {
    return false;
  }
}

export const GET = apiHandler(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const user = await requireApiUser();
    const { id } = await params;
    if (!UUID_V4_REGEX.test(id)) return notFound("Campaign not found");

    const campaign = await getCampaign(id);
    if (!campaign) return notFound("Campaign not found");
    await requireOwnership(campaign.store_id, user.userId);

    const read = await readFormatAdditionByCampaign(
      { storeId: campaign.store_id, campaignId: id },
      { client: supabaseAdmin },
    );
    const durable = durableFrom(read);
    const addition =
      read.kind === "found" ? read.addition : null;
    const formatResolution = resolveCampaignFormat(campaign.input_snapshot);
    const source = await resolveAdditionSource(
      id,
      campaign.store_id,
      user.userId,
      addition?.sourceOrigin ?? null,
    );
    const eligibility = deriveFormatAdditionEligibility({
      campaignStatus: campaign.status,
      formatResolution,
      addition: durable,
      source: source.read,
    });
    const mapped = stateFromEligibility(
      eligibility,
      durable.kind === "refunded",
    );
    const flagEnabled = await readFlag();
    const active =
      mapped.state === "delivered" ||
      mapped.state === "processing" ||
      mapped.state === "unknown";

    // Flag desligada bloqueia somente NOVAS adições/retries; estado ativo segue
    // visível e reconciliável.
    if (!flagEnabled && !active) {
      return NextResponse.json(
        additionDto(
          mapped.state === "refunded" ? "refunded" : "unavailable",
          source.origin,
          {
            reason: "addition_disabled",
            ...(mapped.state === "refunded" ? { refunded: true } : {}),
          },
        ),
      );
    }

    const resumable =
      mapped.state === "processing" || mapped.state === "unknown";
    const actionable =
      mapped.state === "eligible" ||
      mapped.state === "refunded" ||
      resumable;
    if (!actionable) {
      return NextResponse.json(
        additionDto(mapped.state, source.origin, {
          ...(mapped.reason === undefined ? {} : { reason: mapped.reason }),
          ...(mapped.refunded === true ? { refunded: true } : {}),
        }),
      );
    }

    let requestId: string;
    let checksum: string | null;
    let intent: "start" | "retry";

    if (resumable) {
      requestId = addition?.requestId ?? "";
      checksum =
        source.checksum ??
        (requestId.length > 0
          ? await readDurableChecksum(campaign.store_id, id, requestId)
          : null);
      intent = "start";
      if (requestId.length === 0 || checksum === null) {
        return NextResponse.json(
          additionDto(mapped.state, source.origin, {
            reason: "operation_unavailable",
          }),
        );
      }
    } else {
      if (source.checksum === null || source.origin === null) {
        return NextResponse.json(
          additionDto("unavailable", source.origin, {
            reason: "source_unavailable",
          }),
        );
      }
      requestId = randomUUID();
      checksum = source.checksum;
      intent = mapped.state === "refunded" ? "retry" : "start";
    }

    const token = createFormatAdditionConfirmationToken({
      campaignId: id,
      sourceChecksum: checksum,
      requestId,
      intent,
    });
    if (!token.ok) {
      return NextResponse.json(
        additionDto("unavailable", source.origin, {
          reason:
            token.reason === "secret_missing"
              ? "confirmation_unavailable"
              : "invalid_confirmation",
        }),
        { status: 503 },
      );
    }

    return NextResponse.json(
      additionDto(mapped.state, source.origin, {
        ...(mapped.refunded === true ? { refunded: true } : {}),
        requestId,
        confirmationToken: token.token,
        expiresAt: token.payload.expiresAt,
      }),
    );
  },
);

function statusForRun(result: FormatAdditionRunResult): number {
  if (result.ok) {
    return result.kind === "processing" ? 202 : 200;
  }
  if (result.code === "gate_blocked") {
    if (result.reason === "rate_limit_exceeded") return 429;
    if (result.reason === "insufficient_credits") return 402;
    if (
      result.reason === "addition_disabled" ||
      result.reason === "engine_disabled" ||
      result.reason === "legal_blocked" ||
      result.reason === "store_not_ready"
    ) {
      return 403;
    }
    return 409;
  }
  if (result.code === "rpc_failed" || result.code === "durable_context_read_failed") {
    return 503;
  }
  return 409;
}

function runDto(result: FormatAdditionRunResult): Record<string, unknown> {
  if (!result.ok) {
    return { state: "unavailable", reason: result.reason };
  }
  switch (result.kind) {
    case "delivered":
      return { state: "delivered", idempotent: result.idempotent };
    case "processing":
      return {
        state: "processing",
        ...(result.reason === undefined ? {} : { reason: result.reason }),
      };
    case "refunded":
      return { state: "refunded", refunded: true };
    case "unknown":
      return { state: "unknown", reason: result.reason ?? "unknown" };
  }
}

export const POST = apiHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    requireSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await params;
    if (!UUID_V4_REGEX.test(id)) return notFound("Campaign not found");

    const campaign = await getCampaign(id);
    if (!campaign) return notFound("Campaign not found");
    const store = await requireOwnership(campaign.store_id, user.userId);

    let body;
    try {
      body = FORMAT_ADDITION_BODY.parse(await request.json());
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: { code: "invalid_body", message: "Dados inválidos" } },
          { status: 422 },
        );
      }
      return NextResponse.json(
        { error: { code: "invalid_body", message: "Corpo inválido" } },
        { status: 422 },
      );
    }

    const verified = verifyFormatAdditionConfirmationToken(
      body.confirmationToken,
    );
    if (!verified.ok) {
      return NextResponse.json(
        {
          error: {
            code:
              verified.reason === "expired"
                ? "confirmation_expired"
                : "invalid_confirmation",
            message: "Confirmação inválida ou expirada.",
          },
        },
        {
          status: verified.reason === "secret_missing" ? 503 : 403,
        },
      );
    }
    const token = verified.payload;
    if (token.campaignId !== id || token.format !== "9:16") {
      return NextResponse.json(
        { error: { code: "invalid_confirmation", message: "Confirmação inválida." } },
        { status: 403 },
      );
    }

    const byRequest = await readFormatAdditionByIdentity(
      {
        storeId: campaign.store_id,
        campaignId: id,
        requestId: token.requestId,
      },
      { client: supabaseAdmin },
    );
    if (byRequest.kind === "read_failed") {
      return NextResponse.json(
        { error: { code: "operation_unavailable", message: "Adição indisponível." } },
        { status: 503 },
      );
    }

    let engineEnabled = false;
    try {
      engineEnabled = await isProduct9_16TwoStageEnabled();
    } catch {
      engineEnabled = false;
    }

    let decision: Awaited<ReturnType<typeof resolveProductFlowAuthorization>>;
    try {
      decision = await resolveProductFlowAuthorization(
        resolveEligibilityContext(store),
      );
    } catch {
      decision = { allowed: false, code: "read_failure" };
    }

    const deps = createProductionFormatAdditionDeps({
      client: supabaseAdmin,
      authorizeProductFlow: async () =>
        decision.allowed
          ? { allowed: true }
          : {
              allowed: false,
              code: String(decision.code ?? "product_flow_ineligible"),
              reason: String(decision.code ?? "product_flow_ineligible"),
            },
      pilotSpendResolver: async () => {
        try {
          const resolution = await resolvePilotSpendGate({
            store,
            decision,
          });
          if (resolution.kind === "armed") {
            return { kind: "armed", gate: resolution.gate };
          }
          if (resolution.kind === "inactive") return { kind: "inactive" };
          return { kind: "blocked", reason: resolution.reason };
        } catch {
          return { kind: "blocked", reason: "pilot_gate_read_failed" };
        }
      },
    });
    const deadlineAtMs = computeInvocationDeadline(Date.now());
    const authorization = { kind: "owner" as const, userId: user.userId };

    // C6 — replay pelo request ORIGINAL antes da operação ativa.
    if (byRequest.kind === "found") {
      const found = byRequest.addition;
      if (found.state === "delivered") {
        return NextResponse.json({ state: "delivered", idempotent: true });
      }
      if (found.state === "refunded") {
        return NextResponse.json({ state: "refunded", refunded: true });
      }
      if (found.operationId === null) {
        return NextResponse.json(
          { error: { code: "operation_unavailable", message: "Adição indisponível." } },
          { status: 503 },
        );
      }
      // processing/unknown: RETOMA a operação existente, sem nova cobrança.
      // A flag desligada NÃO impede finalizar/retomar operações abertas.
      const result = await continueFormatAddition(
        {
          storeId: campaign.store_id,
          campaignId: id,
          operationId: found.operationId,
          requestId: token.requestId,
          authorization,
          deadlineAtMs,
          allowNewPaidStep: engineEnabled,
          signal: request.signal,
        },
        deps,
      );
      return NextResponse.json(runDto(result), { status: statusForRun(result) });
    }

    const activeRead = await readFormatAdditionByCampaign(
      { storeId: campaign.store_id, campaignId: id },
      { client: supabaseAdmin },
    );
    if (activeRead.kind === "read_failed") {
      return NextResponse.json(
        { error: { code: "operation_unavailable", message: "Adição indisponível." } },
        { status: 503 },
      );
    }
    if (activeRead.kind === "found") {
      if (token.intent === "start") {
        // Token antigo de OUTRO request não pode devolver/assumir a operação atual.
        return NextResponse.json(
          {
            error: {
              code: "operation_exists",
              message: "Já existe uma adição para esta campanha.",
            },
          },
          { status: 409 },
        );
      }
      if (activeRead.addition.state !== "refunded") {
        return NextResponse.json(
          { error: { code: "retry_not_allowed", message: "Nova tentativa não permitida." } },
          { status: 409 },
        );
      }
    }

    if (!(await readFlag())) {
      return NextResponse.json(
        { error: { code: "addition_disabled", message: "Adição indisponível." } },
        { status: 403 },
      );
    }
    if (!engineEnabled) {
      return NextResponse.json(
        { error: { code: "engine_disabled", message: "Motor indisponível." } },
        { status: 503 },
      );
    }

    const source = await resolveAdditionSource(
      id,
      campaign.store_id,
      user.userId,
      activeRead.kind === "found" ? activeRead.addition.sourceOrigin : null,
    );
    const formatResolution = resolveCampaignFormat(campaign.input_snapshot);
    const eligibility = deriveFormatAdditionEligibility({
      campaignStatus: campaign.status,
      formatResolution,
      addition: { kind: "none" },
      source: source.read,
    });
    if (eligibility.kind !== "eligible" || source.checksum === null) {
      return NextResponse.json(
        {
          error: {
            code: "source_not_eligible",
            message: "Fonte incompatível para a adição.",
          },
        },
        { status: 422 },
      );
    }
    if (
      source.checksum.toLowerCase() !== token.sourceChecksum.toLowerCase()
    ) {
      return NextResponse.json(
        {
          error: {
            code: "source_changed",
            message: "A fonte mudou; confirme novamente.",
          },
        },
        { status: 409 },
      );
    }
    const origin = source.origin;
    if (origin === null) {
      return NextResponse.json(
        { error: { code: "source_not_eligible", message: "Fonte incompatível." } },
        { status: 422 },
      );
    }

    const config = await readNineSixteenExpansionConfig({
      client: supabaseAdmin,
    });
    if (config.kind !== "found") {
      return NextResponse.json(
        { error: { code: "configuration_unavailable", message: "Configuração indisponível." } },
        { status: 503 },
      );
    }

    const result = await runFormatAddition(
      {
        storeId: campaign.store_id,
        campaignId: id,
        operationId: randomUUID(),
        requestId: token.requestId,
        sourceOrigin: origin,
        authorization,
        selection: config.selection,
        confirmedSourceChecksumSha256: token.sourceChecksum,
        deadlineAtMs,
        allowNewPaidStep: true,
        signal: request.signal,
      },
      deps,
    );

    return NextResponse.json(runDto(result), { status: statusForRun(result) });
  },
);
