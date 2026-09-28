// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

// `LabTelemetrySink` importa a cadeia de custo produtiva → `@/lib/supabase/server`,
// que exige env na importação. Nenhum teste da bancada toca a rede: só preenchemos
// o env mínimo de importação e apontamos para um host **local**.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
});

import type { AiCapability } from "@/lib/ai/model-resolver";
import type { AiInvoker } from "@/lib/ai/gateway";
import type {
  AiInvocationRequest,
  AiInvocationResult,
  AiTelemetryContext,
} from "@/lib/ai/types";
import { LabTelemetrySink } from "@/lib/ai/lab-telemetry-sink";
import { resolveBenchPreset } from "@/lib/lab/bench/domain/preset-registry";
import { listBenchTestStores } from "@/lib/lab/bench/domain/store-manifest";
import type { BenchManifestStore } from "@/lib/lab/bench/domain/store-manifest";
import { loadBenchBranding, toBenchBrandingSnapshot } from "@/lib/lab/bench/domain/branding-service";
import {
  BENCH_BRANDING_BUCKETS,
  createBenchBrandingSignedUrl,
  createBenchBrandingSignedUrlForStore,
} from "@/lib/lab/bench/persistence/bench-branding-signer";
import {
  confirmBenchRun,
  getBenchRun,
  reserveBenchRun,
  setBenchRunInput,
} from "@/lib/lab/bench/persistence/bench-run-service";
import {
  createBenchArtifactSignedUrl,
  listBenchArtifacts,
  persistBenchArtifact,
} from "@/lib/lab/bench/persistence/bench-artifact-service";
import { executeBenchRun } from "@/lib/lab/bench/execution/bench-execution-service";
import {
  ALLOWED_ENTRY_RE,
  FORBIDDEN_TARGETS,
  createRecordingClient,
  forbiddenProductionAccess,
  type Row,
} from "@/lib/lab/__tests__/recording-supabase-client";

/**
 * Contrato transversal nº 1 (F48.2.2, task 8.2) — **fronteira da bancada**.
 *
 * Executa um fluxo **completo** da bancada (seleção de loja → branding → upload em
 * `draft` → reserva/confirmação → execução com fakes → persistência → leitura)
 * contra o **client gravador** compartilhado (`createRecordingClient`) e prova que
 * ele toca **apenas** tabelas `lab_bench_*`, as tabelas de loja/branding em
 * **leitura**, os buckets de branding da allowlist **somente em leitura**
 * (`createSignedUrl`) e o bucket `lab-artifacts`. Qualquer acesso a `campaigns`,
 * `campaign_art_versions`, `generation_events`, `ai_model_selection`,
 * `admin_audit_log`, `credit_*` ou `campaign-images` faz o teste falhar.
 *
 * Inclui o **POSITIVO** do signer de branding (`createBenchBrandingSignedUrl` em
 * bucket da allowlist sucede e é registrado no `accessLog`) e os **negativos**
 * (bucket produtivo, path traversal e loja fora do manifesto — recusados sem
 * chamada de rede real).
 *
 * Nenhuma chamada de rede real a providers: gateway fake + client em memória.
 */

// ─── Identificadores ─────────────────────────────────────────────────────────

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const STORE_OUTSIDE = "99999999-9999-4999-8999-999999999999";
const OPERATION_ID = "55555555-5555-4555-8555-555555555555";
const ACTOR_ID = "66666666-6666-4666-8666-666666666666";

const MANIFEST: BenchManifestStore[] = [{ id: STORE_ID, label: "Loja de teste A" }];

const SAVED_ENV: Record<string, string | undefined> = {};

beforeAll(async () => {
  SAVED_ENV.VENDEO_LAB_ENABLED = process.env.VENDEO_LAB_ENABLED;
  SAVED_ENV.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.VENDEO_LAB_ENABLED = "true";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";

  pngBuffer = await sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 12, g: 180, b: 40 } },
  })
    .png()
    .toBuffer();
});

