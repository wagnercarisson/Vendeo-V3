// @vitest-environment node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT = process.cwd();
const BASE_SHA = "335bfb70";
const BASE_SHA_RECORD = path.resolve(
  REPOSITORY_ROOT,
  ".planning/phases/56.2-preparacao-nao-operacional-produto-1-1/56-2-ISOLATED-INSTANCE.md",
);

// Exceção ESTREITA (Plano 56.2.1-03, aprovada): a única alteração de fronteira
// produtiva reconhecida originalmente era o guard de submissão na rota
// generate-image. A quick 261011-lc6 reconciliou a guarda para reconhecer
// TAMBÉM as mudanças de fronteira anteriores já autorizadas (laboratório u3h e
// src/lib/ai da rsp), SEM excluir diretórios nem trocar o BASE_SHA:
//  - o conjunto de caminhos alterados deve ser EXATAMENTE o conjunto autorizado;
//  - cada caminho autorizado carrega autorização + commit de origem;
//  - os caminhos adicionais têm o CONTEÚDO comparado ao commit aprovado, de
//    modo que a autorização do caminho NÃO vira autorização permanente para
//    modificá-lo;
//  - a rota generate-image mantém as verificações específicas (aditiva + guard
//    antes do parse/reserva);
//  - a quick 261013-hxm acrescentou os caminhos lab/bench tocados pela correção
//    test-only das fixtures + alinhamento do snapshot do laboratório, com
//    autorização e commit por entrada.
const AUTHORIZED_ROUTE_FILE = "src/app/api/campaign/generate-image/route.ts";
// F56.2b1b (Plano 06 — reconciliação G-LF): a rota de download passa a carregar o
// portão do novo fluxo (aditivo). Tem entrada AUTORIZADA própria (autorização +
// commit de origem) e prova de preservação do ramo legado — NÃO entra na
// comparação de conteúdo dos 12 caminhos adicionais (que permanece inalterada).
const AUTHORIZED_DOWNLOAD_ROUTE_FILE =
  "src/app/api/campaign/[id]/download/route.ts";
// Commit aprovado do ramo legado da rota de download (antes da correção de
// entrega): o bloco legado é comparado por CONTEÚDO contra este commit.
const AUTHORIZED_DOWNLOAD_ROUTE_COMMIT = "e3fb664e";

interface AuthorizedFrontierChange {
  readonly path: string;
  readonly authorization: string;
  /** Commit de origem cujo conteúdo é o aprovado para este caminho. */
  readonly commit: string;
}

