import { z } from "zod";

/**
 * Schema do diagnóstico versionado das evidências do Diretor (F48.2.1, D3).
 *
 * O diagnóstico é um **JSON versionado no repositório** (sem tabela nova) que
 * registra, por item, a cadeia:
 * **falha → evidência → causa provável → tratável por prompt? → hipótese mínima**.
 * Cada item referencia o prompt do Diretor correspondente.
 *
 * Módulo **puro** — sem `server-only`, sem I/O e sem `process.env`. Importável
 * por testes e pelo carregador de `diagnostics/service.ts`.
 *
 * ## Versão e hash
 *
 * - Cada versão é um arquivo imutável próprio; uma nova versão cria um novo
 *   arquivo e preserva o anterior; o carregador usa a maior `diagnosticVersion`.
 * - O `contentHash` é o SHA-256 da representação canônica do JSON **excluindo o
 *   próprio campo `contentHash`** (não autorreferente) — calculado em
 *   `diagnostics/service.ts`.
 *
 * ## Duas gerações de schema
 *
 * - **`schemaVersion: 1`** (v1): item com a cadeia simples (`failureCode`,
 *   `evidence`, `probableCause`, `promptTreatable`, `minimalHypothesis`,
 *   `promptName`). Preservado byte a byte como arquivo imutável.
 * - **`schemaVersion: 2`** (v2, ajuste do Checkpoint 1): o item passa a declarar
 *   **rastreabilidade por item** (`source.ref` + `source.section`) e a
 *   **distinção explícita entre falha observada, hipótese e taxonomia** (`kind`).
 *   Itens sem evidência concreta não podem se apresentar como observados.
 *
 * ## Tratável por prompt
 *
 * `promptTreatable` separa o que pode ser resolvido por prompt do que exige
 * outra mudança. Um item não tratável **não** gera candidata de prompt e registra
 * o encaminhamento em `evidence`/`probableCause` (ver `PROMPT_TREATABLE_FORWARDING`).
 * `treatableItems` é a base pura do filtro.
 */

/** Versão do schema do diagnóstico persistido (v1). */
export const PROMPT_DIAGNOSTICS_SCHEMA_VERSION = 1;

/** Versão do schema com rastreabilidade por item e `kind` (v2). */
export const PROMPT_DIAGNOSTICS_SCHEMA_VERSION_V2 = 2;

/** Os três prompts do Diretor de Arte suportados na F48.2.1 (não alterar). */
export const DIRECTOR_PROMPT_NAMES = [
  "campaign-image-director-offer",
  "campaign-image-director-spotlight",
  "campaign-image-director-exclusive",
] as const;

export type DirectorPromptName = (typeof DIRECTOR_PROMPT_NAMES)[number];

/**
 * Convenção do encaminhamento de falha não tratável: um item com
 * `promptTreatable: false` registra, em `evidence`/`probableCause`, para qual
 * outra mudança o problema é encaminhado. Assim o ciclo de otimização sabe que
 * o prompt do Diretor não resolve aquela falha.
 */
export const PROMPT_TREATABLE_FORWARDING =
  "promptTreatable=false ⇒ registrar o encaminhamento para outra mudança em evidence/probableCause";

/** Código do erro determinístico de diagnóstico inválido. */
export const INVALID_PROMPT_DIAGNOSTICS = "invalid_prompt_diagnostics";

// ─── Rastreabilidade e classificação (v2) ────────────────────────────────────

/**
 * Natureza do item: uma **falha observada** concreta, uma **hipótese** (interpretação
 * que não foi observada) ou uma **taxonomia** (categoria/classificação). Impede que
 * uma interpretação seja apresentada como falha observada.
 */
export const PROMPT_DIAGNOSTIC_ITEM_KINDS = [
  "observed_failure",
  "hypothesis",
  "taxonomy",
] as const;

export type PromptDiagnosticItemKind = (typeof PROMPT_DIAGNOSTIC_ITEM_KINDS)[number];

/** Rastreabilidade por item: fonte e seção específicas da evidência. */
export const PromptDiagnosticSourceSchema = z
  .object({
    /** Referência à fonte consultada (arquivo do repositório). */
    ref: z.string().min(1),
    /** Seção específica dentro da fonte. */
    section: z.string().min(1),
  })
  .strict();

export type PromptDiagnosticSource = z.infer<typeof PromptDiagnosticSourceSchema>;

// ─── Item v1 (schemaVersion 1) ───────────────────────────────────────────────

export const PromptDiagnosticItemSchema = z
  .object({
    /** Código curto e estável da falha observada. */
    failureCode: z.string().min(1),
    /** Evidência rastreável à fonte consultada. */
    evidence: z.string().min(1),
    /** Causa provável da falha. */
    probableCause: z.string().min(1),
    /** A falha pode ser tratada por prompt? */
    promptTreatable: z.boolean(),
    /** Hipótese mínima (uma classe de falha) que alimenta o ciclo D6. */
    minimalHypothesis: z.string().min(1),
    /** Prompt do Diretor ao qual o item se refere. */
    promptName: z.enum(DIRECTOR_PROMPT_NAMES),
  })
  .strict();