afterAll(() => {
  if (SAVED_ENV.VENDEO_LAB_ENABLED === undefined) delete process.env.VENDEO_LAB_ENABLED;
  else process.env.VENDEO_LAB_ENABLED = SAVED_ENV.VENDEO_LAB_ENABLED;
  if (SAVED_ENV.NEXT_PUBLIC_SUPABASE_URL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = SAVED_ENV.NEXT_PUBLIC_SUPABASE_URL;
});

let pngBuffer: Buffer;

// ─── Seed do Supabase local (somente leitura) ────────────────────────────────

function seed(): Record<string, Row[]> {
  return {
    stores: [
      {
        id: STORE_ID,
        name: "Loja de teste A",
        segment: "variedades",
        subsegment: "doces",
        tone_of_voice: "amigavel",
        positioning: "bairro",
        short_description: "loja de bairro",
        slogan: "aqui rende mais",
      },
    ],
    store_brand_profiles: [
      {
        store_id: STORE_ID,
        source: "synced",
        status: "synced",
        typography_direction: "serif elegante",
        safe_color_tokens: { primary: "#22C55E" },
        brand_colors_chosen: ["#22C55E", null],
        logo_colors_detected: ["#ffffff"],
        visual_style: "clean",
        visual_tone: "caloroso",
        brand_personality: "proxima",
        campaign_guidelines: "sem exageros",
        campaign_brief: "oferta clara",
      },
    ],
    store_brand_assets: [
      {
        id: "asset-1",
        store_id: STORE_ID,
        asset_type: "logo",
        variant_type: "primary",
        storage_path: "loja/logo.png",
        mime_type: "image/png",
        width: 512,
        height: 512,
        size_bytes: 12345,
        checksum: "checksum-logo",
        status: "active",
      },
    ],
    store_visual_signatures: [
      {
        id: "sig-1",
        store_id: STORE_ID,
        storage_path: "loja/assinatura.png",
        asset_url: "https://example.invalid/sig.png",
        type: "signature",
        status: "active",
      },
    ],
    lab_bench_runs: [],
    lab_bench_artifacts: [],
  };
}

// ─── Gateway fake (nenhuma rede real) ────────────────────────────────────────

class FakeGateway implements AiInvoker {
  readonly invocations: Array<{ capability: AiCapability; request: AiInvocationRequest }> = [];

  async invoke(
    capability: AiCapability,
    request: AiInvocationRequest,
    telemetry: AiTelemetryContext,
  ): Promise<AiInvocationResult> {
    this.invocations.push({ capability, request });
    // Espelha o gateway real: exatamente um envelope por invocação (read-only).
    await telemetry.sink.emit({
      capability,
      protocol: "images",
      status: "success",
      provider: "openai",
      model: "gpt-image-2",
      durationMs: 1,
    });
    return {
      imageBase64: pngBuffer.toString("base64"),
      mimeType: "image/png",
      model: "gpt-image-2",
    };
  }

  async hasFallback(): Promise<boolean> {
    return false;
  }
}

let gateway: FakeGateway;
let sink: LabTelemetrySink;

beforeEach(() => {
  gateway = new FakeGateway();
  sink = new LabTelemetrySink();
});

// ─── Fluxo completo: só alvos da allowlist ───────────────────────────────────

describe("fronteira da bancada — fluxo completo toca somente alvos permitidos", () => {
  it("seleção → branding → upload em draft → confirmação → execução → persistência → leitura", async () => {
    const recording = createRecordingClient(seed());
    const client = recording.client;
    const preset = resolveBenchPreset("gpt-image-2-low");

    // 1. Seleção de loja (somente leitura de `stores`).
    const stores = await listBenchTestStores({ client, manifest: MANIFEST });
    expect(stores.map((store) => store.id)).toEqual([STORE_ID]);

    // 2. Branding completo (inclui a direção tipográfica) com URL assinada restrita.
    const branding = await loadBenchBranding({ client, storeId: STORE_ID, manifest: MANIFEST });
    expect(branding.typographyDirection).toBe("serif elegante");
    expect(branding.logoUrl).toBe("signed:loja/logo.png");
    expect(branding.signatureUrl).toBe("signed:loja/assinatura.png");
    const brandingSnapshot = toBenchBrandingSnapshot(branding);
    expect(brandingSnapshot.typographyDirection).toBe("serif elegante");

    // 3. Upload (POST /inputs, serviço): reserva em `draft` + persistência da entrada.
    const reserved = await reserveBenchRun({
      client,
      operationId: OPERATION_ID,
      createdBy: ACTOR_ID,
    });
    expect(reserved.idempotent).toBe(false);
    const runId = reserved.runId;
    await persistBenchArtifact({
      client,
      runId,
      kind: "input",
      index: 0,
      buffer: pngBuffer,
      mimeType: "image/png",
    });

    // 4. Fixação da configuração/prompt/referências (só em `draft`).
    await setBenchRunInput({
      client,
      runId,
      campaignSnapshot: { productName: "Produto Teste", intentResolved: "offer" },
      brandingSnapshot,
      config: { pipeline: "manual-direto", formato: "1:1" },
      promptSent: "prompt manual da bancada",
      references: [`bench/${runId}/inputs/0.png`],
    });

    // 5. Confirmação compare-and-set `draft → pending` (adquire o slot global).
    await confirmBenchRun({ client, runId });

    // 6. Execução com fakes (exatamente uma invocação, sem rede real).
    const telemetry: AiTelemetryContext = {
      operationRunId: runId,
      operationRunType: "campaign_delivery",
      traceId: "trace-bancada",
      storeId: STORE_ID,
      sink,
    };
    const outcome = await executeBenchRun({
      client,
      gateway,
      telemetrySink: sink,
      run: { id: runId },
      preset,
      request: { prompt: "prompt manual da bancada", productImagesDataUrls: ["data:image/png;base64,QUFB"] },
      telemetry,
    });
    expect(outcome.status).toBe("succeeded");
    expect(gateway.invocations).toHaveLength(1);
    expect(gateway.invocations[0].capability).toBe("campaign_image");
    expect(sink.entries).toHaveLength(1);

    // 7. Leitura (dispara a reconciliação preguiçosa) + artefatos por URL assinada.
    const run = await getBenchRun({ client, runId });
    expect(run?.status).toBe("succeeded");
    const artifacts = await listBenchArtifacts({ client, runId });
    expect(artifacts).toHaveLength(2);
    const output = artifacts.find((artifact) => artifact.kind === "output");
    expect(output).toBeDefined();
    const signedUrl = await createBenchArtifactSignedUrl({
      client,
      storagePath: output!.storagePath,
    });
    expect(signedUrl).toContain("signed:");

    // ─── Fronteira: nada fora da allowlist foi acessado ──────────────────────
    expect(recording.accessLog.filter((entry) => !ALLOWED_ENTRY_RE.test(entry))).toEqual([]);
    for (const target of FORBIDDEN_TARGETS) {
      expect(
        recording.accessLog.filter((entry) => entry.includes(target)),
        `nenhum acesso a ${target}`,
      ).toEqual([]);
    }
    // Nenhum crédito, nenhuma telemetria produtiva, nenhuma tabela operacional.
    expect(recording.accessLog.filter((entry) => /credit/i.test(entry))).toEqual([]);
    expect(
      recording.state.insertCalls.filter((call) =>
        ["campaigns", "campaign_art_versions", "generation_events", "ai_model_selection", "admin_audit_log", "credit_transactions"].includes(
          call.table,
        ),
      ),
    ).toEqual([]);
    // O upload/saída foram para o bucket próprio da bancada.
    expect(recording.accessLog).toContain("storage.from:lab-artifacts");
    expect(
      recording.accessLog.some((entry) => entry.startsWith("storage.upload:lab-artifacts:bench/")),
    ).toBe(true);
  });
});

// ─── Signer de branding — positivo ───────────────────────────────────────────

describe("signer de branding — positivo em bucket da allowlist", () => {
  it("assina um asset em `store-logos` e registra o acesso", async () => {
    const recording = createRecordingClient(seed());

    const url = await createBenchBrandingSignedUrl({
      client: recording.client,
      bucket: "store-logos",
      path: "loja/logo.png",
    });

    expect(url).toBe("signed:loja/logo.png");
    expect(recording.accessLog).toContain("storage.createSignedUrl:store-logos:loja/logo.png");
    expect(recording.accessLog.filter((entry) => !ALLOWED_ENTRY_RE.test(entry))).toEqual([]);
    expect([...BENCH_BRANDING_BUCKETS]).toEqual([
      "store-logos",
      "store-brand-assets",
      "visual-signatures",
    ]);
  });

  it("assina para uma loja do manifesto (escopado à loja)", async () => {
    const recording = createRecordingClient(seed());

    const url = await createBenchBrandingSignedUrlForStore({
      client: recording.client,
      storeId: STORE_ID,
      bucket: "store-brand-assets",
      path: "loja/logo.png",
      manifest: MANIFEST,
    });

    expect(url).toBe("signed:loja/logo.png");
    expect(recording.accessLog.filter((entry) => !ALLOWED_ENTRY_RE.test(entry))).toEqual([]);
  });
});

// ─── Signer de branding — negativos (sem rede real) ──────────────────────────

describe("signer de branding — negativos recusam sem tocar o storage", () => {
  it("recusa bucket produtivo (campaign-images) sem assinar nada", async () => {
    const recording = createRecordingClient(seed());

    await expect(
      createBenchBrandingSignedUrl({
        client: recording.client,
        bucket: "campaign-images",
        path: "store-1/campaign.jpg",
      }),
    ).rejects.toThrowError(/bench_branding_bucket_not_allowed/);

    expect(recording.accessLog.filter((entry) => entry.includes("campaign-images"))).toEqual([]);
    expect(recording.accessLog.filter((entry) => entry.startsWith("storage."))).toEqual([]);
  });

  it("recusa bucket fora da allowlist (lab-artifacts) sem assinar nada", async () => {
    const recording = createRecordingClient(seed());

    await expect(
      createBenchBrandingSignedUrl({
        client: recording.client,
        bucket: "lab-artifacts",
        path: "bench/run/output.png",
      }),
    ).rejects.toThrowError(/bench_branding_bucket_not_allowed/);

    expect(recording.accessLog.filter((entry) => entry.startsWith("storage."))).toEqual([]);
  });

  it.each(["../segredo.png", "http://evil/x.png", "a\\b.png", "", "a//b.png"])(
    "recusa o path traversal %j",
    async (storagePath) => {
      const recording = createRecordingClient(seed());

      await expect(
        createBenchBrandingSignedUrl({
          client: recording.client,
          bucket: "store-brand-assets",
          path: storagePath,
        }),
      ).rejects.toThrowError(/bench_branding_path_invalid/);

      expect(recording.accessLog.filter((entry) => entry.startsWith("storage."))).toEqual([]);
    },
  );

  it("recusa loja fora do manifesto sem assinar e sem ler (nenhuma consulta remota)", async () => {
    const recording = createRecordingClient(seed());

    await expect(
      createBenchBrandingSignedUrlForStore({
        client: recording.client,
        storeId: STORE_OUTSIDE,
        bucket: "store-brand-assets",
        path: "loja/logo.png",
        manifest: MANIFEST,
      }),
    ).rejects.toThrowError(/store_not_in_manifest/);

    expect(recording.accessLog).toEqual([]);
  });
});

// ─── Detector: alvos produtivos fazem o teste falhar ─────────────────────────

describe("detector de fronteira — alvos produtivos falham", () => {
  it("reusa `forbiddenProductionAccess` do isolamento", () => {
    expect(forbiddenProductionAccess("campaigns").message).toBe(
      "forbidden_production_access:campaigns",
    );
  });

  it("tabelas produtivas e bucket produtivo fazem o detector lançar", () => {
    const loose = createRecordingClient().client as unknown as {
      from: (table: string) => unknown;
      storage: { from: (bucket: string) => unknown };
    };

    for (const table of [
      "campaigns",
      "campaign_art_versions",
      "generation_events",
      "ai_model_selection",
      "admin_audit_log",
      "credit_transactions",
      "credit_balances",
    ]) {
      expect(() => loose.from(table), `tabela produtiva ${table}`).toThrow(
        new RegExp(`forbidden_production_access:${table}`),
      );
    }

    expect(() => loose.storage.from("campaign-images")).toThrow(
      /forbidden_production_access:storage:campaign-images/,
    );
  });

  it("tabelas de loja/branding são somente leitura (escrita lança)", () => {
    const loose = createRecordingClient().client as unknown as {
      from: (table: string) => { insert: (payload: unknown) => unknown };
    };

    for (const table of [
      "stores",
      "store_brand_profiles",
      "store_brand_assets",
      "store_visual_signatures",
    ]) {
      expect(() => loose.from(table).insert({}), `insert ${table}`).toThrow(
        new RegExp(`forbidden_production_access:${table}:insert`),
      );
    }
  });

  it("buckets de branding só permitem `createSignedUrl` (upload/remove/list lançam)", () => {
    const loose = createRecordingClient().client as unknown as {
      storage: {
        from: (bucket: string) => {
          upload: (path: string, body: unknown) => unknown;
          remove: (paths: string[]) => unknown;
        };
      };
    };

    for (const bucket of ["store-logos", "store-brand-assets", "visual-signatures"]) {
      expect(() => loose.storage.from(bucket).upload("asset.png", {})).toThrow(
        new RegExp(`forbidden_production_access:storage:${bucket}:upload`),
      );
      expect(() => loose.storage.from(bucket).remove(["asset.png"])).toThrow(
        new RegExp(`forbidden_production_access:storage:${bucket}:remove`),
      );
    }
  });
});
