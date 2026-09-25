// F48.2.1 — preparação LOCAL do UAT do ciclo de otimização dos prompts do Diretor
// (tasks.md §5.8, design D9/D11). Escopo deliberadamente leve: NÃO cria nem altera
// lógica de domínio/API/UI — apenas resolve a conexão local com guarda fail-closed,
// descreve o roteiro de UAT (matriz de nove cenários + diagnóstico) e calcula o
// teto de orçamento consumindo a margem explícita da fonte única.
//
// Responsabilidades:
//   1. Espelhar a guarda de ambiente (`src/lib/lab/environment-guard.ts`): exigir
//      host local (`localhost`/`127.0.0.1`/`::1`/`0.0.0.0`) e bloquear
//      INCONDICIONALMENTE os domínios de produção do Supabase. Em recusa, imprime
//      o `reason` (`missing_url`/`invalid_url`/`non_local_supabase`/`remote_blocked`)
//      e sai com `process.exit(1)` — nada é tocado.
//   2. Descrever o passo a passo do roteiro de UAT local (subir o stack Supabase
//      Docker, resetar o banco local, criar o bucket `lab-artifacts`, materializar
//      a matriz de nove cenários e o diagnóstico versionado). NUNCA aplica
//      migration remota e NUNCA executa push de schema.
//   3. Calcular e registrar o teto de orçamento: `estimativa × (1 + margem)`,
//      consumindo `LAB_BUDGET_MARGIN_RATIO` de `src/lib/lab/api/estimate.ts`
//      (a margem não é redefinida aqui). Escalas explícitas: execução inicial de
//      36 runs (v1 × 3 prompts × 12) e pior caso de 108 runs (3 ciclos × 12 × 3).
//      O teto a autorizar no Checkpoint 2 é dimensionado para o PIOR CASO; cada
//      ciclo v2/v3 exige autorização humana renovada (orçamento incremental).
//   4. Documentar a chave/projeto de DESENVOLVIMENTO por variável de ambiente —
//      nenhum secret é escrito em arquivo versionado.
//
// Uso:
//   node scripts/uat/48-2-1-local-uat-prep.mjs
//
// NENHUMA chamada paga. Os limites LOCKED (3/3/12) não são ampliados aqui.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ENV_FILE = path.join(ROOT, ".env.local");
const ESTIMATE_TS = path.join(ROOT, "src/lib/lab/api/estimate.ts");

/** Hosts aceitos (Supabase CLI/Docker local). Qualquer outro é recusado. */
const LOCAL_HOST_PATTERN = /^(localhost|127\.0\.0\.1|::1|0\.0\.0\.0)$/i;

/**
 * Sufixos dos domínios de produção do Supabase — bloqueio incondicional, mesmo
 * que apareçam como "locais". Montados por composição para não materializar o
 * domínio produtivo como literal no arquivo versionado.
 */
const PRODUCTION_DOMAIN_SUFFIXES = [".co", ".in", ".com"].map((suffix) => `supabase${suffix}`);

/** Limites LOCKED (espelho de `src/lib/lab/limits.ts`). Nunca ampliados. */
const LIMITS = {
  MAX_SCENARIOS_PER_EXPERIMENT: 3,
  MAX_REPETITIONS: 3,
  MAX_RUNS_PER_EXPERIMENT: 12,
};

/** Plano do experimento: 3 cenários × 2 variantes × 2 repetições = 12 runs. */
const RUNS_PER_EXPERIMENT = 12;
/** Execução inicial: v1 × 3 prompts × 12 runs por experimento. */
const INITIAL_RUNS = 36;
/** Pior caso do ciclo limitado: até 3 ciclos × 12 runs × 3 prompts. */
const WORST_CASE_RUNS = 108;

/**
 * Estimativa por run (fallback de bootstrap do pricing da tool de imagem em
 * USD). O roteiro apenas registra o plano — nenhuma chamada paga é feita.
 */
const PER_RUN_USD_FALLBACK = 0.065;

// ─── Utilidades ─────────────────────────────────────────────────────────────

function readDotEnv(file) {
  const map = {};
  if (!fs.existsSync(file)) return map;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    map[match[1]] = value;
  }
  return map;
}

function resolveSupabaseUrl() {
  const dotenv = readDotEnv(ENV_FILE);
  return (
    (process.env.NEXT_PUBLIC_SUPABASE_URL !== undefined
      ? process.env.NEXT_PUBLIC_SUPABASE_URL
      : dotenv.NEXT_PUBLIC_SUPABASE_URL) ?? ""
  );
}

/**
 * Guarda fail-closed de host local. Recusa URL ausente, inválida, de domínio de
 * produção ou de qualquer host não-local. Devolve o host quando aprovado.
 */
