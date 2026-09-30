import { PROMPT_BLOCK_LABELS } from "./prompt-composer";
import type { BenchPromptBlockLabel } from "./prompt-composer";
import type { BenchIdentityReference } from "./resolve-bench-identity";

/**
 * Contribuição dedicada de **orientação de fidelidade da identidade**
 * (F48.2.4, D9; spec `lab-bench-identity-transport`).
 *
 * Módulo **puro e determinístico** — sem I/O, sem `process.env`, sem provider,
 * sem client Supabase e **sem IA**. É **separado** do núcleo do compositor e das
 * políticas de recorte: o núcleo permanece neutro (não gera orientação de
 * identidade) e a orientação **nunca** vem do conteúdo experimental.
 *
 * Quando há uma referência de identidade (`logo`/`visual_signature`), adiciona
 * ao bloco `[IDENTIDADE E DIREÇÃO VISUAL]` a orientação que exige:
 *  - **reprodução fiel** da identidade, sem redesenhar, distorcer, completar,
 *    reinterpretar nem inventar elementos;
 *  - identidade **secundária** à comunicação comercial da peça;
 *  - **sem posição fixa** na composição.
 *
 * Sem referência (`null`), devolve `[]`. O shape de retorno é declarado
 * **localmente** (`IdentityDirectionContribution`), estruturalmente compatível
 * com o contrato de contribuição das políticas **sem** importá-lo — o Plano 02 é
 * executado em paralelo. O módulo **não** importa `art-director-briefing.ts` nem
 * qualquer serviço produtivo.
 */

// ─── Shape de contribuição (local — estruturalmente compatível) ──────────────

/**
 * Contribuição da orientação de identidade para **um** bloco canônico do prompt.
 * Estruturalmente compatível com o contrato de contribuição das políticas —
 * declarado aqui localmente para manter a independência do Plano 02.
 */
export interface IdentityDirectionContribution {
  readonly block: BenchPromptBlockLabel;
  readonly lines: readonly string[];
}

/**
 * Linhas determinísticas da orientação de reprodução fiel da identidade.
 * Não repetem as orientações exclusivas de oferta (comercial) nem de produto.
 */
const IDENTITY_FIDELITY_LINES: readonly string[] = [
  "Reproduzir com fidelidade a identidade visual enviada, sem redesenhar, distorcer, completar, reinterpretar nem inventar elementos.",
  "Manter a identidade secundária à comunicação comercial da peça.",
  "Sem posição fixa: a identidade pode ocupar qualquer posição na composição, desde que permaneça reconhecível.",
];

/**
 * Monta a contribuição de orientação de fidelidade da identidade. Com
 * `logo`/`visual_signature` contribui no bloco `[IDENTIDADE E DIREÇÃO VISUAL]`;
 * sem referência (`null`), devolve `[]`. Pura e determinística.
 */
export function buildIdentityDirectionContributions(
  reference: BenchIdentityReference | null,
): readonly IdentityDirectionContribution[] {
  if (!reference) return [];
  if (reference.kind !== "logo" && reference.kind !== "visual_signature") return [];

  return [
    {
      block: PROMPT_BLOCK_LABELS.identity,
      lines: [...IDENTITY_FIDELITY_LINES],
    },
  ];
}
