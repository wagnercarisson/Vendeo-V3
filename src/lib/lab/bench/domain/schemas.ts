import { z } from "zod";
import { validateBenchIntentPrice } from "./intent-price-matrix";

/**
 * Schemas puros do domínio da **bancada de geração** (F48.2.2, D6/D9/D13).
 *
 * Módulo **puro** — sem dependência de servidor, sem I/O, sem `process.env` e sem
 * importar o client administrativo do Supabase. Importável por testes, pela API
 * administrativa e pela UI.
 *
 * ## Autoridade dos valores
 *
 * Nenhuma dimensão é validada por enum aqui: a autoridade dos valores é o
 * registry em código (`config-registry.ts`, D6) e o registry de presets
 * (`preset-registry.ts`, D7). Este módulo só garante a **forma** dos dados.
 *
 * ## Ciclo de vida do run
 *
 * O run nasce em `draft` (preparação/upload) — que **não** ocupa o slot global de
 * geração ativa — e progride `draft → pending → running → succeeded | failed |
 * cancelled | timeout` (D10).
 */

// ─── Status do run (ciclo de vida da bancada) ────────────────────────────────

export const BENCH_RUN_STATUSES = [
  "draft",
  "pending",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "timeout",
] as const;

export type BenchRunStatus = (typeof BENCH_RUN_STATUSES)[number];

/** Estado inicial obrigatório: preparação/upload, **fora** do slot global (D10). */
export const BENCH_INITIAL_RUN_STATUS: BenchRunStatus = "draft";

/** Estados que ocupam o slot global de geração ativa (índice parcial global). */
export const BENCH_ACTIVE_RUN_STATUSES = ["pending", "running"] as const;

export const BenchRunStatusSchema = z.enum(BENCH_RUN_STATUSES);

// ─── Dimensões de configuração (D6) ──────────────────────────────────────────

/**
 * As oito dimensões independentes da bancada. `modelo` e `qualidade` são
 * governados pelo registry de presets (D7); as demais pelo registry de dimensões
 * (D6). Aqui modelamos apenas a forma (strings).
 */
export const BenchDimensionsSchema = z
  .object({
    pipeline: z.string().min(1),
    formato: z.string().min(1),
    modelo: z.string().min(1),
    qualidade: z.string().min(1),
    intencao: z.string().min(1),
    tipoConteudo: z.string().min(1),
    estrutura: z.string().min(1),
    tema: z.string().min(1),
  })
  .strict();

export type BenchDimensions = z.infer<typeof BenchDimensionsSchema>;

/** Configuração resolvida (as oito dimensões resolvidas). */
export const BenchConfigSchema = z
  .object({
    pipeline: z.string().min(1),
    formato: z.string().min(1),
    modelo: z.string().min(1),
    qualidade: z.string().min(1),
    intencao: z.string().min(1),
    tipoConteudo: z.string().min(1),
    estrutura: z.string().min(1),
    tema: z.string().min(1),
  })
  .strict();

export type BenchConfig = z.infer<typeof BenchConfigSchema>;

// ─── Formulário mínimo de produto/oferta (D-snapshot) ────────────────────────

/**
 * Produto — contrato FIEL ao formulário produtivo (F48.2.3, D14): nome `max(60)`
 * e descrição `max(120)` (mesmos limites do produtivo) e as **informações
 * obrigatórias na arte** `max(200)`. `preserveImageContext` é o campo
 * "Preservar imagem original" (disponível apenas em Destaque/Exclusivo e limpo ao
 * mudar para Oferta). Nenhum campo produtivo novo é inventado.
 */
export const BenchProductSchema = z
  .object({
    name: z.string().min(1).max(60),
    priceCents: z.number().int().min(0).optional(),
    originalPriceCents: z.number().int().min(0).optional(),
    description: z.string().max(120).optional(),
    /** Informações obrigatórias na arte — mesmo limite produtivo (200). */
    mandatoryArtworkText: z.string().max(200).optional(),
  })
  .strict();

export type BenchProduct = z.infer<typeof BenchProductSchema>;