const AUTHORIZED_FRONTIER_CHANGES: readonly AuthorizedFrontierChange[] = [
  {
    path: AUTHORIZED_ROUTE_FILE,
    authorization: "F56.2.1-03 (exceção estreita aprovada — guard de submissão)",
    commit: "6d341964",
  },
  {
    path: AUTHORIZED_DOWNLOAD_ROUTE_FILE,
    authorization:
      "F56.2b1b Plano 06 (portão de download do novo fluxo — ramo legado preservado)",
    commit: "e3fb664e",
  },
  {
    path: "src/lib/ai/__tests__/quick-gpt6-luna-brand-profile-text.test.ts",
    authorization:
      "quick 261018-k9c (testes Luna em brand_profile_text — caminho específico)",
    commit: "3d6e5763",
  },
  {
    path: "src/lib/ai/__tests__/quick-gpt6-luna-brand-profile-vision.test.ts",
    authorization:
      "quick 261018-k9c (testes Luna em brand_profile_vision — caminho específico)",
    commit: "3d6e5763",
  },
  {
    path: "src/lib/ai/__tests__/luna-gradual-opening.contract.test.ts",
    authorization:
      "F56.2e 56.2.7 (teste de resolucao de Luna nas tres capacidades)",
    commit: "2d81646c",
  },
  {
    path: "src/lib/lab/bench/domain/background-direction.ts",
    authorization: "quick 261009-u3h (prompts experimentais — somente laboratório)",
    commit: "99017f35",
  },
  {
    path: "src/lib/lab/bench/domain/prompt-composer.ts",
    authorization: "quick 261009-u3h (prompts experimentais — somente laboratório)",
    commit: "99017f35",
  },
  {
    path: "src/lib/lab/bench/domain/policies/destaque.ts",
    authorization: "quick 261009-u3h (prompts experimentais — somente laboratório)",
    commit: "99017f35",
  },
  {
    path: "src/lib/lab/bench/domain/policies/exclusivo.ts",
    authorization: "quick 261009-u3h (prompts experimentais — somente laboratório)",
    commit: "99017f35",
  },
  {
    path: "src/lib/lab/bench/domain/policies/oferta.ts",
    authorization: "quick 261009-u3h (prompts experimentais — somente laboratório)",
    commit: "99017f35",
  },
  {
    path: "src/lib/lab/bench/domain/policies/resolve-bench-prompt-policies.ts",
    authorization: "quick 261009-u3h (prompts experimentais — somente laboratório)",
    commit: "99017f35",
  },
  {
    path: "src/lib/lab/bench/__tests__/prompt-composer.contract.test.ts",
    authorization: "quick 261009-u3h (testes/versões do laboratório)",
    commit: "b7ab7b1b",
  },
  {
    path: "src/lib/lab/bench/__tests__/prompt-policy.contract.test.ts",
    authorization: "quick 261009-u3h (testes/versões do laboratório)",
    commit: "b7ab7b1b",
  },
  {
    path: "src/lib/ai/types.ts",
    authorization:
      "quick 261010-rsp (diagnóstico aditivo de identidade visual) + F56.2b1b Plano 08 P1 Opção A (tipo aditivo AiEnvelopeInternalCost)",
    commit: "201e606f",
  },
  {
    path: "src/lib/ai/telemetry-sink.ts",
    authorization:
      "F56.2b1b Plano 08 P1 Opção A (custo interno `internalCost` opcional no contexto do sink — aditivo)",
    commit: "201e606f",
  },
  {
    path: "src/lib/ai/__tests__/telemetry-sink.test.ts",
    authorization:
      "F56.2b1b Plano 08 P1 Opção A (testes do custo interno do novo fluxo no sink)",
    commit: "201e606f",
  },
  {
    path: "src/lib/ai/adapters/chat-completions.ts",
    authorization:
      "quick 261010-rsp (diagnóstico aditivo de identidade visual) + quick gpt6-luna (adapter gpt-6-luna: reasoning_effort none / max_completion_tokens, sem temperature — GPT-4o/Gemini preservados)",
    commit: "322809d0",
  },
  {
    path: "src/lib/ai/adapters/__tests__/chat-completions.test.ts",
    authorization: "quick 261010-rsp (testes do adapter)",
    commit: "6c2ebdb7",
  },
  {
    path: "src/lib/ai/__tests__/ai-invocation-result-additive.contract.test.ts",
    authorization: "quick 261010-rsp (contrato aditivo)",
    commit: "6c2ebdb7",
  },
  // Reconciliação do manifesto (2026-10-17, quick 261017-cdi): registra por
  // caminho + commit + autorização as mudanças de fronteira JÁ AUTORIZADAS por
  // quicks anteriores (gpt6-luna e 261017-ms4) que ainda não constavam aqui.
  // Nenhum caminho é liberado em bloco; BASE_SHA e testes negativos permanecem.
  {
    path: "src/lib/ai/gateway.ts",
    authorization:
      "quick gpt6-luna (AiInvoker/AiGateway: prepare/invokePrepared + correções)",
    commit: "322809d0",
  },
  {
    path: "src/lib/ai/__tests__/gateway-prepared.test.ts",
    authorization: "quick gpt6-luna (teste prepare/invokePrepared + pinning)",
    commit: "7d08a068",
  },
  {
    path: "src/lib/ai/model-registry.ts",
    authorization:
      "quick gpt6-luna (allowlist `openai: gpt-6-luna` para campaign_copy)",
    commit: "0b72ad99",
  },
  {
    path: "src/lib/ai/__tests__/upstream-images-adapter.test.ts",
    authorization:
      "quick 261017-ms4 (pricing das seis combinações — teste do adapter)",
    commit: "8a8c0819",
  },
  {
    path: "src/lib/ai-cost/__tests__/homolog-image-pricing-readiness.test.ts",
    authorization:
      "quick 261017-ms4 (pricing das seis combinações — teste de readiness)",
    commit: "8a8c0819",
  },
  {
    path: "src/lib/lab/bench/domain/__tests__/intent-schema.contract.test.ts",
    authorization:
      "quick 261013-hxm — fixtures e alinhamento do snapshot do laboratório",
    commit: "e13732a2",
  },
  {
    path: "src/lib/lab/bench/__tests__/branding-service.test.ts",
    authorization:
      "quick 261013-hxm — fixtures e alinhamento do snapshot do laboratório",
    commit: "e13732a2",
  },
  {
    path: "src/lib/lab/bench/__tests__/prompt-base.contract.test.ts",
    authorization:
      "quick 261013-hxm — fixtures e alinhamento do snapshot do laboratório",
    commit: "e13732a2",
  },
  {
    path: "src/lib/lab/bench/__tests__/form-parity.contract.test.ts",
    authorization:
      "quick 261013-hxm — fixtures e alinhamento do snapshot do laboratório",
    commit: "e13732a2",
  },
  {
    path: "src/lib/lab/bench/__tests__/run-history.contract.test.ts",
    authorization:
      "quick 261013-hxm — fixtures e alinhamento do snapshot do laboratório",
    commit: "e13732a2",
  },
  {
    path: "src/lib/lab/bench/domain/campaign-snapshot.ts",
    authorization:
      "quick 261013-hxm — fixtures e alinhamento do snapshot do laboratório",
    commit: "af28dc7e",
  },
  {
    path: "src/lib/lab/bench/__tests__/campaign-snapshot.test.ts",
    authorization:
      "quick 261013-hxm — fixtures e alinhamento do snapshot do laboratório",
    commit: "af28dc7e",
  },
  // Reconciliação 2026-10-21 — F50.2 (oferta de teste gratuito de 28 dias).
  // Mudança ADITIVA/read-only no CreditService (leitura do enrollment), já
  // aprovada no planejamento da F50.2 (50.2-02-PLAN.md) e publicada nesse
  // commit. A comparação de conteúdo contra `05e81d90` permanece ativa.
  {
    path: "src/lib/credit/credit-service.ts",
    authorization:
      "F50.2 (leitura de enrollment do teste gratuito — aditiva/read-only)",
    commit: "05e81d90",
  },
];

