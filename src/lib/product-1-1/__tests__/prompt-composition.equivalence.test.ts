import { describe, expect, it } from "vitest";

import baselineJson from "./fixtures/prompt-composition.baseline.json";
import { PROMPT_BASE_CONTENT, PROMPT_BASE_VERSION } from "../prompt-base";
import { COMPOSER_VERSION, composeProductPrompt } from "../prompt-composition";
import type { ProductPromptCompositionBriefing } from "../policies/types";

/**
 * Equivalência congelada do Produto 1:1 (ajuste estreito da quick 261009-u3h;
 * incorporação produtiva na quick 261011-lc6).
 *
 * Antes desta quick o arquivo comparava o Produto 1:1 diretamente contra a
 * bancada EXPERIMENTAL (lab) em tempo real. Como o laboratório passou a divergir
 * de propósito (prompts experimentais ainda não incorporados), a equivalência
 * deixou de ser "prod == lab mutável" e passou a ser "prod == fixture congelada do
 * baseline aprovado anterior".
 *
 * A fixture `fixtures/prompt-composition.baseline.json` congela, para as 9
 * combinações (3 intenções × 3 direções de fundo): o briefing de entrada, a
 * configuração, as contribuições resolvidas, e a saída esperada (texto, blocos e
 * versões). Ela foi gerada a partir da bancada PRÉ-mudança que passou na comparação
 * lab×prod (10/10) no commit `8f0b3fb0` — não apenas a partir da saída produtiva.
 *
 * A incorporação produtiva (quick 261011-lc6) atualizou a fixture para o
 * **baseline do laboratório aprovado pelo responsável em 2026-10-11** (quick
 * 261009-u3h, domínio `99017f35`). A rastreabilidade do baseline anterior é
 * preservada em `previousBaseline` (sourceCommit `8f0b3fb0` + proveniência). A
 * equivalência continua sendo aderência ao **baseline aprovado**, não igualdade
 * permanente com a bancada mutável.
 *
 * Nenhuma importação do laboratório é usada aqui: o runtime produtivo é a única
 * fonte de produção, confrontada contra o baseline imutável.
 */

interface FrozenCase {
  readonly intent: string;
  readonly direction: string;
  readonly briefing: ProductPromptCompositionBriefing;
  readonly expected: {
    readonly text: string;
    readonly blocks: Readonly<Record<string, string>>;
    readonly policyVersions: Readonly<Record<string, string>>;
  };
}

interface FrozenBaseline {
  readonly sourceCommit: string;
  readonly provenance: string;
  readonly approvedBy?: string;
  readonly approvedOn?: string;
  readonly previousBaseline?: {
    readonly sourceCommit: string;
    readonly provenance: string;
  };
  readonly promptBase: string;
  readonly promptBaseVersion: string;
  readonly composerVersion: string;
  readonly references: readonly string[];
  readonly cases: readonly FrozenCase[];
}

const baseline = baselineJson as unknown as FrozenBaseline;

describe("F48.2.6 → Product 1:1 frozen prompt equivalence", () => {
  it("fixa o prompt-base produtivo contra o baseline congelado", () => {
    expect(PROMPT_BASE_CONTENT).toBe(baseline.promptBase);
    expect(PROMPT_BASE_VERSION).toBe(baseline.promptBaseVersion);
  });

  it("fixa o compositor produtivo à versão do baseline congelado", () => {
    expect(COMPOSER_VERSION).toBe(baseline.composerVersion);
  });

  it("preserva a rastreabilidade do baseline anterior", () => {
    expect(baseline.sourceCommit).toBe("99017f35451366b05f51099bfe02143f1d49d206");
    expect(baseline.previousBaseline?.sourceCommit).toBe(
      "8f0b3fb0cb7fb3c9aecbe2c82abfc96ab50efd3f",
    );
    expect(baseline.previousBaseline?.provenance).toContain("10/10");
  });

  it.each(
    baseline.cases.map(
      (entry) => [`${entry.intent} / ${entry.direction}`, entry] as const,
    ),
  )(
    "mantém a saída produtiva idêntica ao baseline aprovado para %s",
    (_label, entry) => {
      const product = composeProductPrompt({
        briefing: entry.briefing,
        promptBase: baseline.promptBase,
        references: baseline.references,
      });

      expect(product.text).toBe(entry.expected.text);
      expect(product.blocks).toEqual(entry.expected.blocks);
      expect(product.policyVersions).toEqual(entry.expected.policyVersions);
      expect(product.composerVersion).toBe(baseline.composerVersion);
      expect(product.promptBaseVersion).toBe(baseline.promptBaseVersion);
    },
  );
});
