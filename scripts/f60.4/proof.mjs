/**
 * F60.4 / 60.4-05 — harness da prova real autorizada da base quadrada.
 *
 * Uso (a partir da raiz do repositório):
 *   node --env-file=.env.local --import ./scripts/f60.4/server-only-resolve.mjs \
 *     --import tsx scripts/f60.4/proof.mjs --dry-run
 *
 *   F60_4_HOMOLOG_AUTHORIZED=1 F60_4_AUTHORIZED=<token> \
 *   F60_4_MAX_CALLS=1 F60_4_AUTHORIZED_BUDGET_USD=0.10 \
 *   node --env-file=.env.local --import ./scripts/f60.4/server-only-resolve.mjs \
 *     --import tsx scripts/f60.4/proof.mjs --apply
 *
 * O modo `--dry-run` é 100% read-only. O modo `--apply` exige autorização
 * explícita, manifesto com `authorization.decision === "approved"`, orçamento
 * >= estimativa, exatamente 1 chamada de imagem e no máximo 1 copy. Em qualquer
 * falha, preserva a evidência e NUNCA repete.
 */
import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const ROOT = process.cwd();
const PHASE_DIR = path.join(
  ROOT,
  ".planning",
  "phases",
  "60.4-f60-4-composicao-e-persistencia-da-base-quadrada",
);
const MANIFEST_PATH = path.join(PHASE_DIR, "60.4-05-PROOF-MANIFEST.json");
const REPORT_PATH = path.join(PHASE_DIR, "60.4-05-PROOF-REPORT.md");
const EVIDENCE_DIR = path.join(PHASE_DIR, "evidence");
const INTENT_DIR = path.join(ROOT, "scripts", "f60.4", "evidence");
const BUCKET_ARTIFACTS = "campaign-internal-artifacts";
const BUCKET_INPUTS = "campaign-images";
const ROLE = "square_original";
const AUTHORIZATION = Object.freeze({ kind: "system" });

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const APPLY = args.has("--apply");
if (DRY_RUN === APPLY) {
  console.error("use exatamente um modo: --dry-run ou --apply");
  process.exit(2);
}

function fail(message) {
  console.error(`[f60.4] ${message}`);
  process.exit(2);
}

function readManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) fail("manifesto ausente");
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, filePath);
}

function writeTextAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, value, "utf8");
  fs.renameSync(tmp, filePath);
}

function brl(cents) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function check(items, id, label, ok, detail, options = {}) {
  items.push({
    id,
    label,
    status: ok ? "PASS" : "FAIL",
    detail,
    critical: options.critical !== false,
  });
  return ok;
}

function info(items, id, label, detail) {
  items.push({ id, label, status: "INFO", detail, critical: false });
}

function makeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    fail("NEXT_PUBLIC_SUPABASE_URL inválida");
  }
  if (parsed.hostname !== "127.0.0.1" || parsed.port !== "57781") {
    fail(`host não é o homolog autorizado: ${parsed.hostname}:${parsed.port}`);
  }
  if (key.length === 0) fail("SUPABASE_SERVICE_ROLE_KEY ausente");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function readCampaign(client, campaignId) {
  const { data, error } = await client
    .from("campaigns")
    .select(
      "id, store_id, product_name, status, storage_path, operation_run_id, input_snapshot, identity_snapshot, updated_at",
    )
    .eq("id", campaignId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function readImageInfos(client, images) {
  const result = [];
  for (const image of images) {
    const { data, error } = await client.storage
      .from(BUCKET_INPUTS)
      .info(image.storagePath);
    result.push({
      path: image.storagePath,
      role: image.role,
      mimeType: image.mimeType,
      exists: !error && data !== null,
      byteSize: error ? null : data?.size ?? null,
      contentType: error ? null : data?.contentType ?? null,
      lastModified: error ? null : data?.lastModified ?? null,
    });
  }
  return result;
}

async function downloadImageDataUrl(client, image) {
  const { data, error } = await client.storage
    .from(BUCKET_INPUTS)
    .download(image.storagePath);
  if (error || data === null) {
    throw new Error(`image_download_failed:${image.storagePath}`);
  }
  const buffer = Buffer.from(await data.arrayBuffer());
  const mime = image.mimeType || "image/jpeg";
  return {
    dataUrl: `data:${mime};base64,${buffer.toString("base64")}`,
    byteSize: buffer.byteLength,
  };
}

function homologSignaturePath(url) {
  try {
    const parsed = new URL(url);
    const markers = [
      "/storage/v1/object/sign/visual-signatures/",
      "/storage/v1/object/public/visual-signatures/",
    ];
    for (const marker of markers) {
      const index = parsed.pathname.indexOf(marker);
      if (index >= 0) {
        return decodeURIComponent(parsed.pathname.slice(index + marker.length));
      }
    }
  } catch {
    // URL inválida: sem leitura.
  }
  return null;
}

async function fetchIdentityDataUrl(client, url) {
  if (typeof url !== "string" || url.length === 0) return null;

  // Nunca consultar host remoto/produção a partir do snapshot. Se a URL for
  // assinada de outro projeto, procura o MESMO objeto no bucket do homolog.
  let parsed = null;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.hostname === "127.0.0.1" && parsed.port === "57781") {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const type = response.headers.get("content-type") ?? "";
      if (!type.startsWith("image/")) return null;
      const buffer = Buffer.from(await response.arrayBuffer());
      const mime = type.split(";")[0];
      return {
        dataUrl: `data:${mime};base64,${buffer.toString("base64")}`,
        mimeType: mime,
        byteSize: buffer.byteLength,
        source: "homolog-url",
      };
    } catch {
      return null;
    }
  }

  const homologPath = homologSignaturePath(url);
  if (homologPath === null) return null;
  try {
    const { data, error } = await client.storage
      .from("visual-signatures")
      .download(homologPath);
    if (error || data === null) return null;
    const buffer = Buffer.from(await data.arrayBuffer());
    const mime = data.type || "image/png";
    return {
      dataUrl: `data:${mime};base64,${buffer.toString("base64")}`,
      mimeType: mime,
      byteSize: buffer.byteLength,
      source: "homolog-bucket",
    };
  } catch {
    return null;
  }
}

