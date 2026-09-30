import { PROMPT_BLOCK_LABELS } from "./prompt-composer";
import type { BenchPromptBlockLabel } from "./prompt-composer";
import type {
  BenchExperimentalBriefing,
  BenchExperimentalVisualDirection,
} from "./experimental-briefing";

/**
 * Mapeamento mínimo de branding para o prompt (F48.2.4, D8;
 * spec `lab-bench-branding`).
 *
 * Módulo **puro e determinístico** — sem I/O, sem `process.env`, sem provider,
 * sem client Supabase e **sem IA**. Aplica a **seleção determinística por
 * prioridade** que envia a **menor representação** que preserva a direção
 * visual da loja:
 *
 *  - **sempre** nome da loja (`storeName`) e cor da marca resolvida
 *    (`brandColor`);
 *  - **um único** campo de direção visual pela cadeia
 *    `campaignBrief` → `campaignGuidelines` → `visualStyle` → `visualTone` →
 *    `brandPersonality` (primeiro não vazio; **nunca** os cinco simultaneamente);
 *  - direção tipográfica (`typographyDirection`) no bloco próprio
 *    `[DIREÇÃO TIPOGRÁFICA]`.
 *
 * Todos os demais campos do branding (`segment`, `subsegment`, `toneOfVoice`,
 * `positioning`, `shortDescription`, `slogan`, `safeColorTokens`,
 * `brandColorsChosen`, `inferredPrimaryColor`, `storeBrandColor`,
 * `logoColorsDetected`, `profileSource`, `profileStatus`) permanecem **apenas na
 * evidência** — não entram nas contribuições.
 *
 * ## Independência de execução (onda 2)
 *
 * O shape de retorno é declarado **localmente** (`BrandingPromptContribution`),
 * estruturalmente compatível com o contrato de contribuição das políticas
 * **sem** importá-lo — o Plano 02 é executado em paralelo. O módulo também
 * **não** reutiliza o produtivo `art-director-briefing.ts`.
 *
 * A seleção é **posicional** (primeiro não vazio da cadeia) e **não** usa
 * deduplicação semântica/embedding nem qualquer heurística de similaridade: a
 * mesma entrada produz sempre a mesma seleção, independentemente do conteúdo.
 */

// ─── Shape de contribuição (local — estruturalmente compatível) ──────────────

/**
 * Contribuição do mapeamento de branding para **um** bloco canônico do prompt.
 * Estruturalmente compatível com `BenchPromptContribution` — declarado aqui
 * localmente para manter a independência do Plano 02 (onda paralela).
 */
export interface BrandingPromptContribution {
  readonly block: BenchPromptBlockLabel;
  readonly lines: readonly string[];
}

// ─── Cadeia canônica de direção visual (prioridade travada — D8) ─────────────

interface VisualDirectionStep {
  /** Rótulo em linguagem natural do campo selecionado. */
  readonly label: string;
  readonly key: keyof BenchExperimentalVisualDirection;
}

/** Cadeia de fallback **na ordem travada** (D8). */
export const VISUAL_DIRECTION_CHAIN: readonly VisualDirectionStep[] = [
  { label: "Brief da marca", key: "campaignBrief" },
  { label: "Diretrizes de campanha", key: "campaignGuidelines" },
  { label: "Estilo visual", key: "visualStyle" },
  { label: "Tom visual", key: "visualTone" },
  { label: "Personalidade da marca", key: "brandPersonality" },
];

/** Campo de direção visual selecionado (rótulo natural + valor). */
export interface SelectedVisualDirection {
  readonly label: string;
  readonly value: string;
}

function isNonEmpty(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Seleciona **um único** campo de direção visual pelo **primeiro não vazio** da
 * cadeia `campaignBrief` → `campaignGuidelines` → `visualStyle` → `visualTone` →
 * `brandPersonality`. Determinístico e puramente posicional (sem dedup
 * semântica/embedding): devolve `null` quando os cinco campos estão vazios.
 */
export function selectVisualDirection(
  direction: BenchExperimentalVisualDirection,
): SelectedVisualDirection | null {
  for (const step of VISUAL_DIRECTION_CHAIN) {
    const value = direction[step.key];
    if (isNonEmpty(value)) {
      return { label: step.label, value: value.trim() };
    }
  }
  return null;
}

// ─── Construção das contribuições ────────────────────────────────────────────

/**
 * Monta as contribuições de branding do briefing experimental:
 *  - `[IDENTIDADE E DIREÇÃO VISUAL]`: `storeName` + `brandColor` + **um único**
 *    campo de direção visual (pela cadeia travada);
 *  - `[DIREÇÃO TIPOGRÁFICA]`: `typographyDirection` quando presente.
 *
 * Blocos sem linhas são omitidos. Função pura e determinística.
 */
export function buildBrandingPromptContributions(
  briefing: BenchExperimentalBriefing,
): readonly BrandingPromptContribution[] {
  const identityLines: string[] = [];

  if (isNonEmpty(briefing.storeName)) {
    identityLines.push(`Loja: ${briefing.storeName.trim()}`);
  }
  if (isNonEmpty(briefing.brandColor)) {
    identityLines.push(`Cor da marca: ${briefing.brandColor.trim()}`);
  }

  const direction = selectVisualDirection(briefing.visualDirection);
  if (direction) {
    identityLines.push(`${direction.label}: ${direction.value}`);
  }

  const contributions: BrandingPromptContribution[] = [];
  if (identityLines.length > 0) {
    contributions.push({ block: PROMPT_BLOCK_LABELS.identity, lines: identityLines });
  }

  if (isNonEmpty(briefing.typographyDirection)) {
    contributions.push({
      block: PROMPT_BLOCK_LABELS.typography,
      lines: [`Direção tipográfica: ${briefing.typographyDirection.trim()}`],
    });
  }

  return contributions;
}
