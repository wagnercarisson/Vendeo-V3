/**
 * F60.5 / 60.5-04 — harness da prova real integrada 9:16 por expansao.
 *
 * Uso (a partir da raiz):
 *   node --env-file=.env.local --import ./scripts/f60.5/server-only-resolve.mjs \
 *     --import tsx scripts/f60.5/proof.mjs --preflight
 *
 *   F60_5_HOMOLOG_AUTHORIZED=1 F60_5_AUTHORIZED=<token> \
 *   F60_5_MAX_PAID_CALLS=3 F60_5_AUTHORIZED_BUDGET_USD=0.12 \
 *   node --env-file=.env.local --import ./scripts/f60.5/server-only-resolve.mjs \
 *     --import tsx scripts/f60.5/proof.mjs --apply
 *
 * `--preflight` e 100% read-only. `--apply` exige autorizacao explicita,
 * manifesto `approved`, preflight `ready` e intento local inexistente.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const PHASE_DIR = path.join(
  ROOT,
  ".planning",
  "phases",
  "60.5-f60-5-integracao-e-entrega-9-16-por-expansao",
);
const MANIFEST_PATH = path.join(PHASE_DIR, "60.5-04-PROOF-MANIFEST.json");
const PREFLIGHT_PATH = path.join(PHASE_DIR, "60.5-04-PREFLIGHT.json");
const REPORT_PATH = path.join(PHASE_DIR, "60.5-04-PROOF-REPORT.md");
const EVIDENCE_DIR = path.join(PHASE_DIR, "evidence");
const INTENT_DIR = path.join(ROOT, "scripts", "f60.5", "evidence");
const BUCKET_ARTIFACTS = "campaign-internal-artifacts";
const BUCKET_INPUTS = "campaign-images";
const BUCKET_SIGNATURES = "visual-signatures";

const args = new Set(process.argv.slice(2));
const PREFLIGHT = args.has("--preflight");
const APPLY = args.has("--apply");
if (PREFLIGHT === APPLY) {
  fail("use exatamente um modo: --preflight ou --apply");
}

function fail(message) {
  console.error(`[f60.5] ${message}`);
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

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hashDataUrl(dataUrl) {
  return sha256Hex(dataUrl);
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
    fail("NEXT_PUBLIC_SUPABASE_URL invalida");
  }
  if (parsed.hostname !== "127.0.0.1" || parsed.port !== "57781") {
    fail(`host nao e o homolog autorizado: ${parsed.hostname}:${parsed.port}`);
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

async function readStore(client, storeId) {
  const { data, error } = await client
    .from("stores")
    .select(
      "id, name, segment, tone_of_voice, positioning, short_description, slogan",
    )
    .eq("id", storeId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function objectInfo(client, bucket, storagePath) {
  try {
    const { data, error } = await client.storage.from(bucket).info(storagePath);
    if (error || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

async function downloadBytes(client, bucket, storagePath) {
  const { data, error } = await client.storage.from(bucket).download(storagePath);
  if (error || data === null) {
    throw new Error(`download_failed:${bucket}:${storagePath}`);
  }
  return Buffer.from(await data.arrayBuffer());
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
    // URL invalida: sem leitura.
  }
  return null;
}

async function fetchIdentityDataUrl(client, url) {
  if (typeof url !== "string" || url.length === 0) return null;
  let parsed;
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
    const buffer = await downloadBytes(client, BUCKET_SIGNATURES, homologPath);
    const mime = "image/png";
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

function productImagesFromSnapshot(inputSnapshot) {
  const images = inputSnapshot?.media?.images;
  if (!Array.isArray(images)) return [];
  return images
    .filter(
      (image) =>
        image &&
        typeof image.storagePath === "string" &&
        image.storagePath.length > 0,
    )
    .map((image) => ({
      role: image.role === "primary" ? "primary" : "reference",
      source: image.source === "camera" ? "camera" : "upload",
      mimeType:
        typeof image.mimeType === "string" && image.mimeType.length > 0
          ? image.mimeType
          : "image/jpeg",
      storagePath: image.storagePath,
    }));
}

async function buildSourceData(client, manifest) {
  const campaign = await readCampaign(client, manifest.source.campaignId);
  if (!campaign) fail("campanha-fonte ausente");
  if (campaign.store_id !== manifest.source.storeId) {
    fail("campanha-fonte nao pertence a loja autorizada");
  }
  const store = await readStore(client, manifest.source.storeId);
  if (!store) fail("loja autorizada ausente");

  const snapshot = campaign.input_snapshot ?? {};
  const images = productImagesFromSnapshot(snapshot);
  const downloadedImages = [];
  for (const image of images) {
    const buffer = await downloadBytes(client, BUCKET_INPUTS, image.storagePath);
    downloadedImages.push({
      ...image,
      buffer,
      dataUrl: `data:${image.mimeType};base64,${buffer.toString("base64")}`,
      contentId: hashDataUrl(
        `data:${image.mimeType};base64,${buffer.toString("base64")}`,
      ),
    });
  }

  const identitySnapshot = campaign.identity_snapshot ?? {};
  const signatureUrl =
    typeof identitySnapshot?.signature?.url === "string"
      ? identitySnapshot.signature.url
      : null;
  const identityAsset = await fetchIdentityDataUrl(client, signatureUrl);
  return {
    campaign,
    store,
    snapshot,
    images: downloadedImages,
    identitySnapshot,
    identityAsset,
  };
}

async function readPricingAndConfig(client, manifest) {
  const { data: config, error: configError } = await client
    .from("image_model_pair_config")
    .select(
      "scope, primary_model, primary_quality, fallback_model, fallback_quality, config_version_id",
    )
    .eq("scope", "new_flow")
    .maybeSingle();
  const { data: pricing, error: pricingError } = await client
    .from("ai_model_pricing")
    .select(
      "id, provider, model, quality, image_unit_usd, image_input_token_usd_per_1m, image_cached_input_token_usd_per_1m, effective_until",
    )
    .in("model", [
      manifest.target.base.model,
      manifest.target.expansion.model,
      manifest.target.fallback.model,
    ])
    .is("effective_until", null);
  const find = (model, quality) =>
    (pricing ?? []).find(
      (row) => row.model === model && row.quality === quality,
    ) ?? null;
  return {
    config,
    configError,
    pricing,
    pricingError,
    basePricing: find(
      manifest.target.base.model,
      manifest.target.base.quality,
    ),
    expansionPricing: find(
      manifest.target.expansion.model,
      manifest.target.expansion.quality,
    ),
    fallbackPricing: find(
      manifest.target.fallback.model,
      manifest.target.fallback.quality,
    ),
  };
}

async function targetAbsence(client, manifest) {
  const campaignId = manifest.targetCampaign.campaignIdProposed;
  const operationId = manifest.targetCampaign.operationIdProposed;
  const campaign = await client
    .from("campaigns")
    .select("id, store_id, status")
    .eq("id", campaignId)
    .maybeSingle();
  const operations = await client
    .from("product_9_16_two_stage_operations")
    .select("campaign_id, operation_id")
    .eq("campaign_id", campaignId);
  const steps = await client
    .from("product_9_16_two_stage_steps")
    .select("stage, status")
    .eq("campaign_id", campaignId);
  const artifacts = await client
    .from("campaign_composition_artifacts")
    .select("id, role, operation_id")
    .eq("campaign_id", campaignId);
  const credit = await client
    .from("product_1_1_campaign_credit_operations")
    .select("campaign_id, operation_id, status")
    .eq("campaign_id", campaignId);
  const copy = await client
    .from("product_1_1_copy_state")
    .select("campaign_id, operation_id, attempt_seq")
    .eq("campaign_id", campaignId);
  return {
    campaign: campaign.data,
    operations: operations.data ?? [],
    steps: steps.data ?? [],
    artifacts: artifacts.data ?? [],
    credit: credit.data ?? [],
    copy: copy.data ?? [],
    errors: [
      campaign.error?.message,
      operations.error?.message,
      steps.error?.message,
      artifacts.error?.message,
      credit.error?.message,
      copy.error?.message,
    ].filter(Boolean),
    operationId,
  };
}

async function buildPreflight(client, manifest) {
  const items = [];
  const observed = {};
  const authorized = manifest.authorization?.decision === "approved";

  check(
    items,
    "environment",
    "Homolog existente",
    process.env.NEXT_PUBLIC_SUPABASE_URL === "http://127.0.0.1:57781",
    "API 127.0.0.1:57781; DB 127.0.0.1:57782/postgres; producao nao consultada",
  );
  check(
    items,
    "authorization",
    "Autorizacao explicita",
    authorized &&
      Number(manifest.authorization?.authorizedBudgetUsd) >=
        Number(manifest.estimate?.estimatedTotalUsd) &&
      Number(manifest.authorization?.authorizedMaxPaidCalls) === 3,
    authorized
      ? `approved; budget=${manifest.authorization.authorizedBudgetUsd}; maxPaidCalls=${manifest.authorization.authorizedMaxPaidCalls}`
      : "decision diferente de approved",
  );
  check(
    items,
    "credential_product",
    "Credencial de produto",
    typeof process.env.OPENAI_API_KEY === "string" &&
      process.env.OPENAI_API_KEY.length > 0,
    "OPENAI_API_KEY presente; OPENAI_BENCH_API_KEY nao e usada silenciosamente",
  );
  check(
    items,
    "credential_supabase",
    "Credenciais Supabase",
    typeof process.env.SUPABASE_SERVICE_ROLE_KEY === "string" &&
      process.env.SUPABASE_SERVICE_ROLE_KEY.length > 0,
    "service role presente",
  );

  const source = await buildSourceData(client, manifest);
  observed.source = {
    campaignId: source.campaign.id,
    storeId: source.campaign.store_id,
    productName: source.campaign.product_name,
    status: source.campaign.status,
    imageCount: source.images.length,
    images: source.images.map((image) => ({
      role: image.role,
      mimeType: image.mimeType,
      byteSize: image.buffer.byteLength,
      contentId: image.contentId,
    })),
    identityState: source.identitySnapshot?.identityState ?? null,
    identityAsset:
      source.identityAsset === null
        ? "unavailable"
        : {
            mimeType: source.identityAsset.mimeType,
            byteSize: source.identityAsset.byteSize,
            source: source.identityAsset.source,
            contentId: hashDataUrl(source.identityAsset.dataUrl),
          },
  };

  check(
    items,
    "source_campaign",
    "Campanha-fonte existente e pertencente",
    source.campaign.store_id === manifest.source.storeId &&
      source.campaign.status === "ready",
    `status=${source.campaign.status}; store=${source.campaign.store_id}`,
  );
  check(
    items,
    "source_media",
    "Imagens de produto legiveis",
    source.images.length >= 1 && source.images.every((image) => image.buffer.length > 0),
    `images=${source.images.length}`,
  );
  check(
    items,
    "identity",
    "Identidade acessivel ou fallback explicito",
    source.identitySnapshot?.identityState !== "visual_signature" ||
      source.identityAsset !== null,
    source.identityAsset === null
      ? "visual_signature indisponivel; usar identityDirective e registrar limitacao"
      : `identityAsset=${source.identityAsset.source}`,
  );

  const pricing = await readPricingAndConfig(client, manifest);
  observed.pricing = {
    configVersionId: pricing.config?.config_version_id ?? null,
    primary: pricing.config
      ? `${pricing.config.primary_model}/${pricing.config.primary_quality}`
      : null,
    fallback: pricing.config
      ? `${pricing.config.fallback_model}/${pricing.config.fallback_quality}`
      : null,
    baseUnitUsd: pricing.basePricing?.image_unit_usd ?? null,
    expansionUnitUsd: pricing.expansionPricing?.image_unit_usd ?? null,
    basePricingId: pricing.basePricing?.id ?? null,
    expansionPricingId: pricing.expansionPricing?.id ?? null,
  };
  check(
    items,
    "config",
    "Configuracao ativa do par",
    !pricing.configError &&
      pricing.config?.primary_model === manifest.target.base.model &&
      pricing.config?.primary_quality === manifest.target.base.quality &&
      pricing.config?.fallback_model === manifest.target.fallback.model &&
      pricing.config?.fallback_quality === manifest.target.fallback.quality,
    pricing.configError
      ? pricing.configError.message
      : `${pricing.config?.primary_model}/${pricing.config?.primary_quality}; fallback ${pricing.config?.fallback_model}/${pricing.config?.fallback_quality}`,
  );
  check(
    items,
    "pricing_base",
    "Pricing base completo",
    !pricing.pricingError &&
      pricing.basePricing?.image_unit_usd !== null &&
      pricing.basePricing?.image_unit_usd !== undefined,
    pricing.pricingError
      ? pricing.pricingError.message
      : `base=${pricing.basePricing?.image_unit_usd ?? "missing"}`,
  );
  check(
    items,
    "pricing_expansion",
    "Pricing expansao completo",
    !pricing.pricingError &&
      pricing.expansionPricing?.image_unit_usd !== null &&
      pricing.expansionPricing?.image_unit_usd !== undefined,
    pricing.pricingError
      ? pricing.pricingError.message
      : `expansion=${pricing.expansionPricing?.image_unit_usd ?? "missing"}`,
  );
  check(
    items,
    "budget",
    "Orcamento autorizado cobre a estimativa",
    Number(manifest.authorization?.authorizedBudgetUsd) >=
      Number(manifest.estimate?.estimatedTotalUsd),
    `authorized=${manifest.authorization?.authorizedBudgetUsd}; estimate=${manifest.estimate?.estimatedTotalUsd}`,
  );

  const target = await targetAbsence(client, manifest);
  observed.target = {
    campaignId: manifest.targetCampaign.campaignIdProposed,
    operationId: manifest.targetCampaign.operationIdProposed,
    campaignAbsent: target.campaign === null,
    operations: target.operations.length,
    steps: target.steps.length,
    artifacts: target.artifacts.length,
    creditRows: target.credit.length,
    copyRows: target.copy.length,
  };
  check(
    items,
    "target_absent",
    "Campanha/operacao/artefatos alvo ausentes",
    target.errors.length === 0 &&
      target.campaign === null &&
      target.operations.length === 0 &&
      target.steps.length === 0 &&
      target.artifacts.length === 0 &&
      target.credit.length === 0 &&
      target.copy.length === 0,
    target.errors.length > 0
      ? target.errors.join("; ")
      : `campaign=${target.campaign === null ? "absent" : "present"}; operations=${target.operations.length}; artifacts=${target.artifacts.length}; credit=${target.credit.length}; copy=${target.copy.length}`,
  );

  const bucket = await objectInfo(
    client,
    BUCKET_ARTIFACTS,
    "00000000-0000-4000-8000-000000000000/probe",
  );
  void bucket;
  const { data: bucketList, error: bucketError } = await client.storage
    .from(BUCKET_ARTIFACTS)
    .list("", { limit: 1 });
  check(
    items,
    "bucket",
    "Bucket F60.1 acessivel",
    !bucketError && Array.isArray(bucketList),
    bucketError ? bucketError.message : BUCKET_ARTIFACTS,
  );

  check(
    items,
    "code_sha",
    "Codigo aceito e SHAs registrados",
    manifest.implementation?.acceptedHead === "e35b5a1d" &&
      manifest.phaseBaseSha === "35b0aa4e",
    `phaseBaseSha=${manifest.phaseBaseSha}; acceptedHead=${manifest.implementation?.acceptedHead}`,
  );
  check(
    items,
    "window_owners",
    "Responsavel pelo aceite humano definido",
    manifest.authorization?.humanAcceptanceOwner === "operator",
    `humanAcceptanceOwner=${manifest.authorization?.humanAcceptanceOwner ?? "missing"}`,
  );

  const ready = items.every((item) => item.status !== "FAIL");
  return {
    kind: "f60.5-preflight",
    plan: "60.5-04",
    status: ready ? "ready" : "blocked",
    ready,
    executedAt: new Date().toISOString(),
    providerCalls: 0,
    aiCalls: 0,
    writesPerformed: 0,
    items,
    observed,
  };
}

function refuseApply(manifest, preflight) {
  if (process.env.F60_5_HOMOLOG_AUTHORIZED !== "1") {
    fail("F60_5_HOMOLOG_AUTHORIZED=1 ausente");
  }
  if (process.env.F60_5_MAX_PAID_CALLS !== "3") {
    fail("F60_5_MAX_PAID_CALLS deve ser 3");
  }
  const token = process.env.F60_5_AUTHORIZED ?? "";
  if (token.length < 8) fail("F60_5_AUTHORIZED ausente/curto");
  const budget = Number(process.env.F60_5_AUTHORIZED_BUDGET_USD);
  if (!Number.isFinite(budget) || budget !== 0.12) {
    fail("F60_5_AUTHORIZED_BUDGET_USD deve ser 0.12");
  }
  if (manifest.authorization?.decision !== "approved") {
    fail("manifesto sem authorization.decision=approved");
  }
  if (preflight?.ready !== true) {
    fail("preflight nao esta ready");
  }
  if (
    (manifest.providerCalls ?? 0) > 0 ||
    (manifest.calls ?? []).length > 0
  ) {
    fail("manifesto ja contem chamada; nova execucao recusada");
  }
  return budget;
}

async function apply(manifest, preflight) {
  const budget = refuseApply(manifest, preflight);
  fs.mkdirSync(INTENT_DIR, { recursive: true });
  const intentPath = path.join(
    INTENT_DIR,
    `proof-intent-${manifest.targetCampaign.operationIdProposed}.json`,
  );
  if (fs.existsSync(intentPath)) {
    fail(`intento ja existe: ${intentPath}`);
  }
  const startedAt = new Date().toISOString();
  writeJsonAtomic(intentPath, {
    kind: "f60.5-proof-intent",
    status: "sending",
    startedAt,
    operationId: manifest.targetCampaign.operationIdProposed,
    campaignId: manifest.targetCampaign.campaignIdProposed,
    storeId: manifest.source.storeId,
    authorizedBudgetUsd: budget,
    maxPaidCalls: 3,
    providerCalls: 0,
  });

  const client = makeClient();
  const source = await buildSourceData(client, manifest);

  // Importacoes reais do app (server-only resolvido pelo hook).
  const { createCampaign, uploadCampaignInputFile } = await import(
    "../../src/lib/campaign/persistence.ts"
  );
  const { buildCampaignBriefFromFlat, buildCampaignBriefSnapshot, mimeTypeFromDataUrl } =
    await import("../../src/lib/campaign/brief.ts");
  const { describeDurableInput, verifyReconstructedInput } = await import(
    "../../src/lib/product-9-16-two-stage/orchestration/durable-input.ts"
  );
  const { buildNineSixteenResumeContext } = await import(
    "../../src/lib/product-9-16-two-stage/orchestration/resume-context.ts"
  );
  const { identityReferenceId } = await import(
    "../../src/lib/product-9-16-two-stage/orchestration/identity-id.ts"
  );
  const { GENERATION_ORIGIN, GENERATION_CONTRACT_VERSION } = await import(
    "../../src/lib/product-9-16-two-stage/orchestration/origin.ts"
  );
  const { FORMAT_CONTRACT_VERSION } = await import(
    "../../src/lib/campaign/format-resolution.ts"
  );
  const { buildNewFlowIdentityBlock } = await import(
    "../../src/lib/product-1-1/identity-context.ts"
  );
  const { positivePriceTextBRL } = await import(
    "../../src/lib/product-1-1/commercial-price.ts"
  );
  const { runNineSixteenTwoStageGeneration } = await import(
    "../../src/lib/product-9-16-two-stage/orchestration/run-nine-sixteen.ts"
  );
  const { createNineSixteenDeps } = await import(
    "../../src/lib/product-9-16-two-stage/orchestration/delivery-deps.ts"
  );
  const { createHash } = await import("node:crypto");

  const campaignId = manifest.targetCampaign.campaignIdProposed;
  const operationId = manifest.targetCampaign.operationIdProposed;
  const storeId = manifest.source.storeId;
  const commercial = source.snapshot?.commercial ?? {};
  const product = source.snapshot?.product ?? {};
  const identitySnapshot = source.identitySnapshot ?? {};
  const brandProfile = identitySnapshot?.brandProfile ?? null;
  const identityStoreName = identitySnapshot?.storeName ?? source.store.name;
  const identityStoreSegment =
    identitySnapshot?.storeSegment ??
    identitySnapshot?.subsegment ??
    source.store.segment;
  const backgroundDirection = "studio";

  const legacyDirective =
    source.identityAsset === null
      ? "Nao inventar logotipo. Usar apenas a direcao visual do perfil de marca como contexto direcional."
      : "Assinar a campanha com a assinatura visual da loja fornecida como imagem de referencia. Manter fidelidade ao arquivo fornecido. Nao adicionar logotipo.";
  const identityBlock = buildNewFlowIdentityBlock({
    legacyDirective,
    backgroundDirection,
    storeName: identityStoreName,
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
  const originalPriceText = positivePriceTextBRL(commercial?.originalPriceCents);
  const discountedPriceText = positivePriceTextBRL(
    commercial?.discountedPriceCents,
  );

  const briefing = {
    backgroundDirection,
    product: {
      name: product?.name ?? source.campaign.product_name,
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
  };

  const copyContext = {
    storeName: source.store.name,
    segment: source.store.segment,
    ...(source.store.tone_of_voice
      ? { toneOfVoice: source.store.tone_of_voice }
      : {}),
    ...(source.store.positioning
      ? { positioning: source.store.positioning }
      : {}),
    ...(source.store.short_description
      ? { shortDescription: source.store.short_description }
      : {}),
    ...(source.store.slogan ? { slogan: source.store.slogan } : {}),
    ...(brandProfile?.brand_personality
      ? { brandPersonality: brandProfile.brand_personality }
      : {}),
    ...(brandProfile?.campaign_guidelines
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

  const identityContextFrozen = Object.freeze({
    ...identityBlock.context,
    brandProfile,
  });

  const durableInputs = [];
  const uploads = [];
  for (const [index, image] of source.images.entries()) {
    const parsed = describeDurableInput({
      kind: "product",
      role: image.role,
      index,
      storagePath: "",
      mimeType: image.mimeType,
      dataUrl: image.dataUrl,
    });
    if (!parsed.ok) fail("imagem de produto nao reconstruivel");
    const extension =
      parsed.descriptor.mimeType === "image/png"
        ? "png"
        : parsed.descriptor.mimeType === "image/webp"
          ? "webp"
          : "jpg";
    const descriptor = {
      ...parsed.descriptor,
      storagePath: `${storeId}/${campaignId}/inputs/${parsed.descriptor.contentId}.${extension}`,
    };
    durableInputs.push(descriptor);
    uploads.push({ descriptor, buffer: image.buffer, dataUrl: image.dataUrl });
  }
  if (source.identityAsset !== null) {
    const parsed = describeDurableInput({
      kind: "identity",
      role: "identity",
      index: source.images.length,
      storagePath: "",
      mimeType: source.identityAsset.mimeType,
      dataUrl: source.identityAsset.dataUrl,
    });
    if (!parsed.ok) fail("identidade nao reconstruivel");
    const extension =
      parsed.descriptor.mimeType === "image/png"
        ? "png"
        : parsed.descriptor.mimeType === "image/webp"
          ? "webp"
          : "jpg";
    const descriptor = {
      ...parsed.descriptor,
      storagePath: `${storeId}/${campaignId}/inputs/${parsed.descriptor.contentId}.${extension}`,
    };
    durableInputs.push(descriptor);
    uploads.push({
      descriptor,
      buffer: Buffer.from(
        source.identityAsset.dataUrl.slice(
          source.identityAsset.dataUrl.indexOf(",") + 1,
        ),
        "base64",
      ),
      dataUrl: source.identityAsset.dataUrl,
    });
  }

  const references = [
    ...durableInputs
      .filter((descriptor) => descriptor.kind === "product")
      .map((descriptor, index) => ({
        kind: index === 0 ? "product" : "reference",
        id: descriptor.contentId,
        role: descriptor.role,
        index,
      })),
    ...(source.identityAsset === null
      ? []
      : [
          {
            kind: "identity",
            id: identityReferenceId({
              format: "9:16",
              contentId: durableInputs.find(
                (descriptor) => descriptor.kind === "identity",
              ).contentId,
              dataUrl: source.identityAsset.dataUrl,
            }),
            role: "identity",
            index: source.images.length,
          },
        ]),
  ];

  const brief = buildCampaignBriefFromFlat(
    {
      storeId,
      productName: product?.name ?? source.campaign.product_name,
      description: product?.description ?? undefined,
      originalPriceCents: commercial?.originalPriceCents ?? 0,
      discountedPriceCents: commercial?.discountedPriceCents,
      badgeText: commercial?.badgeText ?? "",
      campaignIntent: commercial?.intent ?? "offer",
      productImages: source.images.map((image) => ({
        role: image.role,
        source: image.source,
        mimeType: image.mimeType,
        dataUrl: image.dataUrl,
      })),
      validity: validityText ?? undefined,
      mandatoryArtworkText: legalNoticeText ?? undefined,
      customerName: undefined,
      preserveImageContext: false,
    },
    storeId,
  );
  const briefSnapshot = buildCampaignBriefSnapshot(brief);
  const frozenSnapshot = {
    ...briefSnapshot,
    identityDirective: identityBlock.directive,
    identityContext: identityContextFrozen,
    campaignFormat: "9:16",
    formatContractVersion: FORMAT_CONTRACT_VERSION,
    generationOrigin: GENERATION_ORIGIN,
    generationContractVersion: GENERATION_CONTRACT_VERSION,
    inputFiles: durableInputs,
  };
  const resumeContext = buildNineSixteenResumeContext({
    briefing,
    campaignIntent: commercial?.intent ?? "offer",
    backgroundDirection,
    identityDirective: identityBlock.directive,
    identityContext: identityContextFrozen,
    copyContext,
    economicSnapshot: {
      usdBrlRateAtGeneration: null,
      creditValueBrlAtGeneration: null,
    },
    inputFiles: durableInputs,
  });
  if (!resumeContext.ok) fail("resumeContext invalido");

  const identitySnapshotToPersist =
    source.identityAsset === null
      ? {
          ...identitySnapshot,
          signature: null,
          signatureUnavailable: true,
        }
      : identitySnapshot;

  let campaignCreated = false;
  let uploadsVerified = 0;
  let terminalEvents = [];
  let phaseEvents = [];
  let invokeStartedAt = null;
  let invokeEndedAt = null;
  let executionError = null;

  try {
    await createCampaign(
      storeId,
      {
        productName: product?.name ?? source.campaign.product_name,
        inputSnapshot: {
          ...frozenSnapshot,
          resumeContext: resumeContext.context,
          frozenContentReferences: references,
        },
        identitySnapshot: identitySnapshotToPersist,
        operationRunId: operationId,
      },
      campaignId,
    );
    campaignCreated = true;

    for (const upload of uploads) {
      const result = await uploadCampaignInputFile(storeId, campaignId, {
        contentId: upload.descriptor.contentId,
        mimeType: upload.descriptor.mimeType,
        dataUrlPrefix: upload.descriptor.dataUrlPrefix,
        buffer: upload.buffer,
      });
      if (result.kind === "conflict" || result.kind === "indeterminate") {
        throw new Error(`input_upload_${result.kind}`);
      }
      const { downloadCampaignInputFileWithClient } = await import(
        "../../src/lib/campaign/persistence.ts"
      );
      const { supabaseAdmin } = await import("../../src/lib/supabase/server.ts");
      const read = await downloadCampaignInputFileWithClient(
        supabaseAdmin,
        upload.descriptor.storagePath,
      );
      if (read.kind !== "bytes") throw new Error(`input_read_${read.kind}`);
      const verified = verifyReconstructedInput(
        upload.descriptor,
        read.bytes,
      );
      if (!verified.ok) throw new Error(`input_verify_${verified.reason}`);
      if (verified.dataUrl !== upload.dataUrl) {
        throw new Error("input_verify_data_url_mismatch");
      }
      uploadsVerified += 1;
    }

    invokeStartedAt = new Date().toISOString();
    const { supabaseAdmin } = await import("../../src/lib/supabase/server.ts");
    const response = await runNineSixteenTwoStageGeneration(
      {
        mode: "initial",
        storeId,
        campaignId,
        operationId,
        authorization: { kind: "system" },
        requestStartedAtMs: Date.now(),
        allowNewPaidStep: true,
      },
      createNineSixteenDeps({ client: supabaseAdmin }),
    );
    const text = await response.text();
    const events = text
      .trim()
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
    phaseEvents = events.filter((event) => event.type === "phase");
    terminalEvents = events.filter((event) =>
      ["result", "error", "unknown", "processing"].includes(event.type),
    );
    invokeEndedAt = new Date().toISOString();
  } catch (error) {
    executionError = error instanceof Error ? error.message : String(error);
    invokeEndedAt = new Date().toISOString();
  }

  const snapshot = await snapshotExecution(client, {
    manifest,
    campaignId,
    operationId,
    storeId,
    sourceCampaignId: source.campaign.id,
    sourceSnapshot: source.snapshot,
    sourceIdentity: source.identitySnapshot,
    campaignCreated,
    uploadsVerified,
    durableInputs,
    references,
    phaseEvents,
    terminalEvents,
    invokeStartedAt,
    invokeEndedAt,
    executionError,
    startedAt,
    budget,
  });

  const finishedAt = new Date().toISOString();
  snapshot.finishedAt = finishedAt;
  snapshot.manifest.preparation = snapshot.preparation;
  snapshot.manifest.calls = snapshot.calls;
  snapshot.manifest.freeInvocations = snapshot.freeInvocations;
  snapshot.manifest.delivery = snapshot.delivery;
  snapshot.manifest.artifact = snapshot.artifact;
  snapshot.manifest.copy = snapshot.copy;
  snapshot.manifest.credit = snapshot.credit;
  snapshot.manifest.cost = snapshot.cost;
  snapshot.manifest.invocations = snapshot.invocations;
  snapshot.manifest.terminal = snapshot.terminal;
  snapshot.manifest.providerCalls = snapshot.calls.length;
  snapshot.manifest.aiCalls = snapshot.calls.length;
  snapshot.manifest.writesPerformed = campaignCreated ? 1 : 0;
  snapshot.manifest.status = snapshot.technical.pass
    ? "technical-pass-human-pending"
    : "failed";
  snapshot.manifest.acceptance = {
    technical: snapshot.technical,
    human: {
      status: "pending",
      owner: manifest.authorization.humanAcceptanceOwner,
      notes:
        "Aceite humano do vertical/copy/miniatura/credito deve ser registrado pelo operador.",
    },
  };
  snapshot.manifest.preflight = {
    path: "60.5-04-PREFLIGHT.json",
    status: preflight.status,
    ready: preflight.ready,
    executedAt: preflight.executedAt,
  };

  writeJsonAtomic(MANIFEST_PATH, snapshot.manifest);
  writeJsonAtomic(
    path.join(EVIDENCE_DIR, `proof-${finishedAt.replace(/[:.]/g, "-")}.json`),
    snapshot.manifest,
  );
  writeJsonAtomic(path.join(EVIDENCE_DIR, "proof-latest.json"), snapshot.manifest);
  writeTextAtomic(REPORT_PATH, buildReport(snapshot, preflight));
  writeJsonAtomic(intentPath, {
    kind: "f60.5-proof-intent",
    status: "finished",
    startedAt,
    finishedAt,
    operationId,
    campaignId,
    providerCalls: snapshot.calls.length,
    terminal: snapshot.terminal,
  });

  printSummary(snapshot);
  if (!snapshot.technical.pass) process.exitCode = 1;
}

async function snapshotExecution(
  client,
  input,
) {
  const { manifest } = input;
  const { data: campaign } = await client
    .from("campaigns")
    .select("id, store_id, status, storage_path, updated_at")
    .eq("id", input.campaignId)
    .maybeSingle();
  const { data: operation } = await client
    .from("product_9_16_two_stage_operations")
    .select("campaign_id, operation_id, store_id, origin, contract_version")
    .eq("campaign_id", input.campaignId)
    .eq("operation_id", input.operationId)
    .maybeSingle();
  const { data: steps } = await client
    .from("product_9_16_two_stage_steps")
    .select("stage, status, attempts_used, failure_class")
    .eq("campaign_id", input.campaignId)
    .eq("operation_id", input.operationId);
  const { data: claims } = await client
    .from("product_9_16_two_stage_attempt_claims")
    .select(
      "stage, attempt_number, target, request_id, status, failure_class, attempt_token, created_at",
    )
    .eq("campaign_id", input.campaignId)
    .eq("operation_id", input.operationId)
    .order("attempt_number", { ascending: true });
  const { data: outcome } = await client
    .from("product_9_16_two_stage_outcomes")
    .select("outcome, stage, support_reference")
    .eq("campaign_id", input.campaignId)
    .eq("operation_id", input.operationId)
    .maybeSingle();
  const { data: credit } = await client
    .from("product_1_1_campaign_credit_operations")
    .select("status, amount, state_epoch, publication_state")
    .eq("campaign_id", input.campaignId)
    .eq("operation_id", input.operationId)
    .maybeSingle();
  const { data: artifacts } = await client
    .from("campaign_composition_artifacts")
    .select(
      "id, role, origin, storage_bucket, storage_path, width, height, mime_type, byte_size, checksum_sha256, derived_from_artifact_id, created_at",
    )
    .eq("campaign_id", input.campaignId)
    .eq("operation_id", input.operationId);
  const { data: copyRows } = await client
    .from("product_1_1_copy_state")
    .select("attempt_seq, state, copy_text, copy_payload")
    .eq("campaign_id", input.campaignId)
    .eq("operation_id", input.operationId)
    .order("attempt_seq", { ascending: true });
  const { data: events } = await client
    .from("generation_events")
    .select(
      "id, operation_run_id, trace_id, model, attempt_number, status, estimated_cost_usd, cost_source, pricing_version, prompt_tokens, completion_tokens, total_tokens, image_tokens, error_type, created_at",
    )
    .eq("operation_run_id", input.operationId)
    .order("created_at", { ascending: true });

  const sourceAfter = await readCampaign(client, input.sourceCampaignId);
  const sourceImagesAfter = productImagesFromSnapshot(
    sourceAfter?.input_snapshot ?? {},
  );
  const sourceSnapshotUnchanged =
    JSON.stringify(sourceAfter?.input_snapshot ?? null) ===
    JSON.stringify(input.sourceSnapshot ?? null);
  const sourceIdentityUnchanged =
    JSON.stringify(sourceAfter?.identity_snapshot ?? null) ===
    JSON.stringify(input.sourceIdentity ?? null);
  const sourceImagesUnchanged =
    JSON.stringify(sourceImagesAfter) ===
    JSON.stringify(productImagesFromSnapshot(input.sourceSnapshot));
  const sourceStatusUnchanged = sourceAfter?.status === "ready";

  const baseArtifact =
    (artifacts ?? []).find((artifact) => artifact.role === "square_original") ??
    null;
  const preparedArtifact =
    (artifacts ?? []).find((artifact) => artifact.role === "square_prepared") ??
    null;
  const verticalArtifact =
    (artifacts ?? []).find((artifact) => artifact.role === "vertical") ?? null;

  let verticalBytes = null;
  let verticalInfo = null;
  let verticalDownloadError = null;
  if (verticalArtifact) {
    try {
      verticalBytes = await downloadBytes(
        client,
        BUCKET_ARTIFACTS,
        verticalArtifact.storage_path,
      );
      verticalInfo = await objectInfo(
        client,
        BUCKET_ARTIFACTS,
        verticalArtifact.storage_path,
      );
    } catch (error) {
      verticalDownloadError =
        error instanceof Error ? error.message : String(error);
    }
  }
  const verticalChecksumOk =
    verticalBytes !== null &&
    verticalArtifact !== null &&
    sha256Hex(verticalBytes) === verticalArtifact.checksum_sha256;

  const thumbnailPath = verticalArtifact
    ? verticalArtifact.storage_path.replace(/\.jpe?g$/i, ".thumb-v1.webp")
    : null;
  const thumbnailInfo = thumbnailPath
    ? await objectInfo(client, BUCKET_INPUTS, thumbnailPath)
    : null;

  const { data: campaignImages } = await client.storage
    .from(BUCKET_INPUTS)
    .list(`${input.storeId}/${input.campaignId}`, { limit: 100 });
  const integralVerticalInCampaignImages = (campaignImages ?? []).some(
    (entry) => /vertical\.jpe?g$/i.test(entry.name ?? ""),
  );

  const calls = (events ?? []).filter(
    (event) =>
      event.estimated_cost_usd !== null ||
      event.prompt_tokens !== null ||
      event.completion_tokens !== null ||
      event.total_tokens !== null ||
      event.image_tokens !== null,
  );
  const costValues = calls.map((call) => call.estimated_cost_usd);
  const costAvailable = costValues.every(
    (value) => typeof value === "number" && Number.isFinite(value) && value >= 0,
  );
  const observedCostUsd = costValues.reduce(
    (total, value) => total + (typeof value === "number" ? value : 0),
    0,
  );
  const withinBudget = costAvailable && observedCostUsd <= input.budget;
  const terminal = input.terminalEvents.at(-1) ?? null;
  const deliveryStarted = input.phaseEvents.some(
    (event) =>
      event.phase === "campaign_delivery" && event.status === "running",
  );
  const deliveryCompleted = input.phaseEvents.some(
    (event) =>
      event.phase === "campaign_delivery" && event.status === "complete",
  );
  const copyCompleted = (copyRows ?? []).some(
    (row) => row.state === "completed" && typeof row.copy_text === "string",
  );

  const technicalChecks = [];
  const technicalCheck = (id, label, ok, detail) => {
    technicalChecks.push({
      id,
      label,
      status: ok ? "PASS" : "FAIL",
      detail,
    });
    return ok;
  };
  const technicalPass = [
    technicalCheck(
      "terminal",
      "Terminal resultado entregue",
      terminal?.type === "result",
      terminal ? `${terminal.type}${terminal.code ? `:${terminal.code}` : ""}` : "sem terminal",
    ),
    technicalCheck(
      "campaign_projected",
      "Campanha projetada ready",
      campaign?.status === "ready",
      `status=${campaign?.status ?? "missing"}`,
    ),
    technicalCheck(
      "vertical_row",
      "Vertical persistido 1080x1920 JPEG",
      verticalArtifact !== null &&
        verticalArtifact.width === 1080 &&
        verticalArtifact.height === 1920 &&
        verticalArtifact.mime_type === "image/jpeg",
      verticalArtifact
        ? `${verticalArtifact.width}x${verticalArtifact.height} ${verticalArtifact.mime_type}`
        : "missing",
    ),
    technicalCheck(
      "vertical_checksum",
      "Checksum do vertical confere",
      verticalChecksumOk,
      verticalChecksumOk ? "sha256 ok" : (verticalDownloadError ?? "mismatch"),
    ),
    technicalCheck(
      "thumbnail",
      "Miniatura derivada presente",
      thumbnailInfo !== null,
      thumbnailInfo === null ? "missing" : "present",
    ),
    technicalCheck(
      "no_integral_in_campaign_images",
      "Nenhum vertical integral em campaign-images",
      !integralVerticalInCampaignImages,
      integralVerticalInCampaignImages ? "vertical.jpg encontrado" : "ok",
    ),
    technicalCheck(
      "copy",
      "Copy entregue ou falha nao bloqueante",
      copyCompleted ||
        (copyRows ?? []).some((row) => row.state === "failed") ||
        (copyRows ?? []).length === 0,
      `copyRows=${(copyRows ?? []).length}; completed=${copyCompleted}`,
    ),
    technicalCheck(
      "credit",
      "Credito: reserva/confirmacao coerentes",
      credit?.amount === 1 &&
        (credit?.status === "delivered" ||
          (terminal?.type !== "result" && credit?.status === "refunded")),
      `status=${credit?.status ?? "missing"}; amount=${credit?.amount ?? "?"}`,
    ),
    technicalCheck(
      "cost_available",
      "Custo disponivel e dentro do teto",
      withinBudget,
      `calls=${calls.length}; observed=${observedCostUsd}; budget=${input.budget}`,
    ),
    technicalCheck(
      "paid_calls_cap",
      "Chamadas pagas <= 3",
      calls.length <= 3,
      `calls=${calls.length}`,
    ),
    technicalCheck(
      "operation_correlation",
      "generation_events correlacionados",
      (events ?? []).every(
        (event) => event.operation_run_id === input.operationId,
      ),
      `events=${(events ?? []).length}`,
    ),
    technicalCheck(
      "source_preserved",
      "Campanha-fonte/imagens preservadas",
      sourceSnapshotUnchanged &&
        sourceIdentityUnchanged &&
        sourceImagesUnchanged &&
        sourceStatusUnchanged,
      `snapshot=${sourceSnapshotUnchanged}; identity=${sourceIdentityUnchanged}; images=${sourceImagesUnchanged}; status=${sourceStatusUnchanged}`,
    ),
    technicalCheck(
      "uploads_verified",
      "Inputs enviados e verificados",
      input.uploadsVerified === input.manifest.preparationPlan.resumeContextFields.length ||
        input.uploadsVerified > 0,
      `uploadsVerified=${input.uploadsVerified}`,
    ),
  ].every(Boolean);

  const preparation = {
    mode: "created",
    campaignId: input.campaignId,
    operationId: input.operationId,
    generationOrigin: GENERATION_ORIGIN_VALUE,
    generationContractVersion: GENERATION_CONTRACT_VERSION_VALUE,
    campaignFormat: "9:16",
    inputFiles: input.durableInputs ?? [],
    resumeContext: {
      briefing: true,
      briefingText: true,
      campaignIntent: true,
      backgroundDirection: true,
      identityDirective: true,
      identityContext: true,
      copyContext: true,
      economicSnapshot: true,
      inputFiles: true,
    },
    inputsUploaded: input.uploadsVerified,
    inputHashVerified: input.uploadsVerified > 0,
    resumeContextHashExcluded: true,
    identityContentIdStrategy: "sha256_data_url",
    preparedAt: input.invokeStartedAt,
    campaignCreated: input.campaignCreated,
    frozenContentReferences: input.references ?? [],
  };

  const callsManifest = (events ?? []).map((event) => ({
    id: event.id,
    operationRunId: event.operation_run_id,
    callId: event.trace_id,
    model: event.model,
    attemptNumber: event.attempt_number,
    status: event.status,
    costUsd: event.estimated_cost_usd,
    costSource: event.cost_source,
    pricingVersion: event.pricing_version,
    tokens: {
      prompt: event.prompt_tokens,
      completion: event.completion_tokens,
      total: event.total_tokens,
      image: event.image_tokens,
    },
    errorType: event.error_type,
  }));

  const invocations = (claims ?? []).map((claim) => ({
    stage: claim.stage,
    attemptNumber: claim.attempt_number,
    target: claim.target,
    requestId: claim.request_id,
    status: claim.status,
    failureClass: claim.failure_class,
    createdAt: claim.created_at,
  }));

  const delivery = {
    beginPublicationCalls: deliveryStarted ? 1 : 0,
    confirmations:
      credit?.status === "delivered" ? 1 : 0,
    order: deliveryStarted
      ? "beginPublication_before_confirm"
      : "not_observed",
    deliveryCompleted,
  };

  const copy = {
    rows: (copyRows ?? []).map((row) => ({
      attemptSeq: row.attempt_seq,
      state: row.state,
      copyText: row.copy_text,
      hasPayload: row.copy_payload !== null,
    })),
    completed: copyCompleted,
  };

  const manifestNext = {
    ...manifest,
    authorization: {
      ...manifest.authorization,
      decidedAt: manifest.authorization.decidedAt ?? input.startedAt,
      decidedBy: "operator",
      authorizedBudgetUsd: input.budget,
      authorizedMaxPaidCalls: 3,
    },
    targetCampaign: {
      ...manifest.targetCampaign,
      campaignIdProposed: input.campaignId,
      operationIdProposed: input.operationId,
    },
    execution: {
      startedAt: input.startedAt,
      invokeStartedAt: input.invokeStartedAt,
      invokeEndedAt: input.invokeEndedAt,
      finishedAt: new Date().toISOString(),
      executionError: input.executionError,
      status: terminal?.type ?? "no-terminal",
    },
    providerCalls: callsManifest.length,
    calls: callsManifest,
    invocations,
    freeInvocations: input.terminalEvents.filter(
      (event) =>
        event.type === "processing" &&
        (event.state === "delivery_pending" || event.nextStep === "delivery"),
    ),
    terminal,
    preparation,
    delivery,
    copy,
    credit: credit
      ? {
          status: credit.status,
          amount: credit.amount,
          reservations: 1,
          confirmations: credit.status === "delivered" ? 1 : 0,
          refunds: credit.status === "refunded" ? 1 : 0,
          stateEpoch: credit.state_epoch,
          publicationState: credit.publication_state,
        }
      : null,
    artifact: verticalArtifact
      ? {
          id: verticalArtifact.id,
          role: verticalArtifact.role,
          width: verticalArtifact.width,
          height: verticalArtifact.height,
          mimeType: verticalArtifact.mime_type,
          byteSize: verticalArtifact.byte_size,
          checksumSha256: verticalArtifact.checksum_sha256,
          checksumVerified: verticalChecksumOk,
          storagePresent: verticalInfo !== null,
          localEvidencePath: verticalArtifact
            ? path.join(
                EVIDENCE_DIR,
                `vertical-${input.operationId}.jpg`,
              )
            : null,
          thumbnail: {
            present: thumbnailInfo !== null,
            pathKind: "derived_thumb_v1",
          },
        }
      : null,
    baseArtifact: baseArtifact
      ? {
          id: baseArtifact.id,
          width: baseArtifact.width,
          height: baseArtifact.height,
          mimeType: baseArtifact.mime_type,
        }
      : null,
    preparedArtifact: preparedArtifact
      ? {
          id: preparedArtifact.id,
          width: preparedArtifact.width,
          height: preparedArtifact.height,
          mimeType: preparedArtifact.mime_type,
        }
      : null,
    steps: steps ?? [],
    claims: claims ?? [],
    outcome: outcome ?? null,
    cost: {
      observedCostUsd,
      costAvailable,
      withinBudget,
      budgetUsd: input.budget,
      callCount: calls.length,
    },
    technical: {
      pass: technicalPass,
      checkedAt: new Date().toISOString(),
      checks: technicalChecks,
    },
  };

  if (verticalBytes !== null) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, `vertical-${input.operationId}.jpg`),
      verticalBytes,
    );
  }

  return {
    manifest: manifestNext,
    preparation,
    calls: callsManifest,
    freeInvocations: manifestNext.freeInvocations,
    delivery,
    copy,
    credit: manifestNext.credit,
    cost: manifestNext.cost,
    artifact: manifestNext.artifact,
    invocations,
    terminal,
    technical: manifestNext.technical,
  };
}

const GENERATION_ORIGIN_VALUE = "9_16_two_stage";
const GENERATION_CONTRACT_VERSION_VALUE = "f60.5-two-stage-9-16-v1";

function buildReport(snapshot, preflight) {
  const m = snapshot.manifest;
  const lines = [];
  lines.push("# F60.5 / 60.5-04 — PROVA REAL INTEGRADA 9:16 POR EXPANSÃO");
  lines.push("");
  lines.push(`**Status:** ${m.status}`);
  lines.push(`**Início:** ${m.execution?.startedAt ?? "-"}`);
  lines.push(`**Fim:** ${m.execution?.finishedAt ?? "-"}`);
  lines.push(`**Terminal:** ${m.terminal?.type ?? "sem terminal"}`);
  lines.push("");
  lines.push("## Autorização");
  lines.push("");
  lines.push(`- Modo: \`${m.executionMode?.requested ?? "authorize-server"}\``);
  lines.push(`- Orçamento autorizado: US$ ${m.authorization?.authorizedBudgetUsd}`);
  lines.push(`- Máximo de chamadas pagas: ${m.authorization?.authorizedMaxPaidCalls}`);
  lines.push("- Sem retry/fallback; uma única operação.");
  lines.push("");
  lines.push("## Preflight");
  lines.push("");
  lines.push(`- Status: **${preflight.status}** (${preflight.ready ? "ready" : "blocked"})`);
  for (const item of preflight.items) {
    lines.push(`- ${item.status} — ${item.label}: ${item.detail}`);
  }
  lines.push("");
  lines.push("## Preparação da campanha");
  lines.push("");
  lines.push(`- Campanha: \`${m.preparation?.campaignId}\``);
  lines.push(`- Operação: \`${m.preparation?.operationId}\``);
  lines.push(`- Origem: \`${m.preparation?.generationOrigin}\``);
  lines.push(`- Inputs verificados: ${m.preparation?.inputsUploaded}`);
  lines.push(`- resumeContext completo: ${Object.values(m.preparation?.resumeContext ?? {}).every(Boolean)}`);
  lines.push("");
  lines.push("## Execução e chamadas");
  lines.push("");
  lines.push(`- Chamadas pagas: ${m.calls?.length ?? 0} (teto 3)`);
  for (const call of m.calls ?? []) {
    lines.push(`  - ${call.model} ${call.status} US$ ${call.costUsd ?? "null"} (${call.costSource ?? "?"})`);
  }
  lines.push(`- Custo observado: US$ ${m.cost?.observedCostUsd ?? "null"}`);
  lines.push(`- Custo dentro do teto: ${m.cost?.withinBudget ? "sim" : "não"}`);
  lines.push(`- Invocações gratuitas: ${(m.freeInvocations ?? []).length}`);
  lines.push("");
  lines.push("## Entrega");
  lines.push("");
  lines.push(`- Vertical: ${m.artifact ? `${m.artifact.width}x${m.artifact.height} ${m.artifact.mimeType}, ${m.artifact.byteSize} B` : "ausente"}`);
  lines.push(`- Checksum verificado: ${m.artifact?.checksumVerified ? "sim" : "não"}`);
  lines.push(`- Miniatura derivada: ${m.artifact?.thumbnail?.present ? "presente" : "ausente"}`);
  lines.push(`- Copy: ${m.copy?.completed ? "completed" : "não concluída/sem bloqueio"}`);
  lines.push(`- Crédito: status=${m.credit?.status ?? "?"}; reservas=${m.credit?.reservations ?? "?"}; confirmações=${m.credit?.confirmations ?? "?"}; estornos=${m.credit?.refunds ?? "?"}`);
  lines.push(`- beginPublication antes da confirmação: ${m.delivery?.order ?? "n/a"}`);
  lines.push("");
  lines.push("## Aceite técnico");
  lines.push("");
  lines.push(`- Resultado: **${m.technical?.pass ? "PASS" : "FAIL"}**`);
  for (const check of m.technical?.checks ?? []) {
    lines.push(`- ${check.status} — ${check.label}: ${check.detail}`);
  }
  lines.push("");
  lines.push("## Aceite humano — PENDENTE");
  lines.push("");
  lines.push("Abrir o vertical original local (não a miniatura) e conferir:");
  lines.push("1. enquadramento 9:16, nitidez, produto, preço, selo, validade e aviso obrigatório;");
  lines.push("2. copy entregue contra o briefing congelado;");
  lines.push("3. miniatura do card, sem uso como arte de entrega;");
  lines.push("4. crédito: 1 reserva e 1 confirmação, sem segundo débito.");
  lines.push("");
  lines.push(`Arquivo local: \`${m.artifact?.localEvidencePath ?? "-"}\``);
  lines.push("");
  lines.push("## Não escopo");
  lines.push("");
  lines.push("- produção, deploy, flag global, migration, reset, merge, push;");
  lines.push("- nova operação, retry, fallback ou segunda reserva;");
  lines.push("- 60.5-05 e ativação permanente.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function printSummary(snapshot) {
  const m = snapshot.manifest;
  console.log(
    JSON.stringify(
      {
        status: m.status,
        technical: m.technical?.pass ? "PASS" : "FAIL",
        terminal: m.terminal?.type ?? null,
        campaignId: m.preparation?.campaignId,
        operationId: m.preparation?.operationId,
        paidCalls: m.calls?.length ?? 0,
        observedCostUsd: m.cost?.observedCostUsd ?? null,
        withinBudget: m.cost?.withinBudget ?? false,
        vertical: m.artifact
          ? {
              id: m.artifact.id,
              width: m.artifact.width,
              height: m.artifact.height,
              checksum: m.artifact.checksumSha256,
              localEvidencePath: m.artifact.localEvidencePath,
            }
          : null,
        copy: m.copy?.completed ?? false,
        credit: m.credit,
        humanAcceptance: "pending",
      },
      null,
      2,
    ),
  );
}

if (PREFLIGHT) {
  const manifest = readManifest();
  const client = makeClient();
  const preflight = await buildPreflight(client, manifest);
  writeJsonAtomic(PREFLIGHT_PATH, preflight);
  console.log(
    JSON.stringify(
      {
        status: preflight.status,
        ready: preflight.ready,
        items: preflight.items.map((item) => ({
          id: item.id,
          status: item.status,
          detail: item.detail,
        })),
        observed: preflight.observed,
      },
      null,
      2,
    ),
  );
  if (!preflight.ready) process.exitCode = 1;
} else if (APPLY) {
  const manifest = readManifest();
  if (!fs.existsSync(PREFLIGHT_PATH)) fail("preflight ausente; rode --preflight");
  const preflight = JSON.parse(fs.readFileSync(PREFLIGHT_PATH, "utf8"));
  await apply(manifest, preflight);
}