async function preflight(client, manifest) {
  const items = [];
  const source = manifest.source;
  const campaignId = source.campaignId;
  const storeId = source.storeId;

  check(
    items,
    "environment",
    "Homolog existente",
    process.env.NEXT_PUBLIC_SUPABASE_URL === "http://127.0.0.1:57781",
    "API 127.0.0.1:57781; DB 127.0.0.1:57782/postgres; produção não consultada",
  );

  check(
    items,
    "credential_product",
    "Credencial de produto",
    typeof process.env.OPENAI_API_KEY === "string" &&
      process.env.OPENAI_API_KEY.length > 0,
    "OPENAI_API_KEY presente; OPENAI_BENCH_API_KEY não é usada silenciosamente",
  );
  check(
    items,
    "credential_supabase",
    "Credenciais Supabase",
    typeof process.env.SUPABASE_SERVICE_ROLE_KEY === "string" &&
      process.env.SUPABASE_SERVICE_ROLE_KEY.length > 0 &&
      typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string" &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0,
    "service role e anon presentes",
  );

  try {
    const module = await import(
      "../../src/lib/campaign/square-base/run-square-base.ts"
    );
    check(
      items,
      "module_import",
      "Módulo importável",
      typeof module.runSquareBase === "function",
      "runSquareBase importado sem executar",
    );
  } catch (error) {
    check(
      items,
      "module_import",
      "Módulo importável",
      false,
      error instanceof Error ? error.message : String(error),
    );
  }

  const campaign = await readCampaign(client, campaignId);
  check(
    items,
    "campaign",
    "Campanha fonte",
    campaign !== null &&
      campaign.store_id === storeId &&
      campaign.status === "ready" &&
      campaign.storage_path !== null,
    campaign === null
      ? "campanha não encontrada"
      : `status=${campaign.status}; product=${campaign.product_name}; storagePath presente`,
  );
  if (campaign === null) {
    return { items, ready: false, campaign: null, sourceData: null };
  }

  const { data: store, error: storeError } = await client
    .from("stores")
    .select("id, name, user_id")
    .eq("id", storeId)
    .maybeSingle();
  check(
    items,
    "store_link",
    "Vínculo loja↔campanha",
    !storeError && store !== null,
    storeError ? storeError.message : `store=${store?.name ?? "-"}`,
  );

  const snapshots = await client
    .from("image_generation_config_snapshots")
    .select("id")
    .eq("campaign_id", campaignId);
  const bindings = await client
    .from("product_1_1_snapshot_content_binding")
    .select("snapshot_original_id")
    .eq("campaign_id", campaignId);
  const evidences = await client
    .from("product_1_1_snapshot_frozen_evidence")
    .select("id")
    .eq("campaign_id", campaignId);
  const artifacts = await client
    .from("campaign_composition_artifacts")
    .select("id, operation_id")
    .eq("campaign_id", campaignId)
    .eq("role", ROLE);

  check(
    items,
    "frozen_absent",
    "Estado congelado ausente",
    !snapshots.error &&
      !bindings.error &&
      !evidences.error &&
      (snapshots.data ?? []).length === 0 &&
      (bindings.data ?? []).length === 0 &&
      (evidences.data ?? []).length === 0,
    `snapshots=${snapshots.data?.length ?? "?"}; bindings=${bindings.data?.length ?? "?"}; evidences=${evidences.data?.length ?? "?"}`,
  );
  check(
    items,
    "square_original_absent",
    "square_original ausente",
    !artifacts.error && (artifacts.data ?? []).length === 0,
    artifacts.error
      ? artifacts.error.message
      : `linhas=${artifacts.data?.length ?? "?"}`,
  );

  const { data: config, error: configError } = await client
    .from("image_model_pair_config")
    .select(
      "scope, primary_model, primary_quality, fallback_model, fallback_quality, config_version_id, updated_by",
    )
    .eq("scope", "new_flow")
    .maybeSingle();
  check(
    items,
    "config",
    "Configuração ativa",
    !configError &&
      config !== null &&
      config.primary_model === manifest.target.model &&
      config.primary_quality === manifest.target.quality &&
      config.fallback_model === manifest.target.fallbackModel &&
      config.fallback_quality === manifest.target.fallbackQuality,
    configError
      ? configError.message
      : `${config?.primary_model}/${config?.primary_quality}; fallback ${config?.fallback_model}/${config?.fallback_quality}`,
  );

  const { data: pricing, error: pricingError } = await client
    .from("ai_model_pricing")
    .select(
      "id, provider, model, quality, image_unit_usd, image_input_token_usd_per_1m, image_cached_input_token_usd_per_1m, effective_until",
    )
    .in("model", [manifest.target.model, manifest.target.fallbackModel])
    .is("effective_until", null);
  const primaryPricing =
    (pricing ?? []).find(
      (row) =>
        row.model === manifest.target.model &&
        row.quality === manifest.target.quality,
    ) ?? null;
  const fallbackPricing =
    (pricing ?? []).find(
      (row) =>
        row.model === manifest.target.fallbackModel &&
        row.quality === manifest.target.fallbackQuality,
    ) ?? null;
  check(
    items,
    "pricing",
    "Pricing completo",
    !pricingError &&
      primaryPricing?.image_unit_usd !== null &&
      primaryPricing?.image_unit_usd !== undefined &&
      fallbackPricing?.image_unit_usd !== null &&
      fallbackPricing?.image_unit_usd !== undefined,
    pricingError
      ? pricingError.message
      : `primary=${primaryPricing?.image_unit_usd ?? "missing"}; fallback=${fallbackPricing?.image_unit_usd ?? "missing"}`,
  );
  check(
    items,
    "budget",
    "Orçamento autorizado",
    Number.isFinite(Number(manifest.authorization.authorizedBudgetUsd)) &&
      Number(manifest.authorization.authorizedBudgetUsd) >=
        Number(primaryPricing?.image_unit_usd ?? NaN),
    `authorized=${manifest.authorization.authorizedBudgetUsd ?? "pending"}; imageEstimate=${primaryPricing?.image_unit_usd ?? "?"}`,
  );

  const { data: bucketData, error: bucketError } = await client.storage
    .from(BUCKET_ARTIFACTS)
    .list("", { limit: 1 });
  check(
    items,
    "bucket",
    "Bucket F60.1",
    !bucketError && Array.isArray(bucketData),
    bucketError ? bucketError.message : BUCKET_ARTIFACTS,
  );

  const { error: eventsError } = await client
    .from("generation_events")
    .select("id")
    .limit(1);
  check(
    items,
    "telemetry_table",
    "Telemetria existente",
    !eventsError,
    eventsError ? eventsError.message : "generation_events acessível",
  );

  const { data: credits, error: creditsError } = await client
    .from("credit_balances")
    .select("balance, updated_at")
    .eq("store_id", storeId)
    .maybeSingle();
  check(
    items,
    "credits",
    "Créditos legíveis",
    !creditsError && credits !== null,
    creditsError ? creditsError.message : `balance=${credits?.balance ?? "?"}`,
  );

  const inputSnapshot = campaign.input_snapshot ?? {};
  const identitySnapshot = campaign.identity_snapshot ?? {};
  const mediaImages = inputSnapshot?.media?.images ?? [];
  const images = await readImageInfos(client, mediaImages);
  check(
    items,
    "product_images",
    "Imagens de produto",
    images.length > 0 && images.every((image) => image.exists),
    images.map((image) => `${image.role}:${image.exists}`).join("; "),
  );

  const signatureUrl = identitySnapshot?.signature?.url ?? null;
  const identityAsset = await fetchIdentityDataUrl(client, signatureUrl);
  if (identityAsset === null) {
    info(
      items,
      "identity_asset",
      "Assinatura visual",
      "não acessível por leitura no homolog; a prova usará identityDirective sem inventar logo",
    );
  } else {
    info(
      items,
      "identity_asset",
      "Assinatura visual",
      `lida do ${identityAsset.source} (${identityAsset.mimeType}, ${identityAsset.byteSize} B)`,
    );
  }

  const ready = items
    .filter((item) => item.critical)
    .every((item) => item.status === "PASS");

  return {
    items,
    ready,
    campaign,
    store,
    config,
    primaryPricing,
    fallbackPricing,
    credits,
    images,
    mediaImages,
    identitySnapshot,
    inputSnapshot,
    identityAsset,
    signatureUrl,
  };
}

