import {
  getOpenAiPricingInventoryEntry,
  type OpenAiPricingInventoryEntry,
  type OpenAiPricingKind,
} from "./openai-pricing-inventory";

/**
 * Parser determinístico da página oficial de preços da OpenAI (Markdown).
 *
 * Regras:
 * - somente a modalidade Standard é considerada para persistência;
 * - Batch/Flex/Fast/Ultrafast são lidos como contexto e ignorados;
 * - modelo e dimensão são identificados pelo cabeçalho/rótulo, não por posição;
 * - "-" e células vazias significam ausência (nunca zero);
 * - "$0.00" é zero explícito e válido;
 * - modelos fora do inventário são ignorados; duplicata/ambigüidade de um
 *   modelo do inventário é erro (nunca "primeira ocorrência vence").
 */

export class OpenAiPricingParseError extends Error {
  constructor(
    readonly code: string,
    readonly detail?: string,
  ) {
    super(detail ? `${code}:${detail}` : code);
    this.name = "OpenAiPricingParseError";
  }
}

export interface ParsedOpenAiModelPricing {
  model: string;
  kind: OpenAiPricingKind;
  inputTextUsdPer1M: number;
  cachedInputTextUsdPer1M: number | null;
  outputTextUsdPer1M: number | null;
  inputImageUsdPer1M: number | null;
  cachedInputImageUsdPer1M: number | null;
  outputImageUsdPer1M: number | null;
}

type Modality = "text" | "image";
type PriceCell =
  | { kind: "value"; value: number }
  | { kind: "not_applicable" }
  | { kind: "missing" };

interface CollectedRow {
  model: string;
  modality: Modality;
  textInput?: PriceCell;
  textCached?: PriceCell;
  textOutput?: PriceCell;
  imageInput?: PriceCell;
  imageCached?: PriceCell;
  imageOutput?: PriceCell;
}