const ADDITIONAL_AUTHORIZED_FILES = AUTHORIZED_FRONTIER_CHANGES.filter(
  (entry) =>
    entry.path !== AUTHORIZED_ROUTE_FILE &&
    entry.path !== AUTHORIZED_DOWNLOAD_ROUTE_FILE,
);

const LEGACY_FRONTIER_PATHS = [
  "src/app/api/campaign/generate-image/route.ts",
  ":(literal)src/app/api/campaign/[id]/download/route.ts",
  "src/lib/ai/adapters/images.ts",
  "src/lib/ai/adapters/registry.ts",
  "src/lib/ai/gateway.ts",
  "src/lib/credit/credit-service.ts",
  "src/lib/ai-cost/**",
  "src/lib/lab/bench/**",
  "src/lib/ai/**",
  ":(exclude)src/lib/ai/image-generation-operations-repository.ts",
  ":(exclude)src/lib/ai/__tests__/image-generation-operations-repository.test.ts",
  ":(exclude)src/lib/ai/__tests__/image-generation-config-snapshot.reuse.test.ts",
  ":(exclude)src/lib/ai/__tests__/image-generation-operations-repository.integration.test.ts",
];

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: REPOSITORY_ROOT, encoding: "utf8" });
}

/** Normaliza CRLF→LF para comparar conteúdo independentemente do checkout. */
function normalize(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

// Bloco legado completo: começa no gate F37 e vai até o fim da rota (storage,
// resposta e fechamento). A comparação por CONTEÚDO contra o commit aprovado
// admite SOMENTE a extração exata do cálculo do nome para o helper.
const LEGACY_BLOCK_MARKER = "  // F37.1";
const LEGACY_FILENAME_CALCULATION = [
  '  const safeName = campaign.product_name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase() || "campanha";',
  '  const dateStr = campaign.created_at?.split("T")[0] ?? new Date().toISOString().split("T")[0];',
  "  const filename = `${safeName}-${dateStr}.jpg`;",
].join("\n");
const SHARED_FILENAME_CALCULATION = [
  "  const filename = buildSafeDownloadFilename({",
  "    productName: campaign.product_name,",
  "    createdAt: campaign.created_at,",
  '    extension: "jpg",',
  "  });",
].join("\n");

function legacyBlock(source: string): string {
  const idx = source.indexOf(LEGACY_BLOCK_MARKER);
  if (idx < 0) {
    throw new Error("legacy_block_marker_missing");
  }
  return source.slice(idx).trimEnd();
}

/** Diferenças do conjunto alterado contra o conjunto autorizado. */
function diffAgainstAuthorized(
  changed: readonly string[],
  authorized: readonly string[],
): { extra: string[]; missing: string[] } {
  const changedSet = new Set(changed);
  const authorizedSet = new Set(authorized);
  return {
    extra: changed.filter((file) => !authorizedSet.has(file)),
    missing: authorized.filter((file) => !changedSet.has(file)),
  };
}

/** Caminhos autorizados cujo conteúdo atual difere do conteúdo aprovado. */
function contentMismatches(
  entries: readonly AuthorizedFrontierChange[],
  readCurrent: (file: string) => string,
  readApproved: (commit: string, file: string) => string,
): string[] {
  return entries
    .filter(
      (entry) =>
        normalize(readCurrent(entry.path)) !==
        normalize(readApproved(entry.commit, entry.path)),
    )
    .map((entry) => entry.path);
}

describe("legacy-frontier guard — F56.2a", () => {
  it("usa o BASE_SHA literal registrado e confirma commit/ancestry", () => {
    const evidence = readFileSync(BASE_SHA_RECORD, "utf8");
    expect(evidence.split(/\r?\n/)).toContain(`BASE_SHA: \`${BASE_SHA}\``);

    expect(() =>
      execFileSync("git", ["cat-file", "-e", `${BASE_SHA}^{commit}`], {
        cwd: REPOSITORY_ROOT,
        stdio: "pipe",
      }),
    ).not.toThrow();
    expect(() =>
      execFileSync("git", ["merge-base", "--is-ancestor", BASE_SHA, "HEAD"], {
        cwd: REPOSITORY_ROOT,
        stdio: "pipe",
      }),
    ).not.toThrow();
  });

  it("reconhece EXATAMENTE o conjunto autorizado de mudanças de fronteira", () => {
    const changed = git([
      "diff",
      "--name-only",
      `${BASE_SHA}..HEAD`,
      "--",
      ...LEGACY_FRONTIER_PATHS,
    ])
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);

    const { extra, missing } = diffAgainstAuthorized(
      changed,
      AUTHORIZED_FRONTIER_CHANGES.map((entry) => entry.path),
    );

    // Conjunto exato: nenhum caminho NÃO autorizado e nenhum autorizado ausente.
    expect(extra, "caminhos de fronteira não autorizados").toEqual([]);
    expect(missing, "caminhos autorizados ausentes do diff").toEqual([]);
    expect(changed).toHaveLength(AUTHORIZED_FRONTIER_CHANGES.length);
  });

  it("não autoriza modificação de conteúdo nos caminhos autorizados adicionais", () => {
    const mismatches = contentMismatches(
      ADDITIONAL_AUTHORIZED_FILES,
      (file) => readFileSync(path.resolve(REPOSITORY_ROOT, file), "utf8"),
      (commit, file) => git(["show", `${commit}:${file}`]),
    );

    // O conteúdo ATUAL deve ser idêntico ao conteúdo do commit aprovado; a
    // autorização do caminho não é autorização permanente para modificá-lo.
    expect(mismatches).toEqual([]);
  });

  it("a rota generate-image evolui para o wiring b1b preservando o fluxo legado", () => {
    const diff = git([
      "diff",
      "--unified=0",
      `${BASE_SHA}..HEAD`,
      "--",
      AUTHORIZED_ROUTE_FILE,
    ]);
    const lines = diff.split(/\r?\n/);
    const removed = lines.filter((l) => l.startsWith("-") && !l.startsWith("---"));
    const added = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++"));

    // (i) Nenhuma linha existente removida/alterada: o fluxo legado é preservado
    // byte a byte (prova concreta de preservação do comportamento legado).
    expect(removed).toEqual([]);

    const addedText = added.join("\n");
    // Os imports do guard b1a continuam presentes.
    expect(addedText).toMatch(/\+import \{ detectExclusiveNewFlowFields \}/);
    expect(addedText).toMatch(/\+import \{ assertSubmissionEligible \}/);
    expect(addedText).toMatch(/\+import \{ resolveEligibilityContext \}/);
    expect(addedText).toMatch(/\+import \{ resolveProductFlowAuthorization \}/);
    // As adições do wiring b1b (roteamento de aceitação + revalidação server-side).
    // O import do orquestrador é reconhecido por MÓDULO + SÍMBOLOS (não por uma
    // formatação específica): os dois símbolos consumidos pela rota e o specifier
    // do módulo, num ÚNICO import consolidado (sem import duplicado do módulo).
    expect(addedText).toMatch(
      /import\s*\{[^}]*\brunProductOneToOneGeneration\b[^}]*\breadProductOneToOneOperation\b[^}]*\}\s*from\s*"@\/lib\/product-1-1\/orchestration\/generation-orchestrator"/,
    );
    expect(
      (
        addedText.match(
          /from\s*"@\/lib\/product-1-1\/orchestration\/generation-orchestrator"/g,
        ) ?? []
      ).length,
      "import do módulo do orquestrador deve ser ÚNICO (consolidado)",
    ).toBe(1);
    expect(addedText).toMatch(/\+import \{ NewFlowGenerateImageRequestSchema \}/);

    // (ii) As linhas adicionadas ANTES do índice do guard NÃO contêm `safeParse(`/
    // `fieldErrors` — as adições do novo ramo ficam confinadas ao caminho `allowed`.
    const guardAddedIdx = added.findIndex((l) =>
      l.includes("detectExclusiveNewFlowFields(body)"),
    );
    expect(guardAddedIdx).toBeGreaterThan(-1);
    const beforeGuard = added.slice(0, guardAddedIdx).join("\n");
    expect(beforeGuard).not.toMatch(/safeParse\(/);
    expect(beforeGuard).not.toMatch(/fieldErrors/);

    // (iii) O novo tratamento `allowed` é ADITIVO dentro do bloco do guard
    // existente — depois do guard e ANTES do `safeParse` legado e da reserva.
    const source = readFileSync(path.resolve(REPOSITORY_ROOT, AUTHORIZED_ROUTE_FILE), "utf8");
    const guardIdx = source.indexOf("detectExclusiveNewFlowFields(body)");
    const allowedIdx = source.indexOf('guard.kind === "allowed"');
    const legacySafeParseIdx = source.indexOf("GenerateImageRequestSchema.safeParse(body)");
    const reserveIdx = source.indexOf("creditService.reserveCredit(");
    expect(guardIdx).toBeGreaterThan(-1);
    expect(allowedIdx).toBeGreaterThan(guardIdx);
    expect(legacySafeParseIdx).toBeGreaterThan(allowedIdx);
    expect(reserveIdx).toBeGreaterThan(legacySafeParseIdx);
    // O wiring b1b é realmente efetivado (não apenas autorizado no comentário).
    expect(source).toMatch(/return await runProductOneToOneGeneration\(/);
  });

  it("o guard roda ANTES do safeParse e da reserva, preservando o fluxo legado", () => {
    const source = readFileSync(
      path.resolve(REPOSITORY_ROOT, AUTHORIZED_ROUTE_FILE),
      "utf8",
    );

    const guardIdx = source.indexOf("detectExclusiveNewFlowFields(body)");
    const safeParseIdx = source.indexOf("GenerateImageRequestSchema.safeParse(body)");
    const reserveIdx = source.indexOf("creditService.reserveCredit(");

    expect(guardIdx).toBeGreaterThan(-1);
    expect(safeParseIdx).toBeGreaterThan(guardIdx);
    expect(reserveIdx).toBeGreaterThan(safeParseIdx);

    // Sem duplicação dos pontos críticos.
    expect(source.match(/GenerateImageRequestSchema\.safeParse\(body\)/g)?.length).toBe(1);
    expect(source.match(/creditService\.reserveCredit\(/g)?.length).toBe(1);
    // Resposta de validação legada (400 com details/fieldErrors) preservada.
    expect(source).toMatch(/details: parsed\.error\.flatten\(\)\.fieldErrors/);
  });

  it("a rota de download evolui para o portão do novo fluxo preservando o ramo legado", () => {
    const diff = git([
      "diff",
      "--unified=0",
      `${BASE_SHA}..HEAD`,
      "--",
      AUTHORIZED_DOWNLOAD_ROUTE_FILE,
    ]);
    const added = diff
      .split(/\r?\n/)
      .filter((l) => l.startsWith("+") && !l.startsWith("+++"));

    const addedText = added.join("\n");
    // O ramo novo é ADITIVO: importa o portão, a arte e o cliente de operação.
    expect(addedText).toMatch(/download-gate/);
    expect(addedText).toMatch(/artifact\/artifact-store/);
    expect(addedText).toMatch(/orchestration\/attempt-start-client/);
    expect(addedText).toMatch(/decideNewFlowDownload/);

    const source = readFileSync(
      path.resolve(REPOSITORY_ROOT, AUTHORIZED_DOWNLOAD_ROUTE_FILE),
      "utf8",
    );
    const approvedSource = git([
      "show",
      `${AUTHORIZED_DOWNLOAD_ROUTE_COMMIT}:${AUTHORIZED_DOWNLOAD_ROUTE_FILE}`,
    ]);

    // (i) O bloco legado COMPLETO (F37 + storage privado + resposta + fechamento)
    // é comparado por CONTEÚDO contra o commit aprovado. A ÚNICA diferença
    // admitida é a extração EXATA do cálculo do nome para o helper compartilhado.
    const approvedLegacy = legacyBlock(approvedSource);
    expect(approvedLegacy).toContain(LEGACY_FILENAME_CALCULATION);
    const expectedLegacy = approvedLegacy.replace(
      LEGACY_FILENAME_CALCULATION,
      SHARED_FILENAME_CALCULATION,
    );
    expect(normalize(expectedLegacy)).not.toBe(normalize(approvedLegacy));
    expect(normalize(legacyBlock(source))).toBe(normalize(expectedLegacy));

    // (ii) O ramo legado (F37 + storage privado) permanece presente.
    expect(source).toMatch(/await isCampaignApprovalEnabled\(\)/);
    expect(source).toMatch(/isDeliveryReleased\(/);
    expect(source).toMatch(/from\("campaign-images"\)\s*\.download\(/);
    // (iii) Fail-closed: os bytes são entregues APÓS o portão liberar e a recusa
    // retorna ANTES da entrega; o ramo novo precede o gate legado da F37.
    const decisionIdx = source.indexOf("decideNewFlowDownload(");
    const rejectIdx = source.indexOf("decision.allowed");
    const deliverIdx = source.indexOf("downloadArtifact(");
    const f37Idx = source.indexOf("await isCampaignApprovalEnabled()");
    expect(decisionIdx).toBeGreaterThan(-1);
    expect(rejectIdx).toBeGreaterThan(decisionIdx);
    expect(deliverIdx).toBeGreaterThan(rejectIdx);
    expect(source.indexOf("getCampaignOperation(")).toBeLessThan(f37Idx);
    // A entrega do novo fluxo não é um redirect para a URL de exibição.
    expect(source).not.toContain("NextResponse.redirect");
  });
});

describe("legacy-frontier guard — reconciliação (testes negativos)", () => {
  const AUTHORIZED = AUTHORIZED_FRONTIER_CHANGES.map((entry) => entry.path);

  it("rejeita um caminho de fronteira EXTRA não autorizado", () => {
    const changed = [...AUTHORIZED, "src/lib/ai/adapters/images.ts"];
    const { extra } = diffAgainstAuthorized(changed, AUTHORIZED);
    expect(extra).toEqual(["src/lib/ai/adapters/images.ts"]);
  });

  it("rejeita a ausência de um caminho autorizado", () => {
    const changed = AUTHORIZED.filter(
      (file) => file !== "src/lib/ai/types.ts",
    );
    const { missing } = diffAgainstAuthorized(changed, AUTHORIZED);
    expect(missing).toEqual(["src/lib/ai/types.ts"]);
  });

  it("rejeita alteração de CONTEÚDO em um caminho autorizado", () => {
    const entries = ADDITIONAL_AUTHORIZED_FILES.slice(0, 1);
    const file = entries[0].path;
    const mismatches = contentMismatches(
      entries,
      () => "conteúdo indevidamente alterado",
      () => "conteúdo aprovado",
    );
    expect(mismatches).toEqual([file]);
  });

  it("aceita caminhos e conteúdos quando idênticos ao autorizado", () => {
    const entries = ADDITIONAL_AUTHORIZED_FILES;
    const mismatches = contentMismatches(
      entries,
      (file) => readFileSync(path.resolve(REPOSITORY_ROOT, file), "utf8"),
      (commit, file) => git(["show", `${commit}:${file}`]),
    );
    expect(mismatches).toEqual([]);
  });
});
