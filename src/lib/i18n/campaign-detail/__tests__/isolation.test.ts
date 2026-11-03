/**
 * Prova de isolamento do namespace da campanha pronta.
 *
 * O catálogo é local à rota: não pode ser reexportado pelo barrel global nem
 * importado por shell, layout ou admin. A prova é estática e independe de build.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { es419Messages } from "@/lib/i18n/catalogs/es-419";
import { ptBRMessages } from "@/lib/i18n/catalogs/pt-BR";

import { es419CampaignDetailMessages } from "../catalogs/es-419";
import { ptBRCampaignDetailMessages } from "../catalogs/pt-BR";
import { getCampaignDetailMessages } from "../get-messages";

const ROOT = process.cwd();

const FORBIDDEN_IMPORT =
  /(?:from\s*|import\s*\(|require\s*\()\s*["'][^"']*(?:i18n\/campaign-detail|campaign-detail\/catalogs)/;

function read(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function collectFiles(relativeDir: string): string[] {
  const absolute = join(ROOT, relativeDir);
  const results: string[] = [];
  for (const entry of readdirSync(absolute)) {
    const childRelative = join(relativeDir, entry);
    const childAbsolute = join(ROOT, childRelative);
    if (statSync(childAbsolute).isDirectory()) {
      results.push(...collectFiles(childRelative));
    } else if (/\.(?:ts|tsx)$/.test(entry)) {
      results.push(childRelative);
    }
  }
  return results;
}

const BOUNDARY_FILES = [
  "src/lib/i18n/index.ts",
  "src/lib/i18n/messages.ts",
  "src/lib/i18n/get-catalog.ts",
  "src/app/(app)/layout.tsx",
  "src/components/shell/app-shell.tsx",
];

describe("isolamento do namespace da campanha pronta", () => {
  it("barrel global, mensagens, get-catalog, layout e shell não importam campaign-detail", () => {
    for (const file of BOUNDARY_FILES) {
      expect(
        FORBIDDEN_IMPORT.test(read(file)),
        `${file} importa o namespace da campanha pronta`,
      ).toBe(false);
    }
  });

  it("nenhum arquivo do admin importa o namespace da campanha pronta", () => {
    const adminFiles = collectFiles(join("src", "app", "(app)", "admin"));

    expect(adminFiles.length).toBeGreaterThan(0);
    for (const file of adminFiles) {
      expect(
        FORBIDDEN_IMPORT.test(read(file)),
        `${relative(ROOT, join(ROOT, file))} importa o namespace da campanha pronta`,
      ).toBe(false);
    }
  });

  it("o catálogo global não contém o namespace da campanha pronta", () => {
    for (const catalog of [ptBRMessages, es419Messages]) {
      const keys = Object.keys(catalog);
      expect(keys).not.toContain("campaignDetail");
      expect(keys).not.toContain("campaign-detail");
    }
  });

  it("o namespace é client-safe e não importa server-only", () => {
    const files = collectFiles(join("src", "lib", "i18n", "campaign-detail")).filter(
      (file) => !file.includes("__tests__"),
    );

    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(read(file), `${file} importa server-only`).not.toMatch(
        /(?:from|import)\s*["']server-only["']/,
      );
    }
  });

  it("resolve os catálogos esperados por locale", () => {
    expect(getCampaignDetailMessages("es-419")).toBe(
      es419CampaignDetailMessages,
    );
    expect(getCampaignDetailMessages("pt-BR")).toBe(
      ptBRCampaignDetailMessages,
    );
  });
});
