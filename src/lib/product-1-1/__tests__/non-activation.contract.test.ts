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

// Exceções ESTREITAS (Planos 56.2.1-02 e 56.2.1-03): cada importador autorizado
// tem seu próprio conjunto de módulos permitidos. NÃO excluir genericamente
// src/app/api/admin/** nem src/app/api/campaign/**.
const AUTHORIZED_ADMIN_AUTHORIZATION_ROUTE =
  "src/app/api/admin/product-flow-authorizations/route.ts";
const AUTHORIZED_CAMPAIGN_GENERATE_IMAGE_ROUTE =
  "src/app/api/campaign/generate-image/route.ts";

interface AuthorizedImportRule {
  readonly prefixes: readonly string[];
  readonly exact?: readonly string[];
}

const AUTHORIZED_PRODUCT_FLOW_IMPORTS: Readonly<
  Record<string, AuthorizedImportRule>
> = Object.freeze({
  [AUTHORIZED_ADMIN_AUTHORIZATION_ROUTE]: {
    prefixes: ["@/lib/product-1-1/authorization/"],
  },
  [AUTHORIZED_CAMPAIGN_GENERATE_IMAGE_ROUTE]: {
    prefixes: ["@/lib/product-1-1/submission/"],
    exact: ["@/lib/product-1-1/authorization/authorization-service"],
  },
});
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
  const rule = AUTHORIZED_PRODUCT_FLOW_IMPORTS[relativePath];
  if (!rule) return false;
  if (rule.prefixes.some((prefix) => specifier.startsWith(prefix))) return true;
  if (rule.exact?.includes(specifier)) return true;
  return false;
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

describe("Product 1:1 — exceções estreitas de importação (Planos 56.2.1-02/03)", () => {
  it("rota admin: permite SOMENTE módulos authorization/**", () => {
    expect(
      isAuthorizedAdminAuthorizationImport(
        AUTHORIZED_ADMIN_AUTHORIZATION_ROUTE,
        "@/lib/product-1-1/authorization/schemas",
      ),
    ).toBe(true);
    expect(
      isAuthorizedAdminAuthorizationImport(
        AUTHORIZED_ADMIN_AUTHORIZATION_ROUTE,
        "@/lib/product-1-1/submission/exclusive-fields",
      ),
    ).toBe(false);
  });

  it("rota generate-image: permite submission/** E o módulo exato authorization-service", () => {
    expect(
      isAuthorizedAdminAuthorizationImport(
        AUTHORIZED_CAMPAIGN_GENERATE_IMAGE_ROUTE,
        "@/lib/product-1-1/submission/exclusive-fields",
      ),
    ).toBe(true);
    expect(
      isAuthorizedAdminAuthorizationImport(
        AUTHORIZED_CAMPAIGN_GENERATE_IMAGE_ROUTE,
        "@/lib/product-1-1/authorization/authorization-service",
      ),
    ).toBe(true);
  });

  it("rota generate-image NÃO libera genericamente authorization/** nem outros módulos Produto 1:1", () => {
    for (const specifier of [
      "@/lib/product-1-1/authorization/schemas",
      "@/lib/product-1-1/authorization/authorization-decision",
      "@/lib/product-1-1/prompt-composition",
      "@/lib/product-1-1/submission",
    ]) {
      expect(
        isAuthorizedAdminAuthorizationImport(
          AUTHORIZED_CAMPAIGN_GENERATE_IMAGE_ROUTE,
          specifier,
        ),
        specifier,
      ).toBe(false);
    }
  });

  it("não libera outros importadores (outras rotas admin/campaign)", () => {
    for (const importer of [
      "src/app/api/admin/feature-flags/route.ts",
      "src/app/api/campaign/other/route.ts",
    ]) {
      expect(
        isAuthorizedAdminAuthorizationImport(
          importer,
          "@/lib/product-1-1/submission/exclusive-fields",
        ),
      ).toBe(false);
      expect(
        isAuthorizedAdminAuthorizationImport(importer, "@/lib/product-1-1/authorization/schemas"),
      ).toBe(false);
    }
  });

  it("classifica corretamente imports proibidos e permitidos no corpo das rotas autorizadas", () => {
    const forbidden =
      'import { decideProductFlow } from "@/lib/product-1-1/feature-flow-decision";';
    expect(
      hasUnauthorizedProductFlowImport(AUTHORIZED_ADMIN_AUTHORIZATION_ROUTE, forbidden),
    ).toBe(true);
    expect(
      hasUnauthorizedProductFlowImport(AUTHORIZED_CAMPAIGN_GENERATE_IMAGE_ROUTE, forbidden),
    ).toBe(true);

    const adminAllowed =
      'import { GrantStageAuthorizationRequestSchema } from "@/lib/product-1-1/authorization/schemas";';
    expect(
      hasUnauthorizedProductFlowImport(AUTHORIZED_ADMIN_AUTHORIZATION_ROUTE, adminAllowed),
    ).toBe(false);

    const campaignAllowed =
      'import { assertSubmissionEligible } from "@/lib/product-1-1/submission/assert-submission-eligible";\n' +
      'import { resolveProductFlowAuthorization } from "@/lib/product-1-1/authorization/authorization-service";';
    expect(
      hasUnauthorizedProductFlowImport(AUTHORIZED_CAMPAIGN_GENERATE_IMAGE_ROUTE, campaignAllowed),
    ).toBe(false);

    const campaignForbidden =
      'import { decideProductFlowAuthorization } from "@/lib/product-1-1/authorization/authorization-decision";';
    expect(
      hasUnauthorizedProductFlowImport(
        AUTHORIZED_CAMPAIGN_GENERATE_IMAGE_ROUTE,
        campaignForbidden,
      ),
    ).toBe(true);
  });
});
