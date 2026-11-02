/**
 * Prova de isolamento do namespace dashboard (F58, REQ-58-06).
 *
 * O catálogo do dashboard é local à rota: não pode ser reexportado pelo barrel
 * global nem importado por shell, layout ou admin. A prova é estática, lendo os
 * arquivos de fronteira, e independe de build/deploy.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { es419Messages } from "@/lib/i18n/catalogs/es-419";
import { ptBRMessages } from "@/lib/i18n/catalogs/pt-BR";
import { es419DashboardMessages } from "../catalogs/es-419";
import { ptBRDashboardMessages } from "../catalogs/pt-BR";
import { getDashboardMessages } from "../get-messages";

const ROOT = process.cwd();

const FORBIDDEN_IMPORT = /(?:from\s*|import\s*\(|require\s*\()\s*["'][^"']*(?:i18n\/dashboard|dashboard\/catalogs)/;

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

type FlatCatalog = Record<string, string>;

function flatten(value: unknown, prefix = ""): FlatCatalog {
  const result: FlatCatalog = {};
  if (typeof value !== "object" || value === null) {
    if (typeof value === "string") result[prefix] = value;
    return result;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    Object.assign(result, flatten(child, path));
  }
  return result;
}

const BOUNDARY_FILES = [
  "src/lib/i18n/index.ts",
  "src/lib/i18n/messages.ts",
  "src/lib/i18n/get-catalog.ts",
  "src/app/(app)/layout.tsx",
  "src/components/shell/app-shell.tsx",
];

describe("isolamento do namespace dashboard", () => {
  it("barrel global, mensagens, get-catalog, layout e shell não importam o dashboard", () => {
    for (const file of BOUNDARY_FILES) {
      expect(FORBIDDEN_IMPORT.test(read(file)), `${file} importa o namespace dashboard`).toBe(
        false,
      );
    }
  });

  it("nenhum arquivo do admin importa o namespace dashboard", () => {
    const adminFiles = collectFiles(join("src", "app", "(app)", "admin"));

    expect(adminFiles.length).toBeGreaterThan(0);
    for (const file of adminFiles) {
      expect(
        FORBIDDEN_IMPORT.test(read(file)),
        `${relative(ROOT, join(ROOT, file))} importa o namespace dashboard`,
      ).toBe(false);
    }
  });

  it("o catálogo global não contém chaves exclusivas do dashboard", () => {
    for (const catalog of [ptBRMessages, es419Messages]) {
      const keys = Object.keys(flatten(catalog));
      expect(keys.filter((key) => key.startsWith("dashboard."))).toEqual([]);
    }
  });

  it("o namespace dashboard é client-safe e não importa server-only", () => {
    const dashboardFiles = collectFiles(join("src", "lib", "i18n", "dashboard")).filter(
      (file) => !file.includes(`__tests__`),
    );

    expect(dashboardFiles.length).toBeGreaterThan(0);
    for (const file of dashboardFiles) {
      expect(read(file), `${file} importa server-only`).not.toMatch(
        /(?:from|import)\s*["']server-only["']/,
      );
    }
  });

  it("resolve os catálogos esperados por locale", () => {
    expect(getDashboardMessages("es-419")).toBe(es419DashboardMessages);
    expect(getDashboardMessages("pt-BR")).toBe(ptBRDashboardMessages);
  });
});
