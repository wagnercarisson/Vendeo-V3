// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// Complemento C2 — a prova do download exercita a ROTA REAL
// (`src/app/api/campaign/[id]/download/route.ts`). `supabaseAdmin` é um Proxy
// dinâmico sobre o cliente ISOLADO real (definido em `beforeAll`), de modo que a
// rota/`getCampaign`/`ProductOneToOneArtifactStore`/`AttemptStartClient` falem
// com o Postgres/Storage isolados. Apenas auth/ownership e a flag de aprovação
// são mockados (o resto é código real).
const h = vi.hoisted(() => ({
  admin: {} as Record<string, unknown>,
  requireOwnership: vi.fn(),
  requireApiUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: new Proxy(
    {},
    {
      get: (_target, prop) => {
        const inner = h.admin as Record<string | symbol, unknown>;
        const value = inner[prop];
        return typeof value === "function"
          ? (value as (...args: unknown[]) => unknown).bind(inner)
          : value;
      },
    },
  ),
  createServerClient: vi.fn(),
}));
vi.mock("@/lib/auth/require-user", () => ({
  requireApiUser: h.requireApiUser,
  requireUser: h.requireApiUser,
  UnauthorizedError: class UnauthorizedError extends Error {},
}));
vi.mock("@/lib/auth/store-ownership", () => ({
  requireOwnership: h.requireOwnership,
  getCurrentStore: vi.fn(),
  requireAuthorizedStore: vi.fn(),
}));
vi.mock("@/lib/feature-flags/feature-flag-service", () => ({
  isCampaignApprovalEnabled: vi.fn(async () => false),
  isForceBriefVisionCheckEnabled: vi.fn(async () => false),
  FORCE_BRIEF_VISION_CHECK_KEY: "force_brief_vision_check",
  FeatureFlagService: vi.fn(),
}));

import { StoreNotFoundError } from "@/lib/auth/errors";
import {
  ProductOneToOneArtifactStore,
  artifactStoragePath,
} from "../artifact/artifact-store";
import { decideNewFlowDownload } from "../artifact/download-gate";
import {
  CREDIT_BUCKET,
  closeIsolatedContext,
  createCampaign,
  createIsolatedContext,
  createTestStore,
  deliverCredit,
  jpeg1024DataUrl,
  markArtUploaded,
  pngDataUrl,
  reserveCredit,
  setCredits,
  type IsolatedContext,
} from "./integration-harness";

/**
 * F56.2b1b — Plano 09 / Task 2: download recusado antes de `delivered`, upload
 * REAL no Storage local, F7 (dimensões por BYTES 1024×1024) e C2 (probe TIPADO)
 * + I3 (probe NUNCA assina). Postgres/Storage reais; provider não é chamado.
 */

let ctx: IsolatedContext;
let storeId: string;

/** Envolve o cliente real delegando tudo, mas contando assinaturas (I3). */
function countingSigner(
  real: SupabaseClient,
  counters: { signed: number },
): SupabaseClient {
  return {
    from: real.from.bind(real),
    rpc: real.rpc.bind(real),
    auth: real.auth,
    storage: {
      from: (bucket: string) => {
        const inner = real.storage.from(bucket);
        return {
          upload: inner.upload.bind(inner),
          download: inner.download.bind(inner),
          createSignedUrl: async (path: string, ttl: number) => {
            counters.signed += 1;
            return inner.createSignedUrl(path, ttl);
          },
        };
      },
    },
  } as unknown as SupabaseClient;
}

async function uploadObject(path: string, body: Buffer, contentType: string): Promise<void> {
  const { error } = await ctx.supabase.storage
    .from(CREDIT_BUCKET)
    .upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`fixture_upload_failed:${error.message}`);
}

