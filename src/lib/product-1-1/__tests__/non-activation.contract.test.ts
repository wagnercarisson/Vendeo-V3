// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { FeatureFlagService } from "@/lib/feature-flags/feature-flag-service";
import { resolveProductOneToOneFlow } from "../feature-flow-decision-service";
import { buildCampaignGenerationBody } from "@/components/flow/use-campaign-form";
import { detectExclusiveNewFlowFields } from "../submission/exclusive-fields";

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
// F56.2b1b (Plano 04 — reconciliação G-NA): a rota de status do reenvio
// (query-only) importa SOMENTE o módulo exato `orchestration/resend-query`.
const AUTHORIZED_CAMPAIGN_GENERATION_STATUS_ROUTE =
  "src/app/api/campaign/generation-status/route.ts";

// F56.2b1b (Plano 01 — reconciliação G-NA): o formulário elegível do Produto 1:1
// introduz importadores legados (fora de src/lib|components/product-1-1). SÓ
// pares EXPLÍCITOS importador+módulo — nunca `@/lib/product-1-1/**` genérico. As
// duas exceções b1a acima permanecem intactas. Esta tarefa é a ÚNICA gravação da
// G-NA na onda 1 (ordem da fase: 01 → 04 → 06 → 07, sequencial).
const AUTHORIZED_CAMPANHAS_NOVA_PAGE = "src/app/(app)/campanhas/nova/page.tsx";
const AUTHORIZED_FLOW_BACKGROUND_DIRECTION_SELECTOR =
  "src/components/flow/background-direction-selector.tsx";
const AUTHORIZED_FLOW_CAMPAIGN_INPUT_FORM =
  "src/components/flow/campaign-input-form.tsx";
const AUTHORIZED_FLOW_USE_CAMPAIGN_FORM =
  "src/components/flow/use-campaign-form.ts";

// F56.2b1b (Plano 06 — reconciliação G-NA): a rota de download do novo fluxo e a
// página persistida `campanhas/[id]` introduzem importadores legados. SÓ pares
// EXPLÍCITOS importador+módulo — nunca `@/lib/product-1-1/**` genérico.
// `src/lib/campaign/display.ts` NÃO importa `product-1-1` (união de estado local)
// — provado por teste NEGATIVO.
const AUTHORIZED_CAMPAIGN_DOWNLOAD_ROUTE =
  "src/app/api/campaign/[id]/download/route.ts";
const AUTHORIZED_CAMPANHAS_ID_PAGE = "src/app/(app)/campanhas/[id]/page.tsx";
const NO_PRODUCT_FLOW_IMPORT_MODULE = "src/lib/campaign/display.ts";

// F56.2b2a (Plano 03 — reconciliação G-NA): a rota AUTENTICADA da recuperação
// de copy introduz importadores legados. SÓ pares EXPLÍCITOS importador+módulo —
// nunca `@/lib/product-1-1/**` genérico. `AUTHORIZED_CAMPANHAS_ID_PAGE` permanece
// INALTERADO (a página usa apenas o módulo já autorizado `copy/copy-state`).
const AUTHORIZED_CAMPAIGN_COPY_RECOVERY_ROUTE =
  "src/app/api/campaign/[id]/copy-recovery/route.ts";

// F56.2b2b (Plano 02 — reconciliação G-NA): a rota AUTENTICADA da recuperação de
// imagem introduz importadores legados. SÓ pares EXPLÍCITOS importador+módulo —
// nunca `@/lib/product-1-1/**` genérico. `AUTHORIZED_CAMPANHAS_ID_PAGE` permanece
// INALTERADO (a rota de recuperação de imagem não toca a página).
const AUTHORIZED_CAMPAIGN_IMAGE_RECOVERY_ROUTE =
  "src/app/api/campaign/[id]/image-recovery/route.ts";

// F56.2b1b (Plano 07 — reconciliação G-NA, ÚLTIMO escritor da sequência
// 01 → 04 → 06 → 07): as superfícies admin de resolução introduzem importadores
// legados. SÓ pares EXPLÍCITOS importador+módulo — nunca `@/lib/product-1-1/**`
// genérico nem `pending/**` por prefixo. O `resolution-form.tsx` é CLIENT
// component: NÃO importa `product-1-1` (tipos inline por props). `schemas.ts` e
// `(app)/admin/layout.tsx` NÃO importam `product-1-1` (negativos).
const AUTHORIZED_ADMIN_PRODUCT_PENDING_ROUTE =
  "src/app/api/admin/product-1-1-pending/route.ts";
const AUTHORIZED_ADMIN_PRODUCT_PENDING_PAGE =
  "src/app/(app)/admin/product-1-1-pending/page.tsx";
const AUTHORIZED_ADMIN_PRODUCT_PENDING_FORM =
  "src/app/(app)/admin/product-1-1-pending/resolution-form.tsx";