const MODALITY_LABELS = new Set(["standard", "batch", "flex", "fast", "ultrafast"]);

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeModelLabel(value: string): string {
  return value
    .replace(/`/g, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.every((cell) => /^:?-{2,}:?$/.test(cell.replace(/\s/g, "")));
}

function parsePriceCell(raw: string | undefined): PriceCell {
  const value = (raw ?? "").trim();
  if (value === "") {
    return { kind: "missing" };
  }
  if (value === "-" || value === "—") {
    return { kind: "not_applicable" };
  }
  const match = value.match(/^\$?\s*(\d+(?:\.\d+)?)$/);
  if (!match) {
    throw new OpenAiPricingParseError("invalid_price", value.slice(0, 40));
  }
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new OpenAiPricingParseError("invalid_price", value.slice(0, 40));
  }
  return { kind: "value", value: parsed };
}

function findColumn(headers: string[], names: readonly string[]): number {
  return headers.findIndex((header) => names.includes(header));
}

function currentModalityFromLine(line: string): Modality | null {
  const trimmed = line.trim();
  const bare = trimmed.replace(/^#+\s*/, "").replace(/\s+pricing data$/i, "").trim();
  const normalized = bare.toLowerCase();
  if (!MODALITY_LABELS.has(normalized)) return null;
  return normalized === "standard" ? "text" : null;
}

/**
 * Retorna `true` quando a linha declara uma modalidade diferente de Standard
 * (usada para marcar que a tabela seguinte não deve ser extraída).
 */
function isNonStandardModalityLine(line: string): boolean {
  const trimmed = line.trim();
  const bare = trimmed
    .replace(/^#+\s*/, "")
    .replace(/\s+pricing data$/i, "")
    .trim()
    .toLowerCase();
  return MODALITY_LABELS.has(bare) && bare !== "standard";
}

export function parseOpenAiStandardPricing(
  markdown: string,
  inventory: readonly OpenAiPricingInventoryEntry[],
): ParsedOpenAiModelPricing[] {
  const inventoryModels = new Set(inventory.map((entry) => entry.model));
  const rows = new Map<string, CollectedRow>();
  const lines = markdown.split(/\r?\n/);

  let standard = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed.startsWith("|")) {
      if (currentModalityFromLine(line) === "text") {
        standard = true;
      } else if (isNonStandardModalityLine(line)) {
        standard = false;
      }
      i += 1;
      continue;
    }

    // Bloco de tabela: cabeçalho + separador + linhas.
    const headerCells = splitTableRow(lines[i]);
    const separatorCells = i + 1 < lines.length ? splitTableRow(lines[i + 1]) : [];
    if (separatorCells.length === 0 || !isSeparatorRow(separatorCells)) {
      i += 1;
      continue;
    }

    const headers = headerCells.map(normalizeHeader);
    let end = i + 2;
    while (end < lines.length && lines[end].trim().startsWith("|")) end += 1;

    if (standard) {
      extractTable({
        headers,
        body: lines.slice(i + 2, end).map(splitTableRow),
        inventoryModels,
        rows,
      });
    }

    i = end;
  }

  return resolveInventory(rows, inventory);
}

function extractTable(params: {
  headers: string[];
  body: string[][];
  inventoryModels: Set<string>;
  rows: Map<string, CollectedRow>;
}): void {
  const { headers, body, inventoryModels, rows } = params;

  // Tabelas de fine-tuning/tools/áudio têm unidades diferentes e não entram.
  if (
    headers.includes("training") ||
    headers.some((header) => header.includes("price per")) ||
    headers.includes("category") ||
    headers.includes("tool") ||
    headers.includes("use case")
  ) {
    return;
  }

  const modelIndex = findColumn(headers, ["model"]);
  if (modelIndex < 0) return;

  const modalityIndex = findColumn(headers, ["modality"]);
  const shortInputIndex = findColumn(headers, ["short context input"]);
  const shortOutputIndex = findColumn(headers, ["short context output"]);
  const shortCachedIndex = findColumn(headers, ["short context cached input"]);
  const inputIndex = shortInputIndex >= 0 ? shortInputIndex : findColumn(headers, ["input"]);
  const outputIndex =
    shortOutputIndex >= 0 ? shortOutputIndex : findColumn(headers, ["output"]);
  const cachedIndex =
    shortCachedIndex >= 0 ? shortCachedIndex : findColumn(headers, ["cached input"]);

  if (inputIndex < 0 || outputIndex < 0 || cachedIndex < 0) return;

  for (const cells of body) {
    if (cells.length === 0 || isSeparatorRow(cells)) continue;
    const rawModel = cells[modelIndex] ?? "";
    const model = normalizeModelLabel(rawModel);
    if (!inventoryModels.has(model)) continue;

    const modalityValue = modalityIndex >= 0 ? (cells[modalityIndex] ?? "").toLowerCase() : "text";
    if (modalityValue !== "text" && modalityValue !== "image") {
      throw new OpenAiPricingParseError("unknown_modality", `${model}:${modalityValue}`);
    }
    const modality: Modality = modalityValue;

    const key = `${model}|${modality}`;
    if (rows.has(key)) {
      throw new OpenAiPricingParseError("duplicate_model_dimension", key);
    }

    const input = parsePriceCell(cells[inputIndex]);
    const output = parsePriceCell(cells[outputIndex]);
    const cached = parsePriceCell(cells[cachedIndex]);

    rows.set(
      key,
      modality === "text"
        ? { model, modality, textInput: input, textOutput: output, textCached: cached }
        : { model, modality, imageInput: input, imageOutput: output, imageCached: cached },
    );
  }
}

function requireNumber(cell: PriceCell | undefined, detail: string): number {
  if (!cell || cell.kind === "missing") {
    throw new OpenAiPricingParseError("missing_information", detail);
  }
  if (cell.kind === "not_applicable") {
    throw new OpenAiPricingParseError("not_applicable_dimension", detail);
  }
  return cell.value;
}

/**
 * Só para dimensão explicitamente não aplicável no provider (ex.: saída textual
 * de modelo de imagem, publicada como "-"). Célula vazia continua sendo
 * informação ausente e falha a tentativa.
 */
function optionalNotApplicableNumber(
  cell: PriceCell | undefined,
  detail: string,
): number | null {
  if (!cell || cell.kind === "missing") {
    throw new OpenAiPricingParseError("missing_information", detail);
  }
  if (cell.kind === "not_applicable") return null;
  return cell.value;
}

function resolveInventory(
  rows: Map<string, CollectedRow>,
  inventory: readonly OpenAiPricingInventoryEntry[],
): ParsedOpenAiModelPricing[] {
  return inventory.map((entry) => {
    const textRow = rows.get(`${entry.model}|text`);
    const imageRow = rows.get(`${entry.model}|image`);

    if (entry.kind === "text") {
      if (!textRow) {
        throw new OpenAiPricingParseError("missing_model", entry.model);
      }
      if (imageRow) {
        throw new OpenAiPricingParseError("unexpected_image_row", entry.model);
      }
      return {
        model: entry.model,
        kind: "text",
        inputTextUsdPer1M: requireNumber(textRow.textInput, `${entry.model}:input_text`),
        // Cache é tarifa aplicável aos modelos textuais do inventário; "-"/vazio
        // NÃO vira null silencioso (preserva a tabela em caso de dúvida).
        cachedInputTextUsdPer1M: requireNumber(
          textRow.textCached,
          `${entry.model}:cached_input_text`,
        ),
        outputTextUsdPer1M: requireNumber(textRow.textOutput, `${entry.model}:output_text`),
        inputImageUsdPer1M: null,
        cachedInputImageUsdPer1M: null,
        outputImageUsdPer1M: null,
      };
    }

    if (!textRow) {
      throw new OpenAiPricingParseError("missing_model", `${entry.model}:text`);
    }
    if (!imageRow) {
      throw new OpenAiPricingParseError("missing_model", `${entry.model}:image`);
    }

    return {
      model: entry.model,
      kind: "image",
      inputTextUsdPer1M: requireNumber(textRow.textInput, `${entry.model}:input_text`),
      cachedInputTextUsdPer1M: requireNumber(
        textRow.textCached,
        `${entry.model}:cached_input_text`,
      ),
      // Modelos de imagem não publicam saída textual ("-" na tabela Text).
      // "-" é não aplicável; célula vazia é informação ausente (falha).
      outputTextUsdPer1M: optionalNotApplicableNumber(
        textRow.textOutput,
        `${entry.model}:output_text`,
      ),
      inputImageUsdPer1M: requireNumber(imageRow.imageInput, `${entry.model}:input_image`),
      cachedInputImageUsdPer1M: requireNumber(
        imageRow.imageCached,
        `${entry.model}:cached_input_image`,
      ),
      outputImageUsdPer1M: requireNumber(imageRow.imageOutput, `${entry.model}:output_image`),
    };
  });
}

/** Diagnóstico barato para o serviço (sem expor conteúdo bruto ao admin). */
export function describeInventoryCoverage(
  parsed: readonly ParsedOpenAiModelPricing[],
): { models: number; rows: number } {
  return {
    models: parsed.length,
    rows: parsed.reduce((total, item) => {
      const entry = getOpenAiPricingInventoryEntry(item.model);
      return total + (entry?.qualities.length ?? 0);
    }, 0),
  };
}
