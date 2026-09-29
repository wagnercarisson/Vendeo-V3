import { BADGE_OPTIONS_BY_INTENT } from "@/lib/constants";
import { ILLUSTRATIVE_NOTICE_TEXT } from "@/lib/campaign/constants";
import { MAX_CAMPAIGN_IMAGES } from "@/lib/image-generation/config";
import { formatCurrencyBRL, parseCurrencyBRL } from "@/lib/formatters";
import type { CampaignIntent } from "@/lib/campaign/types";

/**
 * Regras puras de paridade do formulário produtivo da bancada (F48.2.3, D13).
 *
 * Módulo **puro** — sem JSX, sem runtime de UI, sem ambiente de servidor e sem
 * imports de efeito colateral. Importável por testes, pela API administrativa e
 * pela UI da bancada.
 *
 * ## Reuso (módulos genuinamente puros, importados — nenhuma cópia divergente)
 * - `parseCurrencyBRL` / `formatCurrencyBRL` de `@/lib/formatters`
 *   (normalização monetária por dígitos→centavos e formatação BRL).
 * - `BADGE_OPTIONS_BY_INTENT` de `@/lib/constants` (selo por intenção).
 * - `ILLUSTRATIVE_NOTICE_TEXT` de `@/lib/campaign/constants` (aviso ilustrativo).
 * - `MAX_CAMPAIGN_IMAGES` de `@/lib/image-generation/config`
 *   (1 imagem principal + até 3 adicionais).
 * - tipo `CampaignIntent` de `@/lib/campaign/types`.
 *
 * ## Replicação (cópia fiel com teste explícito de paridade)
 * Os helpers puros do formulário vivem dentro do hook cliente
 * (`src/components/flow/use-campaign-form.ts`) e **não** são importáveis sem
 * arrastar o runtime de UI. Por isso, as regras abaixo são **replicadas** aqui,
 * byte a byte, e a equivalência com o produtivo é comprovada por
 * `src/lib/lab/bench/__tests__/form-parity.contract.test.ts`:
 * `inferIntent`, `buildValidityDisplayText`, `buildMandatoryArtworkText`,
 * `formatDateDisplay`, `getTodayISO` e as validações de
 * nome/descrição/informações obrigatórias/preço/selo/imagem.
 *
 * O formulário e o hook produtivos **não** são editados (D13).
 */

// ─── Limites e tipos produtivos ──────────────────────────────────────────────

/** Limite do nome do produto (produtivo: `maxLength={60}`). */
export const PRODUCT_NAME_MAX = 60;

/** Limite da descrição opcional do produto (produtivo: `maxLength={120}`). */
export const PRODUCT_DESCRIPTION_MAX = 120;

/** Limite das informações obrigatórias na arte (produtivo: `maxLength={200}`). */
export const MANDATORY_ARTWORK_MAX = 200;

/** Teto de tamanho por imagem (produtivo: 5MB). */
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** Máximo de imagens do produto (1 principal + 3 adicionais). */
export const MAX_PRODUCT_IMAGES = MAX_CAMPAIGN_IMAGES;

/** Máximo de imagens adicionais (referências). */
export const MAX_ADDITIONAL_IMAGES = MAX_CAMPAIGN_IMAGES - 1;

/** Tipos MIME aceitos pelo produtivo (mesma ordem/valores). */
export const PRODUCT_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

/** Modos de validade da oferta (produtivo). */
export type BenchValidityMode = "" | "until-date" | "range" | "today" | "stock" | "custom";

// ─── Monetário (reuso de formatters) ─────────────────────────────────────────

/**
 * Normaliza uma máscara monetária por dígitos→centavos, idêntico ao produtivo.
 * Reusa `parseCurrencyBRL` — nenhuma lógica monetária é duplicada aqui.
 */
export function normalizePriceCents(masked: string): number {
  return parseCurrencyBRL(masked);
}

/** Formata centavos em BRL, idêntico ao produtivo. Reusa `formatCurrencyBRL`. */
export function formatPriceCents(valueCents: number): string {
  return formatCurrencyBRL(valueCents);
}

// ─── Datas (replicado do hook produtivo) ─────────────────────────────────────

