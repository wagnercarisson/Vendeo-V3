import type { LabPromptSnapshot } from "./domain/prompt-snapshot";

/**
 * Snapshot imutável do run do Laboratório de IA (F48.1, D8).
 *
 * O snapshot é montado **antes** da reserva e enviado em `p_snapshot`; a RPC o
 * grava na mesma transação, de modo que nenhum run existe com snapshot vazio. O
 * banco reforça a imutabilidade por trigger (apenas colunas de resultado podem
 * ser preenchidas depois).
 *
 * Escopo do que é congelado: cenário (id/versão/hash), prompt sob teste
 * (nome/conteúdo/hash/origem), capability, alvo de modelo, parâmetros,
 * dimensão alterada, papel da variante, versão de código/build quando
 * disponível e as configurações comparativas das duas variantes.
 *
 * Módulo **puro** (sem `server-only`, sem I/O), exceto pela leitura de variáveis
 * de build em `readCodeVersion` — que nunca lê chave de provider/modelo.
 */

/** Papel da variante no experimento prompt-only. */
export type LabVariantRole = "baseline" | "candidate";

/** Prompt congelado no snapshot — mesma forma do snapshot da variante (D5). */
export interface LabRunSnapshotPrompt {
  name: string;
  content: string;
  contentHash: string;
  source: "official" | "override";
}

/** Configuração comparativa de uma variante (sem duplicar o conteúdo do prompt). */
export interface LabRunVariantConfig {
  promptName: string;
  promptContentHash: string;
  source: "official" | "override";
}

/** Versão de código/build do run — `null` quando não há variável de build. */
export interface LabCodeVersion {
  gitSha?: string;
  buildId?: string;
}

/** Parâmetros congelados do experimento (idênticos para as duas variantes). */
export interface LabRunSnapshotParams {
  size: string;
  quality: string;
  skipInputValidation: true;
}

/** Snapshot completo e imutável de um run. */
export interface LabRunSnapshot {
  scenarioVersionId: string;
  scenarioVersion: number;
  scenarioContentHash: string;
  prompt: LabRunSnapshotPrompt;
  capability: "campaign_image";
  modelTarget: {
    provider: string;
    model: string;
    protocol: string;
  };
  params: LabRunSnapshotParams;
  changedDimension: "prompt";
  variantRole: LabVariantRole;
  codeVersion: LabCodeVersion | null;
  baselineConfig: LabRunVariantConfig;
  candidateConfig: LabRunVariantConfig;
  runType: "lab";
}

/** Código determinístico da barreira de snapshot incompleto. */
export const MISSING_SNAPSHOT = "missing_snapshot";

function toVariantConfig(snapshot: LabPromptSnapshot): LabRunVariantConfig {
  return {
    promptName: snapshot.name,
    promptContentHash: snapshot.contentHash,
    source: snapshot.source,
  };
}

/**
 * Monta o snapshot imutável do run.
 *
 * Apenas as configurações comparativas das variantes entram (nome/hash/origem):
 * o conteúdo completo do prompt vive **uma única vez** em `prompt`, evitando
 * duplicar texto (e qualquer base64/imagem) no objeto congelado.
 */
export function buildLabRunSnapshot(params: {
  scenarioVersionId: string;
  scenarioVersion: number;
  scenarioContentHash: string;
  prompt: LabPromptSnapshot;
  modelTarget: { provider: string; model: string; protocol: string };
  params: LabRunSnapshotParams;
  variantRole: LabVariantRole;
  variants: { baseline: LabPromptSnapshot; candidate: LabPromptSnapshot };
  codeVersion?: LabCodeVersion | null;
}): LabRunSnapshot {
  return {
    scenarioVersionId: params.scenarioVersionId,
    scenarioVersion: params.scenarioVersion,
    scenarioContentHash: params.scenarioContentHash,
    prompt: {
      name: params.prompt.name,
      content: params.prompt.content,
      contentHash: params.prompt.contentHash,
      source: params.prompt.source,
    },
    capability: "campaign_image",
    modelTarget: {
      provider: params.modelTarget.provider,
      model: params.modelTarget.model,
      protocol: params.modelTarget.protocol,
    },
    params: {
      size: params.params.size,
      quality: params.params.quality,
      skipInputValidation: true,
    },
    changedDimension: "prompt",
    variantRole: params.variantRole,
    codeVersion: params.codeVersion ?? null,
    baselineConfig: toVariantConfig(params.variants.baseline),
    candidateConfig: toVariantConfig(params.variants.candidate),
    runType: "lab",
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Barreira executada **antes** da RPC: recusa qualquer snapshot incompleto.
 *
 * Sem isso, um snapshot vazio poderia ser enviado em `p_snapshot` e a reserva
 * recusaria com `missing_snapshot` sem indicar o campo faltante. Aqui a falha é
 * determinística e ocorre antes de qualquer I/O.
 */
export function assertSnapshotComplete(snapshot: LabRunSnapshot | null | undefined): void {
  if (!snapshot) {
    throw new Error(MISSING_SNAPSHOT);
  }

  const serialized = JSON.stringify(snapshot);
  if (serialized === "{}" || serialized.length === 0) {
    throw new Error(MISSING_SNAPSHOT);
  }

  if (!isNonEmptyString(snapshot.scenarioVersionId)) {
    throw new Error(MISSING_SNAPSHOT);
  }
  if (!isNonEmptyString(snapshot.scenarioContentHash)) {
    throw new Error(MISSING_SNAPSHOT);
  }
  if (!isNonEmptyString(snapshot.prompt?.name)) {
    throw new Error(MISSING_SNAPSHOT);
  }
  if (!isNonEmptyString(snapshot.prompt?.content)) {
    throw new Error(MISSING_SNAPSHOT);
  }
  if (!isNonEmptyString(snapshot.prompt?.contentHash)) {
    throw new Error(MISSING_SNAPSHOT);
  }
  if (!isNonEmptyString(snapshot.modelTarget?.provider)) {
    throw new Error(MISSING_SNAPSHOT);
  }
  if (!isNonEmptyString(snapshot.modelTarget?.model)) {
    throw new Error(MISSING_SNAPSHOT);
  }
  if (!isNonEmptyString(snapshot.modelTarget?.protocol)) {
    throw new Error(MISSING_SNAPSHOT);
  }
  if (snapshot.variantRole !== "baseline" && snapshot.variantRole !== "candidate") {
    throw new Error(MISSING_SNAPSHOT);
  }
}

/**
 * Lê a versão de código/build do ambiente, quando disponível.
 *
 * Somente variáveis de build são consideradas. Nenhuma variável de
 * modelo/provider/chave é lida — o snapshot não pode carregar configuração de
 * runtime que ele não congela.
 */
export function readCodeVersion(): LabCodeVersion | null {
  const gitSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_SHA || undefined;
  const buildId = process.env.VERCEL_DEPLOYMENT_ID || undefined;

  const version: LabCodeVersion = {};
  if (gitSha) version.gitSha = gitSha;
  if (buildId) version.buildId = buildId;

  return Object.keys(version).length > 0 ? version : null;
}
