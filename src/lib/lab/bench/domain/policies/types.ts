import type { BenchRegistryDimension } from "../config-registry";
import type { BenchExperimentalBriefing } from "../experimental-briefing";
import type { BenchConfig } from "../schemas";
import type { BenchPromptBlockLabel } from "../prompt-composer";

/**
 * Contratos puros das **políticas de prompt** da bancada (F48.2.4, D1/D7).
 *
 * Módulo **puro e sem IA** — apenas tipos; sem I/O, sem `process.env`, sem
 * provider e sem client Supabase.
 *
 * Cada política governa **uma** dimensão do recorte (`intencao`, `formato`,
 * `tipoConteudo`, `estrutura`, `tema`), é **versionada** e declara, por bloco
 * canônico, as linhas que contribui. O **núcleo** do compositor
 * (`prompt-composer.ts`) apenas coleta/ordena/serializa essas contribuições — ele
 * não contém regra alguma de dimensão.
 */

/**
 * Contribuição de uma política para **um** bloco canônico do prompt. O bloco é um
 * dos rótulos travados (`PROMPT_BLOCK_LABELS`); as linhas são o conteúdo textual
 * em linguagem natural.
 */
export interface BenchPromptContribution {
  readonly block: BenchPromptBlockLabel;
  readonly lines: readonly string[];
}

/**
 * Contexto de resolução entregue à política. As políticas do recorte atual
 * (Oferta 1:1) emitem orientação **estática** (independente do briefing), mas o
 * contexto é extensível: `config` é a configuração resolvida e `briefing`/
 * `references` ficam disponíveis para políticas futuras dependentes de dados.
 */
export interface BenchPolicyContext {
  readonly config: BenchConfig;
  readonly briefing?: BenchExperimentalBriefing;
  readonly references?: readonly string[];
}

/**
 * Política independente e versionada de uma dimensão do recorte. Expõe
 * `id`/`dimension`/`value`/`version` e `contributions(context)`, que devolve as
 * contribuições por bloco canônico declaradas pela política.
 */
export interface BenchPromptPolicy {
  readonly id: string;
  readonly dimension: BenchRegistryDimension;
  readonly value: string;
  readonly version: string;
  contributions(context: BenchPolicyContext): readonly BenchPromptContribution[];
}
