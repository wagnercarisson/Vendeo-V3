import "server-only";

import { createHash } from "node:crypto";

import { PromptLoader } from "@/lib/image-generation/prompt-loader";

/**
 * Snapshots de prompt do Laboratório de IA (F48.1, D5/D8).
 *
 * O prompt sob teste nesta fase é o diretor de arte de oferta (intent `offer`).
 * A comparação é **prompt-only**: o baseline é o conteúdo **oficial atual** do
 * arquivo versionado (`source: "official"`) e a candidata é o override enviado
 * pelo admin (`source: "override"`), congelado apenas no snapshot.
 *
 * Garantias:
 *  - **Somente leitura** do prompt oficial: nada é escrito em `prompts/`
 *    (T-48-1-27). O arquivo é lido pelo `PromptLoader` e nunca alterado.
 *  - O snapshot guarda `name`, `content` e `contentHash` (SHA-256 hex) — a
 *    identidade verificável do conteúdo congelado no run (D8).
 *  - Nenhum secret, chave ou URL entra no snapshot (D15).
 */

/**
 * Nome do prompt oficial sob teste (intent `offer`). Constante única: qualquer
 * outro prompt é recusado pela candidata com `unsupported_prompt_under_test`.
 */
export const PROMPT_UNDER_TEST = "campaign-image-director-offer";

/** Erro determinístico para prompt fora do escopo da F48.1. */
export const UNSUPPORTED_PROMPT_UNDER_TEST = "unsupported_prompt_under_test";

export interface LabPromptSnapshot {
  name: string;
  content: string;
  contentHash: string;
  source: "official" | "override";
}

/** Baseline: conteúdo oficial atual do prompt versionado. */
export type BaselinePromptSnapshot = LabPromptSnapshot & { source: "official" };

/** Candidata: override do prompt sob teste. */
export type CandidatePromptSnapshot = LabPromptSnapshot & { source: "override" };

/** SHA-256 (hex, 64 chars) do conteúdo do prompt. */
export function computePromptContentHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Congela o baseline a partir do **conteúdo oficial atual**.
 *
 * O loader é injetável para testes; sem argumento usa o `PromptLoader` padrão
 * (diretório `prompts/` do projeto). Nenhum arquivo é escrito.
 */
export function buildBaselinePromptSnapshot(
  promptLoader?: PromptLoader,
): BaselinePromptSnapshot {
  const loader = promptLoader ?? new PromptLoader();
  const content = loader.load(PROMPT_UNDER_TEST);

  return {
    name: PROMPT_UNDER_TEST,
    content,
    contentHash: computePromptContentHash(content),
    source: "official",
  };
}

/**
 * Congela a candidata a partir do override do admin.
 *
 * O prompt precisa ser exatamente o prompt sob teste — um nome diferente lança
 * `unsupported_prompt_under_test:<name>` (nada é congelado silenciosamente).
 */
export function buildCandidatePromptSnapshot(input: {
  promptName: string;
  promptContent: string;
}): CandidatePromptSnapshot {
  if (input.promptName !== PROMPT_UNDER_TEST) {
    throw new Error(`${UNSUPPORTED_PROMPT_UNDER_TEST}:${input.promptName}`);
  }

  return {
    name: input.promptName,
    content: input.promptContent,
    contentHash: computePromptContentHash(input.promptContent),
    source: "override",
  };
}