const NO_PRODUCT_FLOW_IMPORT_ADMIN_SCHEMAS = "src/lib/admin/schemas.ts";
const NO_PRODUCT_FLOW_IMPORT_ADMIN_LAYOUT = "src/app/(app)/admin/layout.tsx";

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
    exact: [
      "@/lib/product-1-1/authorization/authorization-service",
      // Plano 04 — wiring do núcleo entregável na rota existente.
      "@/lib/product-1-1/orchestration/generation-orchestrator",
      "@/lib/product-1-1/selection-validation",
      "@/lib/product-1-1/background-direction",
      // Plano 08 (correção de integração — gap 1): a rota fornece o contexto
      // server-side da copy DEFAULT (tipo) para o orquestrador gerar copy.
      "@/lib/product-1-1/copy/default-copy-runner",
      // F56.2b2c (B2.3) — conexão server-side do gate de gasto do piloto
      // (INATIVO quando o piloto não está autorizado). Par EXATO, sem prefixo.
      "@/lib/product-1-1/pilot/resolve-pilot-spend-gate",
      // Quick 261017-cdi — bloco de identidade do novo fluxo (paleta canônica +
      // presença/ausência reconciliada). Par EXATO, sem prefixo amplo.
      "@/lib/product-1-1/identity-context",
      // Quick 261017-cdi — normalização de preço do novo fluxo (zero/ausente =
      // ausência) + paridade da validação de oferta. Par EXATO, sem prefixo amplo.
      "@/lib/product-1-1/commercial-price",
    ],
  },
  // Plano 04 — rota de status do reenvio (query-only).
  [AUTHORIZED_CAMPAIGN_GENERATION_STATUS_ROUTE]: {
    prefixes: [],
    exact: ["@/lib/product-1-1/orchestration/resend-query"],
  },
  // Plano 01 — pares EXATOS (sem prefixo amplo).
  [AUTHORIZED_CAMPANHAS_NOVA_PAGE]: {
    prefixes: [],
    exact: [
      "@/lib/product-1-1/authorization/authorization-service",
      "@/lib/product-1-1/submission/eligibility-context",
      // P1 (correção 2026-10-15) — o `operationId` da operação PERSISTIDA é
      // resolvido SERVER-SIDE e a direção de fundo é lida da EVIDÊNCIA CONGELADA.
      "@/lib/product-1-1/orchestration/attempt-start-client",
      "@/lib/product-1-1/snapshot/persist-snapshot",
    ],
  },
  [AUTHORIZED_FLOW_BACKGROUND_DIRECTION_SELECTOR]: {
    prefixes: [],
    exact: ["@/lib/product-1-1/background-direction"],
  },
  [AUTHORIZED_FLOW_CAMPAIGN_INPUT_FORM]: {
    prefixes: [],
    exact: [
      "@/lib/product-1-1/selection-validation",
      "@/lib/product-1-1/background-direction",
    ],
  },
  [AUTHORIZED_FLOW_USE_CAMPAIGN_FORM]: {
    prefixes: [],
    exact: [
      "@/lib/product-1-1/selection-validation",
      "@/lib/product-1-1/background-direction",
    ],
  },
  // Plano 06 — rota de download do novo fluxo (portão) e página persistida
  // `campanhas/[id]`. Pares EXATOS (sem prefixo amplo).
  [AUTHORIZED_CAMPAIGN_DOWNLOAD_ROUTE]: {
    prefixes: [],
    exact: [
      "@/lib/product-1-1/artifact/download-gate",
      "@/lib/product-1-1/artifact/artifact-store",
      "@/lib/product-1-1/orchestration/attempt-start-client",
    ],
  },
  [AUTHORIZED_CAMPANHAS_ID_PAGE]: {
    prefixes: [],
    exact: [
      "@/lib/product-1-1/orchestration/attempt-start-client",
      "@/lib/product-1-1/artifact/artifact-store",
      // Plano 08 (correção de integração — P3): a página lê a copy do NOVO FLUXO
      // POR OPERAÇÃO (`readCopyDelivery`/`readCopyCancellation`) — somente leitura
      // (nunca gera/regenera/cobra). Par EXATO, sem prefixo amplo.
      "@/lib/product-1-1/copy/copy-state",
      // P1 (correção 2026-10-15) — leitura SOMENTE-leitura da direção de fundo da
      // EVIDÊNCIA CONGELADA (`operationId` resolvido server-side do estado
      // persistido). Par EXATO, sem prefixo amplo.
      "@/lib/product-1-1/snapshot/persist-snapshot",
    ],
  },
  // Plano 03 (F56.2b2a) — rota AUTENTICADA da recuperação de copy (GET
  // query-only + POST de UMA tentativa) com a BARREIRA DE NÃO-ATIVAÇÃO/IDENTIDADE.
  // Pares EXATOS refletindo os imports REAIS da rota (sem prefixo amplo).
  [AUTHORIZED_CAMPAIGN_COPY_RECOVERY_ROUTE]: {
    prefixes: [],
    exact: [
      "@/lib/product-1-1/copy/copy-recovery",
      "@/lib/product-1-1/copy/recovery-schemas",
      "@/lib/product-1-1/orchestration/attempt-start-client",
      "@/lib/product-1-1/authorization/authorization-service",
      // Barreira de não-ativação: contexto canônico de elegibilidade (server-only).
      "@/lib/product-1-1/submission/eligibility-context",
      // F56.2b2c (B2.3) — conexão server-side do gate de gasto do piloto
      // (INATIVO quando o piloto não está autorizado). Par EXATO, sem prefixo.
      "@/lib/product-1-1/pilot/resolve-pilot-spend-gate",
    ],
  },
  // Plano 02 (F56.2b2b) — rota AUTENTICADA da recuperação de IMAGEM (GET
  // query-only + POST que delega ao serviço de recuperação). Pares EXATOS
  // refletindo os imports REAIS da rota (sem prefixo amplo).
  [AUTHORIZED_CAMPAIGN_IMAGE_RECOVERY_ROUTE]: {
    prefixes: [],
    exact: [
      "@/lib/product-1-1/artifact/artifact-recovery",
      "@/lib/product-1-1/orchestration/attempt-start-client",
      "@/lib/product-1-1/authorization/authorization-service",
      "@/lib/product-1-1/submission/eligibility-context",
    ],
  },
  // Plano 07 — superfícies admin de resolução de pendências. Pares EXPLÍCITOS
  // (sem prefixo `pending/**` genérico). A rota importa SOMENTE o serviço de
  // resolução; a página importa SOMENTE o repositório de pendências; o formulário
  // client NÃO importa `product-1-1` (regra vazia explícita).
  [AUTHORIZED_ADMIN_PRODUCT_PENDING_ROUTE]: {
    prefixes: [],
    exact: ["@/lib/product-1-1/pending/resolve-pending-operation"],
  },
  [AUTHORIZED_ADMIN_PRODUCT_PENDING_PAGE]: {
    prefixes: [],
    exact: ["@/lib/product-1-1/pending/pending-operations-repository"],
  },
  [AUTHORIZED_ADMIN_PRODUCT_PENDING_FORM]: {
    prefixes: [],
    exact: [],
  },
  // F56.2b2c (B2.3) — o resolver server-side do gate de gasto do piloto é um
  // módulo `product-1-1` que importa PARES EXATOS de autorização/elegibilidade e
  // o próprio gate. (Consumido EXCLUSIVAMENTE pelas duas rotas acima.)
  ["src/lib/product-1-1/pilot/resolve-pilot-spend-gate.ts"]: {
    prefixes: [],
    exact: [
      "@/lib/product-1-1/authorization/authorization-service",
      "@/lib/product-1-1/submission/eligibility-context",
      "@/lib/product-1-1/pilot/spend-control",
    ],
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

describe("Product 1:1 — reconciliação G-NA (Plano 01, F56.2b1b)", () => {
  it("nova/page.tsx: permite SOMENTE os dois módulos exatos e recusa módulo indevido", () => {
    expect(
      isAuthorizedAdminAuthorizationImport(
        AUTHORIZED_CAMPANHAS_NOVA_PAGE,
        "@/lib/product-1-1/authorization/authorization-service",
      ),
    ).toBe(true);
    expect(
      isAuthorizedAdminAuthorizationImport(
        AUTHORIZED_CAMPANHAS_NOVA_PAGE,
        "@/lib/product-1-1/submission/eligibility-context",
      ),
    ).toBe(true);
    for (const specifier of [
      "@/lib/product-1-1/orchestration/generation-orchestrator",
      "@/lib/product-1-1/pending/pending-operations-repository",
      "@/lib/product-1-1/selection-validation",
    ]) {
      expect(
        isAuthorizedAdminAuthorizationImport(AUTHORIZED_CAMPANHAS_NOVA_PAGE, specifier),
        specifier,
      ).toBe(false);
    }
  });

  it("flow: permite selection-validation + background-direction; recusa módulo indevido", () => {
    for (const importer of [
      AUTHORIZED_FLOW_CAMPAIGN_INPUT_FORM,
      AUTHORIZED_FLOW_USE_CAMPAIGN_FORM,
    ]) {
      expect(
        isAuthorizedAdminAuthorizationImport(importer, "@/lib/product-1-1/selection-validation"),
      ).toBe(true);
      expect(
        isAuthorizedAdminAuthorizationImport(importer, "@/lib/product-1-1/background-direction"),
      ).toBe(true);
      expect(
        isAuthorizedAdminAuthorizationImport(importer, "@/lib/product-1-1/orchestration/x"),
      ).toBe(false);
    }
    expect(
      isAuthorizedAdminAuthorizationImport(
        AUTHORIZED_FLOW_BACKGROUND_DIRECTION_SELECTOR,
        "@/lib/product-1-1/background-direction",
      ),
    ).toBe(true);
    expect(
      isAuthorizedAdminAuthorizationImport(
        AUTHORIZED_FLOW_BACKGROUND_DIRECTION_SELECTOR,
        "@/lib/product-1-1/selection-validation",
      ),
    ).toBe(false);
  });

  it("o mapa NÃO contém prefixo amplo de product-1-1/**", () => {
    for (const [importer, rule] of Object.entries(AUTHORIZED_PRODUCT_FLOW_IMPORTS)) {
      for (const prefix of rule.prefixes) {
        expect(prefix, `${importer}::${prefix}`).not.toBe("@/lib/product-1-1/");
        expect(prefix.endsWith("/product-1-1/"), `${importer}::${prefix}`).toBe(false);
      }
      for (const exact of rule.exact ?? []) {
        expect(exact, `${importer}::${exact}`).not.toBe("@/lib/product-1-1/");
      }
    }
  });

  it("negativos: importador NÃO autorizado + módulo liberado ⇒ violação", () => {
    const source =
      'import { countProductImages } from "@/lib/product-1-1/selection-validation";';
    expect(hasUnauthorizedProductFlowImport("src/components/flow/other.tsx", source)).toBe(true);
    expect(
      hasUnauthorizedProductFlowImport("src/app/(app)/campanhas/nova/other.tsx", source),
    ).toBe(true);
  });

  it("negativos: importador autorizado + módulo NÃO listado ⇒ violação", () => {
    expect(
      hasUnauthorizedProductFlowImport(
        AUTHORIZED_FLOW_USE_CAMPAIGN_FORM,
        'import { x } from "@/lib/product-1-1/orchestration/generation-orchestrator";',
      ),
    ).toBe(true);
    expect(
      hasUnauthorizedProductFlowImport(
        AUTHORIZED_FLOW_USE_CAMPAIGN_FORM,
        'import { x } from "@/lib/product-1-1/pending/pending-operations-repository";',
      ),
    ).toBe(true);
    expect(
      hasUnauthorizedProductFlowImport(
        AUTHORIZED_CAMPANHAS_NOVA_PAGE,
        'import { x } from "@/lib/product-1-1/selection-validation";',
      ),
    ).toBe(true);
  });

  it("positivos: importador autorizado + módulos listados ⇒ sem violação", () => {
    expect(
      hasUnauthorizedProductFlowImport(
        AUTHORIZED_FLOW_USE_CAMPAIGN_FORM,
        'import { countProductImages } from "@/lib/product-1-1/selection-validation";\n' +
          'import type { ProductOneToOneBackgroundDirection } from "@/lib/product-1-1/background-direction";',
      ),
    ).toBe(false);
    expect(
      hasUnauthorizedProductFlowImport(
        AUTHORIZED_CAMPANHAS_NOVA_PAGE,
        'import { resolveProductFlowAuthorization } from "@/lib/product-1-1/authorization/authorization-service";\n' +
          'import { resolveEligibilityContext } from "@/lib/product-1-1/submission/eligibility-context";',
      ),
    ).toBe(false);
  });

  it("os quatro importadores do Plano 01 refletem exatamente os pares autorizados", () => {
    for (const importer of [
      AUTHORIZED_CAMPANHAS_NOVA_PAGE,
      AUTHORIZED_FLOW_BACKGROUND_DIRECTION_SELECTOR,
      AUTHORIZED_FLOW_CAMPAIGN_INPUT_FORM,
      AUTHORIZED_FLOW_USE_CAMPAIGN_FORM,
    ]) {
      const source = readFileSync(path.resolve(process.cwd(), importer), "utf8");
      expect(
        hasUnauthorizedProductFlowImport(importer, source),
        `${importer} importa módulo Produto 1:1 não autorizado`,
      ).toBe(false);
    }
  });
});

describe("Product 1:1 — provas comportamentais de `off` (Plano 01, F56.2b1b)", () => {
  it("payload legado: o detector de campos exclusivos NÃO dispara", () => {
    expect(detectExclusiveNewFlowFields({ productName: "X", campaignIntent: "offer" })).toEqual([]);
    expect(detectExclusiveNewFlowFields({})).toEqual([]);
  });

  it("buildCampaignGenerationBody NÃO inclui campos exclusivos quando inelegível", () => {
    const fields = {
      productName: "Produto Teste",
      description: "",
      originalPriceCents: 10000,
      discountedPriceCents: 1990,
      badge: "Oferta",
      campaignIntent: "offer" as const,
      preserveImageContext: false,
      productImages: [],
      mandatoryArtworkText: "",
      showIllustrativeNotice: false,
      mandatoryArtworkTextFree: "",
      validityMode: "" as const,
      validityStartDate: "",
      validityEndDate: "",
      validityCustomText: "",
      backgroundDirection: "studio" as const,
    };
    const prepared = [
      {
        id: "p1",
        role: "primary" as const,
        source: "upload" as const,
        mimeType: "image/jpeg" as const,
        dataUrl: "data:image/png;base64,AAAA",
      },
    ];

    const body = buildCampaignGenerationBody(fields, prepared, "store-1");
    expect(body).not.toHaveProperty("backgroundDirection");
    expect(body).not.toHaveProperty("campaignId");
    expect(body).not.toHaveProperty("operationId");

    const explicitOff = buildCampaignGenerationBody(fields, prepared, "store-1", {
      eligible: false,
    });
    expect(explicitOff).not.toHaveProperty("backgroundDirection");
    expect(explicitOff).not.toHaveProperty("campaignId");
    expect(explicitOff).not.toHaveProperty("operationId");
  });

  it("controle exclusivo em `off`: prova de RENDER (jsdom) referenciada no contrato do Plano 01", () => {
    const contractPath = path.resolve(
      process.cwd(),
      "src/lib/product-1-1/__tests__/intent-background-selection.contract.test.ts",
    );
    const source = readFileSync(contractPath, "utf8");
    expect(source).toMatch(/@vitest-environment jsdom/);
    // ponteiro para a região B (controle exclusivo) e a asserção de ausência em `off`.
    expect(source).toMatch(/flow-background-direction-selector/);
    expect(source).toMatch(/queryByTestId|queryByText/);
  });

  it("o caminho legado/elegível do Plano 01 não alcança provider/gateway do novo fluxo", () => {
    const forbiddenImports =
      /@\/lib\/product-1-1\/(?:orchestration|artifact|pending|credit-operation)\//;
    for (const file of [
      AUTHORIZED_FLOW_BACKGROUND_DIRECTION_SELECTOR,
      AUTHORIZED_FLOW_CAMPAIGN_INPUT_FORM,
      AUTHORIZED_FLOW_USE_CAMPAIGN_FORM,
    ]) {
      const source = readFileSync(path.resolve(process.cwd(), file), "utf8");
      expect(source, file).not.toMatch(forbiddenImports);
      expect(source, file).not.toMatch(/createNewFlowImageGateway/);
    }
    // P1 (correção 2026-10-15) — a `nova/page.tsx` ganha a EXCEÇÃO EXATA
    // `orchestration/attempt-start-client` (resolve o `operationId` da operação
    // PERSISTIDA server-side para ler a direção da evidência congelada). Continua
    // NÃO alcançando o orquestrador/provider/gateway: `orchestration/**` segue
    // proibido EXCETO o módulo exato autorizado.
    const novaSource = readFileSync(
      path.resolve(process.cwd(), AUTHORIZED_CAMPANHAS_NOVA_PAGE),
      "utf8",
    );
    expect(novaSource).not.toMatch(
      /@\/lib\/product-1-1\/(?:orchestration\/(?!attempt-start-client)|artifact|pending|credit-operation)\//,
    );
    expect(novaSource).not.toMatch(/createNewFlowImageGateway/);
  });
});

describe("Product 1:1 — reconciliação G-NA (Plano 04, F56.2b1b)", () => {
  it("generate-image: autoriza generation-orchestrator + selection-validation + background-direction (sem perder submission/** e authorization-service)", () => {
    for (const specifier of [
      "@/lib/product-1-1/orchestration/generation-orchestrator",
      "@/lib/product-1-1/selection-validation",
      "@/lib/product-1-1/background-direction",
      "@/lib/product-1-1/submission/exclusive-fields",
      "@/lib/product-1-1/authorization/authorization-service",
      // Plano 08 (correção de integração — gap 1): contexto server-side da copy.
      "@/lib/product-1-1/copy/default-copy-runner",
      // Quick 261017-cdi — identidade do novo fluxo (paleta canônica).
      "@/lib/product-1-1/identity-context",
      // Quick 261017-cdi — normalização de preço do novo fluxo.
      "@/lib/product-1-1/commercial-price",
    ]) {
      expect(
        isAuthorizedAdminAuthorizationImport(AUTHORIZED_CAMPAIGN_GENERATE_IMAGE_ROUTE, specifier),
        specifier,
      ).toBe(true);
    }
    for (const specifier of [
      "@/lib/product-1-1/orchestration/resend-query",
      "@/lib/product-1-1/orchestration/attempt-start-client",
      "@/lib/product-1-1/pending/pending-operations-repository",
      "@/lib/product-1-1/artifact/artifact-store",
    ]) {
      expect(
        isAuthorizedAdminAuthorizationImport(AUTHORIZED_CAMPAIGN_GENERATE_IMAGE_ROUTE, specifier),
        specifier,
      ).toBe(false);
    }
  });

  it("generation-status: autoriza SOMENTE orchestration/resend-query", () => {
    expect(
      isAuthorizedAdminAuthorizationImport(
        AUTHORIZED_CAMPAIGN_GENERATION_STATUS_ROUTE,
        "@/lib/product-1-1/orchestration/resend-query",
      ),
    ).toBe(true);
    for (const specifier of [
      "@/lib/product-1-1/orchestration/generation-orchestrator",
      "@/lib/product-1-1/selection-validation",
      "@/lib/product-1-1/submission/exclusive-fields",
      "@/lib/product-1-1/authorization/authorization-service",
    ]) {
      expect(
        isAuthorizedAdminAuthorizationImport(
          AUTHORIZED_CAMPAIGN_GENERATION_STATUS_ROUTE,
          specifier,
        ),
        specifier,
      ).toBe(false);
    }
  });

  it("as rotas do Plano 04 importam EXATAMENTE os pares autorizados", () => {
    for (const importer of [
      AUTHORIZED_CAMPAIGN_GENERATE_IMAGE_ROUTE,
      AUTHORIZED_CAMPAIGN_GENERATION_STATUS_ROUTE,
    ]) {
      const source = readFileSync(path.resolve(process.cwd(), importer), "utf8");
      expect(
        hasUnauthorizedProductFlowImport(importer, source),
        `${importer} importa módulo Produto 1:1 não autorizado`,
      ).toBe(false);
    }
  });

  it("negativos preservados: importador indevido e módulo indevido continuam violação", () => {
    expect(
      hasUnauthorizedProductFlowImport(
        AUTHORIZED_CAMPAIGN_GENERATION_STATUS_ROUTE,
        'import { x } from "@/lib/product-1-1/orchestration/generation-orchestrator";',
      ),
    ).toBe(true);
    expect(
      hasUnauthorizedProductFlowImport(
        "src/app/api/campaign/other/route.ts",
        'import { x } from "@/lib/product-1-1/orchestration/resend-query";',
      ),
    ).toBe(true);
    expect(
      hasUnauthorizedProductFlowImport(
        AUTHORIZED_CAMPAIGN_GENERATE_IMAGE_ROUTE,
        'import { x } from "@/lib/product-1-1/orchestration/resend-query";',
      ),
    ).toBe(true);
  });

  it("nenhum prefixo amplo de product-1-1/** foi adicionado", () => {
    for (const [importer, rule] of Object.entries(AUTHORIZED_PRODUCT_FLOW_IMPORTS)) {
      for (const prefix of rule.prefixes) {
        expect(prefix, `${importer}::${prefix}`).not.toBe("@/lib/product-1-1/");
        expect(prefix.endsWith("/product-1-1/"), `${importer}::${prefix}`).toBe(false);
      }
    }
  });
});

describe("Product 1:1 — reconciliação G-NA (Plano 06, F56.2b1b)", () => {
  it("rota de download: autoriza SOMENTE os pares exatos do portão", () => {
    for (const specifier of [
      "@/lib/product-1-1/artifact/download-gate",
      "@/lib/product-1-1/artifact/artifact-store",
      "@/lib/product-1-1/orchestration/attempt-start-client",
    ]) {
      expect(
        isAuthorizedAdminAuthorizationImport(AUTHORIZED_CAMPAIGN_DOWNLOAD_ROUTE, specifier),
        specifier,
      ).toBe(true);
    }
    for (const specifier of [
      "@/lib/product-1-1/orchestration/generation-orchestrator",
      "@/lib/product-1-1/orchestration/resend-query",
      "@/lib/product-1-1/pending/pending-operations-repository",
      "@/lib/product-1-1/artifact",
    ]) {
      expect(
        isAuthorizedAdminAuthorizationImport(AUTHORIZED_CAMPAIGN_DOWNLOAD_ROUTE, specifier),
        specifier,
      ).toBe(false);
    }
  });

  it("campanhas/[id]/page.tsx: autoriza SOMENTE attempt-start-client + artifact-store + copy/copy-state", () => {
    for (const specifier of [
      "@/lib/product-1-1/orchestration/attempt-start-client",
      "@/lib/product-1-1/artifact/artifact-store",
      // Plano 08 (P3): leitura da copy do novo fluxo POR OPERAÇÃO (somente leitura).
      "@/lib/product-1-1/copy/copy-state",
    ]) {
      expect(
        isAuthorizedAdminAuthorizationImport(AUTHORIZED_CAMPANHAS_ID_PAGE, specifier),
        specifier,
      ).toBe(true);
    }
    for (const specifier of [
      "@/lib/product-1-1/orchestration/generation-orchestrator",
      "@/lib/product-1-1/artifact/download-gate",
      "@/lib/product-1-1/submission/eligibility-context",
    ]) {
      expect(
        isAuthorizedAdminAuthorizationImport(AUTHORIZED_CAMPANHAS_ID_PAGE, specifier),
        specifier,
      ).toBe(false);
    }
  });

  it("os importadores do Plano 06 refletem EXATAMENTE os pares autorizados", () => {
    for (const importer of [
      AUTHORIZED_CAMPAIGN_DOWNLOAD_ROUTE,
      AUTHORIZED_CAMPANHAS_ID_PAGE,
    ]) {
      const source = readFileSync(path.resolve(process.cwd(), importer), "utf8");
      expect(
        hasUnauthorizedProductFlowImport(importer, source),
        `${importer} importa módulo Produto 1:1 não autorizado`,
      ).toBe(false);
    }
  });

  it("NEGATIVO: display.ts NÃO importa product-1-1 (união de estado local)", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), NO_PRODUCT_FLOW_IMPORT_MODULE),
      "utf8",
    );
    expect(collectProductFlowImports(source)).toEqual([]);
    expect(source).not.toMatch(/from\s+["'][^"']*product-1-1/);
  });

  it("negativos preservados: importador indevido e módulo indevido continuam violação", () => {
    expect(
      hasUnauthorizedProductFlowImport(
        "src/app/api/campaign/other/route.ts",
        'import { decideNewFlowDownload } from "@/lib/product-1-1/artifact/download-gate";',
      ),
    ).toBe(true);
    expect(
      hasUnauthorizedProductFlowImport(
        AUTHORIZED_CAMPAIGN_DOWNLOAD_ROUTE,
        'import { x } from "@/lib/product-1-1/orchestration/generation-orchestrator";',
      ),
    ).toBe(true);
  });

  it("nenhum prefixo amplo de product-1-1/** foi adicionado (Plano 06)", () => {
    for (const [importer, rule] of Object.entries(AUTHORIZED_PRODUCT_FLOW_IMPORTS)) {
      for (const prefix of rule.prefixes) {
        expect(prefix, `${importer}::${prefix}`).not.toBe("@/lib/product-1-1/");
        expect(prefix.endsWith("/product-1-1/"), `${importer}::${prefix}`).toBe(false);
      }
    }
  });
});

