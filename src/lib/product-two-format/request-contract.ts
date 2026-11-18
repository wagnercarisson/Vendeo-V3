/**
 * F60.7 — Contrato ESTRITO da declaração conjunta (não conectado a rota).
 *
 * Este schema reconhece somente o corpo exato
 * `campaignFormat: "1:1+9:16"` + as duas chaves de versão conjunta. Não aceita
 * listas de formatos, formatos desconhecidos, chaves extras nem pares
 * incoerentes.
 *
 * FRONTEIRA DA SUBFATIA A: este contrato NÃO está conectado a
 * `POST /api/campaign/generate-image`. O schema de produção
 * (`NewFlowGenerateImageRequestSchema`) permanece intocado e continua recusando
 * o valor conjunto — a conexão e o dispatch pertencem à Subfatia C. Até lá, a
 * opção conjunta é inalcançável por HTTP.
 *
 * Módulo puro: apenas `zod` e constantes locais.
 */

import { z } from "zod";

import {
  TWO_FORMAT_CAMPAIGN_FORMAT,
  TWO_FORMAT_CONTRACT_VERSION,
  TWO_FORMAT_GENERATION_CONTRACT_VERSION,
  TWO_FORMAT_GENERATION_ORIGIN,
} from "./types";

/** Schema estrito e congelado da declaração conjunta. */
export const TwoFormatDeclarationSchema = z
  .object({
    campaignFormat: z.literal(TWO_FORMAT_CAMPAIGN_FORMAT),
    formatContractVersion: z.literal(TWO_FORMAT_CONTRACT_VERSION),
    generationOrigin: z.literal(TWO_FORMAT_GENERATION_ORIGIN),
    generationContractVersion: z.literal(
      TWO_FORMAT_GENERATION_CONTRACT_VERSION,
    ),
  })
  .strict()
  .readonly();

export type TwoFormatDeclaration = z.infer<typeof TwoFormatDeclarationSchema>;

export type TwoFormatDeclarationInvalidReason =
  | "malformed"
  | "unsupported_format"
  | "unsupported_version"
  | "unsupported_origin"
  | "unexpected_field";

export type TwoFormatDeclarationParseResult =
  | {
      readonly kind: "two_format";
      readonly declaration: TwoFormatDeclaration;
    }
  | {
      readonly kind: "invalid";
      readonly reason: TwoFormatDeclarationInvalidReason;
    };

const FORMAT_FIELD = "campaignFormat";
const FORMAT_VERSION_FIELD = "formatContractVersion";
const ORIGIN_FIELD = "generationOrigin";
const ORIGIN_VERSION_FIELD = "generationContractVersion";

function issuePath(issue: z.ZodIssue): string | number | undefined {
  return issue.path.length > 0 ? issue.path[0] : undefined;
}

/**
 * Classifica os problemas do Zod em um motivo fechado. A ordem é explícita:
 * chave não reconhecida (listas/campos extras) → formato → versões → origem.
 */
function classifyIssues(
  issues: ReadonlyArray<z.ZodIssue>,
): TwoFormatDeclarationInvalidReason {
  if (issues.some((issue) => issue.code === "unrecognized_keys")) {
    return "unexpected_field";
  }

  const paths = issues.map(issuePath);

  if (paths.includes(FORMAT_FIELD)) return "unsupported_format";
  if (paths.includes(FORMAT_VERSION_FIELD) || paths.includes(ORIGIN_VERSION_FIELD)) {
    return "unsupported_version";
  }
  if (paths.includes(ORIGIN_FIELD)) return "unsupported_origin";

  return "malformed";
}

/**
 * Interpreta uma declaração conjunta sem lançar. Retorna o contrato tipado ou um
 * motivo fechado de invalidação.
 */
export function parseTwoFormatDeclaration(
  value: unknown,
): TwoFormatDeclarationParseResult {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return Object.freeze({ kind: "invalid" as const, reason: "malformed" as const });
  }

  const parsed = TwoFormatDeclarationSchema.safeParse(value);
  if (parsed.success) {
    return Object.freeze({
      kind: "two_format" as const,
      declaration: parsed.data,
    });
  }

  return Object.freeze({
    kind: "invalid" as const,
    reason: classifyIssues(parsed.error.issues),
  });
}