describe("F56.2b1b — artifact download / Storage real", () => {
  beforeAll(async () => {
    ctx = await createIsolatedContext();
    const store = await createTestStore(ctx.supabase);
    storeId = store.storeId;
    await setCredits(ctx.pg, storeId, 10);
    // A rota REAL fala com o Postgres/Storage ISOLADOS via `supabaseAdmin`.
    h.admin = ctx.supabase as unknown as Record<string, unknown>;
    h.requireApiUser.mockResolvedValue({ userId: "00000000-0000-4000-8000-0000000000aa" });
    h.requireOwnership.mockResolvedValue({ id: storeId });
  }, 60_000);

  afterAll(async () => {
    await closeIsolatedContext(ctx);
  });

  it("F7 — upload real 1024×1024; dimensões DECODIFICADAS dos bytes e recuperadas do metadado", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    const store = new ProductOneToOneArtifactStore(ctx.supabase);

    const ref = await store.storeArtifact({
      storeId,
      campaignId: campaign,
      operationId,
      imageDataUrl: await jpeg1024DataUrl(),
    });
    expect(ref).toMatchObject({ width: 1024, height: 1024, mimeType: "image/jpeg" });
    expect(ref.storagePath).toBe(artifactStoragePath(storeId, campaign, operationId));

    const metadata = await store.getArtifactMetadata(campaign, operationId);
    expect(metadata).toMatchObject({ width: 1024, height: 1024, mimeType: "image/jpeg" });

    // Integridade por CONTEÚDO (bytes decodificados), não por tamanho/path.
    const probe = await store.probeArtifact({ storeId, campaignId: campaign, operationId });
    expect(probe.kind).toBe("integral");
    if (probe.kind === "integral") {
      expect(probe.width).toBe(1024);
      expect(probe.height).toBe(1024);
      expect(probe.mimeType).toBe("image/jpeg");
    }
  }, 60_000);

  it("download recusado com objeto presente + `art_uploaded`; liberado com `delivered`", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    const store = new ProductOneToOneArtifactStore(ctx.supabase);
    await store.storeArtifact({
      storeId,
      campaignId: campaign,
      operationId,
      imageDataUrl: await jpeg1024DataUrl(),
    });
    const probe = await store.probeArtifact({ storeId, campaignId: campaign, operationId });

    const blocked = decideNewFlowDownload({ operationStatus: "art_uploaded", artifactProbe: probe });
    expect(blocked).toMatchObject({ allowed: false, reason: "operation_not_delivered" });

    const allowed = decideNewFlowDownload({ operationStatus: "delivered", artifactProbe: probe });
    expect(allowed).toMatchObject({ allowed: true, reason: "delivered_with_integral_artifact" });

    // I2 — `unknown` histórico NÃO governa operação terminal.
    const terminalWins = decideNewFlowDownload({
      operationStatus: "delivered",
      artifactProbe: probe,
      unknown: true,
    });
    expect(terminalWins.allowed).toBe(true);
  }, 60_000);

  it("I3 — probe devolve `integral` SEM assinar URL (zero `createSignedUrl` até `delivered`)", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    await new ProductOneToOneArtifactStore(ctx.supabase).storeArtifact({
      storeId,
      campaignId: campaign,
      operationId,
      imageDataUrl: await jpeg1024DataUrl(),
    });

    const counters = { signed: 0 };
    const store = new ProductOneToOneArtifactStore(countingSigner(ctx.supabase, counters));
    const probe = await store.probeArtifact({ storeId, campaignId: campaign, operationId });
    expect(probe.kind).toBe("integral");
    expect(counters.signed).toBe(0);

    // A assinatura é SEPARADA e só ocorre quando solicitada.
    if (probe.kind === "integral") {
      const url = await store.getSignedArtifactUrl(probe.storagePath);
      expect(url).toContain("token=");
      expect(counters.signed).toBe(1);
    }
  }, 60_000);

  it("C2 — upload-ok + metadata-ausente recupera a arte pelo caminho determinístico (sem regenerar)", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    const path = artifactStoragePath(storeId, campaign, operationId);
    const jpeg = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: { r: 1, g: 2, b: 3 } } })
      .jpeg()
      .toBuffer();
    // Upload direto (sem linha de metadados) — simula upload-ok + metadata-fail.
    await uploadObject(path, jpeg, "image/jpeg");

    const store = new ProductOneToOneArtifactStore(ctx.supabase);
    expect(await store.getArtifactMetadata(campaign, operationId)).toBeNull();
    const probe = await store.probeArtifact({ storeId, campaignId: campaign, operationId });
    expect(probe.kind).toBe("integral");
  }, 60_000);

  it("C2 — `absent` apenas em ausência CONFIRMADA; `invalid` para objeto não íntegro", async () => {
    const store = new ProductOneToOneArtifactStore(ctx.supabase);

    // Ausente: caminho determinístico sem objeto.
    const campaignAbsent = await createCampaign(ctx.supabase, storeId);
    const opAbsent = randomUUID();
    const absent = await store.probeArtifact({
      storeId,
      campaignId: campaignAbsent,
      operationId: opAbsent,
    });
    expect(absent.kind).toBe("absent");

    // Inválido: PNG real (não-JPEG) servido no path `.jpg`.
    const campaignPng = await createCampaign(ctx.supabase, storeId);
    const opPng = randomUUID();
    const pngPath = artifactStoragePath(storeId, campaignPng, opPng);
    const png = Buffer.from((await pngDataUrl(1024, 1024)).split(",")[1], "base64");
    await uploadObject(pngPath, png, "image/png");
    const invalidFormat = await store.probeArtifact({
      storeId,
      campaignId: campaignPng,
      operationId: opPng,
    });
    expect(invalidFormat.kind).toBe("invalid");

    // Inválido: JPEG TRUNCADO no path `.jpg` (header reporta 1024×1024).
    const campaignTrunc = await createCampaign(ctx.supabase, storeId);
    const opTrunc = randomUUID();
    const truncPath = artifactStoragePath(storeId, campaignTrunc, opTrunc);
    const fullJpeg = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: { r: 9, g: 9, b: 9 } } })
      .jpeg({ quality: 95 })
      .toBuffer();
    await uploadObject(truncPath, fullJpeg.subarray(0, Math.floor(fullJpeg.length / 2)), "image/jpeg");
    const invalidTrunc = await store.probeArtifact({
      storeId,
      campaignId: campaignTrunc,
      operationId: opTrunc,
    });
    expect(invalidTrunc.kind).toBe("invalid");
  }, 90_000);

  it("C2 — erro/indisponibilidade do Storage NUNCA colapsa com `absent` (indeterminate)", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();

    const throwingClient = {
      from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
      }),
      storage: {
        from: () => ({
          download: async () => {
            throw new Error("storage_unavailable");
          },
        }),
      },
    } as unknown as SupabaseClient;

    const store = new ProductOneToOneArtifactStore(throwingClient);
    const probe = await store.probeArtifact({ storeId, campaignId: campaign, operationId });
    expect(probe.kind).toBe("indeterminate");
  });

  it("C2 — a ROTA REAL `/api/campaign/[id]/download` só libera com `delivered`+`integral` (403/sem assinatura vs 302/uma assinatura) e aplica OWNERSHIP", async () => {
    const campaignId = randomUUID();
    const operationId = randomUUID();

    // Campanha do NOVO fluxo (marcador PERSISTIDO `frozenContentReferences` presente).
    const { error: insertError } = await ctx.supabase.from("campaigns").insert({
      id: campaignId,
      store_id: storeId,
      status: "ready",
      product_name: "Produto rota",
      storage_path: `${storeId}/${campaignId}.jpg`,
      input_snapshot: { frozenContentReferences: [] },
    });
    expect(insertError).toBeNull();

    // Operação PERSISTIDA (`art_uploaded`) + arte ÍNTEGRA no Storage real.
    await reserveCredit(ctx.pg, storeId, campaignId, operationId);
    await markArtUploaded(ctx.pg, campaignId, operationId);
    await new ProductOneToOneArtifactStore(ctx.supabase).storeArtifact({
      storeId,
      campaignId,
      operationId,
      imageDataUrl: await jpeg1024DataUrl(),
    });

    // Contador de ASSINATURA no Storage subjacente usado pela rota.
    const counters = { signed: 0 };
    h.admin = countingSigner(ctx.supabase, counters) as unknown as Record<string, unknown>;
    h.requireOwnership.mockResolvedValue({ id: storeId });

    const { GET } = await import("@/app/api/campaign/[id]/download/route");
    const call = () =>
      GET(new NextRequest(`http://localhost/api/campaign/${campaignId}/download`), {
        params: Promise.resolve({ id: campaignId }),
      });

    // ANTES de `delivered` (objeto presente, operação `art_uploaded`) ⇒ 403 + ZERO assinaturas.
    const blocked = await call();
    expect(blocked.status).toBe(403);
    expect(counters.signed).toBe(0);

    // APÓS `delivered` + arte ÍNTEGRA ⇒ 302 + EXATAMENTE UMA URL assinada.
    await deliverCredit(ctx.pg, campaignId, operationId);
    const allowed = await call();
    expect(allowed.status).toBe(302);
    expect(String(allowed.headers.get("location"))).toContain("token=");
    expect(counters.signed).toBe(1);

    // OWNERSHIP: `requireOwnership` recusando ⇒ 404 (nunca 302; nenhuma nova assinatura).
    h.requireOwnership.mockRejectedValueOnce(new StoreNotFoundError("not owner"));
    const foreign = await call();
    expect(foreign.status).toBe(404);
    expect(counters.signed).toBe(1);
  }, 90_000);
});