describe("Product 1:1 — reconciliação G-NA (Plano 07 — fim da sequência, F56.2b1b)", () => {
  it("rota admin de pendências: autoriza SOMENTE `pending/resolve-pending-operation`", () => {
    expect(
      isAuthorizedAdminAuthorizationImport(
        AUTHORIZED_ADMIN_PRODUCT_PENDING_ROUTE,
        "@/lib/product-1-1/pending/resolve-pending-operation",
      ),
    ).toBe(true);
    for (const specifier of [
      "@/lib/product-1-1/pending/pending-operations-repository",
      "@/lib/product-1-1/pending",
      "@/lib/product-1-1/pending/**",
      "@/lib/product-1-1/orchestration/generation-orchestrator",
      "@/lib/product-1-1/artifact/artifact-store",
    ]) {
      expect(
        isAuthorizedAdminAuthorizationImport(AUTHORIZED_ADMIN_PRODUCT_PENDING_ROUTE, specifier),
        specifier,
      ).toBe(false);
    }
  });

  it("página admin de pendências: autoriza SOMENTE `pending/pending-operations-repository`", () => {
    expect(
      isAuthorizedAdminAuthorizationImport(
        AUTHORIZED_ADMIN_PRODUCT_PENDING_PAGE,
        "@/lib/product-1-1/pending/pending-operations-repository",
      ),
    ).toBe(true);
    for (const specifier of [
      "@/lib/product-1-1/pending/resolve-pending-operation",
      "@/lib/product-1-1/orchestration/generation-orchestrator",
      "@/lib/product-1-1/artifact/artifact-store",
    ]) {
      expect(
        isAuthorizedAdminAuthorizationImport(AUTHORIZED_ADMIN_PRODUCT_PENDING_PAGE, specifier),
        specifier,
      ).toBe(false);
    }
  });

  it("formulário de resolução (CLIENT): NÃO autoriza NENHUM import `product-1-1` (nem `pending/**` genérico)", () => {
    for (const specifier of [
      "@/lib/product-1-1/pending/pending-operations-repository",
      "@/lib/product-1-1/pending/resolve-pending-operation",
      "@/lib/product-1-1/pending/repository",
      "@/lib/product-1-1/artifact/artifact-store",
      "@/lib/product-1-1/pending/**",
    ]) {
      expect(
        isAuthorizedAdminAuthorizationImport(AUTHORIZED_ADMIN_PRODUCT_PENDING_FORM, specifier),
        specifier,
      ).toBe(false);
    }
  });

  it("os importadores do Plano 07 refletem EXATAMENTE os pares autorizados", () => {
    for (const importer of [
      AUTHORIZED_ADMIN_PRODUCT_PENDING_ROUTE,
      AUTHORIZED_ADMIN_PRODUCT_PENDING_PAGE,
    ]) {
      const source = readFileSync(path.resolve(process.cwd(), importer), "utf8");
      expect(
        hasUnauthorizedProductFlowImport(importer, source),
        `${importer} importa módulo Produto 1:1 não autorizado`,
      ).toBe(false);
    }
  });

  it("NEGATIVO: o formulário client NÃO importa `product-1-1`", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), AUTHORIZED_ADMIN_PRODUCT_PENDING_FORM),
      "utf8",
    );
    expect(collectProductFlowImports(source)).toEqual([]);
    expect(source).not.toMatch(/from\s+["'][^"']*product-1-1/);
  });

  it("NEGATIVO: `admin/schemas.ts` e `(app)/admin/layout.tsx` NÃO importam `product-1-1`", () => {
    for (const file of [NO_PRODUCT_FLOW_IMPORT_ADMIN_SCHEMAS, NO_PRODUCT_FLOW_IMPORT_ADMIN_LAYOUT]) {
      const source = readFileSync(path.resolve(process.cwd(), file), "utf8");
      expect(collectProductFlowImports(source), file).toEqual([]);
      expect(source, file).not.toMatch(/from\s+["'][^"']*product-1-1/);
    }
  });

  it("negativos preservados: importador indevido e módulo indevido continuam violação", () => {
    expect(
      hasUnauthorizedProductFlowImport(
        "src/app/api/admin/other/route.ts",
        'import { resolvePendingOperation } from "@/lib/product-1-1/pending/resolve-pending-operation";',
      ),
    ).toBe(true);
    expect(
      hasUnauthorizedProductFlowImport(
        AUTHORIZED_ADMIN_PRODUCT_PENDING_ROUTE,
        'import { x } from "@/lib/product-1-1/pending/pending-operations-repository";',
      ),
    ).toBe(true);
  });

  it("nenhum prefixo amplo de product-1-1/** (nem `pending/**`) foi adicionado (Plano 07)", () => {
    for (const [importer, rule] of Object.entries(AUTHORIZED_PRODUCT_FLOW_IMPORTS)) {
      for (const prefix of rule.prefixes) {
        expect(prefix, `${importer}::${prefix}`).not.toBe("@/lib/product-1-1/");
        expect(prefix, `${importer}::${prefix}`).not.toBe("@/lib/product-1-1/pending/");
        expect(prefix.endsWith("/product-1-1/"), `${importer}::${prefix}`).toBe(false);
      }
    }
  });
});

