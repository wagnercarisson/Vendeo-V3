#!/usr/bin/env node
/**
 * Inventário do lint diagnóstico — quick 261121-k4g.
 *
 * Contrato:
 * - Usa a API do ESLint com `overrideConfigFile: eslint.diagnostic.config.mjs`
 *   e `allowInlineConfig: false` (mesma política do CLI `--no-inline-config`).
 * - NÃO carrega módulos da aplicação, NÃO acessa banco/Storage/rede e grava
 *   apenas sob `--out`.
 * - Todos os caminhos nos artefatos são relativos ao repositório, com `/`.
 * - Exit 0 significa "relatório produzido e sem erro de configuração/fatal".
 *   Achados de regra são DADOS do diagnóstico, não falha do comando.
 *   O relatório imprime as contagens reais e qual seria o exit code de uma
 *   execução estrita (`--max-warnings 0`).
 * - Exit 1 quando há mensagem fatal, "Definition for rule ... was not found"
 *   (erro de configuração que NÃO aparece em fatalErrorCount) ou falha de I/O.
 *
 * Uso:
 *   node scripts/lint/build-inventory.mjs [--out <dir>] [--baseline <arquivo>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const CONFIG_FILE = path.join(REPO_ROOT, 'eslint.diagnostic.config.mjs');
const LINT_GLOB = '**/*.{js,mjs,cjs,ts,tsx,mts,cts}';

const toPosix = (value) => value.split(path.sep).join('/');
const rel = (absolutePath) => toPosix(path.relative(REPO_ROOT, absolutePath));

function parseArgs(argv) {
  const options = { out: path.join('.lint-diagnostic'), baseline: null };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--out') {
      options.out = argv[i + 1];
      i += 1;
    } else if (token === '--baseline') {
      options.baseline = argv[i + 1];
      i += 1;
    } else {
      throw new Error(`Argumento desconhecido: ${token}`);
    }
  }
  if (!options.out) throw new Error('--out exige um diretório');
  return options;
}

function readPackageVersion(moduleName) {
  const file = path.join(REPO_ROOT, 'node_modules', moduleName, 'package.json');
  return JSON.parse(fs.readFileSync(file, 'utf8')).version;
}

const SRC_AREAS = [
  ['src/app/', 'app'],
  ['src/components/', 'components'],
  ['src/hooks/', 'hooks'],
  ['src/lib/', 'lib'],
  ['src/types/', 'types'],
];

function areaOf(relPath) {
  const isTestName = /\.(test|spec)\.[cm]?[jt]sx?$/.test(relPath);
  if (relPath.startsWith('src/')) {
    if (relPath.includes('/__tests__/') || isTestName) return 'src-tests';
    for (const [prefix, area] of SRC_AREAS) {
      if (relPath.startsWith(prefix)) return area;
    }
    return 'src-other';
  }
  if (relPath.startsWith('tests/')) return 'tests';
  if (relPath.startsWith('scripts/')) return 'tools';
  if (!relPath.includes('/')) return 'tools';
  if (relPath.startsWith('supabase/proofs/')) return 'tracking-evidence';
  if (
    relPath.startsWith('.planning/') ||
    relPath.startsWith('.opencode/') ||
    relPath.startsWith('.scripts/')
  ) {
    return 'tracking-evidence';
  }
  if (relPath.startsWith('supabase/')) return 'tools';
  return 'other';
}

function extractSuppressionRules(rest) {
  let text = rest;
  text = text.trim();
  if (text.startsWith('--')) text = text.slice(2).trim();
  if (text === '') return ['(todas as regras)'];
  return text.split(',').map((rule) => rule.trim()).filter(Boolean);
}

/**
 * Extrai apenas o texto de comentários (linha e bloco), ignorando strings e
 * templates. Sem isso, o próprio script/config/testes — que contêm a palavra
 * `eslint-disable` como literal — seriam inventariados como diretivas.
 */
