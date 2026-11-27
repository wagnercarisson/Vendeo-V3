#!/usr/bin/env node
/**
 * F63 — lint TypeScript DELIMITADO (diagnóstico), reproduzível.
 *
 * Usa exclusivamente `eslint.diagnostic.config.mjs` (o lint oficial do projeto
 * continua sendo `npm run lint`, que não cobre TypeScript). Não cria parser,
 * não instala dependências e não altera a configuração oficial.
 *
 * Escopo: os oito arquivos TS novos/alterados pela F63 + o guarda de regressão
 * reconciliado nesta quick. Para cada arquivo, o relatório prova:
 *   - não está ignorado pelo diagnóstico;
 *   - resolve o parser TypeScript;
 *   - tem `@typescript-eslint/no-unused-vars` ativo (warn);
 *   - zero erros, zero warnings e zero mensagens suprimidas.
 *
 * Uso:
 *   node scripts/f63/validate-ts-lint.mjs [--out <json>]
 *
 * Este script é somente leitura: não executa `--fix`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_FILE = path.join(REPO_ROOT, 'eslint.diagnostic.config.mjs');
const TS_UNUSED = '@typescript-eslint/no-unused-vars';
const RULES_OF_HOOKS = 'react-hooks/rules-of-hooks';
const EXHAUSTIVE_DEPS = 'react-hooks/exhaustive-deps';

/** Oito arquivos TS da F63 + o guarda reconciliado nesta quick. */
const FILES = [
  'src/lib/credit/trial-offer/offer.ts',
  'src/lib/credit/trial-offer/offer-contract.ts',
  'src/lib/credit/__tests__/f63-offer-catalog-schema.postgres.test.ts',
  'src/lib/credit/__tests__/f63-offer-catalog-calendar.postgres.test.ts',
  'src/lib/credit/__tests__/f63-offer-catalog-concurrency.postgres.test.ts',
  'src/lib/credit/__tests__/trial-offer-offer.test.ts',
  'vitest.shared.ts',
  'vitest.integration-f63.config.ts',
  'src/lib/campaign/square-base/__tests__/regression.contract.test.ts',
];

function parseArgs(argv) {
  const args = { out: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === '--out') {
      args.out = argv[i + 1];
      i += 1;
    } else if (current === '--help' || current === '-h') {
      args.help = true;
    } else {
      throw new Error(`argumento desconhecido: ${current}`);
    }
  }
  return args;
}

function severityOf(config, ruleId) {
  const entry = config.rules ? config.rules[ruleId] : undefined;
  return Array.isArray(entry) ? entry[0] : entry;
}

function parserLabel(config) {
  const parser = config.languageOptions?.parser;
  if (!parser) return null;
  const meta = parser.meta ?? {};
  return String(meta.name ?? parser.name ?? parser).trim();
}

function isTypeScriptParser(label) {
  return typeof label === 'string' && /typescript-eslint|@typescript-eslint\/parser/i.test(label);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Uso: node scripts/f63/validate-ts-lint.mjs [--out <json>]');
    return 0;
  }

  const eslint = new ESLint({
    cwd: REPO_ROOT,
    overrideConfigFile: CONFIG_FILE,
    allowInlineConfig: false,
    warnIgnored: true,
  });

  const results = [];
  for (const relPath of FILES) {
    const absPath = path.join(REPO_ROOT, relPath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`arquivo ausente: ${relPath}`);
    }

    const ignored = await eslint.isPathIgnored(relPath);
    const config = await eslint.calculateConfigForFile(relPath);
    const parser = parserLabel(config ?? {});
    const tsUnused = severityOf(config ?? {}, TS_UNUSED);
    const lintResults = await eslint.lintFiles([relPath]);
    const result = lintResults[0];
    if (!result) throw new Error(`lint sem resultado para ${relPath}`);

    const messages = result.messages.map((message) => ({
      ruleId: message.ruleId ?? null,
      severity: message.severity,
      line: message.line ?? null,
      message: message.message,
    }));
    const forbiddenRuleMessages = messages.filter(
      (message) =>
        message.ruleId === RULES_OF_HOOKS || message.ruleId === EXHAUSTIVE_DEPS,
    );
    const suppressed = result.suppressedMessages ?? [];
    const errors = result.errorCount ?? 0;
    const warnings = result.warningCount ?? 0;
    const fatalErrors = result.fatalErrorCount ?? 0;

    const pass =
      ignored === false &&
      isTypeScriptParser(parser) &&
      tsUnused === 1 &&
      errors === 0 &&
      warnings === 0 &&
      fatalErrors === 0 &&
      suppressed.length === 0 &&
      messages.length === 0 &&
      forbiddenRuleMessages.length === 0;

    results.push({
      file: relPath,
      ignored,
      parser,
      parser_is_typescript: isTypeScriptParser(parser),
      rules: {
        [TS_UNUSED]: tsUnused ?? null,
        [RULES_OF_HOOKS]: severityOf(config ?? {}, RULES_OF_HOOKS) ?? null,
        [EXHAUSTIVE_DEPS]: severityOf(config ?? {}, EXHAUSTIVE_DEPS) ?? null,
      },
      error_count: errors,
      warning_count: warnings,
      fatal_error_count: fatalErrors,
      suppressed_messages: suppressed.length,
      messages,
      pass,
    });
  }

  const summary = {
    files: results.length,
    ignored: results.filter((entry) => entry.ignored).length,
    parser_ok: results.filter((entry) => entry.parser_is_typescript).length,
    rule_ok: results.filter((entry) => entry.rules[TS_UNUSED] === 1).length,
    errors: results.reduce((total, entry) => total + entry.error_count, 0),
    warnings: results.reduce((total, entry) => total + entry.warning_count, 0),
    fatal_errors: results.reduce((total, entry) => total + entry.fatal_error_count, 0),
    suppressed: results.reduce((total, entry) => total + entry.suppressed_messages, 0),
    pass: results.every((entry) => entry.pass),
  };

  const evidence = {
    tool: 'eslint.diagnostic.config.mjs',
    mode: 'delimited-diagnostic',
    official_lint_scope: 'npm run lint (não cobre .ts neste repositório)',
    command:
      'eslint --config eslint.diagnostic.config.mjs --no-inline-config --max-warnings 0 <files>',
    generated_at_utc: new Date().toISOString(),
    allow_inline_config: false,
    files: results,
    summary,
  };

  for (const entry of results) {
    console.log(
      `${entry.pass ? 'PASS' : 'FAIL'} ${entry.file} ignored=${entry.ignored} parser=${entry.parser} ${TS_UNUSED}=${entry.rules[TS_UNUSED]} errors=${entry.error_count} warnings=${entry.warning_count} suppressed=${entry.suppressed_messages}`,
    );
    if (!entry.pass) {
      for (const message of entry.messages) {
        console.error(
          `  ${message.ruleId ?? '(fatal)'} ${message.line ?? ''}: ${message.message}`,
        );
      }
    }
  }
  console.log(
    `summary: files=${summary.files} ignored=${summary.ignored} parser_ok=${summary.parser_ok} rule_ok=${summary.rule_ok} errors=${summary.errors} warnings=${summary.warnings} fatal=${summary.fatal_errors} suppressed=${summary.suppressed} pass=${summary.pass}`,
  );

  if (args.out) {
    const abs = path.resolve(process.cwd(), args.out);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    console.log(`evidence: ${abs}`);
  }

  return summary.pass ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(`f63 ts lint: ${error.message}`);
    process.exitCode = 1;
  });
