import { z } from "zod";

/**
 * Schema dos cenários controlados do Laboratório de IA (F48.1, D4).
 *
 * O cenário é um brief **fictício ou explicitamente autorizado**, com imagens de
 * produto controladas e identidade de loja inventada. Nenhum dado real de lojista
 * é usado (spec `lab-scenarios`).
 *
 * Módulo **puro** — sem `server-only`, sem I/O e sem `process.env`. Importável por
 * testes, pela UI de cenários e pelo serviço de bootstrap.
 *
 * ## Extensibilidade × modalidades suportadas
 *
 * As uniões (`SCENARIO_INTENTS`/`SCENARIO_FORMATS`/`SCENARIO_LOCALES`/
 * `SCENARIO_MEDIA_KINDS`) já preveem modalidades futuras (serviços, informativos,
 * 9:16, carrossel, i18n), mas `SUPPORTED_SCENARIO_MODES` aceita **somente**
 * `offer`/`1:1`/`pt-BR` nesta fase. Qualquer valor fora disso é rejeitado com o
 * código determinístico `unsupported_scenario_mode` no campo correspondente —
 * nenhum run pode ser iniciado com uma modalidade ainda não implementada.
 */

// ─── Uniões extensíveis (modalidades previstas) ──────────────────────────────

export const SCENARIO_INTENTS = [
  "offer",
  "spotlight",
  "exclusive",
  "service",
  "informative",
] as const;

export const SCENARIO_FORMATS = ["1:1", "9:16", "carousel"] as const;

export const SCENARIO_LOCALES = ["pt-BR", "en-US", "es-ES"] as const;

export const SCENARIO_MEDIA_KINDS = ["image"] as const;

export type ScenarioIntent = (typeof SCENARIO_INTENTS)[number];
export type ScenarioFormat = (typeof SCENARIO_FORMATS)[number];
export type ScenarioLocale = (typeof SCENARIO_LOCALES)[number];
export type ScenarioMediaKind = (typeof SCENARIO_MEDIA_KINDS)[number];

/** Campos de modalidade validados contra o conjunto suportado na F48.1. */
export type ScenarioModeField = "intent" | "format" | "locale";

// ─── Modalidades efetivamente suportadas na F48.1 ────────────────────────────

/**
 * Único conjunto de modalidades executável nesta fase. O schema conhece mais
 * valores (uniões acima) do que o laboratório sabe executar — a diferença é
 * exatamente o que `unsupported_scenario_mode` sinaliza.
 */
export const SUPPORTED_SCENARIO_MODES = {
  intents: ["offer"],
  formats: ["1:1"],
  locales: ["pt-BR"],
} as const;

const SUPPORTED_INTENTS: ReadonlySet<string> = new Set(SUPPORTED_SCENARIO_MODES.intents);
const SUPPORTED_FORMATS: ReadonlySet<string> = new Set(SUPPORTED_SCENARIO_MODES.formats);
const SUPPORTED_LOCALES: ReadonlySet<string> = new Set(SUPPORTED_SCENARIO_MODES.locales);

/** Whitelist de slug — sem `..`, sem `/`, sem maiúsculas (proteção de path). */
export const SCENARIO_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// ─── Erro determinístico de modalidade não suportada ─────────────────────────

/**
 * Lançado quando o cenário declara `intent`/`format`/`locale` fora do conjunto
 * suportado nesta fase. Carrega o campo culpado para que o chamador possa
 * recusar a execução sem ambiguidade.
 */
export class UnsupportedScenarioModeError extends Error {
  readonly code = "unsupported_scenario_mode" as const;
  readonly field: ScenarioModeField;
  readonly value: string;

  constructor(field: ScenarioModeField, value: string) {
    super(`Modalidade de cenário não suportada em '${field}': ${value}`);
    this.name = "UnsupportedScenarioModeError";
    this.field = field;
    this.value = value;
  }
}

// ─── Blocos do conteúdo ──────────────────────────────────────────────────────

const productSchema = z
  .object({
    name: z.string().min(1),
    brand: z.string().min(1).optional(),
    sizeOrVariant: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
  })
  .strict();

const offerSchema = z
  .object({
    originalPriceCents: z.number().int().nonnegative().optional(),
    discountedPriceCents: z.number().int().positive().optional(),
    badgeText: z.string().min(1).optional(),
    validityText: z.string().min(1).optional(),
    availabilityNotes: z.string().min(1).optional(),
    campaignDetails: z.string().min(1).optional(),
    additionalDetails: z.string().min(1).optional(),
    hook: z.string().min(1).optional(),
    cta: z.string().min(1).optional(),
    objective: z.string().min(1).optional(),
    targetChannel: z.string().min(1).optional(),
  })
  .strict();