function commentSegments(text) {
  const segments = [];
  let index = 0;
  let line = 1;
  let state = 'code';
  let start = 0;
  let startLine = 1;

  const pushSegment = (end) => {
    segments.push({ text: text.slice(start, end), line: startLine });
  };

  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];

    if (state === 'code') {
      if (char === '/' && next === '/') {
        state = 'line';
        start = index + 2;
        startLine = line;
        index += 2;
        continue;
      }
      if (char === '/' && next === '*') {
        state = 'block';
        start = index + 2;
        startLine = line;
        index += 2;
        continue;
      }
      if (char === "'") {
        state = 'single';
        index += 1;
        continue;
      }
      if (char === '"') {
        state = 'double';
        index += 1;
        continue;
      }
      if (char === '`') {
        state = 'template';
        index += 1;
        continue;
      }
      if (char === '\n') line += 1;
      index += 1;
      continue;
    }

    if (state === 'line') {
      if (char === '\n') {
        pushSegment(index);
        state = 'code';
      } else {
        index += 1;
        continue;
      }
      line += 1;
      index += 1;
      continue;
    }

    if (state === 'block') {
      if (char === '*' && next === '/') {
        pushSegment(index);
        state = 'code';
        index += 2;
        continue;
      }
      if (char === '\n') line += 1;
      index += 1;
      continue;
    }

    if (state === 'single' || state === 'double') {
      if (char === '\\') {
        index += 2;
        continue;
      }
      if ((state === 'single' && char === "'") || (state === 'double' && char === '"')) {
        state = 'code';
      }
      if (char === '\n') line += 1;
      index += 1;
      continue;
    }

    // template
    if (char === '\\') {
      index += 2;
      continue;
    }
    if (char === '`') state = 'code';
    if (char === '\n') line += 1;
    index += 1;
    continue;
  }

  if (state === 'line' || state === 'block') pushSegment(text.length);
  return segments;
}

function collectSuppressions(relPath) {
  const text = fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
  const found = [];
  const directivePattern = /^\s*eslint-disable(-next-line|-line)?([^\n]*)/;

  for (const segment of commentSegments(text)) {
    const lines = segment.text.split('\n');
    for (let offset = 0; offset < lines.length; offset += 1) {
      const match = directivePattern.exec(lines[offset]);
      if (!match) continue;
      const form = `eslint-disable${match[1] ?? ''}`;
      const rules = extractSuppressionRules(match[2] ?? '');
      for (const rule of rules) {
        found.push({ rule, form, file: relPath, line: segment.line + offset });
      }
    }
  }

  return found;
}

function normalizeBaselinePath(rawPath) {
  if (typeof rawPath !== 'string') return null;
  if (path.isAbsolute(rawPath)) return rel(rawPath);
  return toPosix(rawPath).replace(/^\.\//, '');
}

function extensionOf(relPath) {
  if (relPath.endsWith('.d.ts')) return '.d.ts';
  if (relPath.endsWith('.d.mts')) return '.d.mts';
  const ext = path.extname(relPath);
  return ext === '' ? '(sem extensão)' : ext;
}

function countBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

function formatMap(map) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ');
}

