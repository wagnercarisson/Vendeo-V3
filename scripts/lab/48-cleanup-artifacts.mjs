// F48.1 — cleanup MANUAL e opt-in dos artefatos do Laboratório de IA.
//
// Remove apenas os ARQUIVOS de artefatos elegíveis do bucket privado
// `lab-artifacts` e marca `lab_artifacts.removed_at`. Metadados, checksums, runs
// e avaliações humanas permanecem intactos — nenhum `delete` é executado em
// nenhuma tabela do laboratório.
//
// Elegibilidade (nesta ordem):
//   1. artefato já removido (`removed_at` não nulo) é ignorado;
//   2. run ausente do conjunto lido é ignorado (nunca limpar sem saber o estado);
//   3. run `pending`/`running` NUNCA é elegível, independente da idade;
//   4. elegível quando o experimento do run está `archived` OU quando a idade do
//      run (a partir de `finished_at`, senão `created_at`) excede
//      `retentionDays` (default 30).
//
// Uso (manual, sem scheduler):
//   node scripts/lab/48-cleanup-artifacts.mjs [--dry-run]
//
// LOCAL-ONLY: o host do Supabase é validado e hosts remotos/produção são
// recusados ANTES de qualquer leitura/escrita. Exige `SUPABASE_SERVICE_ROLE_KEY`.
//
// O módulo NÃO tem efeito colateral no import: as funções puras são exportadas e
// a CLI só roda quando o arquivo é o entry point. Nenhum import de código de
// produção (`src/lib/**`) — o default de retenção é espelhado aqui e travado por
// teste contra `src/lib/lab/limits.ts`.

import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

/** Bucket privado e dedicado do laboratório. */
export const LAB_ARTIFACT_BUCKET = "lab-artifacts";

/** Idade mínima (dias) do cleanup por idade — paridade com LAB_ARTIFACT_RETENTION_DAYS. */
export const DEFAULT_RETENTION_DAYS = 30;

const ARTIFACTS_TABLE = "lab_artifacts";
const RUNS_TABLE = "lab_runs";
const EXPERIMENTS_TABLE = "lab_experiments";

const MS_PER_DAY = 86400000;

/** Estados que indicam run em andamento — nunca elegíveis. */
const ACTIVE_RUN_STATUSES = ["pending", "running"];

/** Hosts aceitos (Supabase CLI/Docker local). Qualquer outro é recusado. */
const LOCAL_HOST_PATTERN = /^(localhost|127\.0\.0\.1|::1|0\.0\.0\.0)$/i;

/** Domínios de produção — bloqueio incondicional. */
const PRODUCTION_DOMAINS = ["supabase.co", "supabase.in", "supabase.com"];

/** Erro de bloqueio/execução do cleanup (mensagem clara, exit code 1 na CLI). */
export class CleanupBlockedError extends Error {
  constructor(message) {
    super(message);
    this.name = "CleanupBlockedError";
  }
}

/** `true` para `pending`/`running`; `false` para os estados terminais. */
export function isRunInProgress(status) {
  return ACTIVE_RUN_STATUSES.includes(status);
}

/** `retentionDays` do ambiente (default `DEFAULT_RETENTION_DAYS`). */
export function resolveRetentionDays(raw) {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  return DEFAULT_RETENTION_DAYS;
}

function getRun(runsById, runId) {
  if (runsById instanceof Map) return runsById.get(runId) ?? null;
  if (runsById && Object.prototype.hasOwnProperty.call(runsById, runId)) {
    return runsById[runId];
  }
  return null;
}

/**
 * Seleciona os artefatos elegíveis ao cleanup.
 *
 * `runsById` é um `Map`/objeto `runId → { status, created_at, finished_at,
 * experiment_status }`. Devolve apenas `artifactId` + `storagePath`.
 */
export function selectEligibleArtifacts({ artifacts, runsById, now, retentionDays }) {
  const retentionMs = retentionDays * MS_PER_DAY;
  const nowMs = now.getTime();
  const eligible = [];

  for (const artifact of artifacts) {
    if (artifact.removed_at != null) continue;

    const run = getRun(runsById, artifact.run_id);
    if (!run) continue;

    if (isRunInProgress(run.status)) continue;

    const experimentArchived = run.experiment_status === "archived";
    const reference = run.finished_at ?? run.created_at;
    const referenceMs = reference ? new Date(reference).getTime() : nowMs;
    const expired = nowMs - referenceMs > retentionMs;

    if (experimentArchived || expired) {
      eligible.push({ artifactId: artifact.id, storagePath: artifact.storage_path });
    }
  }

  return eligible;
}