/**
 * Formata ISO `YYYY-MM-DD` → `dd/mm/aaaa`. Entrada vazia ou sem 3 partes após
 * split "-" retorna a entrada original (comportamento produtivo preservado).
 */
export function formatDateDisplay(isoDate: string): string {
  const parts = isoDate.split("-");
  if (!isoDate || parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * "Hoje" em `YYYY-MM-DD` no fuso LOCAL. Determinístico dado `now`; única fonte
 * de `new Date()` neste módulo. Idêntico ao produtivo.
 */
export function getTodayISO(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ─── Intenção e derivação (replicado) ────────────────────────────────────────

/**
 * Deriva a intenção a partir dos preços, idêntico ao produtivo:
 * ambos > 0 → `offer`; só venda > 0 → `spotlight`; senão `exclusive`.
 */
export function inferIntent(
  originalPriceCents: number,
  discountedPriceCents: number | undefined | null,
): CampaignIntent {
  const hasOriginal = originalPriceCents > 0;
  const hasDiscounted = (discountedPriceCents ?? 0) > 0;

  if (hasOriginal && hasDiscounted) return "offer";
  if (hasDiscounted) return "spotlight";
  return "exclusive";
}

/**
 * Opções de intenção disponíveis por estado dos preços (espelha o produtivo):
 * ambos → `["offer"]`; só venda → `["offer", "spotlight"]`; senão
 * `["spotlight", "exclusive"]`.
 */
export function availableIntents(
  originalPriceCents: number,
  discountedPriceCents: number | undefined | null,
): CampaignIntent[] {
  const inferred = inferIntent(originalPriceCents, discountedPriceCents);
  if (inferred === "offer") return ["offer"];
  if ((discountedPriceCents ?? 0) > 0) return ["offer", "spotlight"];
  return ["spotlight", "exclusive"];
}

// ─── Validações de campos (replicado do hook/formulário produtivo) ───────────

/** Nome do produto: obrigatório e `<= 60`. */
export function validateProductName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Nome do produto é obrigatório";
  if (trimmed.length > PRODUCT_NAME_MAX) return `Máximo de ${PRODUCT_NAME_MAX} caracteres`;
  return null;
}

/** Descrição opcional: `<= 120`. */
export function validateProductDescription(value: string): string | null {
  if (value.length > PRODUCT_DESCRIPTION_MAX) {
    return `Máximo de ${PRODUCT_DESCRIPTION_MAX} caracteres`;
  }
  return null;
}

/** Informações obrigatórias na arte: `<= 200`. */
export function validateMandatoryArtworkText(value: string): string | null {
  if (value.length > MANDATORY_ARTWORK_MAX) {
    return `Máximo de ${MANDATORY_ARTWORK_MAX} caracteres`;
  }
  return null;
}

/** Preço de venda: obrigatório apenas quando a intenção é oferta. */
export function validateDiscountedPrice(
  value: number | undefined,
  intent: CampaignIntent = "offer",
): string | null {
  if (intent !== "offer") return null;
  if ((value ?? 0) <= 0) return "Preço com desconto é obrigatório para ofertas";
  return null;
}

/** Preço "de/por": o preço de venda deve ser menor que o original. */
export function validateOriginalPrice(
  originalPriceCents: number,
  discountedPriceCents: number,
): string | null {
  if (originalPriceCents > 0 && originalPriceCents <= discountedPriceCents) {
    return "Preço com desconto deve ser menor que o preço original";
  }
  return null;
}

/** Selo: obrigatório em oferta e sempre pertencente às opções da intenção. */
export function validateBadge(value: string, intent: CampaignIntent = "offer"): string | null {
  if (value === "" && intent !== "offer") return null;
  if (value === "" && intent === "offer") return "Selecione um badge promocional";
  if (!BADGE_OPTIONS_BY_INTENT[intent].includes(value)) {
    return "Badge inválido para esta intenção comercial";
  }
  return null;
}

/** Limpa um selo que não pertence às opções da intenção (comportamento produtivo). */
export function cleanBadgeForIntent(badge: string, intent: CampaignIntent): string {
  if (badge && !BADGE_OPTIONS_BY_INTENT[intent].includes(badge)) return "";
  return badge;
}

/** Imagem do produto: principal obrigatória, tipo e tamanho produtivos. */
export function validateImage(file: { type: string; size: number } | null): string | null {
  if (!file) return "Imagem do produto é obrigatória";
  if (!(PRODUCT_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Formato não suportado. Use PNG, JPG, WEBP ou HEIC";
  }
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    return "Arquivo muito grande. Máximo 5MB";
  }
  return null;
}

/** Contagem de imagens: 1 principal obrigatória e no máximo 4 no total. */
export function validateImagesCount(count: number): string | null {
  if (count < 1) return "Imagem do produto é obrigatória";
  if (count > MAX_PRODUCT_IMAGES) return `Máximo de ${MAX_PRODUCT_IMAGES} imagens`;
  return null;
}

// ─── preserveImageContext (replicado) ────────────────────────────────────────

/** "Preservar imagem original" só é oferecido fora da oferta (Destaque/Exclusivo). */
export function isPreserveImageContextAvailable(intent: CampaignIntent): boolean {
  return intent !== "offer";
}

/**
 * Resolve o valor de `preserveImageContext`: forçado `false` quando a intenção
 * é oferta; caso contrário preserva o valor corrente (padrão `false`).
 */
export function resolvePreserveImageContext(
  intent: CampaignIntent,
  current: boolean | undefined,
): boolean {
  if (intent === "offer") return false;
  return current ?? false;
}

// ─── Validade (replicado) ────────────────────────────────────────────────────

/** Data final obrigatória e não retroativa nos modos `until-date`/`range`. */
export function validateValidityEndDate(
  fields: { validityMode: BenchValidityMode; validityEndDate: string },
  todayISO: string = getTodayISO(),
): string | null {
  const requiresEndDate = fields.validityMode === "until-date" || fields.validityMode === "range";
  if (!requiresEndDate) return null;
  if (!fields.validityEndDate) return "Informe uma data válida (dd/mm/aaaa)";
  if (fields.validityEndDate < todayISO) return "Data final não pode ser anterior à data de hoje";
  return null;
}

/** Data inicial obrigatória, não retroativa e não posterior à final no modo `range`. */
export function validateValidityStartDate(
  fields: {
    validityMode: BenchValidityMode;
    validityStartDate: string;
    validityEndDate: string;
  },
  todayISO: string = getTodayISO(),
): string | null {
  if (fields.validityMode !== "range") return null;
  if (!fields.validityStartDate) return "Informe uma data válida (dd/mm/aaaa)";
  if (fields.validityStartDate < todayISO) {
    return "Data inicial não pode ser anterior à data de hoje";
  }
  if (fields.validityEndDate && fields.validityStartDate > fields.validityEndDate) {
    return "Data inicial não pode ser posterior à data final";
  }
  return null;
}

/** Texto de exibição da validade, idêntico ao produtivo. */
export function buildValidityDisplayText(fields: {
  validityMode: BenchValidityMode;
  validityStartDate: string;
  validityEndDate: string;
  validityCustomText: string;
}): string | undefined {
  switch (fields.validityMode) {
    case "":
      return undefined;
    case "until-date":
      return fields.validityEndDate
        ? `até ${formatDateDisplay(fields.validityEndDate)}`
        : undefined;
    case "range":
      return fields.validityStartDate && fields.validityEndDate
        ? `de ${formatDateDisplay(fields.validityStartDate)} até ${formatDateDisplay(fields.validityEndDate)}`
        : undefined;
    case "today":
      return "somente hoje";
    case "stock":
      return "enquanto durarem os estoques";
    case "custom":
      return fields.validityCustomText.replace(/^Oferta válida[:\s-]*/i, "").trim() || undefined;
    default:
      return undefined;
  }
}

// ─── Avisos e informações obrigatórias (replicado) ───────────────────────────

/**
 * Concatena o aviso "Imagem meramente ilustrativa" com o texto livre das
 * informações obrigatórias, idêntico ao produtivo.
 */
export function buildMandatoryArtworkText(
  showNotice: boolean,
  freeText: string,
): string | undefined {
  const notice = showNotice ? ILLUSTRATIVE_NOTICE_TEXT : "";
  const free = freeText.trim();
  if (notice && free) return `${notice}\n${free}`;
  if (notice) return notice;
  if (free) return free;
  return undefined;
}