/** Campos livres editáveis pelo operador e cobertos pela integridade textual (F48.2.5). */
export const BENCH_TEXT_INTEGRITY_FIELDS = [
  "product.name",
  "product.description",
  "product.mandatoryArtworkText",
  "promptBase",
] as const;

export const BenchTextIntegrityFieldSchema = z.enum(BENCH_TEXT_INTEGRITY_FIELDS);
export type BenchTextIntegrityField = z.infer<typeof BenchTextIntegrityFieldSchema>;

export const BenchTextIntegrityPairSchema = z
  .object({
    field: BenchTextIntegrityFieldSchema,
    value: z.string(),
  })
  .strict();

export type BenchTextIntegrityPair = z.infer<typeof BenchTextIntegrityPairSchema>;

export const BenchTextIntegrityAlertSchema = z
  .object({
    field: BenchTextIntegrityFieldSchema,
    excerpt: z.string(),
    reason: z.string().min(1),
    ruleId: z.string().min(1),
  })
  .strict();

export type BenchTextIntegrityAlert = z.infer<typeof BenchTextIntegrityAlertSchema>;

export const BenchTextIntegrityDecisionSchema = z.enum(["no_alerts", "keep_exactly"]);

export const BenchTextIntegrityEvidenceSchema = z
  .object({
    policyVersion: z.string().min(1),
    reviewRevision: z.string().regex(/^[0-9a-f]{64}$/i),
    decision: BenchTextIntegrityDecisionSchema,
  })
  .strict();

export type BenchTextIntegrityEvidence = z.infer<typeof BenchTextIntegrityEvidenceSchema>;

/**
 * Oferta — contrato FIEL ao formulário produtivo (F48.2.3, D14): validade, selo,
 * intenção e aviso ilustrativo usados pela paridade. **Não** há texto manual de
 * oferta (UAT): os preços + selo + validade representam as condições comerciais.
 */
export const BenchOfferSchema = z
  .object({
    backgroundDirection: z.enum(["studio", "ambient", "original"]).optional(),
    validUntil: z.string().max(80).optional(),
    /** Selo promocional — opções por intenção (obrigatório em oferta). */
    badge: z.string().max(80).optional(),
    /** Intenção da campanha (offer/spotlight/exclusive). */
    campaignIntent: z.enum(["offer", "spotlight", "exclusive"]).optional(),
    /** Texto de exibição da validade resolvido (D13). */
    validity: z.string().max(200).optional(),
    /** Aviso "Imagem meramente ilustrativa" (padrão ligado no produtivo). */
    showIllustrativeNotice: z.boolean().optional(),
  })
  .strict();

export type BenchOffer = z.infer<typeof BenchOfferSchema>;

// ─── Snapshot de branding (contrato local completo — inclui tipografia) ──────

export const BenchBrandingAssetSchema = z
  .object({
    assetType: z.string().min(1),
    variantType: z.string().min(1),
    storagePath: z.string().min(1),
    mimeType: z.string().min(1),
    width: z.number().int().min(0),
    height: z.number().int().min(0),
    sizeBytes: z.number().int().min(0),
    checksum: z.string().min(1),
    signedUrl: z.string().nullable(),
  })
  .strict();

export type BenchBrandingAsset = z.infer<typeof BenchBrandingAssetSchema>;

/**
 * Descritor canônico da identidade resolvida (F48.2.3). Contém **apenas** o tipo,
 * a variante e o `storagePath` — **nunca** a URL assinada (o snapshot persistido
 * não carrega URLs efêmeras). A URL assinada vive só no contrato transitório da API.
 */
export const BenchIdentityReferenceSchema = z
  .object({
    kind: z.enum(["logo", "visual_signature"]),
    variantType: z.string().nullable(),
    storagePath: z.string().min(1),
  })
  .strict();

export type BenchIdentityReference = z.infer<typeof BenchIdentityReferenceSchema>;

/**
 * Contrato local **completo** de branding (D3). Fecha a lacuna de
 * `typography_direction` que hoje não chega ao snapshot de campanha, **sem**
 * alterar o pipeline produtivo. Logo/assinatura são **apenas exibidos/registrados**
 * nesta fase (não são enviados automaticamente ao modelo).
 */