async function buildInput(client, preflightData, manifest) {
  const { campaign, identitySnapshot, inputSnapshot, images, identityAsset } =
    preflightData;
  const commercial = inputSnapshot?.commercial ?? {};
  const product = inputSnapshot?.product ?? {};
  const brandProfile = identitySnapshot?.brandProfile ?? null;
  const storeName = identitySnapshot?.storeName ?? "Loja";
  const storeSegment =
    identitySnapshot?.storeSegment ?? identitySnapshot?.subsegment ?? "varejo";
  const toneOfVoice = identitySnapshot?.toneOfVoice ?? undefined;

  const productDataUrls = [];
  for (const image of images) {
    const downloaded = await downloadImageDataUrl(client, {
      storagePath: image.path,
      mimeType: image.mimeType || "image/jpeg",
    });
    productDataUrls.push(downloaded.dataUrl);
  }

  const { buildNewFlowIdentityBlock } = await import(
    "../../src/lib/product-1-1/identity-context.ts"
  );
  const legacyDirective =
    identityAsset === null
      ? "Não inventar logotipo. Usar apenas a direção visual do perfil de marca como contexto direcional."
      : "Assinar a campanha com a assinatura visual da loja fornecida como imagem de referência. Manter fidelidade ao arquivo fornecido. Não adicionar logotipo.";
  const identityBlock = buildNewFlowIdentityBlock({
    legacyDirective,
    backgroundDirection: "studio",
    storeName,
    storeBrandColor: identitySnapshot?.brandColor ?? null,
    brandProfile,
  });

  const validityText =
    commercial?.validity?.enabled === true
      ? commercial?.validity?.displayText ?? null
      : null;
  const legalNoticeText =
    commercial?.legalNotice?.enabled === true
      ? commercial?.legalNotice?.text ?? null
      : null;
  const originalPriceText =
    typeof commercial?.originalPriceCents === "number"
      ? brl(commercial.originalPriceCents)
      : null;
  const discountedPriceText =
    typeof commercial?.discountedPriceCents === "number"
      ? brl(commercial.discountedPriceCents)
      : null;

  const briefing = {
    backgroundDirection: "studio",
    product: {
      name: product?.name ?? campaign.product_name,
      description: product?.description ?? null,
    },
    commercial: {
      intent: commercial?.intent ?? "offer",
      originalPriceText,
      discountedPriceText,
      badge: commercial?.badgeText ?? null,
      validity: validityText,
    },
    constraints: {
      mandatoryArtworkText: legalNoticeText,
    },
    identity: {
      storeName,
      palettePrimary: identitySnapshot?.brandColor ?? null,
      paletteAccent:
        brandProfile?.safe_color_tokens?.accent ??
        brandProfile?.safe_color_tokens?.primary ??
        null,
    },
  };

  const briefingTextParts = [
    `${product?.name ?? campaign.product_name}`,
    discountedPriceText === null ? null : `por ${discountedPriceText}`,
    originalPriceText === null ? null : `(de ${originalPriceText})`,
    commercial?.badgeText ? `Selo: ${commercial.badgeText}` : null,
    validityText ? `Validade: ${validityText}` : null,
    legalNoticeText ? `Aviso: ${legalNoticeText}` : null,
  ].filter(Boolean);

  const copyContext = {
    storeName,
    segment: storeSegment,
    ...(typeof toneOfVoice === "string" && toneOfVoice.length > 0
      ? { toneOfVoice }
      : {}),
    ...(typeof identitySnapshot?.positioning === "string" &&
    identitySnapshot.positioning.length > 0
      ? { positioning: identitySnapshot.positioning }
      : {}),
    ...(typeof identitySnapshot?.shortDescription === "string" &&
    identitySnapshot.shortDescription.length > 0
      ? { shortDescription: identitySnapshot.shortDescription }
      : {}),
    ...(typeof identitySnapshot?.slogan === "string" &&
    identitySnapshot.slogan.length > 0
      ? { slogan: identitySnapshot.slogan }
      : {}),
    ...(typeof brandProfile?.brand_personality === "string"
      ? { brandPersonality: brandProfile.brand_personality }
      : {}),
    ...(typeof brandProfile?.campaign_guidelines === "string"
      ? { campaignGuidelines: brandProfile.campaign_guidelines }
      : {}),
    ...(commercial?.badgeText ? { badgeText: commercial.badgeText } : {}),
    ...(typeof commercial?.originalPriceCents === "number"
      ? { originalPriceCents: commercial.originalPriceCents }
      : {}),
    ...(typeof commercial?.discountedPriceCents === "number"
      ? { discountedPriceCents: commercial.discountedPriceCents }
      : {}),
  };

  return {
    input: {
      storeId: manifest.source.storeId,
      campaignId: manifest.source.campaignId,
      operationId: manifest.source.operationIdProposed,
      authorization: AUTHORIZATION,
      briefing,
      briefingText: briefingTextParts.join(". "),
      campaignIntent: commercial?.intent ?? "offer",
      backgroundDirection: "studio",
      productImagesDataUrls: productDataUrls,
      ...(identityAsset === null
        ? {}
        : { identityImageUrl: identityAsset.dataUrl }),
      identityDirective: identityBlock.directive,
      copyContext,
      attempt: {
        number: 1,
        target: "primary",
        reference: manifest.source.attemptReferenceProposed,
      },
      timeoutMs: 180_000,
      usdBrlRateAtGeneration: null,
      creditValueBrlAtGeneration: null,
    },
    observations: {
      productImages: productDataUrls.length,
      identityImage: identityAsset === null ? "unavailable" : "included",
      briefTextLength: briefingTextParts.join(". ").length,
    },
  };
}