// ─── Item v2 (schemaVersion 2) — rastreabilidade por item + kind ─────────────

export const PromptDiagnosticItemV2Schema = z
  .object({
    /** Falha observada, hipótese ou taxonomia — nunca ambíguo. */
    kind: z.enum(PROMPT_DIAGNOSTIC_ITEM_KINDS),
    /** Código curto e estável do item. */
    failureCode: z.string().min(1),
    /** Evidência concreta (para `observed_failure`) ou base da interpretação. */
    evidence: z.string().min(1),
    /** Fonte e seção específicas às quais o item é rastreável. */
    source: PromptDiagnosticSourceSchema,
    /** Causa provável. */
    probableCause: z.string().min(1),
    /** O item pode ser tratado por prompt? */
    promptTreatable: z.boolean(),
    /** Hipótese mínima (uma classe de falha) que alimenta o ciclo D6. */
    minimalHypothesis: z.string().min(1),
    /** Prompt do Diretor ao qual o item se refere. */
    promptName: z.enum(DIRECTOR_PROMPT_NAMES),
  })
  .strict()
  .superRefine((item, ctx) => {
    // Uma taxonomia é uma classificação, não um alvo direto de prompt.
    if (item.kind === "taxonomy" && item.promptTreatable) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["promptTreatable"],
        message: "taxonomy_not_prompt_treatable",
      });
    }
  });

// ─── Documento v1 / v2 ───────────────────────────────────────────────────────

const diagnosticsDocumentCommon = {
  diagnosticVersion: z.number().int().min(1),
  generatedAt: z.string().min(1),
  sourceRefs: z.array(z.string().min(1)).min(1),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
};

export const LabPromptDiagnosticsSchema = z
  .object({
    schemaVersion: z.literal(PROMPT_DIAGNOSTICS_SCHEMA_VERSION),
    ...diagnosticsDocumentCommon,
    items: z.array(PromptDiagnosticItemSchema).min(1),
  })
  .strict();

export const LabPromptDiagnosticsV2Schema = z
  .object({
    schemaVersion: z.literal(PROMPT_DIAGNOSTICS_SCHEMA_VERSION_V2),
    ...diagnosticsDocumentCommon,
    items: z.array(PromptDiagnosticItemV2Schema).min(1),
  })
  .strict();

/** Qualquer versão suportada do documento de diagnóstico. */
export const AnyLabPromptDiagnosticsSchema = z.union([
  LabPromptDiagnosticsSchema,
  LabPromptDiagnosticsV2Schema,
]);

export type PromptDiagnosticItem = z.infer<typeof PromptDiagnosticItemSchema>;
export type PromptDiagnosticItemV2 = z.infer<typeof PromptDiagnosticItemV2Schema>;
export type AnyPromptDiagnosticItem = PromptDiagnosticItem | PromptDiagnosticItemV2;
export type LabPromptDiagnostics = z.infer<typeof LabPromptDiagnosticsSchema>;
export type LabPromptDiagnosticsV2 = z.infer<typeof LabPromptDiagnosticsV2Schema>;
export type AnyLabPromptDiagnostics = LabPromptDiagnostics | LabPromptDiagnosticsV2;

/**
 * Erro determinístico de diagnóstico inválido. Carrega apenas os issues
 * serializados (path + message) — **nunca** o conteúdo bruto da entrada.
 */
export class InvalidPromptDiagnosticsError extends Error {
  readonly code = INVALID_PROMPT_DIAGNOSTICS;
  readonly issues: ReadonlyArray<{ path: ReadonlyArray<string | number>; message: string }>;

  constructor(
    issues: ReadonlyArray<{ path: ReadonlyArray<string | number>; message: string }>,
  ) {
    super(`${INVALID_PROMPT_DIAGNOSTICS}:${JSON.stringify(issues)}`);
    this.name = "InvalidPromptDiagnosticsError";
    this.issues = issues;
  }
}

/**
 * Valida e devolve o diagnóstico (v1 ou v2). Qualquer falha ⇒
 * `InvalidPromptDiagnosticsError` com os issues serializados; a mensagem nunca
 * inclui o conteúdo bruto da entrada.
 */
export function parsePromptDiagnostics(input: unknown): AnyLabPromptDiagnostics {
  const result = AnyLabPromptDiagnosticsSchema.safeParse(input);
  if (result.success) return result.data;

  const serialized = result.error.issues.map((issue) => ({
    path: issue.path,
    message: issue.message,
  }));
  throw new InvalidPromptDiagnosticsError(serialized);
}

/**
 * Filtro puro dos itens tratáveis por prompt. É a base do contrato "falha não
 * tratável não gera candidata": apenas itens com `promptTreatable === true`
 * alimentam o ciclo de otimização.
 */
export function treatableItems(
  diagnostics: AnyLabPromptDiagnostics,
): AnyPromptDiagnosticItem[] {
  return diagnostics.items.filter((item) => item.promptTreatable === true);
}