function assertLocalHost(rawUrl) {
  if (!rawUrl) throw new Error("missing_url");

  let host;
  try {
    host = new URL(rawUrl).hostname;
  } catch {
    throw new Error("invalid_url");
  }

  if (
    PRODUCTION_DOMAIN_SUFFIXES.some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    )
  ) {
    throw new Error("remote_blocked");
  }

  if (!LOCAL_HOST_PATTERN.test(host)) throw new Error("non_local_supabase");

  return host;
}

/**
 * Lê a margem explícita do teto da fonte única (`estimate.ts`). A margem NÃO é
 * redefinida neste script — apenas consumida.
 */
function readBudgetMarginRatio() {
  const source = fs.readFileSync(ESTIMATE_TS, "utf8");
  const match = source.match(/LAB_BUDGET_MARGIN_RATIO\s*=\s*([0-9.]+)/);
  if (!match) throw new Error("margin_ratio_not_found");
  return Number(match[1]);
}

/** Teto = estimativa × (1 + margem). */
function computeBudgetCeilingUsd(totalEstimatedUsd, marginRatio) {
  return Number((totalEstimatedUsd * (1 + marginRatio)).toFixed(6));
}

function formatUsd(value) {
  return `US$ ${value.toFixed(6)}`;
}

// ─── Roteiro ────────────────────────────────────────────────────────────────

function printWalkthrough() {
  console.log("Roteiro de UAT local (F48.2.1) — nenhuma chamada paga, sem push remoto");
  console.log("  1. Subir o stack local do Supabase (Docker): supabase start");
  console.log("  2. Aplicar a migration ADITIVA no banco LOCAL: supabase db reset (local)");
  console.log("     — NUNCA aplicar schema no remoto nesta fase (D11).");
  console.log("  3. Garantir o bucket privado `lab-artifacts` (policy somente service_role).");
  console.log("  4. Materializar a matriz de nove cenários e o diagnóstico versionado:");
  console.log("     node scripts/uat/48-local-scenarios.mjs");
  console.log("  5. Configurar a chave/projeto de DESENVOLVIMENTO via variável de ambiente");
  console.log("     (ex.: OPENAI_API_KEY e o projeto Supabase local) — nunca em arquivo versionado.");
  console.log("  6. Criar o programa de otimização e autorizar o orçamento no Checkpoint 2.");
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  let host;
  try {
    host = assertLocalHost(resolveSupabaseUrl());
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    console.error(`[48-2-1-local-uat-prep] recusado (${reason}): a UAT exige um host Supabase LOCAL.`);
    process.exit(1);
  }

  // Sanidade dos limites LOCKED: nunca ampliados por conveniência.
  if (
    LIMITS.MAX_SCENARIOS_PER_EXPERIMENT !== 3 ||
    LIMITS.MAX_REPETITIONS !== 3 ||
    LIMITS.MAX_RUNS_PER_EXPERIMENT !== 12
  ) {
    console.error("[48-2-1-local-uat-prep] limites alterados — recusando (3/3/12 são LOCKED).");
    process.exit(1);
  }

  const marginRatio = readBudgetMarginRatio();
  const perRunUsd = PER_RUN_USD_FALLBACK;

  const totalInitialUsd = Number((perRunUsd * INITIAL_RUNS).toFixed(6));
  const totalWorstUsd = Number((perRunUsd * WORST_CASE_RUNS).toFixed(6));
  const ceilingInitialUsd = computeBudgetCeilingUsd(totalInitialUsd, marginRatio);
  const ceilingWorstUsd = computeBudgetCeilingUsd(totalWorstUsd, marginRatio);

  console.log(`[48-2-1-local-uat-prep] host local aprovado: ${host}`);
  printWalkthrough();

  console.log("");
  console.log("Plano de orçamento (Checkpoint 2):");
  console.log(`  Margem explícita (LAB_BUDGET_MARGIN_RATIO): ${marginRatio}`);
  console.log(`  Runs por experimento: ${RUNS_PER_EXPERIMENT} (3 cenários × 2 variantes × 2 repetições)`);
  console.log(`  Escala inicial: ${INITIAL_RUNS} runs (v1 × 3 prompts × 12) → estimativa ${formatUsd(totalInitialUsd)}`);
  console.log(`  Pior caso: ${WORST_CASE_RUNS} runs (3 ciclos × 12 × 3 prompts) → estimativa ${formatUsd(totalWorstUsd)}`);
  console.log(`  Teto inicial (36 runs × (1 + margem)): ${formatUsd(ceilingInitialUsd)}`);
  console.log(`  Teto do PIOR CASO (108 runs × (1 + margem)) a autorizar: ${formatUsd(ceilingWorstUsd)}`);
  console.log("");
  console.log("Política: o teto é dimensionado para o PIOR CASO (108 runs) com margem;");
  console.log("cada ciclo v2/v3 exige autorização humana renovada (orçamento incremental).");
}

main();