const legalNoticeSchema = z
  .object({
    /** Texto obrigatório do lojista (vai para `mandatoryArtworkText`). */
    mandatoryText: z.string().min(1).optional(),
    /** Liga o aviso ilustrativo canônico do produto. */
    illustrativeNoticeEnabled: z.boolean().optional(),
  })
  .strict();

const creativeContextSchema = z
  .object({
    preserveImageContext: z.boolean().optional(),
    sensitiveConstraints: z.string().min(1).optional(),
  })
  .strict();

const briefSchema = z
  .object({
    product: productSchema,
    offer: offerSchema,
    legalNotice: legalNoticeSchema.optional(),
    creativeContext: creativeContextSchema.optional(),
  })
  .strict();

const storeSchema = z
  .object({
    name: z.string().min(1),
    segment: z.string().min(1),
    brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  })
  .strict();

/**
 * Identidade fictícia da loja. `text_only` é o padrão; `logo` exige o caminho do
 * logo controlado (relativo ao diretório do cenário). `visual_signature` fica
 * fora da F48.1.
 */
const identitySchema = z.union([
  z.object({ state: z.literal("text_only") }).strict(),
  z
    .object({
      state: z.literal("logo"),
      logoPath: z.string().min(1),
    })
    .strict(),
]);

const scenarioImageSchema = z
  .object({
    id: z.string().min(1),
    role: z.enum(["primary", "reference"]),
    /** Caminho relativo ao diretório do cenário (ex.: `images/produto.jpg`). */
    path: z.string().min(1),
    alt: z.string().optional(),
  })
  .strict();

// ─── Conteúdo do cenário ─────────────────────────────────────────────────────

export const LabScenarioContentSchema = z
  .object({
    slug: z.string().regex(SCENARIO_SLUG_PATTERN),
    name: z.string().min(1),
    description: z.string().optional(),
    intent: z.enum(SCENARIO_INTENTS),
    format: z.enum(SCENARIO_FORMATS),
    locale: z.enum(SCENARIO_LOCALES),
    mediaKinds: z.array(z.enum(SCENARIO_MEDIA_KINDS)).min(1),
    brief: briefSchema,
    store: storeSchema,
    identity: identitySchema,
    images: z.array(scenarioImageSchema).min(1),
    /** Trava explícita: dados fictícios (ou autorizados) — nunca lojista real. */
    fictitious: z.literal(true),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!SUPPORTED_INTENTS.has(value.intent)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["intent"],
        message: "unsupported_scenario_mode",
      });
    }
    if (!SUPPORTED_FORMATS.has(value.format)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["format"],
        message: "unsupported_scenario_mode",
      });
    }
    if (!SUPPORTED_LOCALES.has(value.locale)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["locale"],
        message: "unsupported_scenario_mode",
      });
    }

    const primaryImages = value.images.filter((image) => image.role === "primary").length;
    if (primaryImages !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["images"],
        message: "exactly_one_primary_image",
      });
    }
  });

export type LabScenarioContent = z.infer<typeof LabScenarioContentSchema>;

// ─── Parsing ─────────────────────────────────────────────────────────────────

function readModeValue(input: unknown, field: ScenarioModeField): string {
  if (typeof input !== "object" || input === null) return "";
  const value = (input as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
}

/**
 * Valida e devolve o conteúdo do cenário.
 *
 * - Modalidade não suportada ⇒ `UnsupportedScenarioModeError` (com `code` e `field`).
 * - Qualquer outra falha ⇒ `Error` com a serialização dos issues (path + message).
 *   A mensagem **nunca** inclui o conteúdo bruto das imagens.
 */
export function parseLabScenarioContent(input: unknown): LabScenarioContent {
  const result = LabScenarioContentSchema.safeParse(input);
  if (result.success) return result.data;

  const issues = result.error.issues;
  const modeIssue = issues.find((issue) => issue.message === "unsupported_scenario_mode");
  if (modeIssue) {
    const field = modeIssue.path[0];
    if (field === "intent" || field === "format" || field === "locale") {
      throw new UnsupportedScenarioModeError(field, readModeValue(input, field));
    }
  }

  const serialized = JSON.stringify(
    issues.map((issue) => ({ path: issue.path, message: issue.message })),
  );
  throw new Error(`Cenário de laboratório inválido: ${serialized}`);
}
