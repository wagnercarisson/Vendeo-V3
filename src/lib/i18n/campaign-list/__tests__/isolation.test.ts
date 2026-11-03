/**
 * Prova de isolamento do namespace da listagem de campanhas.
 *
 * O catálogo da listagem é local à rota: não pode ser reexportado pelo barrel
 * global nem importado por shell, layout ou admin. A prova é estática, lendo
 * os arquivos de fronteira, e independe de build/deploy.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { es419Messages } from "@/lib/i18n/catalogs/es-419";
import { ptBRMessages } from "@/lib/i18n/catalogs/pt-BR";

import { es419CampaignListMessages } from "../catalogs/es-419";
import { ptBRCampaignListMessages } from "../catalogs/pt-BR";
import { getCampaignListMessages } from "../get-messages";

const ROOT = process.cwd();

const FORBIDDEN_IMPORT =
  /(?:from\s*|import\s*\(|require\s*\()\s*["'][^"']*(?:i18n\/campaign-list|campaign-list\/catalogs)/;

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

describe("isolamento do namespace da listagem", () => {
  it("barrel global, mensagens, get-catalog, layout e shell não importam a listagem", () => {
    for (const file of BOUNDARY_FILES) {
      expect(
        FORBIDDEN_IMPORT.test(read(file)),
        `${file} importa o namespace da listagem`,
      ).toBe(false);
    }
  });

  it("nenhum arquivo do admin importa o namespace da listagem", () => {
    const adminFiles = collectFiles(join("src", "app", "(app)", "admin"));

    expect(adminFiles.length).toBeGreaterThan(0);
    for (const file of adminFiles) {
      expect(
        FORBIDDEN_IMPORT.test(read(file)),
        `${relative(ROOT, join(ROOT, file))} importa o namespace da listagem`,
      ).toBe(false);
    }
  });

  it("o catálogo global não contém o namespace da listagem", () => {
    for (const catalog of [ptBRMessages, es419Messages]) {
      const keys = Object.keys(catalog);
      expect(keys).not.toContain("campaignList");
      expect(keys).not.toContain("campaign-list");
      expect(keys).not.toContain("campaigns");
    }
  });

  it("o namespace da listagem é client-safe e não importa server-only", () => {
    const files = collectFiles(join("src", "lib", "i18n", "campaign-list")).filter(
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
    expect(getCampaignListMessages("es-419")).toBe(es419CampaignListMessages);
    expect(getCampaignListMessages("pt-BR")).toBe(ptBRCampaignListMessages);
  });
});
