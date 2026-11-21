/**
 * Prova de isolamento do catálogo COMPARTILHADO de formatos.
 *
 * O namespace é client-safe e local às superfícies de campanha: o catálogo
 * global do shell/admin não o importa nem reexporta. A prova é estática.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { es419Messages } from "@/lib/i18n/catalogs/es-419";
import { ptBRMessages } from "@/lib/i18n/catalogs/pt-BR";

import { es419CampaignFormatMessages } from "../catalogs/es-419";
import { ptBRCampaignFormatMessages } from "../catalogs/pt-BR";

const ROOT = process.cwd();

const FORBIDDEN_IMPORT =
  /(?:from\s*|import\s*\(|require\s*\()\s*["'][^"']*campaign-formats/;

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

describe("isolamento do catálogo compartilhado de formatos", () => {
  it("barrel global, mensagens, get-catalog, layout e shell não importam formatos", () => {
    for (const file of BOUNDARY_FILES) {
      expect(
        FORBIDDEN_IMPORT.test(read(file)),
        `${file} importa campaign-formats`,
      ).toBe(false);
    }
  });

  it("o catálogo global não contém o namespace de formatos", () => {
    for (const catalog of [ptBRMessages, es419Messages]) {
      const keys = Object.keys(catalog);
      expect(keys).not.toContain("campaignFormats");
      expect(keys).not.toContain("campaign-formats");
      expect(keys).not.toContain("formats");
    }
  });

  it("o módulo é client-safe (sem server-only) e não importa o catálogo global", () => {
    const files = collectFiles(
      join("src", "lib", "i18n", "campaign-formats"),
    ).filter((file) => !file.includes("__tests__"));

    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = read(file);
      expect(source, `${file} importa server-only`).not.toMatch(
        /(?:from|import)\s*["']server-only["']/,
      );
      expect(source, `${file} importa o catálogo global`).not.toMatch(
        /(?:from|import)\s*["']@\/lib\/i18n\/catalogs/,
      );
    }
  });

  it("catálogos pt-BR e es-419 são objetos distintos e congelados", () => {
    expect(Object.isFrozen(ptBRCampaignFormatMessages)).toBe(true);
    expect(Object.isFrozen(es419CampaignFormatMessages)).toBe(true);
    expect(ptBRCampaignFormatMessages).not.toBe(
      es419CampaignFormatMessages,
    );
  });

  it("arquivos escaneados existem (sanidade do caminho)", () => {
    const files = collectFiles(
      join("src", "lib", "i18n", "campaign-formats"),
    );
    expect(
      files.map((file) => relative(ROOT, join(ROOT, file))).length,
    ).toBeGreaterThan(0);
  });
});
