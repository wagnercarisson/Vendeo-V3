/**
 * Prova de isolamento do namespace da página de novidades.
 *
 * O catálogo é local à rota: não pode ser reexportado pelo barrel global nem
 * importado por shell, layout ou admin. A prova é estática e independe de build.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { es419Messages } from "@/lib/i18n/catalogs/es-419";
import { ptBRMessages } from "@/lib/i18n/catalogs/pt-BR";

import { es419NovidadesMessages } from "../catalogs/es-419";
import { ptBRNovidadesMessages } from "../catalogs/pt-BR";
import { getNovidadesMessages } from "../get-messages";

const ROOT = process.cwd();

const FORBIDDEN_IMPORT =
  /(?:from\s*|import\s*\(|require\s*\()\s*["'][^"']*(?:i18n\/novidades|novidades\/catalogs)/;

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

describe("isolamento do namespace de novidades", () => {
  it("barrel global, mensagens, get-catalog, layout e shell não importam novidades", () => {
    for (const file of BOUNDARY_FILES) {
      expect(
        FORBIDDEN_IMPORT.test(read(file)),
        `${file} importa o namespace de novidades`,
      ).toBe(false);
    }
  });

  it("nenhum arquivo do admin importa o namespace de novidades", () => {
    const adminFiles = collectFiles(join("src", "app", "(app)", "admin"));

    expect(adminFiles.length).toBeGreaterThan(0);
    for (const file of adminFiles) {
      expect(
        FORBIDDEN_IMPORT.test(read(file)),
        `${relative(ROOT, join(ROOT, file))} importa o namespace de novidades`,
      ).toBe(false);
    }
  });

  it("o catálogo global não contém o namespace de novidades", () => {
    for (const catalog of [ptBRMessages, es419Messages]) {
      const keys = Object.keys(catalog);
      expect(keys).not.toContain("novidades");
      expect(keys).not.toContain("news");
    }
  });

  it("o namespace de novidades é client-safe e não importa server-only", () => {
    const files = collectFiles(join("src", "lib", "i18n", "novidades")).filter(
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
    expect(getNovidadesMessages("es-419")).toBe(es419NovidadesMessages);
    expect(getNovidadesMessages("pt-BR")).toBe(ptBRNovidadesMessages);
  });
});