export const BenchBrandingSnapshotSchema = z
  .object({
    storeId: z.string().uuid(),
    storeName: z.string().min(1),
    segment: z.string().min(1),
    subsegment: z.string().nullable(),
    toneOfVoice: z.string().nullable(),
    positioning: z.string().nullable(),
    shortDescription: z.string().nullable(),
    slogan: z.string().nullable(),
    /** Direção tipográfica — campo que o snapshot de campanha produtivo omite (D3). */
    typographyDirection: z.string().nullable(),
    safeColorTokens: z.record(z.string(), z.string()),
    brandColorsChosen: z.array(z.string().nullable()),
    /** Cor principal inferida (`inferred_primary_color`) — usada só em `text_only`. */
    inferredPrimaryColor: z.string().nullable(),
    /** `stores.brand_color` — penúltimo degrau da precedência cromática produtiva. */
    storeBrandColor: z.string().nullable(),
    /** `brandColor` resolvido pela precedência produtiva exata (D16). */
    brandColor: z.string().min(1),
    logoColorsDetected: z.array(z.string()),
    visualStyle: z.string().nullable(),
    visualTone: z.string().nullable(),
    brandPersonality: z.string().nullable(),
    campaignGuidelines: z.string().nullable(),
    campaignBrief: z.string().nullable(),
    profileSource: z.string().nullable(),
    profileStatus: z.string().nullable(),
    logoUrl: z.string().nullable(),
    signatureUrl: z.string().nullable(),
    /** Estado real da loja (`stores.identity_state`) — fonte de verdade da identidade. */
    identityState: z.enum(["text_only", "logo", "visual_signature"]),
    /** Descritor selecionado pelo estado — sem URL assinada. */
    identityReference: BenchIdentityReferenceSchema.nullable(),
    /** Motivo da resolução (seleção ou ausência/falha). */
    identityReason: z.string().min(1),
    assets: z.array(BenchBrandingAssetSchema),
  })
  .strict();

export type BenchBrandingSnapshot = z.infer<typeof BenchBrandingSnapshotSchema>;

// ─── Entrada de execução do run (confirmação) ────────────────────────────────

const BENCH_REFERENCE_PREFIX = "bench/";

/**
 * Referências de imagem aceitas são **apenas** paths locais do bucket
 * `lab-artifacts` no esquema `bench/{runId}/inputs/...`, usando o **mesmo**
 * `runId` do payload. Qualquer outro path é recusado antes de qualquer chamada
 * paga (o bucket remoto `campaign-images` nunca é lido/reutilizado).
 */
function isBenchInputReference(reference: string, runId: string): boolean {
  if (reference.includes("..") || reference.includes("\\") || reference.includes("://")) {
    return false;
  }
  const prefix = `${BENCH_REFERENCE_PREFIX}${runId}/inputs/`;
  if (!reference.startsWith(prefix)) return false;
  const rest = reference.slice(prefix.length);
  return rest.length > 0 && !rest.startsWith("/") && !rest.includes("//");
}

/**
 * Evidência mínima do preflight do prompt (F48.2.3, D20; estendida na F48.2.4,
 * D2/D6/D10/D11/D14). Reusa `prompt_sent` e `campaign_snapshot`; NÃO cria tabela
 * de versões, histórico de rascunhos, novo estado do run, hashes persistidos nem
 * infraestrutura de assinatura. `promptApproved` é o prompt final aprovado e é
 * gravado idêntico a `prompt_sent`.
 *
 * Campos da F48.2.4 (opcionais para preservar o comportamento de
 * `BenchRunInputSchema` e a compatibilidade dos consumidores atuais): versões das
 * políticas, versão do prompt-base PADRÃO e referência canônica da identidade (sem
 * URL assinada).
 *
 * **Correção de UAT (separação aprovação ↔ execução):** `presetId` e a configuração
 * de execução (`modelo`/`qualidade`) **não** integram a evidência do preflight —
 * não participam da composição textual e são validados/persistidos separadamente
 * como configuração de execução do run. Trocar de preset/modelo/qualidade reutiliza
 * o mesmo prompt aprovado byte a byte.
 */
