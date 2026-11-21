/**
 * Provas da configuração de lint diagnóstico (quick 261121-k4g).
 *
 * Executa com `node --test` (categoria `nodeTest` em
 * scripts/testing/test-categories.json). Não importa módulos da aplicação,
 * não escreve arquivos e não acessa banco/Storage/rede.
 *
 * Duas instâncias do MESMO config:
 * - `strictResolver`: honra os `ignores` do config — usada para provar que
 *   arquivos reais são analisados e que fixtures são ignoradas pelo CLI normal.
 * - `fixtureLinter`: `ignore: false` — usada apenas para lintar as fixtures
 *   sintéticas que vivem num diretório ignorado de propósito.
 * Ambas usam `allowInlineConfig: false`, a mesma política da CLI.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";

const REPO_ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const CONFIG_FILE = path.join(REPO_ROOT, "eslint.diagnostic.config.mjs");
const FIXTURE_DIR = path.join(REPO_ROOT, "tests/fixtures/lint-diagnostic");
const ESLINT_BIN = path.join(REPO_ROOT, "node_modules/eslint/bin/eslint.js");

const TS_UNUSED = "@typescript-eslint/no-unused-vars";
const RULES_OF_HOOKS = "react-hooks/rules-of-hooks";
const EXHAUSTIVE_DEPS = "react-hooks/exhaustive-deps";

const strictResolver = new ESLint({
  cwd: REPO_ROOT,
  overrideConfigFile: CONFIG_FILE,
  allowInlineConfig: false,
});

const fixtureLinter = new ESLint({
  cwd: REPO_ROOT,
  overrideConfigFile: CONFIG_FILE,
  allowInlineConfig: false,
  ignore: false,
});

function severityOf(config, ruleId) {
  const entry = config.rules ? config.rules[ruleId] : undefined;
  return Array.isArray(entry) ? entry[0] : entry;
}

function messagesOf(result) {
  return result.messages.map((message) => ({
    ruleId: message.ruleId ?? null,
    severity: message.severity,
    line: message.line ?? null,
    message: message.message,
  }));
}

async function lintFixture(name) {
  const code = fs.readFileSync(path.join(FIXTURE_DIR, name), "utf8");
  const [result] = await fixtureLinter.lintText(code, {
    filePath: path.join(FIXTURE_DIR, name),
  });
  return result;
}

function countRule(result, ruleId) {
  return result.messages.filter((message) => message.ruleId === ruleId).length;
}

async function assertRealAppFile(relPath) {
  const ignored = await strictResolver.isPathIgnored(relPath);
  assert.equal(ignored, false, `${relPath} não deveria ser ignorado pelo diagnóstico`);

  const config = await strictResolver.calculateConfigForFile(relPath);
  assert.ok(config, `${relPath} deveria resolver uma configuração`);
  assert.ok(
    config.languageOptions && config.languageOptions.parser,
    `${relPath} deveria resolver o parser TypeScript`,
  );
  assert.equal(severityOf(config, TS_UNUSED), 1, `${relPath} deveria ter ${TS_UNUSED} como warn`);
  assert.equal(severityOf(config, RULES_OF_HOOKS), 2, `${relPath} deveria ter ${RULES_OF_HOOKS} como error`);
  assert.equal(severityOf(config, EXHAUSTIVE_DEPS), 1, `${relPath} deveria ter ${EXHAUSTIVE_DEPS} como warn`);
}

test("a) rota .ts real não é ignorada e resolve parser + as três regras", async () => {
  await assertRealAppFile("src/app/api/access-requests/route.ts");
});

test("b) componente .tsx e página .tsx reais não são ignorados", async () => {
  await assertRealAppFile("src/components/admin/reprocess-button.tsx");
  await assertRealAppFile("src/app/layout.tsx");
});

test("c) teste em __tests__ não recebe regras de hooks", async () => {
  const relPath = "src/lib/__tests__/market-preferences-schema.postgres.test.ts";
  const ignored = await strictResolver.isPathIgnored(relPath);
  assert.equal(ignored, false, `${relPath} não deveria ser ignorado`);

  const config = await strictResolver.calculateConfigForFile(relPath);
  assert.equal(severityOf(config, TS_UNUSED), 1, `${relPath} deveria ter ${TS_UNUSED} como warn`);
  assert.equal(severityOf(config, RULES_OF_HOOKS), undefined, `${relPath} não deveria ter ${RULES_OF_HOOKS}`);
  assert.equal(severityOf(config, EXHAUSTIVE_DEPS), undefined, `${relPath} não deveria ter ${EXHAUSTIVE_DEPS}`);
});

test("c2) testes colocados FORA de __tests__ também não recebem regras de hooks", async () => {
  const relPaths = [
    "src/app/(app)/admin/feature-flags/product-activation-panel.test.tsx",
    "src/app/api/admin/ai-model-selection/route.test.ts",
  ];

  for (const relPath of relPaths) {
    const ignored = await strictResolver.isPathIgnored(relPath);
    assert.equal(ignored, false, `${relPath} não deveria ser ignorado`);
    const config = await strictResolver.calculateConfigForFile(relPath);
    assert.equal(severityOf(config, TS_UNUSED), 1, `${relPath} deveria ter ${TS_UNUSED} como warn`);
    assert.equal(severityOf(config, RULES_OF_HOOKS), undefined, `${relPath} não deveria ter ${RULES_OF_HOOKS}`);
    assert.equal(severityOf(config, EXHAUSTIVE_DEPS), undefined, `${relPath} não deveria ter ${EXHAUSTIVE_DEPS}`);
  }
});

test("d) declaração não utilizada dispara exatamente a regra TypeScript", async () => {
  const fixture = await lintFixture("unused-vars.fixture.ts");
  assert.equal(countRule(fixture, TS_UNUSED), 1, "fixture deve produzir 1 ocorrência de no-unused-vars");

  const valid = await lintFixture("unused-vars.valid.ts");
  assert.equal(countRule(valid, TS_UNUSED), 0, "contraparte válida não deve produzir no-unused-vars");
});

test("e) hook condicional dispara rules-of-hooks como error", async () => {
  const fixture = await lintFixture("rules-of-hooks.fixture.tsx");
  const violations = fixture.messages.filter((message) => message.ruleId === RULES_OF_HOOKS);
  assert.ok(violations.length >= 1, "fixture deve produzir rules-of-hooks");
  assert.equal(violations[0].severity, 2, "rules-of-hooks deve ser error");

  const valid = await lintFixture("rules-of-hooks.valid.tsx");
  assert.equal(countRule(valid, RULES_OF_HOOKS), 0, "contraparte válida não deve produzir rules-of-hooks");
});

test("f) dependência ausente em efeito dispara exhaustive-deps", async () => {
  const fixture = await lintFixture("exhaustive-deps.fixture.tsx");
  const warnings = fixture.messages.filter((message) => message.ruleId === EXHAUSTIVE_DEPS);
  assert.ok(warnings.length >= 1, "fixture deve produzir exhaustive-deps");
  assert.equal(warnings[0].severity, 1, "exhaustive-deps deve ser warn");

  const valid = await lintFixture("exhaustive-deps.valid.tsx");
  assert.equal(countRule(valid, EXHAUSTIVE_DEPS), 0, "contraparte válida não deve produzir exhaustive-deps");
});

test("g) cobertura JS/MJS preservada: no-unused-vars do core continua ativo", async () => {
  const code = "const unusedJsValue = 1;\nexport const ok = 2;\n";
  const [result] = await fixtureLinter.lintText(code, {
    filePath: path.join(FIXTURE_DIR, "virtual-unused.fixture.mjs"),
  });

  assert.equal(countRule(result, "no-unused-vars"), 1, "JS/MJS deve manter no-unused-vars");
});

test("h) diretivas inline não são aplicadas nem geram erro de plugin ausente", async () => {
  const fixture = await lintFixture("inline-config.fixture.ts");

  const definitionErrors = fixture.messages.filter((message) =>
    message.message.includes("Definition for rule"),
  );
  assert.equal(definitionErrors.length, 0, "diretiva para plugin ausente não deve virar erro de definição");

  const nextPluginMessages = fixture.messages.filter(
    (message) => typeof message.ruleId === "string" && message.ruleId.startsWith("@next/next/"),
  );
  assert.equal(nextPluginMessages.length, 0, "nenhuma mensagem deve vir do plugin next (não instalado)");

  assert.equal(
    countRule(fixture, TS_UNUSED),
    1,
    "a ocorrência suprimida por diretiva deve ser reportada com inline config desligada",
  );

  const valid = await lintFixture("inline-config.valid.ts");
  assert.equal(valid.messages.length, 0, "contraparte válida não deve produzir nenhuma mensagem");
});

test("i) política de diretivas idêntica entre CLI e API (exit 1 por achados é esperado)", async () => {
  const fixtureName = "inline-config.fixture.ts";
  const fixturePath = path.join(FIXTURE_DIR, fixtureName);

  const cli = spawnSync(
    process.execPath,
    [
      ESLINT_BIN,
      "--config",
      CONFIG_FILE,
      "--no-inline-config",
      "--no-ignore",
      "--format",
      "json",
      fixturePath,
    ],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );

  assert.ok(
    cli.status === 0 || cli.status === 1,
    `CLI retornou status inesperado ${cli.status}. stderr: ${cli.stderr}`,
  );

  let parsed;
  try {
    parsed = JSON.parse(cli.stdout);
  } catch (error) {
    assert.fail(`CLI não produziu JSON válido (${error.message}). stdout: ${cli.stdout}`);
  }

  assert.equal(parsed.length, 1, "CLI deve devolver exatamente um resultado para a fixture");
  const cliResult = parsed[0];
  assert.equal(cliResult.fatalErrorCount, 0, `CLI reportou erro fatal: ${cli.stdout}`);
  assert.equal(
    cliResult.messages.some((message) => message.message.includes("Definition for rule")),
    false,
    "CLI não deve reportar 'Definition for rule'",
  );

  const apiResult = await lintFixture(fixtureName);

  const normalize = (result) =>
    messagesOf(result)
      .map((message) => `${message.ruleId}|${message.line}|${message.severity}|${message.message}`)
      .sort();

  assert.deepEqual(
    normalize(cliResult),
    normalize(apiResult),
    "CLI e API devem produzir exatamente os mesmos diagnósticos para a mesma fixture",
  );
});

test("j) fixtures são ignoradas pelo CLI normal (só alcançáveis com ignore desligado)", async () => {
  const relPath = "tests/fixtures/lint-diagnostic/inline-config.fixture.ts";
  const ignored = await strictResolver.isPathIgnored(relPath);
  assert.equal(ignored, true, `${relPath} deve estar nos ignores do config para não poluir o inventário`);
});