describe("Product 1:1 — reconciliação G-NA (Plano 03 — F56.2b2a rota da recuperação)", () => {
  it("rota copy-recovery: autoriza SOMENTE os pares exatos (sem prefixo amplo)", () => {
    for (const specifier of [
      "@/lib/product-1-1/copy/copy-recovery",
      "@/lib/product-1-1/copy/recovery-schemas",
      "@/lib/product-1-1/orchestration/attempt-start-client",
      "@/lib/product-1-1/authorization/authorization-service",
      "@/lib/product-1-1/submission/eligibility-context",
    ]) {
      expect(
        isAuthorizedAdminAuthorizationImport(
          AUTHORIZED_CAMPAIGN_COPY_RECOVERY_ROUTE,
          specifier,
        ),
        specifier,
      ).toBe(true);
    }
    for (const specifier of [
      "@/lib/product-1-1/copy/copy-state",
      "@/lib/product-1-1/artifact/artifact-store",
      "@/lib/product-1-1/orchestration/generation-orchestrator",
      "@/lib/product-1-1",
    ]) {
      expect(
        isAuthorizedAdminAuthorizationImport(
          AUTHORIZED_CAMPAIGN_COPY_RECOVERY_ROUTE,
          specifier,
        ),
        specifier,
      ).toBe(false);
    }
  });

  it("o importador do Plano 03 reflete EXATAMENTE os pares autorizados", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), AUTHORIZED_CAMPAIGN_COPY_RECOVERY_ROUTE),
      "utf8",
    );
    expect(
      hasUnauthorizedProductFlowImport(AUTHORIZED_CAMPAIGN_COPY_RECOVERY_ROUTE, source),
      `${AUTHORIZED_CAMPAIGN_COPY_RECOVERY_ROUTE} importa módulo Produto 1:1 não autorizado`,
    ).toBe(false);
  });

  it("negativos preservados: importador indevido e módulo indevido continuam violação", () => {
    expect(
      hasUnauthorizedProductFlowImport(
        "src/app/api/campaign/other/route.ts",
        'import { x } from "@/lib/product-1-1/copy/copy-recovery";',
      ),
    ).toBe(true);
    expect(
      hasUnauthorizedProductFlowImport(
        AUTHORIZED_CAMPAIGN_COPY_RECOVERY_ROUTE,
        'import { x } from "@/lib/product-1-1/copy/copy-state";',
      ),
    ).toBe(true);
    expect(
      hasUnauthorizedProductFlowImport(
        AUTHORIZED_CAMPAIGN_COPY_RECOVERY_ROUTE,
        'import { x } from "@/lib/product-1-1/orchestration/generation-orchestrator";',
      ),
    ).toBe(true);
  });

  it("nenhum prefixo amplo de product-1-1/** foi adicionado (Plano 03)", () => {
    for (const [importer, rule] of Object.entries(AUTHORIZED_PRODUCT_FLOW_IMPORTS)) {
      for (const prefix of rule.prefixes) {
        expect(prefix, `${importer}::${prefix}`).not.toBe("@/lib/product-1-1/");
        expect(prefix.endsWith("/product-1-1/"), `${importer}::${prefix}`).toBe(false);
      }
    }
  });

  it("AUTHORIZED_CAMPANHAS_ID_PAGE permanece INALTERADO (só o módulo já autorizado `copy/copy-state`)", () => {
    expect(
      isAuthorizedAdminAuthorizationImport(
        AUTHORIZED_CAMPANHAS_ID_PAGE,
        "@/lib/product-1-1/copy/copy-state",
      ),
    ).toBe(true);
    expect(
      isAuthorizedAdminAuthorizationImport(
        AUTHORIZED_CAMPANHAS_ID_PAGE,
        "@/lib/product-1-1/copy/copy-recovery",
      ),
    ).toBe(false);
    expect(
      isAuthorizedAdminAuthorizationImport(
        AUTHORIZED_CAMPANHAS_ID_PAGE,
        "@/lib/product-1-1/copy/recovery-schemas",
      ),
    ).toBe(false);
  });

  it("NEGATIVO: display.ts NÃO importa product-1-1 (G-NA preservada)", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), NO_PRODUCT_FLOW_IMPORT_MODULE),
      "utf8",
    );
    expect(collectProductFlowImports(source)).toEqual([]);
    expect(source).not.toMatch(/from\s+["'][^"']*product-1-1/);
  });
});