async function buildInventory({ outDir, baselinePath }) {
  const versions = {
    node: process.version,
    eslint: readPackageVersion('eslint'),
    typescriptEslint: readPackageVersion('typescript-eslint'),
    reactHooksPlugin: readPackageVersion('eslint-plugin-react-hooks'),
  };

  const eslint = new ESLint({
    cwd: REPO_ROOT,
    overrideConfigFile: CONFIG_FILE,
    allowInlineConfig: false,
  });

  const results = await eslint.lintFiles([LINT_GLOB]);

  const fatal = [];
  const configNotices = [];
  const configErrors = [];
  const findings = [];
  const files = [];

  for (const result of results) {
    const file = rel(result.filePath);
    const area = areaOf(file);
    files.push({ file, area, extension: extensionOf(file) });

    for (const message of result.messages) {
      const record = {
        file,
        area,
        line: message.line ?? null,
        severity: message.severity,
        ruleId: message.ruleId ?? null,
        message: message.message,
      };
      if (message.fatal === true) {
        fatal.push(record);
      } else if (message.ruleId === null) {
        configNotices.push(record);
      } else if (message.message.includes('Definition for rule')) {
        configErrors.push(record);
      } else {
        findings.push(record);
      }
    }
  }

  const errors = findings.filter((item) => item.severity === 2);
  const warnings = findings.filter((item) => item.severity === 1);

  const byRule = [...countBy(findings, (item) => `${item.ruleId} (${item.severity === 2 ? 'error' : 'warn'})`).entries()]
    .map(([key, count]) => {
      const [ruleId, severity] = key.split(' (');
      return {
        ruleId,
        severity: severity.replace(')', ''),
        count,
        files: new Set(findings.filter((item) => item.ruleId === ruleId).map((item) => item.file)).size,
      };
    })
    .sort((a, b) => b.count - a.count || a.ruleId.localeCompare(b.ruleId));

  const byArea = [...countBy(files, (item) => item.area).entries()]
    .map(([area, fileCount]) => ({
      area,
      files: fileCount,
      errors: errors.filter((item) => item.area === area).length,
      warnings: warnings.filter((item) => item.area === area).length,
    }))
    .sort((a, b) => b.errors + b.warnings - (a.errors + a.warnings) || a.area.localeCompare(b.area));

  const perFile = [...countBy(findings, (item) => item.file).entries()]
    .map(([file, count]) => ({
      file,
      errors: errors.filter((item) => item.file === file).length,
      warnings: warnings.filter((item) => item.file === file).length,
      total: count,
    }))
    .sort((a, b) => b.total - a.total || a.file.localeCompare(b.file));

  const suppressions = files.flatMap((item) => collectSuppressions(item.file));

  const diagnosticExtensions = countBy(files, (item) => item.extension);
  const baseline = baselinePath
    ? JSON.parse(fs.readFileSync(path.resolve(REPO_ROOT, baselinePath), 'utf8'))
    : null;

  let coverage;
  if (!baseline) {
    coverage = {
      baseline: { files: null, byExtension: {} },
      diagnostic: { files: files.length, byExtension: Object.fromEntries(diagnosticExtensions) },
      filesRemoved: [],
      filesAdded: [],
      newlyCoveredByExtension: {},
      limitation: 'baseline não fornecida (--baseline ausente)',
    };
  } else {
    const baselineFiles = baseline
      .map((entry) => normalizeBaselinePath(entry.filePath))
      .filter(Boolean);
    const baselineSet = new Set(baselineFiles);
    const diagnosticSet = new Set(files.map((item) => item.file));

    const filesRemoved = [...baselineSet]
      .filter((file) => !diagnosticSet.has(file))
      .sort()
      .map((file) => ({
        file,
        reason: file.startsWith('supabase/.temp/')
          ? 'diretório gerado/ignorado (runtime, gitignored)'
          : 'não coberto pela configuração de diagnóstico',
      }));

    const filesAdded = files
      .filter((item) => !baselineSet.has(item.file))
      .map((item) => ({ file: item.file, area: item.area, extension: item.extension }))
      .sort((a, b) => a.file.localeCompare(b.file));

    const baselineExtensions = countBy(
      baselineFiles.map((file) => ({ extension: extensionOf(file) })),
      (item) => item.extension,
    );
    const newlyCoveredByExtension = {};
    for (const [extension, count] of diagnosticExtensions) {
      if (!baselineExtensions.has(extension)) newlyCoveredByExtension[extension] = count;
    }

    coverage = {
      baseline: { files: baselineFiles.length, byExtension: Object.fromEntries(baselineExtensions) },
      diagnostic: { files: files.length, byExtension: Object.fromEntries(diagnosticExtensions) },
      filesRemoved,
      filesAdded,
      newlyCoveredByExtension,
    };
  }

  const inventory = {
    toolVersions: versions,
    config: {
      path: 'eslint.diagnostic.config.mjs',
      inlineConfigPolicy: 'disabled (CLI --no-inline-config / API allowInlineConfig: false)',
      rulePolicy: {
        '@typescript-eslint/no-unused-vars': 'warn',
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',
        'no-unused-vars (JS/MJS/CJS)': 'warn',
      },
    },
    totals: {
      files: files.length,
      errors: errors.length,
      warnings: warnings.length,
      fatal: fatal.length,
      configNotices: configNotices.length,
      configErrors: configErrors.length,
    },
    byRule,
    byArea,
    topFiles: perFile.slice(0, 25),
    fatal,
    configNotices,
    configErrors,
    fileCounts: perFile.length,
    suppressions,
    coverage,
  };

  const strictExitCode = inventory.totals.errors + inventory.totals.warnings > 0 ? 1 : 0;

  const markdown = renderMarkdown(inventory, strictExitCode);

  fs.mkdirSync(path.resolve(REPO_ROOT, outDir), { recursive: true });
  const jsonPath = path.join(outDir, 'inventory.json');
  const mdPath = path.join(outDir, 'inventory.md');
  fs.writeFileSync(path.resolve(REPO_ROOT, jsonPath), `${JSON.stringify(inventory, null, 2)}\n`);
  fs.writeFileSync(path.resolve(REPO_ROOT, mdPath), markdown);

  console.log('Inventário do lint diagnóstico');
  console.log(`- arquivos analisados: ${inventory.totals.files}`);
  console.log(`- erros: ${inventory.totals.errors} | warnings: ${inventory.totals.warnings}`);
  console.log(`- fatal: ${inventory.totals.fatal} | configNotices: ${inventory.totals.configNotices} | configErrors: ${inventory.totals.configErrors}`);
  console.log(`- supressões inventariadas: ${suppressions.length}`);
  console.log(`- exit code de uma execução estrita (--max-warnings 0): ${strictExitCode}`);
  console.log(`- artefatos: ${toPosix(jsonPath)}, ${toPosix(mdPath)}`);

  return inventory.totals.fatal === 0 && inventory.totals.configErrors === 0;
}

