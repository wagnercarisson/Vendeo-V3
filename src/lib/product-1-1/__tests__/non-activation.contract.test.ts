// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { FeatureFlagService } from "@/lib/feature-flags/feature-flag-service";
import { resolveProductOneToOneFlow } from "../feature-flow-decision-service";

const SOURCE_ROOT = path.resolve(process.cwd(), "src");
const PRODUCT_MODULE_ROOTS = [
  "src/lib/product-1-1/",
  "src/components/product-1-1/",
];
const PRODUCT_FLOW_IMPORT_CAPTURE_RE =
  /(?:from\s*|import\s*\(\s*)["']([^"']*(?:product-1-1|image-generation-operations-repository)[^"']*)["']/g;

// Exceção ESTREITA (Plano 56.2.1-02): SOMENTE esta rota administrativa pode
// importar módulos sob @/lib/product-1-1/authorization/**. Qualquer outro
// importador (src/app ou legado) e qualquer outro módulo Produto 1:1
// permanecem proibidos. Não excluir genericamente src/app/api/admin/**.
const AUTHORIZED_ADMIN_AUTHORIZATION_ROUTE =
  "src/app/api/admin/product-flow-authorizations/route.ts";
const AUTHORIZED_PRODUCT_MODULE_PREFIXES = ["@/lib/product-1-1/authorization/"];
const SIDE_EFFECT_IMPORT_RE =
  /(?:from\s*|import\s*\(\s*)["'][^"']*(?:\/api\/campaign|\/adapters?(?:\/|$)|\/gateway(?:\/|$)|provider|\/credit(?:\/|$)|delivery|download|image-generation-operations-repository|prompt-composition)[^"']*["']/i;

interface RuntimeSource {
  readonly relativePath: string;
  readonly absolutePath: string;
}

function collectRuntimeSources(directory: string): RuntimeSource[] {
  const sources: RuntimeSource[] = [];

  for (const entry of readdirSync(directory)) {
    if (entry === "__tests__" || entry === "node_modules") continue;

    const absolutePath = path.join(directory, entry);
    if (statSync(absolutePath).isDirectory()) {
      sources.push(...collectRuntimeSources(absolutePath));
      continue;
    }

    if (!/\.(ts|tsx)$/.test(entry) || /\.(test|spec)\./.test(entry)) continue;

    sources.push({
      relativePath: path.relative(process.cwd(), absolutePath).split(path.sep).join("/"),
      absolutePath,
    });
  }

  return sources;
}

function collectProductFlowImports(source: string): string[] {
  const specifiers: string[] = [];
  const re = new RegExp(PRODUCT_FLOW_IMPORT_CAPTURE_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

function isAuthorizedAdminAuthorizationImport(
  relativePath: string,
  specifier: string,
): boolean {
  return (
    relativePath === AUTHORIZED_ADMIN_AUTHORIZATION_ROUTE &&
    AUTHORIZED_PRODUCT_MODULE_PREFIXES.some((prefix) => specifier.startsWith(prefix))
  );
}

function hasUnauthorizedProductFlowImport(relativePath: string, source: string): boolean {
  return collectProductFlowImports(source).some(
    (specifier) => !isAuthorizedAdminAuthorizationImport(relativePath, specifier),
  );
}

describe("Product 1:1 — contrato transversal de não-ativação", () => {
  it("as combinações das chaves só produzem uma decisão sem efeitos de geração", async () => {
    const cases = [
      { test: false, all: false, store: false, expected: "legacy" },
      { test: false, all: false, store: true, expected: "legacy" },
      { test: true, all: false, store: true, expected: "new_flow" },
      { test: true, all: false, store: false, expected: "legacy" },
      { test: false, all: true, store: false, expected: "new_flow" },
      { test: false, all: true, store: true, expected: "new_flow" },
      { test: true, all: true, store: false, expected: "new_flow" },
      { test: true, all: true, store: true, expected: "new_flow" },
    ] as const;

    for (const scenario of cases) {
      const readProductOneToOneFlags = vi.fn().mockResolvedValue({
        testStoresEnabled: scenario.test,
        allStoresEnabled: scenario.all,
        testStoresStatus: "valid",
        allStoresStatus: "valid",
      });
      const service = { readProductOneToOneFlags } as unknown as FeatureFlagService;

      await expect(
        resolveProductOneToOneFlow({ isTestStore: scenario.store }, service),
      ).resolves.toBe(scenario.expected);
      expect(readProductOneToOneFlags).toHaveBeenCalledTimes(1);
    }
  });

  it("os módulos de decisão não importam geração, provider, crédito ou entrega", () => {
    const decisionFiles = [
      "src/lib/product-1-1/feature-flow-decision.ts",
      "src/lib/product-1-1/feature-flow-decision-service.ts",
    ];

    for (const file of decisionFiles) {
      const source = readFileSync(path.resolve(process.cwd(), file), "utf8");
      expect(source, file).not.toMatch(SIDE_EFFECT_IMPORT_RE);
      expect(source, file).not.toMatch(/\b(?:createCampaign|generateImage|reserveCredit|deliverCampaign|downloadCampaign)\s*\(/);
    }
  });

  it("nenhuma rota do lojista importa seletores/composição do Produto 1:1", () => {
    const appSources = collectRuntimeSources(path.join(SOURCE_ROOT, "app"));
    const violations = appSources
      .filter(({ relativePath, absolutePath }) =>
        hasUnauthorizedProductFlowImport(relativePath, readFileSync(absolutePath, "utf8")),
      )
      .map(({ relativePath }) => relativePath);

    expect(violations).toEqual([]);
  });

  it("nenhum runtime legado importa as estruturas do Produto 1:1", () => {
    const legacySources = collectRuntimeSources(SOURCE_ROOT).filter(({ relativePath }) =>
      !PRODUCT_MODULE_ROOTS.some((root) => relativePath.startsWith(root)),
    );
    const violations = legacySources
      .filter(({ relativePath, absolutePath }) =>
        hasUnauthorizedProductFlowImport(relativePath, readFileSync(absolutePath, "utf8")),
      )
      .map(({ relativePath }) => relativePath);

    expect(violations).toEqual([]);
  });
});

describe("Product 1:1 — exceção estreita da rota admin de autorização (Plano 56.2.1-02)", () => {
  it("permite SOMENTE a rota autorizada importando módulos authorization", () => {
    expect(
      isAuthorizedAdminAuthorizationImport(
        AUTHORIZED_ADMIN_AUTHORIZATION_ROUTE,
        "@/lib/product-1-1/authorization/schemas",
      ),
    ).toBe(true);
  });

  it("não libera outros importadores (nem outras rotas admin)", () => {
    expect(
      isAuthorizedAdminAuthorizationImport(
        "src/app/api/admin/feature-flags/route.ts",
        "@/lib/product-1-1/authorization/schemas",
      ),
    ).toBe(false);
  });

  it("não libera outros módulos Produto 1:1 pela rota autorizada", () => {
    for (const specifier of [
      "@/lib/product-1-1/prompt-composition",
      "@/lib/product-1-1/authorization",
      "@/lib/product-1-1/authorization-of-other",
    ]) {
      expect(
        isAuthorizedAdminAuthorizationImport(AUTHORIZED_ADMIN_AUTHORIZATION_ROUTE, specifier),
        specifier,
      ).toBe(false);
    }
  });

  it("classifica corretamente imports proibidos e permitidos no corpo da rota autorizada", () => {
    const forbidden =
      'import { decideProductFlow } from "@/lib/product-1-1/feature-flow-decision";';
    expect(
      hasUnauthorizedProductFlowImport(AUTHORIZED_ADMIN_AUTHORIZATION_ROUTE, forbidden),
    ).toBe(true);

    const allowed =
      'import { GrantStageAuthorizationRequestSchema } from "@/lib/product-1-1/authorization/schemas";';
    expect(
      hasUnauthorizedProductFlowImport(AUTHORIZED_ADMIN_AUTHORIZATION_ROUTE, allowed),
    ).toBe(false);
  });
});
