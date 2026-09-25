// @vitest-environment node
import { promises as fsp } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DIRECTOR_PROMPT_NAMES,
  INVALID_PROMPT_DIAGNOSTICS,
  InvalidPromptDiagnosticsError,
  PROMPT_DIAGNOSTIC_ITEM_KINDS,
  PROMPT_DIAGNOSTICS_SCHEMA_VERSION,
  PROMPT_DIAGNOSTICS_SCHEMA_VERSION_V2,
  parsePromptDiagnostics,
  treatableItems,
} from "../schema";
import type {
  AnyLabPromptDiagnostics,
  LabPromptDiagnostics,
  LabPromptDiagnosticsV2,
} from "../schema";
import {
  DIAGNOSTICS_HASH_MISMATCH,
  INVALID_DIAGNOSTICS_PATH,
  canonicalizeDiagnostics,
  computeDiagnosticsContentHash,
  getDiagnosticsVersionUsed,
  loadCurrentDiagnostics,
  loadDiagnosticsFile,
  loadDiagnosticsVersion,
  verifyDiagnosticsHash,
} from "../service";

/**
 * Diagnóstico versionado (F48.2.1, D3; ajuste do Checkpoint 1) — suíte de contrato.
 *
 * Cobre o parsing puro, o hash não autorreferente, o confinamento de path, o
 * filtro de tratáveis, a fixture v1 (preservada) e a fixture v2 (rastreabilidade
 * por item + distinção `kind`). Nenhuma rede e nenhuma chamada paga.
 */

const HEX_64 = "a".repeat(64);

function validDiagnostics(
  overrides: Partial<LabPromptDiagnostics> = {},
): LabPromptDiagnostics {
  return {
    schemaVersion: PROMPT_DIAGNOSTICS_SCHEMA_VERSION,
    diagnosticVersion: 1,
    generatedAt: "2026-09-25T00:00:00.000Z",
    sourceRefs: ["docs/alinhamento-fase-37-revisao-aprovacao-arte.md"],
    contentHash: HEX_64,
    items: [
      {
        failureCode: "invented_information",
        evidence: "Relato de arte com dado ausente no brief.",
        probableCause: "O prompt não proíbe explicitamente inventar dados.",
        promptTreatable: true,
        minimalHypothesis: "Reforçar a proibição de inventar informação.",
        promptName: "campaign-image-director-offer",
      },
      {
        failureCode: "renderer_limitation",
        evidence: "Falha de composição atribuída ao renderer.",
        probableCause: "O renderer não suporta a composição pedida.",
        promptTreatable: false,
        minimalHypothesis: "Encaminhar para a mudança de renderer.",
        promptName: "campaign-image-director-spotlight",
      },
    ],
    ...overrides,
  };
}

function validDiagnosticsV2(
  overrides: Partial<LabPromptDiagnosticsV2> = {},
): LabPromptDiagnosticsV2 {
  return {
    schemaVersion: PROMPT_DIAGNOSTICS_SCHEMA_VERSION_V2,
    diagnosticVersion: 2,
    generatedAt: "2026-09-25T16:55:00.000Z",
    sourceRefs: ["docs/alinhamento-fase-37-revisao-aprovacao-arte.md"],
    contentHash: HEX_64,
    items: [
      {
        kind: "observed_failure",
        failureCode: "invented_information",
        evidence: "Categoria de relato elegível da F37: informação inventada.",
        source: {
          ref: "docs/alinhamento-fase-37-revisao-aprovacao-arte.md",
          section: "D37.2-R2 — Relatos elegíveis: Informação inventada",
        },
        probableCause: "O prompt não proíbe explicitamente inventar dados.",
        promptTreatable: true,
        minimalHypothesis: "Reforçar a proibição de inventar informação.",
        promptName: "campaign-image-director-offer",
      },
      {
        kind: "taxonomy",
        failureCode: "renderer_composition_limitation",
        evidence: "Categoria de composição; sem evidência concreta de falha do prompt.",
        source: {
          ref: "docs/alinhamento-fase-37-revisao-aprovacao-arte.md",
          section:
            "D37.2-R2 — Relatos elegíveis: Falha grave de composição que impeça a publicação",
        },
        probableCause: "Limite do renderer; o prompt não controla o layout final.",
        promptTreatable: false,
        minimalHypothesis: "Encaminhar para a mudança de composição/renderer.",
        promptName: "campaign-image-director-spotlight",
      },
    ],
    ...overrides,
  };
}