describe("Product 1:1 — reconciliação G-NA (Plano 02 — F56.2b2b rota da recuperação de imagem)", () => {
  it("rota image-recovery: autoriza SOMENTE os pares exatos (sem prefixo amplo)", () => {
    for (const specifier of [
      "@/lib/product-1-1/artifact/artifact-recovery",
      "@/lib/product-1-1/orchestration/attempt-start-client",
      "@/lib/product-1-1/authorization/authorization-service",
      "@/lib/product-1-1/submission/eligibility-context",
    ]) {
      expect(
        isAuthorizedAdminAuthorizationImport(
          AUTHORIZED_CAMPAIGN_IMAGE_RECOVERY_ROUTE,
          specifier,
        ),
        specifier,
      ).toBe(true);
    }
    for (const specifier of [
      "@/lib/product-1-1/artifact/artifact-store",
      "@/lib/product-1-1/credit-operation/credit-operation-client",
      "@/lib/product-1-1/orchestration/generation-orchestrator",
      "@/lib/product-1-1",
    ]) {
      expect(
        isAuthorizedAdminAuthorizationImport(
          AUTHORIZED_CAMPAIGN_IMAGE_RECOVERY_ROUTE,
          specifier,
        ),
        specifier,
      ).toBe(false);
    }
  });

  it("o importador do Plano 02 reflete EXATAMENTE os pares autorizados", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), AUTHORIZED_CAMPAIGN_IMAGE_RECOVERY_ROUTE),
      "utf8",
    );
    expect(
      hasUnauthorizedProductFlowImport(AUTHORIZED_CAMPAIGN_IMAGE_RECOVERY_ROUTE, source),
      `${AUTHORIZED_CAMPAIGN_IMAGE_RECOVERY_ROUTE} importa módulo Produto 1:1 não autorizado`,
    ).toBe(false);
  });

  it("negativos preservados: importador indevido e módulo indevido continuam violação", () => {
    expect(
      hasUnauthorizedProductFlowImport(
        "src/app/api/campaign/other/route.ts",
        'import { x } from "@/lib/product-1-1/artifact/artifact-recovery";',
      ),
    ).toBe(true);
    expect(
      hasUnauthorizedProductFlowImport(
        AUTHORIZED_CAMPAIGN_IMAGE_RECOVERY_ROUTE,
        'import { x } from "@/lib/product-1-1/orchestration/generation-orchestrator";',
      ),
    ).toBe(true);
    expect(
      hasUnauthorizedProductFlowImport(
        AUTHORIZED_CAMPAIGN_IMAGE_RECOVERY_ROUTE,
        'import { x } from "@/lib/product-1-1/artifact/artifact-store";',
      ),
    ).toBe(true);
  });

  it("nenhum prefixo amplo de product-1-1/** foi adicionado (Plano 02)", () => {
    for (const [importer, rule] of Object.entries(AUTHORIZED_PRODUCT_FLOW_IMPORTS)) {
      for (const prefix of rule.prefixes) {
        expect(prefix, `${importer}::${prefix}`).not.toBe("@/lib/product-1-1/");
        expect(prefix.endsWith("/product-1-1/"), `${importer}::${prefix}`).toBe(false);
      }
    }
  });

  it("AUTHORIZED_CAMPANHAS_ID_PAGE permanece INALTERADO (sem `artifact-recovery`)", () => {
    expect(
      isAuthorizedAdminAuthorizationImport(
        AUTHORIZED_CAMPANHAS_ID_PAGE,
        "@/lib/product-1-1/artifact/artifact-recovery",
      ),
    ).toBe(false);
  });

  it("NEGATIVO: display.ts NÃO importa product-1-1 (G-NA preservada)", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), NO_PRODUCT_FLOW_IMPORT_MODULE),
      "utf8",
    );
    expect(collectProductFlowImports(source)).toEqual([]);
    expect(source).not.toMatch(/from\s+["'][^"']*product-1-1/);
  });
});
