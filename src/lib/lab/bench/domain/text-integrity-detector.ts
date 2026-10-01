import { createHash } from "node:crypto";

import type { BenchProduct } from "./schemas";
import {
  BENCH_TEXT_INTEGRITY_FIELDS,
  type BenchTextIntegrityAlert,
  type BenchTextIntegrityField,
  type BenchTextIntegrityPair,
} from "./schemas";

/** Versão das regras que participa da evidência entre `/compose` e `/runs`. */
export const TEXT_INTEGRITY_POLICY_VERSION = "48.2.5-text-integrity-v1";

/** Máximo de code points exibidos no trecho de um alerta, antes das reticências. */
const MAX_EXCERPT_CODE_POINTS = 80;

interface IndexedAlert {
  readonly alert: BenchTextIntegrityAlert;
  readonly fieldIndex: number;
  readonly textIndex: number;
}

interface TextIntegrityRule {
  readonly ruleId: string;
  readonly pattern: RegExp;
  readonly reason: string;
  readonly ignoreMatch?: (match: string) => boolean;
}

/**
 * Regras pequenas e deliberadamente sugestivas. A lista curta de grafias sem
 * acento pode sinalizar marcas, nomes próprios ou termos técnicos válidos; ela
 * não é dicionário nem corretor lexical completo. Haverá falsos positivos nesses
 * nomes e falsos negativos para padrões não incluídos. Cada mudança de regra
 * exige nova `TEXT_INTEGRITY_POLICY_VERSION`.
 */
const RULES: readonly TextIntegrityRule[] = [
  {
    ruleId: "punctuation_repeated",
    pattern: /([!?;:,…])\1+|\.{2,}/gu,
    reason: "Há sinais de pontuação repetidos; confira se foi intencional.",
    ignoreMatch: (match) => match === "...",
  },
  {
    ruleId: "character_repeated_suspicious",
    pattern: /([\p{L}\p{N}])\1{2,}/giu,
    reason: "Há um caractere repetido várias vezes; confira se foi intencional.",
  },
  {
    ruleId: "spacing_anomaly",
    pattern: / {2,}|[\t\f\v]+|[\t ]+[,.!?;:]|^[\t ]+|[\t ]+$/gmu,
    reason: "O espaçamento parece incomum; confira este trecho.",
  },
  {
    ruleId: "adjacent_word_repeat",
    pattern: /(?<![\p{L}\p{N}_])([\p{L}\p{N}_]+)\s+\1(?![\p{L}\p{N}_])/giu,
    reason: "Uma palavra adjacente aparece repetida; confira se foi intencional.",
  },
  ...[
    { word: "voce", ruleId: "ptbr_voce_without_accent", intended: "você" },
    { word: "nao", ruleId: "ptbr_nao_without_accent", intended: "não" },
    { word: "promocao", ruleId: "ptbr_promocao_without_accent", intended: "promoção" },
    { word: "imperdivel", ruleId: "ptbr_imperdivel_without_accent", intended: "imperdível" },
    { word: "tambem", ruleId: "ptbr_tambem_without_accent", intended: "também" },
    { word: "otimo", ruleId: "ptbr_otimo_without_accent", intended: "ótimo" },
    { word: "preco", ruleId: "ptbr_preco_without_accent", intended: "preço" },
    { word: "liquidacao", ruleId: "ptbr_liquidacao_without_accent", intended: "liquidação" },
  ].map(({ word, ruleId, intended }) => ({
    ruleId,
    pattern: new RegExp(`(?<![\\p{L}\\p{N}_])${word}(?![\\p{L}\\p{N}_])`, "giu"),
    reason: `“${word}” pode corresponder a “${intended}”; confira a grafia desejada.`,
  })),
];

/**
 * Coleta em ordem canônica exclusivamente os textos livres editáveis pelo
 * operador. O trecho digitado em `mandatoryArtworkText` permanece distinto do
 * aviso ilustrativo controlado; preço, validade, enums e branding read-only não
 * entram na revisão.
 *
 * Strings não são trimadas, normalizadas nem reescritas: a revisão vincula os
 * valores exatamente como recebidos, incluindo `promptBase` byte a byte.
 */
export function collectBenchTextIntegrityFields(input: {
  product: Pick<BenchProduct, "name" | "description" | "mandatoryArtworkText">;
  promptBase: string;
}): BenchTextIntegrityPair[] {
  const values: Record<BenchTextIntegrityField, string> = {
    "product.name": input.product.name,
    "product.description": input.product.description ?? "",
    "product.mandatoryArtworkText": input.product.mandatoryArtworkText ?? "",
    promptBase: input.promptBase,
  };

  return BENCH_TEXT_INTEGRITY_FIELDS.map((field) => ({ field, value: values[field] }));
}

/**
 * Gera revisão SHA-256 dos pares em sua ordem canônica, sem normalizar valores.
 * É uma impressão efêmera de associação entre conteúdo e revisão, não assinatura
 * de segurança nem persistência de texto.
 */
export function createBenchTextIntegrityRevision(
  fields: readonly BenchTextIntegrityPair[],
): string {
  const canonicalPairs = fields.map(({ field, value }) => [field, value]);
  return createHash("sha256").update(JSON.stringify(canonicalPairs), "utf8").digest("hex");
}

function excerptFor(value: string, index: number, matchLength: number): string {
  const matchedCodePoints = Array.from(value.slice(index, index + matchLength));
  if (matchedCodePoints.length <= MAX_EXCERPT_CODE_POINTS) return matchedCodePoints.join("");
  return `${matchedCodePoints.slice(0, MAX_EXCERPT_CODE_POINTS - 1).join("")}…`;
}

/**
 * Examina os pares na ordem fornecida e devolve alertas determinísticos
 * ordenados por campo, posição no texto e ordem estável das regras. A função é
 * pura em relação às entradas: não as muta, corrige, consulta rede ou invoca IA.
 */
export function detectBenchTextIntegrity(
  fields: readonly BenchTextIntegrityPair[],
): BenchTextIntegrityAlert[] {
  const alerts: IndexedAlert[] = [];

  fields.forEach(({ field, value }, fieldIndex) => {
    RULES.forEach(({ ruleId, pattern, reason, ignoreMatch }) => {
      const matcher = new RegExp(pattern.source, pattern.flags);
      for (const match of value.matchAll(matcher)) {
        const matchedText = match[0];
        const textIndex = match.index ?? 0;
        if (ignoreMatch?.(matchedText)) continue;

        alerts.push({
          fieldIndex,
          textIndex,
          alert: {
            field,
            excerpt: excerptFor(value, textIndex, matchedText.length),
            reason,
            ruleId,
          },
        });
      }
    });
  });

  return alerts
    .sort(
      (left, right) =>
        BENCH_TEXT_INTEGRITY_FIELDS.indexOf(left.alert.field) -
          BENCH_TEXT_INTEGRITY_FIELDS.indexOf(right.alert.field) ||
        left.fieldIndex - right.fieldIndex ||
        left.textIndex - right.textIndex ||
        left.alert.ruleId.localeCompare(right.alert.ruleId),
    )
    .map(({ alert }) => alert);
}