async function snapshotCampaign(client, campaignId) {
  const { data, error } = await client
    .from("campaigns")
    .select("id, status, storage_path, updated_at")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function snapshotCredits(client, storeId) {
  const { data, error } = await client
    .from("credit_balances")
    .select("balance, updated_at")
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) return null;
  return data;
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function refuseApply(manifest) {
  if (process.env.F60_4_HOMOLOG_AUTHORIZED !== "1") {
    fail("F60_4_HOMOLOG_AUTHORIZED=1 ausente");
  }
  if (process.env.F60_4_MAX_CALLS !== "1") {
    fail("F60_4_MAX_CALLS deve ser 1");
  }
  const token = process.env.F60_4_AUTHORIZED ?? "";
  if (token.length < 8) fail("F60_4_AUTHORIZED ausente/curto");
  const budget = Number(process.env.F60_4_AUTHORIZED_BUDGET_USD);
  if (!Number.isFinite(budget) || budget <= 0) {
    fail("F60_4_AUTHORIZED_BUDGET_USD inválido");
  }
  if (manifest.authorization.decision !== "approved") {
    fail("manifesto sem authorization.decision=approved");
  }
  if (manifest.providerCalls > 0 || (manifest.calls ?? []).length > 0) {
    fail("manifesto já contém chamada; nova execução recusada");
  }
  return budget;
}

function createIntent(manifest) {
  fs.mkdirSync(INTENT_DIR, { recursive: true });
  const intentPath = path.join(
    INTENT_DIR,
    `proof-intent-${manifest.source.operationIdProposed}.json`,
  );
  if (fs.existsSync(intentPath)) {
    fail(`intento já existe: ${intentPath}`);
  }
  const fd = fs.openSync(intentPath, "wx");
  fs.writeFileSync(
    fd,
    `${JSON.stringify(
      {
        kind: "f60.4-proof-intent",
        status: "sending",
        createdAt: new Date().toISOString(),
        operationId: manifest.source.operationIdProposed,
        campaignId: manifest.source.campaignId,
        storeId: manifest.source.storeId,
        attemptReference: manifest.source.attemptReferenceProposed,
        maxImageCalls: 1,
        maxCopyRequests: 1,
        authorizedBudgetUsd: manifest.authorization.authorizedBudgetUsd,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  fs.closeSync(fd);
  return intentPath;
}

function markIntent(intentPath, status, manifestPath) {
  writeJsonAtomic(intentPath, {
    kind: "f60.4-proof-intent",
    status,
    settledAt: new Date().toISOString(),
    manifestPath,
  });
}

async function main() {
  const manifest = readManifest();
  const client = makeClient();

  const preflightData = await preflight(client, manifest);
  console.log(
    JSON.stringify(
      {
        mode: DRY_RUN ? "dry-run" : "apply",
        ready: preflightData.ready,
        items: preflightData.items,
      },
      null,
      2,
    ),
  );

  if (!preflightData.ready) {
    if (APPLY) {
      writeJsonAtomic(MANIFEST_PATH, {
        ...manifest,
        status: "preflight_failed",
        preflight: {
          status: "failed",
          executedAt: new Date().toISOString(),
          items: preflightData.items,
          ready: false,
        },
        providerCalls: 0,
        calls: [],
      });
    }
    process.exit(1);
  }

  const built = await buildInput(client, preflightData, manifest);
  if (DRY_RUN) {
    console.log(
      JSON.stringify(
        {
          ready: true,
          inputSummary: {
            storeId: built.input.storeId,
            campaignId: built.input.campaignId,
            operationId: built.input.operationId,
            briefing: built.input.briefing,
            campaignIntent: built.input.campaignIntent,
            backgroundDirection: built.input.backgroundDirection,
            productImages: built.input.productImagesDataUrls.length,
            identityImage: built.input.identityImageUrl === undefined ? "omitted" : "included",
            copyContext: built.input.copyContext,
            attempt: built.input.attempt,
            timeoutMs: built.input.timeoutMs,
          },
          observations: built.observations,
        },
        null,
        2,
      ),
    );
    return;
  }

  const authorizedBudgetUsd = refuseApply(manifest);
  const campaignBefore = await snapshotCampaign(
    client,
    manifest.source.campaignId,
  );
  const creditsBefore = await snapshotCredits(
    client,
    manifest.source.storeId,
  );
  const imageInfosBefore = preflightData.images;

  const intentPath = createIntent(manifest);
  const startedAt = Date.now();

  let result = null;
  let thrown = null;
  try {
    const { runSquareBase } = await import(
      "../../src/lib/campaign/square-base/run-square-base.ts"
    );
    result = await runSquareBase(built.input, { client });
  } catch (error) {
    thrown = error;
  }
  const durationMs = Date.now() - startedAt;

  const call = result !== null && "call" in result ? result.call : null;
  const providerCalls = call === null ? 0 : 1;
  const copy = result !== null && "copy" in result ? result.copy : null;

  const campaignAfter = await snapshotCampaign(
    client,
    manifest.source.campaignId,
  ).catch(() => null);
  const creditsAfter = await snapshotCredits(
    client,
    manifest.source.storeId,
  );
  const imageInfosAfter = await readImageInfos(
    client,
    preflightData.mediaImages,
  ).catch(() => null);

  const technicalItems = [];
  check(
    technicalItems,
    "result",
    "Resultado tipado",
    result !== null && result.kind === "completed",
    thrown !== null
      ? `exception: ${thrown instanceof Error ? thrown.message : String(thrown)}`
      : `kind=${result?.kind ?? "null"}`,
  );
  check(
    technicalItems,
    "one_image_call",
    "Uma chamada de imagem",
    providerCalls === 1 && result?.kind === "completed",
    `providerCalls=${providerCalls}`,
  );
  check(
    technicalItems,
    "copy",
    "Copy",
    copy !== null,
    copy === null ? "copy ausente" : `kind=${copy.kind}`,
  );
  check(
    technicalItems,
    "campaigns_unchanged",
    "campaigns preservada",
    sameJson(campaignBefore, campaignAfter),
    sameJson(campaignBefore, campaignAfter)
      ? "sem diferença"
      : "campaigns before/after divergentes",
  );
  check(
    technicalItems,
    "credits_unchanged",
    "Créditos preservados",
    sameJson(creditsBefore, creditsAfter),
    sameJson(creditsBefore, creditsAfter)
      ? "sem diferença"
      : "credit_balances before/after divergentes",
  );
  check(
    technicalItems,
    "input_images_unchanged",
    "Imagens de entrada preservadas",
    imageInfosAfter !== null && sameJson(imageInfosBefore, imageInfosAfter),
    imageInfosAfter === null
      ? "leitura posterior indisponível"
      : sameJson(imageInfosBefore, imageInfosAfter)
        ? "sem diferença"
        : "objetos de entrada divergentes",
  );

  let artifactSummary = null;
  let localImagePath = null;
  if (result?.kind === "completed" && result.art?.kind === "created") {
    check(
      technicalItems,
      "art_created",
      "Arte criada",
      true,
      `artifact=${result.art.artifact.id}`,
    );
    const { retrieveCompositionArtifact } = await import(
      "../../src/lib/campaign/composition-artifacts/retrieve.ts"
    );
    const { computeChecksumSha256 } = await import(
      "../../src/lib/campaign/composition-artifacts/integrity.ts"
    );
    const identity = {
      storeId: manifest.source.storeId,
      campaignId: manifest.source.campaignId,
      operationId: manifest.source.operationIdProposed,
      role: ROLE,
    };
    const retrieved = await retrieveCompositionArtifact(
      { identity, authorization: AUTHORIZATION },
      { client },
    );
    if (retrieved.kind === "integral") {
      const metadata = await sharp(retrieved.bytes).metadata();
      const checksum = computeChecksumSha256(retrieved.bytes);
      const checksumOk = checksum === retrieved.artifact.checksumSha256;
      const dimensionsOk =
        metadata.width === 1024 && metadata.height === 1024;
      const mimeOk = metadata.format === "jpeg";
      check(
        technicalItems,
        "artifact_checksum",
        "Checksum do artefato",
        checksumOk,
        `${checksum} vs ${retrieved.artifact.checksumSha256}`,
      );
      check(
        technicalItems,
        "artifact_dimensions",
        "Dimensões 1024x1024",
        dimensionsOk,
        `${metadata.width}x${metadata.height}`,
      );
      check(
        technicalItems,
        "artifact_mime",
        "MIME JPEG",
        mimeOk,
        metadata.format ?? "unknown",
      );
      check(
        technicalItems,
        "snapshot_original_id",
        "snapshotOriginalId",
        typeof result.art.snapshotOriginalId === "string" &&
          result.art.snapshotOriginalId.length > 0,
        result.art.snapshotOriginalId,
      );
      check(
        technicalItems,
        "cost_known",
        "Custo conhecido e dentro do teto",
        call?.cost?.estimatedCostUsd !== null &&
          typeof call?.cost?.estimatedCostUsd === "number" &&
          call.cost.estimatedCostUsd <= authorizedBudgetUsd,
        `${call?.cost?.estimatedCostUsd ?? "null"} <= ${authorizedBudgetUsd} (${call?.cost?.costSource ?? "?"})`,
      );
      fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
      localImagePath = path.join(EVIDENCE_DIR, "square-original-1024.jpg");
      fs.writeFileSync(localImagePath, retrieved.bytes);
      artifactSummary = {
        id: retrieved.artifact.id,
        storageBucket: retrieved.artifact.storageBucket,
        storagePath: retrieved.artifact.storagePath,
        byteSize: retrieved.artifact.byteSize,
        checksumSha256: retrieved.artifact.checksumSha256,
        width: retrieved.artifact.width,
        height: retrieved.artifact.height,
        mimeType: retrieved.artifact.mimeType,
        origin: retrieved.artifact.origin,
        snapshotOriginalId: result.art.snapshotOriginalId,
        localImagePath,
      };
    } else {
      check(
        technicalItems,
        "artifact_readback",
        "Readback integral",
        false,
        `kind=${retrieved.kind}`,
      );
    }
  } else {
    check(
      technicalItems,
      "art_created",
      "Arte criada",
      false,
      result === null ? "sem resultado" : `art=${result.art?.kind ?? "null"}`,
    );
  }

  const { data: events, error: eventsError } = await client
    .from("generation_events")
    .select(
      "id, operation_run_id, trace_id, provider, model, attempt_number, status, estimated_cost_usd, cost_source, pricing_version, error_type",
    )
    .eq("operation_run_id", manifest.source.operationIdProposed)
    .order("created_at", { ascending: true });
  const imageEvents = (events ?? []).filter(
    (event) => event.trace_id === call?.callId,
  );
  check(
    technicalItems,
    "telemetry",
    "Telemetria da imagem",
    !eventsError && imageEvents.length === 1,
    eventsError
      ? eventsError.message
      : `events=${events?.length ?? 0}; imageEvents=${imageEvents.length}`,
  );

  const eventCosts = (events ?? []).map((event) =>
    event.estimated_cost_usd === null || event.estimated_cost_usd === undefined
      ? null
      : Number(event.estimated_cost_usd),
  );
  const totalEventCost = eventCosts.every((cost) => cost !== null)
    ? eventCosts.reduce((sum, cost) => sum + cost, 0)
    : null;
  check(
    technicalItems,
    "total_cost",
    "Custo total conhecido e dentro do teto",
    totalEventCost !== null && totalEventCost <= authorizedBudgetUsd,
    totalEventCost === null
      ? "custo desconhecido em pelo menos um evento"
      : `${totalEventCost} <= ${authorizedBudgetUsd}`,
  );

  const technicalOk = technicalItems
    .filter((item) => item.critical)
    .every((item) => item.status === "PASS");
  const status =
    result?.kind === "completed" && technicalOk
      ? "awaiting_visual_acceptance"
      : thrown !== null
        ? "unknown"
        : "failed";

  const executedAt = new Date().toISOString();
  const updated = {
    ...manifest,
    status,
    executedAt,
    authorization: {
      ...manifest.authorization,
      decision: "approved",
      decidedAt: manifest.authorization.decidedAt ?? executedAt,
      authorizedBudgetUsd,
      maxImageCalls: 1,
      maxCopyRequests: 1,
    },
    preflight: {
      status: "passed",
      executedAt,
      items: preflightData.items,
      ready: true,
    },
    calls: call === null ? [] : [call],
    providerCalls,
    aiCalls: providerCalls,
    writesPerformed: status === "awaiting_visual_acceptance" ? 1 : 0,
    result: {
      kind: result?.kind ?? null,
      reason: result?.reason ?? null,
      detail: result?.detail ?? null,
      durationMs,
      thrown: thrown === null ? null : thrown instanceof Error ? thrown.message : String(thrown),
    },
    copyOutcome: copy,
    artifact: artifactSummary,
    telemetry: {
      imageEvents,
      allOperationEvents: events ?? [],
      error: eventsError?.message ?? null,
    },
    preservation: {
      campaignsBefore: campaignBefore,
      campaignsAfter: campaignAfter,
      campaignsUnchanged: sameJson(campaignBefore, campaignAfter),
      creditsBefore,
      creditsAfter,
      creditsUnchanged: sameJson(creditsBefore, creditsAfter),
      inputImagesBefore: imageInfosBefore,
      inputImagesAfter: imageInfosAfter,
    },
    technical: {
      status: technicalOk ? "pass" : "fail",
      items: technicalItems,
    },
    visual: {
      status: "pending",
      responsible: "operador",
      localImagePath,
      checkedAt: null,
      notes: null,
    },
    decision: "pending_visual_acceptance",
    declaration:
      status === "awaiting_visual_acceptance"
        ? "Uma única chamada de imagem executada; arte criada e evidência preservada; aguardando aceite visual humano."
        : "Prova encerrada sem nova chamada; evidência preservada; nenhuma repetição autorizada.",
  };

  writeJsonAtomic(MANIFEST_PATH, updated);
  markIntent(intentPath, status === "awaiting_visual_acceptance" ? "completed" : "failed", MANIFEST_PATH);

  const report = `# F60.4 / 60.4-05 — RELATÓRIO DA PROVA REAL

**Status:** **${status === "awaiting_visual_acceptance" ? "EXECUÇÃO CONCLUÍDA — AGUARDANDO ACEITE VISUAL HUMANO" : "EXECUÇÃO ENCERRADA SEM SUCESSO — NENHUMA NOVA CHAMADA"}**
**Data:** ${executedAt}
**Plano:** \`60.4-05\` (Tasks 2–5; Task 6 pendente de aceite visual).
**Manifesto:** \`60.4-05-PROOF-MANIFEST.json\`.

## 1. Autorização

- Decisão: \`approved\` (operador, ${manifest.authorization.decidedAt ?? "nesta rodada"}).
- Teto: **US$ ${authorizedBudgetUsd}**.
- Máximo: 1 imagem + no máximo 1 copy; sem retry/fallback.

## 2. Preflight

${preflightData.items.map((item) => `- **${item.status}** \`${item.id}\` — ${item.label}: ${item.detail}`).join("\n")}

## 3. Chamada única

- Resultado: \`${result?.kind ?? "null"}\`${result?.reason ? ` (${result.reason})` : ""}.
- Duração: ${durationMs} ms.
- Chamadas de imagem: **${providerCalls}**.
- Copy: \`${copy?.kind ?? "null"}\`.
- Custo: \`${call?.cost?.estimatedCostUsd ?? "null"}\` (\`${call?.cost?.costSource ?? "?"}\`).

## 4. Artefato

- ID: \`${artifactSummary?.id ?? "-"}\`
- Caminho: \`${artifactSummary?.storagePath ?? "-"}\`
- Bytes: ${artifactSummary?.byteSize ?? "-"}
- Checksum: \`${artifactSummary?.checksumSha256 ?? "-"}\`
- Dimensões: ${artifactSummary?.width ?? "-"}x${artifactSummary?.height ?? "-"}
- MIME: ${artifactSummary?.mimeType ?? "-"}
- Cópia local para aceite: \`${localImagePath ?? "-"}\`

## 5. Aceite técnico

${technicalItems.map((item) => `- **${item.status}** \`${item.id}\` — ${item.label}: ${item.detail}`).join("\n")}