function assertLocalHost(rawUrl, origin) {
  let hostname;
  try {
    hostname = new URL(rawUrl).hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.+$/, "");
  } catch {
    throw new CleanupBlockedError(`Recusando URL invalida (${origin}): ${rawUrl}`);
  }

  if (PRODUCTION_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
    throw new CleanupBlockedError(`Recusando host de producao (${origin}): ${hostname}`);
  }
  if (!LOCAL_HOST_PATTERN.test(hostname)) {
    throw new CleanupBlockedError(`Recusando host nao local (${origin}): ${hostname}`);
  }
  return hostname;
}

function resolveLocalConnection(env) {
  const rawUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!rawUrl) {
    throw new CleanupBlockedError(
      "Defina NEXT_PUBLIC_SUPABASE_URL apontando para o Supabase local para executar o cleanup.",
    );
  }

  const hostname = assertLocalHost(rawUrl, "NEXT_PUBLIC_SUPABASE_URL");

  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new CleanupBlockedError(
      "Defina SUPABASE_SERVICE_ROLE_KEY para executar o cleanup (as tabelas lab_* sao service_role only).",
    );
  }

  return { url: rawUrl, serviceRoleKey, hostname };
}

/**
 * Executa o cleanup manual. `--dry-run` apenas lista os elegíveis, sem remover
 * nem marcar. Devolve o resumo `{ host, retentionDays, dryRun, eligible,
 * removed, skipped }`.
 */
export async function main(argv = process.argv.slice(2), env = process.env) {
  const dryRun = argv.includes("--dry-run");
  const connection = resolveLocalConnection(env);
  const retentionDays = resolveRetentionDays(env.LAB_ARTIFACT_RETENTION_DAYS);

  const supabase = createClient(connection.url, connection.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const artifactsResult = await supabase
    .from(ARTIFACTS_TABLE)
    .select("id, run_id, storage_path, removed_at");
  if (artifactsResult.error) {
    throw new CleanupBlockedError(`select lab_artifacts falhou: ${artifactsResult.error.message}`);
  }

  const runsResult = await supabase
    .from(RUNS_TABLE)
    .select("id, status, created_at, finished_at, experiment_id");
  if (runsResult.error) {
    throw new CleanupBlockedError(`select lab_runs falhou: ${runsResult.error.message}`);
  }

  const experimentsResult = await supabase.from(EXPERIMENTS_TABLE).select("id, status");
  if (experimentsResult.error) {
    throw new CleanupBlockedError(`select lab_experiments falhou: ${experimentsResult.error.message}`);
  }

  const experimentStatusById = new Map(
    (experimentsResult.data ?? []).map((row) => [row.id, row.status]),
  );
  const runsById = new Map(
    (runsResult.data ?? []).map((row) => [
      row.id,
      {
        status: row.status,
        created_at: row.created_at,
        finished_at: row.finished_at,
        experiment_id: row.experiment_id,
        experiment_status: experimentStatusById.get(row.experiment_id) ?? null,
      },
    ]),
  );

  const eligible = selectEligibleArtifacts({
    artifacts: artifactsResult.data ?? [],
    runsById,
    now: new Date(),
    retentionDays,
  });

  const summary = {
    host: connection.hostname,
    retentionDays,
    dryRun,
    eligible: eligible.length,
    removed: 0,
    skipped: 0,
  };

  if (dryRun) return summary;

  for (const artifact of eligible) {
    const { error: removeError } = await supabase.storage
      .from(LAB_ARTIFACT_BUCKET)
      .remove([artifact.storagePath]);
    if (removeError) {
      summary.skipped += 1;
      continue;
    }

    const { error: updateError } = await supabase
      .from(ARTIFACTS_TABLE)
      .update({ removed_at: new Date().toISOString() })
      .eq("id", artifact.artifactId);
    if (updateError) {
      summary.skipped += 1;
      continue;
    }

    summary.removed += 1;
  }

  return summary;
}

const invokedDirectly =
  typeof process.argv[1] === "string" &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main()
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((error) => {
      console.error(`[lab-cleanup] ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    });
}