describe("parsePromptDiagnostics — schema puro", () => {
  it("aceita um diagnóstico válido inline", () => {
    const parsed = parsePromptDiagnostics(validDiagnostics());

    expect(parsed.schemaVersion).toBe(PROMPT_DIAGNOSTICS_SCHEMA_VERSION);
    expect(parsed.diagnosticVersion).toBe(1);
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0].promptName).toBe("campaign-image-director-offer");
  });

  it("recusa promptName fora dos três prompts do Diretor", () => {
    const invalid = validDiagnostics({
      items: [
        {
          ...validDiagnostics().items[0],
          promptName: "campaign-image-director-other" as never,
        },
      ],
    });

    let caught: unknown;
    try {
      parsePromptDiagnostics(invalid);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(InvalidPromptDiagnosticsError);
    expect((caught as InvalidPromptDiagnosticsError).code).toBe(INVALID_PROMPT_DIAGNOSTICS);
  });

  it("recusa items vazio", () => {
    const result = (() => {
      try {
        parsePromptDiagnostics(validDiagnostics({ items: [] }));
        return null;
      } catch (error) {
        return error;
      }
    })();

    expect(result).toBeInstanceOf(InvalidPromptDiagnosticsError);
  });

  it("a mensagem de erro não vaza conteúdo bruto", () => {
    const error = (() => {
      try {
        parsePromptDiagnostics({ foo: "bar" });
        return null;
      } catch (caught) {
        return caught as Error;
      }
    })();

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toContain(INVALID_PROMPT_DIAGNOSTICS);
    expect(error?.message).not.toContain("base64");
  });
});

describe("parsePromptDiagnostics — v2 (rastreabilidade + kind)", () => {
  it("aceita um diagnóstico v2 válido inline", () => {
    const parsed = parsePromptDiagnostics(validDiagnosticsV2());

    expect(parsed.schemaVersion).toBe(PROMPT_DIAGNOSTICS_SCHEMA_VERSION_V2);
    expect(parsed.diagnosticVersion).toBe(2);
    expect(parsed.items).toHaveLength(2);
  });

  it("expõe os três kinds: observed_failure, hypothesis e taxonomy", () => {
    expect([...PROMPT_DIAGNOSTIC_ITEM_KINDS]).toEqual([
      "observed_failure",
      "hypothesis",
      "taxonomy",
    ]);
  });

  it("recusa item v2 sem 'kind'", () => {
    const doc = validDiagnosticsV2();
    const { kind: _ignored, ...itemWithoutKind } = doc.items[0];
    const invalid = { ...doc, items: [itemWithoutKind] };

    expect(() => parsePromptDiagnostics(invalid)).toThrowError(InvalidPromptDiagnosticsError);
  });

  it("recusa item v2 sem 'source' (sem rastreabilidade por item)", () => {
    const doc = validDiagnosticsV2();
    const { source: _ignored, ...itemWithoutSource } = doc.items[0];
    const invalid = { ...doc, items: [itemWithoutSource] };

    expect(() => parsePromptDiagnostics(invalid)).toThrowError(InvalidPromptDiagnosticsError);
  });

  it("recusa taxonomia tratável por prompt (taxonomy_not_prompt_treatable)", () => {
    const doc = validDiagnosticsV2();
    const invalid = {
      ...doc,
      items: [{ ...doc.items[1], promptTreatable: true }],
    };

    const error = (() => {
      try {
        parsePromptDiagnostics(invalid);
        return null;
      } catch (caught) {
        return caught;
      }
    })();

    expect(error).toBeInstanceOf(InvalidPromptDiagnosticsError);
    expect(
      (error as InvalidPromptDiagnosticsError).issues.some(
        (issue) => issue.message === "taxonomy_not_prompt_treatable",
      ),
    ).toBe(true);
  });
});