**Resultado técnico:** ${technicalOk ? "PASS" : "FAIL"}.

## 6. Aceite visual humano — PENDENTE

Critérios: textos legíveis, preço e selo corretos, aviso obrigatório presente,
logo/assinatura coerente com a fonte, composição 1:1 sem cortes ou artefatos.

- Resultado: **pendente**
- Observações: **pendente**
- Horário: **pendente**

## 7. Preservação e não-escopo

- \`campaigns\`: ${sameJson(campaignBefore, campaignAfter) ? "preservada" : "DIVERGENTE"}.
- Créditos: ${sameJson(creditsBefore, creditsAfter) ? "preservados" : "DIVERGENTES"}.
- Imagens de entrada: ${sameJson(imageInfosBefore, imageInfosAfter) ? "preservadas" : "DIVERGENTES"}.
- Nenhuma segunda chamada, retry, fallback, migration, deploy, merge ou push.
- Nenhuma URL pública/assinada foi persistida no manifesto.

## 8. Decisão final

**PENDENTE** — o aceite técnico ${technicalOk ? "passou" : "falhou"}; o aceite visual
humano da imagem local é a próxima etapa. Nenhuma nova chamada será feita.
`;

  writeTextAtomic(REPORT_PATH, report);

  console.log(
    JSON.stringify(
      {
        status,
        providerCalls,
        resultKind: result?.kind ?? null,
        copy: copy?.kind ?? null,
        artifact: artifactSummary,
        localImagePath,
        technical: technicalOk ? "pass" : "fail",
        manifest: MANIFEST_PATH,
        report: REPORT_PATH,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    `[f60.4] falha no harness: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