export const BenchPreflightEvidenceSchema = z
  .object({
    /** Prompt-base manual fornecido pelo operador (preservado integralmente). */
    promptBase: z.string(),
    /** Prompt originalmente compilado pelo compositor determinístico. */
    promptCompiled: z.string(),
    /** Prompt final editado e aprovado pelo operador. */
    promptApproved: z.string().min(1),
    /** Blocos canônicos utilizados (nome do bloco → conteúdo). */
    promptBlocks: z.record(z.string(), z.string()),
    /** Versão estática do compositor (evidência). */
    composerVersion: z.string().min(1),
    /** Versões resolvidas das políticas por dimensão (F48.2.4, D2/D14). */
    policyVersions: z.record(z.string(), z.string()).optional(),
    /** Versão do prompt-base PADRÃO resolvido por configuração (F48.2.4, D6/D14). */
    promptBaseVersion: z.string().min(1).optional(),
    /** Referência canônica da identidade — sem URL assinada (F48.2.4, D10/D14). */
    identityReference: BenchIdentityReferenceSchema.nullable().optional(),
    /** Revisão textual efêmera validada em /compose e revalidada em /runs. */
    textIntegrityEvidence: BenchTextIntegrityEvidenceSchema.optional(),
  })
  .strict();

export type BenchPreflightEvidence = z.infer<typeof BenchPreflightEvidenceSchema>;

export const BenchRunInputSchema = z
  .object({
    /** Idempotência: reenvio devolve o run existente, sem nova chamada paga (D10). */
    operationId: z.string().uuid(),
    /** Run em `draft` criado pela rota de upload (plano 06). */
    runId: z.string().uuid(),
    storeId: z.string().uuid(),
    presetId: z.string().min(1),
    prompt: z.string().min(1),
    references: z.array(z.string().min(1)),
    /** Confirmação explícita obrigatória antes de qualquer geração paga (D12). */
    confirmed: z.literal(true),
    product: BenchProductSchema,
    offer: BenchOfferSchema,
    /** Evidência mínima do preflight aprovado (F48.2.3, D20). */
    preflight: BenchPreflightEvidenceSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const intent = value.offer.campaignIntent ?? "offer";
    const priceValidation = validateBenchIntentPrice(
      value.product.originalPriceCents,
      value.product.priceCents,
      intent,
    );
    if (!priceValidation.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["offer", "campaignIntent"],
        message: priceValidation.error,
      });
    }
    if (intent !== "offer" && (value.offer.validUntil !== undefined || value.offer.validity !== undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["offer", "validity"],
        message: "bench_validity_only_allowed_for_offer",
      });
    }
    if (!value.offer.backgroundDirection) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["offer", "backgroundDirection"], message: "bench_background_direction_required" });
    } else if (value.offer.backgroundDirection === "original" && value.references.length !== 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["offer", "backgroundDirection"], message: "bench_original_background_requires_exactly_one_product_reference" });
    }
    value.references.forEach((reference, index) => {
      if (!isBenchInputReference(reference, value.runId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["references", index],
          message: "invalid_bench_reference_path",
        });
      }
    });
  });

export type BenchRunInput = z.infer<typeof BenchRunInputSchema>;

// ─── Parsing (serializa os issues no padrão do analog) ───────────────────────

function serializeIssues(issues: z.ZodIssue[]): string {
  return JSON.stringify(issues.map((issue) => ({ path: issue.path, message: issue.message })));
}

/** Valida a entrada de execução da bancada; falha ⇒ `Error` com os issues. */
export function parseBenchRunInput(input: unknown): BenchRunInput {
  const result = BenchRunInputSchema.safeParse(input);
  if (result.success) return result.data;
  throw new Error(`Entrada da bancada inválida: ${serializeIssues(result.error.issues)}`);
}

/** Valida a configuração resolvida da bancada; falha ⇒ `Error` com os issues. */
export function parseBenchConfig(input: unknown): BenchConfig {
  const result = BenchConfigSchema.safeParse(input);
  if (result.success) return result.data;
  throw new Error(`Configuração da bancada inválida: ${serializeIssues(result.error.issues)}`);
}