describe("computeDiagnosticsContentHash — não autorreferente", () => {
  it("ignora o próprio campo contentHash", () => {
    const a = validDiagnostics({ contentHash: "a".repeat(64) });
    const b = validDiagnostics({ contentHash: "b".repeat(64) });

    expect(computeDiagnosticsContentHash(a)).toBe(computeDiagnosticsContentHash(b));
    expect(canonicalizeDiagnostics(a)).toBe(canonicalizeDiagnostics(b));
  });

  it("muda quando outro campo muda", () => {
    const original = validDiagnostics();
    const changed = validDiagnostics({
      items: [
        { ...validDiagnostics().items[0], evidence: "Evidência diferente." },
        validDiagnostics().items[1],
      ],
    });

    expect(computeDiagnosticsContentHash(changed)).not.toBe(
      computeDiagnosticsContentHash(original),
    );
  });

  it("gera hash hexadecimal de 64 caracteres", () => {
    expect(computeDiagnosticsContentHash(validDiagnostics())).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("loadDiagnosticsFile — confinamento de path", () => {
  it("recusa nome de arquivo com '..' ou '/' com invalid_diagnostics_path", async () => {
    await expect(loadDiagnosticsFile("../../etc/passwd")).rejects.toThrowError(
      INVALID_DIAGNOSTICS_PATH,
    );
    await expect(loadDiagnosticsFile("f37/other.json")).rejects.toThrowError(
      INVALID_DIAGNOSTICS_PATH,
    );
    await expect(loadDiagnosticsFile("..")).rejects.toThrowError(INVALID_DIAGNOSTICS_PATH);
  });
});

describe("treatableItems — falha não tratável não gera candidata", () => {
  it("filtra apenas promptTreatable === true", () => {
    const parsed = parsePromptDiagnostics(validDiagnostics());
    const treatable = treatableItems(parsed);

    expect(treatable).toHaveLength(1);
    expect(treatable[0].failureCode).toBe("invented_information");
    expect(treatable.every((item) => item.promptTreatable)).toBe(true);
  });
});

describe("diagnóstico v1 da F37 — fixture preservada", () => {
  it("carrega a v1 explicitamente e o contentHash gravado confere", async () => {
    const v1 = await loadDiagnosticsVersion(1);

    expect(v1.diagnosticVersion).toBe(1);
    expect(v1.schemaVersion).toBe(PROMPT_DIAGNOSTICS_SCHEMA_VERSION);
    expect(v1.sourceRefs.length).toBeGreaterThan(0);
    expect(() => verifyDiagnosticsHash(v1)).not.toThrow();
    expect(computeDiagnosticsContentHash(v1)).toBe(v1.contentHash);
  });

  it("cada item da v1 tem a cadeia completa", async () => {
    const v1 = await loadDiagnosticsVersion(1);

    for (const item of v1.items) {
      expect(item.failureCode.length).toBeGreaterThan(0);
      expect(item.evidence.length).toBeGreaterThan(0);
      expect(item.probableCause.length).toBeGreaterThan(0);
      expect(typeof item.promptTreatable).toBe("boolean");
      expect(item.minimalHypothesis.length).toBeGreaterThan(0);
      expect(DIRECTOR_PROMPT_NAMES).toContain(item.promptName);
    }
  });

  it("os promptName da v1 cobrem os três prompts do Diretor", async () => {
    const v1 = await loadDiagnosticsVersion(1);
    const used = new Set(v1.items.map((item) => item.promptName));

    for (const promptName of DIRECTOR_PROMPT_NAMES) {
      expect(used.has(promptName)).toBe(true);
    }
  });

  it("existe ao menos um item não tratável por prompt na v1", async () => {
    const v1 = await loadDiagnosticsVersion(1);
    const nonTreatable = v1.items.filter((item) => item.promptTreatable === false);

    expect(nonTreatable.length).toBeGreaterThanOrEqual(1);
    expect(treatableItems(v1).length).toBeLessThan(v1.items.length);
  });
});

describe("diagnóstico v2 da F37 — rastreabilidade por item e kind", () => {
  it("é a versão corrente e o contentHash confere", async () => {
    const current = await loadCurrentDiagnostics();

    expect(current.diagnosticVersion).toBe(2);
    expect(current.schemaVersion).toBe(PROMPT_DIAGNOSTICS_SCHEMA_VERSION_V2);
    expect(() => verifyDiagnosticsHash(current)).not.toThrow();
    expect(computeDiagnosticsContentHash(current)).toBe(current.contentHash);
  });

  it("getDiagnosticsVersionUsed retorna a v2 e a v1 permanece carregável", async () => {
    const used = await getDiagnosticsVersionUsed();

    expect(used.diagnosticVersion).toBe(2);
    expect(used.contentHash).toMatch(/^[0-9a-f]{64}$/);

    const v1 = await loadDiagnosticsVersion(1);
    expect(v1.diagnosticVersion).toBe(1);
  });

  it("todo item da v2 declara kind e source.ref/source.section", async () => {
    const current = await loadCurrentDiagnostics();
    if (current.schemaVersion !== PROMPT_DIAGNOSTICS_SCHEMA_VERSION_V2) {
      throw new Error("esperava diagnóstico v2 como corrente");
    }

    for (const item of current.items) {
      expect(PROMPT_DIAGNOSTIC_ITEM_KINDS).toContain(item.kind);
      expect(item.source.ref.length).toBeGreaterThan(0);
      expect(item.source.section.length).toBeGreaterThan(0);
    }
  });

  it("distingue falha observada de hipótese/taxonomia", async () => {
    const current = await loadCurrentDiagnostics();
    if (current.schemaVersion !== PROMPT_DIAGNOSTICS_SCHEMA_VERSION_V2) {
      throw new Error("esperava diagnóstico v2 como corrente");
    }

    const observed = current.items.filter((item) => item.kind === "observed_failure");
    const nonObserved = current.items.filter((item) => item.kind !== "observed_failure");

    expect(observed.length).toBeGreaterThanOrEqual(1);
    expect(nonObserved.length).toBeGreaterThanOrEqual(1);
    for (const item of observed) {
      expect(item.evidence.length).toBeGreaterThan(0);
      expect(item.source.section.length).toBeGreaterThan(0);
    }
    // Itens sem evidência concreta foram reclassificados e nunca se apresentam
    // como falha observada; taxonomia não é alvo direto de prompt.
    for (const item of current.items.filter((entry) => entry.kind === "taxonomy")) {
      expect(item.promptTreatable).toBe(false);
    }
  });

  it("cobre os três prompts e mantém ao menos um item não tratável", async () => {
    const current = await loadCurrentDiagnostics();
    const used = new Set(current.items.map((item) => item.promptName));

    for (const promptName of DIRECTOR_PROMPT_NAMES) {
      expect(used.has(promptName)).toBe(true);
    }
    const nonTreatable = current.items.filter((item) => item.promptTreatable === false);
    expect(nonTreatable.length).toBeGreaterThanOrEqual(1);
    expect(treatableItems(current).length).toBeLessThan(current.items.length);
  });
});

describe("regra de versão — a maior vence e as anteriores permanecem", () => {
  it("uma v3 temporária é usada como corrente e v1/v2 permanecem intactas", async () => {
    const v1 = await loadDiagnosticsVersion(1);
    const v2 = await loadDiagnosticsVersion(2);
    const v3Path = path.resolve(
      process.cwd(),
      "fixtures/lab/diagnostics/f37/f37-prompt-diagnostics.v3.json",
    );

    const v3Base = { ...v2, diagnosticVersion: 3, contentHash: "0".repeat(64) };
    const v3 = { ...v3Base, contentHash: computeDiagnosticsContentHash(v3Base) };
    await fsp.writeFile(v3Path, `${JSON.stringify(v3, null, 2)}\n`, "utf8");

    try {
      const current = await loadCurrentDiagnostics();
      expect(current.diagnosticVersion).toBe(3);
      expect(current.contentHash).toBe(v3.contentHash);

      // As versões anteriores continuam legíveis e inalteradas (imutabilidade).
      const stillV1 = await loadDiagnosticsVersion(1);
      expect(stillV1.diagnosticVersion).toBe(1);
      expect(stillV1.contentHash).toBe(v1.contentHash);
      const stillV2 = await loadDiagnosticsVersion(2);
      expect(stillV2.diagnosticVersion).toBe(2);
      expect(stillV2.contentHash).toBe(v2.contentHash);
    } finally {
      await fsp.rm(v3Path, { force: true });
    }
  });

  it("um campo alterado invalida o hash (diagnostics_hash_mismatch)", async () => {
    const current = await loadCurrentDiagnostics();
    const tampered = {
      ...current,
      items: [{ ...current.items[0], evidence: "Evidência adulterada." }],
    } as unknown as AnyLabPromptDiagnostics;

    expect(() => verifyDiagnosticsHash(tampered)).toThrowError(DIAGNOSTICS_HASH_MISMATCH);
  });

  it("path com '../' é recusado com invalid_diagnostics_path", async () => {
    await expect(loadDiagnosticsFile("../f37-prompt-diagnostics.v1.json")).rejects.toThrowError(
      INVALID_DIAGNOSTICS_PATH,
    );
  });
});
