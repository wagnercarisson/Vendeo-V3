// @vitest-environment node
import { promises as fsp } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DIRECTOR_PROMPT_NAMES,
  INVALID_PROMPT_DIAGNOSTICS,
  InvalidPromptDiagnosticsError,
  PROMPT_DIAGNOSTICS_SCHEMA_VERSION,
  parsePromptDiagnostics,
  treatableItems,
} from "../schema";
import type { LabPromptDiagnostics } from "../schema";
import {
  DIAGNOSTICS_HASH_MISMATCH,
  INVALID_DIAGNOSTICS_PATH,
  canonicalizeDiagnostics,
  computeDiagnosticsContentHash,
  loadCurrentDiagnostics,
  loadDiagnosticsFile,
  loadDiagnosticsVersion,
  verifyDiagnosticsHash,
} from "../service";

/**
 * Diagnóstico versionado (F48.2.1, D3) — suíte de contrato.
 *
 * Esta suíte cobre apenas o que **não** depende da fixture real: parsing puro,
 * hash não autorreferente, confinamento de path e filtro de tratáveis. Os testes
 * que dependem da fixture v1 e da regra de versão vivem no mesmo arquivo,
 * adicionados pelas Tasks 2-3. Nenhuma rede e nenhuma chamada paga.
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

describe("diagnóstico v1 da F37 — fixture materializada", () => {
  it("carrega a v1 e o contentHash gravado confere com o recalculado", async () => {
    const current = await loadCurrentDiagnostics();

    expect(current.diagnosticVersion).toBe(1);
    expect(current.schemaVersion).toBe(PROMPT_DIAGNOSTICS_SCHEMA_VERSION);
    expect(current.sourceRefs.length).toBeGreaterThan(0);
    expect(() => verifyDiagnosticsHash(current)).not.toThrow();
    expect(computeDiagnosticsContentHash(current)).toBe(current.contentHash);
  });

  it("cada item tem a cadeia completa", async () => {
    const current = await loadCurrentDiagnostics();

    for (const item of current.items) {
      expect(item.failureCode.length).toBeGreaterThan(0);
      expect(item.evidence.length).toBeGreaterThan(0);
      expect(item.probableCause.length).toBeGreaterThan(0);
      expect(typeof item.promptTreatable).toBe("boolean");
      expect(item.minimalHypothesis.length).toBeGreaterThan(0);
      expect(DIRECTOR_PROMPT_NAMES).toContain(item.promptName);
    }
  });

  it("os promptName cobrem os três prompts do Diretor", async () => {
    const current = await loadCurrentDiagnostics();
    const used = new Set(current.items.map((item) => item.promptName));

    for (const promptName of DIRECTOR_PROMPT_NAMES) {
      expect(used.has(promptName)).toBe(true);
    }
  });

  it("existe ao menos um item não tratável por prompt", async () => {
    const current = await loadCurrentDiagnostics();
    const nonTreatable = current.items.filter((item) => item.promptTreatable === false);

    expect(nonTreatable.length).toBeGreaterThanOrEqual(1);
    // A falha não tratável registra o encaminhamento e não gera candidata.
    expect(treatableItems(current).length).toBeLessThan(current.items.length);
  });
});

describe("regra de versão — a maior vence e a anterior permanece", () => {
  it("uma v2 temporária é usada como corrente e a v1 permanece intacta", async () => {
    const v1 = await loadDiagnosticsVersion(1);
    const v2Path = path.resolve(
      process.cwd(),
      "fixtures/lab/diagnostics/f37/f37-prompt-diagnostics.v2.json",
    );

    const v2Base = { ...v1, diagnosticVersion: 2, contentHash: "0".repeat(64) };
    const v2 = { ...v2Base, contentHash: computeDiagnosticsContentHash(v2Base) };
    await fsp.writeFile(v2Path, `${JSON.stringify(v2, null, 2)}\n`, "utf8");

    try {
      const current = await loadCurrentDiagnostics();
      expect(current.diagnosticVersion).toBe(2);
      expect(current.contentHash).toBe(v2.contentHash);

      // A versão anterior continua legível e inalterada (imutabilidade).
      const stillV1 = await loadDiagnosticsVersion(1);
      expect(stillV1.diagnosticVersion).toBe(1);
      expect(stillV1.contentHash).toBe(v1.contentHash);
    } finally {
      await fsp.rm(v2Path, { force: true });
    }
  });

  it("um campo alterado invalida o hash (diagnostics_hash_mismatch)", async () => {
    const current = await loadCurrentDiagnostics();
    const tampered = {
      ...current,
      items: [{ ...current.items[0], evidence: "Evidência adulterada." }],
    };

    expect(() => verifyDiagnosticsHash(tampered)).toThrowError(DIAGNOSTICS_HASH_MISMATCH);
  });

  it("path com '../' é recusado com invalid_diagnostics_path", async () => {
    await expect(loadDiagnosticsFile("../f37-prompt-diagnostics.v1.json")).rejects.toThrowError(
      INVALID_DIAGNOSTICS_PATH,
    );
  });
});