function renderMarkdown(inventory, strictExitCode) {
  const lines = [];
  const push = (value = '') => lines.push(value);

  push('# Inventário do lint diagnóstico');
  push();
  push('Gerado por `scripts/lint/build-inventory.mjs` (API do ESLint,');
  push('`allowInlineConfig: false`). Nenhum módulo da aplicação é carregado;');
  push('nenhum banco, Storage ou rede é acessado. Caminhos relativos ao repositório.');
  push();
  push('## Versões');
  push();
  push('| Ferramenta | Versão |');
  push('| --- | --- |');
  push(`| Node | \`${inventory.toolVersions.node}\` |`);
  push(`| ESLint | \`${inventory.toolVersions.eslint}\` |`);
  push(`| typescript-eslint | \`${inventory.toolVersions.typescriptEslint}\` |`);
  push(`| eslint-plugin-react-hooks | \`${inventory.toolVersions.reactHooksPlugin}\` |`);
  push();
  push('## Totais');
  push();
  push(`- Arquivos analisados: **${inventory.totals.files}**`);
  push(`- Erros: **${inventory.totals.errors}** | Warnings: **${inventory.totals.warnings}**`);
  push(`- Mensagens fatais (parse/arquivo): **${inventory.totals.fatal}**`);
  push(`- Avisos de configuração (\`ruleId: null\`): **${inventory.totals.configNotices}**`);
  push(`- Erros de configuração ("Definition for rule"): **${inventory.totals.configErrors}**`);
  push(`- Exit code de execução estrita (\`--max-warnings 0\`): **${strictExitCode}**`);
  push();
  push('Achados de regra são dados do diagnóstico; não são falha deste gerador.');
  push();
  push('## Por regra');
  push();
  push('| Regra | Severidade | Ocorrências | Arquivos |');
  push('| --- | --- | --- | --- |');
  for (const item of inventory.byRule) {
    push(`| \`${item.ruleId}\` | ${item.severity} | ${item.count} | ${item.files} |`);
  }
  if (inventory.byRule.length === 0) push('| — | — | 0 | 0 |');
  push();
  push('## Por área');
  push();
  push('| Área | Arquivos | Erros | Warnings |');
  push('| --- | --- | --- | --- |');
  for (const item of inventory.byArea) {
    push(`| ${item.area} | ${item.files} | ${item.errors} | ${item.warnings} |`);
  }
  push();
  push('## Arquivos com mais ocorrências');
  push();
  push('| Arquivo | Erros | Warnings |');
  push('| --- | --- | --- |');
  for (const item of inventory.topFiles) {
    push(`| \`${item.file}\` | ${item.errors} | ${item.warnings} |`);
  }
  if (inventory.topFiles.length === 0) push('| — | 0 | 0 |');
  push();
  push('## Cobertura');
  push();
  const { coverage } = inventory;
  if (coverage.baseline.files === null) {
    push('Baseline não fornecida; comparação de cobertura indisponível nesta execução.');
  } else {
    push(`- Baseline: **${coverage.baseline.files}** arquivos (${formatMap(new Map(Object.entries(coverage.baseline.byExtension)))}).`);
    push(`- Diagnóstico: **${coverage.diagnostic.files}** arquivos (${formatMap(new Map(Object.entries(coverage.diagnostic.byExtension)))}).`);
    push(`- Arquivos removidos: **${coverage.filesRemoved.length}**.`);
    for (const item of coverage.filesRemoved) push(`  - \`${item.file}\` — ${item.reason}`);
    push(`- Arquivos adicionados: **${coverage.filesAdded.length}**.`);
    push(`- Extensões recém-cobertas: ${formatMap(new Map(Object.entries(coverage.newlyCoveredByExtension)))}.`);
  }
  push();
  push('## Mensagens fatais');
  push();
  if (inventory.fatal.length === 0) {
    push('Nenhuma.');
  } else {
    for (const item of inventory.fatal) push(`- \`${item.file}:${item.line}\` — ${item.message}`);
  }
  push();
  push('## Avisos de configuração (`ruleId: null`)');
  push();
  if (inventory.configNotices.length === 0) {
    push('Nenhum.');
  } else {
    for (const item of inventory.configNotices) push(`- \`${item.file}:${item.line}\` — ${item.message}`);
  }
  push();
  push('## Erros de configuração');
  push();
  if (inventory.configErrors.length === 0) {
    push('Nenhum.');
  } else {
    for (const item of inventory.configErrors) push(`- \`${item.file}:${item.line}\` — ${item.message}`);
  }
  push();
  push('## Diretivas de supressão encontradas');
  push();
  push('As diretivas NÃO são aplicadas no diagnóstico (inline config desligada) e');
  push('NÃO foram removidas. Ocorrências antes suprimidas por elas aparecem nas contagens.');
  push();
  if (inventory.suppressions.length === 0) {
    push('Nenhuma.');
  } else {
    const grouped = new Map();
    for (const item of inventory.suppressions) {
      const key = `${item.form} ${item.rule}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(item);
    }
    push('| Diretiva | Regra | Ocorrências |');
    push('| --- | --- | --- |');
    for (const [key, items] of [...grouped.entries()].sort((a, b) => b[1].length - a[1].length)) {
      const [form, rule] = [key.slice(0, key.indexOf(' ')), key.slice(key.indexOf(' ') + 1)];
      push(`| \`${form}\` | \`${rule}\` | ${items.length} |`);
    }
    push();
    push('Arquivos e linhas:');
    for (const item of inventory.suppressions) {
      push(`- \`${item.file}:${item.line}\` — \`${item.rule}\` (${item.form})`);
    }
  }
  push();
  push('## Limitações');
  push();
  push('- Sem regras type-aware (nenhum `parserOptions.project`): o diagnóstico não');
  push('  usa inferência de tipos; regras que exigem tipo não estão habilitadas.');
  push('- Sem presets (`typescript-eslint`/`next`/`@eslint/js`): apenas as regras');
  push('  declaradas no config, portanto o número de achados é menor que um preset estrito.');
  push('- `next-env.d.ts` é gerado e ignorado; `.d.ts` de `src/` são analisados.');
  push('- Diretivas inline estão desligadas: este diagnóstico não mede "o que o lint');
  push('  oficial reportaria com supressões", e sim o código sem supressões.');
  push('- Este diagnóstico NÃO é gate de release: não está em `lint`, `build`,');
  push('  `vercel.json` ou CI.');
  push();
  return `${lines.join('\n')}`;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    return 1;
  }

  try {
    const ok = await buildInventory({ outDir: options.out, baselinePath: options.baseline });
    if (!ok) {
      console.error('Falha de configuração/fatal detectada: revise as seções de fatal e configErrors do inventário.');
      return 1;
    }
    return 0;
  } catch (error) {
    console.error(`Erro ao gerar inventário: ${error.stack ?? error.message}`);
    return 1;
  }
}

process.exitCode = await main();
