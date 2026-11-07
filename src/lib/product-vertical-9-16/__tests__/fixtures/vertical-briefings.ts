import baselineJson from "@/lib/product-1-1/__tests__/fixtures/prompt-composition.baseline.json";
import type { ProductOneToOneBackgroundDirection } from "@/lib/product-1-1/background-direction";
import type { ProductOneToOneIntent } from "@/lib/product-1-1/intent-selection";
import type { ProductPromptCompositionBriefing } from "@/lib/product-1-1/policies/types";

interface BaselineCase {
  readonly intent: ProductOneToOneIntent;
  readonly direction: ProductOneToOneBackgroundDirection;
  readonly briefing: ProductPromptCompositionBriefing;
}

interface BaselineFixture {
  readonly promptBase: string;
  readonly references: readonly string[];
  readonly cases: readonly BaselineCase[];
}

export interface VerticalCompositionFixture {
  readonly id: string;
  readonly intent: ProductOneToOneIntent;
  readonly backgroundDirection: ProductOneToOneBackgroundDirection;
  readonly briefing: ProductPromptCompositionBriefing;
  readonly promptBase: string;
  readonly references: readonly string[];
}

const baseline = baselineJson as unknown as BaselineFixture;

const INTENT_MATRIX = ["offer", "spotlight", "exclusive"] as const;
const BACKGROUND_MATRIX = ["studio", "ambient", "original"] as const;

/** Variação realista de texto obrigatório em 2 dos 9 briefings. */
const MANDATORY_TEXT_OVERRIDES: Readonly<Record<string, string>> = {
  "offer-ambient": "Promoção válida enquanto durar o estoque.",
  "exclusive-studio": "Peça limitada — consulte disponibilidade na loja.",
};

function fixtureFor(
  intent: ProductOneToOneIntent,
  direction: ProductOneToOneBackgroundDirection,
): VerticalCompositionFixture {
  const entry = baseline.cases.find(
    (candidate) => candidate.intent === intent && candidate.direction === direction,
  );
  if (!entry) {
    throw new Error(`[vertical-briefings] missing baseline case ${intent}/${direction}`);
  }

  const id = `${intent}-${direction}`;
  const mandatoryArtworkText =
    MANDATORY_TEXT_OVERRIDES[id] ??
    entry.briefing.constraints.mandatoryArtworkText;

  return Object.freeze({
    id,
    intent,
    backgroundDirection: direction,
    briefing: Object.freeze({
      ...entry.briefing,
      constraints: Object.freeze({ mandatoryArtworkText }),
    }),
    promptBase: baseline.promptBase,
    // `original` preserva exatamente 1 imagem, como no fluxo novo 1:1.
    references: Object.freeze(
      direction === "original"
        ? baseline.references.slice(0, 1)
        : [...baseline.references],
    ),
  });
}

/** 3 intenções × 3 fundos = 9 briefings válidos do fluxo novo. */
export const VERTICAL_COMPOSITION_FIXTURES: readonly VerticalCompositionFixture[] =
  Object.freeze(
    INTENT_MATRIX.flatMap((intent) =>
      BACKGROUND_MATRIX.map((direction) => fixtureFor(intent, direction)),
    ),
  );
