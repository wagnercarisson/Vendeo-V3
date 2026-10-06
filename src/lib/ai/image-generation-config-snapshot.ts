/**
 * Snapshot imutável da configuração de geração por operação (F56.1, D-12/D-13/D-14).
 *
 * Componente **puro** (sem campanha real, sem I/O, sem banco, sem provider e sem
 * crédito): monta o snapshot tipado com o par principal/fallback, a **versão**
 * (UUID) da configuração e a **origem**, e resolve a configuração por tipo de
 * operação. Reutiliza os tipos de par/qualidade/origem do módulo
 * `image-model-pair.ts` (plano 01) — a origem **não** inclui `"default"`: a
 * resolução é **fail-closed** e a ausência de configuração é **erro**, nunca uma
 * origem (D-12).
 *
 * Fronteira da fase (D-25): a **gravação** do snapshot no início de uma campanha
 * real é integração da **F56.2**; a F56.1 entrega o contrato, o builder e a
 * resolução por operação, exercitados por testes simulados. Em particular, a
 * distinção **nova campanha × correção da mesma campanha** é expressa pelo
 * contrato abaixo: a nova campanha congela a configuração **vigente**
 * (`resolveConfigForNewCampaign`) e a nova geração/correção reutiliza o snapshot
 * **original** (`resolveConfigForCorrection`), independentemente do admin.
 *
 * Tolerância ao legado (D-14): a **ausência** de snapshot em uma operação legada é
 * **estado esperado**, não erro — `resolveConfigForCorrection` devolve `null` nesse
 * caso, sem lançar, e o comportamento do fluxo legado permanece inalterado.
 */

import { randomUUID } from "node:crypto";

import {
  assertEligibleModelPair,
  type ImageModelPairConfig,
  type ImagePairConfigOrigin,
  type ImageQuality,
} from "./image-model-pair";

export type { ImageModelPairConfig, ImagePairConfigOrigin, ImageQuality };

/** Origens válidas do snapshot — `"default"` não existe (D-12). */
export const IMAGE_GENERATION_CONFIG_ORIGINS = Object.freeze([
  "human_decision",
  "selection",
] as const);

/**
 * Snapshot imutável da configuração de geração de uma campanha do novo fluxo
 * (D-12). Espelha as colunas tipadas da tabela de snapshot (F56.2), sem JSONB.
 *
 * `primaryModel/primaryQuality` e `fallbackModel/fallbackQuality` são cópias dos
 * valores congelados; `configVersionId` identifica a versão da configuração e
 * `origin` a sua procedência (`human_decision` ou `selection`). `runId`/`traceId`
 * correlacionam o snapshot à telemetria da mesma operação (D-14).
 */
export interface ImageGenerationConfigSnapshot {
  readonly campaignId: string;
  readonly primaryModel: string;
  readonly primaryQuality: ImageQuality;
  readonly fallbackModel: string;
  readonly fallbackQuality: ImageQuality;
  readonly configVersionId: string;
  readonly origin: ImagePairConfigOrigin;
  readonly runId?: string;
  readonly traceId?: string;
  readonly createdAt: string;
}

/**
 * Configuração **vigente** do novo fluxo: o par principal/fallback mais a sua
 * origem e o identificador de versão. É a entrada de `resolveConfigForNewCampaign`
 * — a nova campanha congela exatamente esta configuração (D-13).
 */
export interface CurrentImageGenerationConfig extends ImageModelPairConfig {
  origin: ImagePairConfigOrigin;
  configVersionId: string;
}

/** Contexto do builder; `generateVersionId`/`now` são injetáveis para testes. */
export interface BuildImageGenerationConfigSnapshotContext {
  readonly campaignId: string;
  readonly origin: ImagePairConfigOrigin;
  readonly configVersionId?: string;
  readonly generateVersionId?: () => string;
  readonly now?: () => string;
  readonly runId?: string;
  readonly traceId?: string;
}

/** Alvo de uma tentativa real de geração no par (principal ou fallback). */
export type ImageModelTarget = "primary" | "fallback";

/** Tentativa de telemetria da operação, correlacionável ao snapshot por run/trace. */
export interface ImageGenerationTelemetryAttempt {
  readonly attemptNumber: number;
  readonly target: ImageModelTarget;
  readonly runId?: string;
  readonly traceId?: string;
}

/** Par modelo–qualidade reconstruído para uma tentativa a partir do snapshot (D-14). */
export interface CorrelatedImageGenerationAttempt {
  readonly attemptNumber: number;
  readonly target: ImageModelTarget;
  readonly model: string;
  readonly quality: ImageQuality;
}

/** Código determinístico da ausência de configuração do novo fluxo (D-12/D-06). */
export const IMAGE_GENERATION_CONFIG_MISSING = "image_generation_config_missing" as const;

/** Erro tipado quando a configuração vigente está ausente — fail-closed, não origem. */
export class ImageGenerationConfigMissingError extends Error {
  readonly code = IMAGE_GENERATION_CONFIG_MISSING;

  constructor() {
    super(IMAGE_GENERATION_CONFIG_MISSING);
    this.name = "ImageGenerationConfigMissingError";
  }
}

/** Código determinístico de origem inválida (exclui `"default"`, D-12). */
export const IMAGE_GENERATION_CONFIG_ORIGIN_INVALID = "image_generation_config_origin_invalid" as const;

/** Erro tipado de origem fora do conjunto `human_decision | selection`. */
export class ImageGenerationConfigOriginInvalidError extends Error {
  readonly code = IMAGE_GENERATION_CONFIG_ORIGIN_INVALID;
  readonly origin: string;

  constructor(origin: string) {
    super(`${IMAGE_GENERATION_CONFIG_ORIGIN_INVALID}:${origin}`);
    this.name = "ImageGenerationConfigOriginInvalidError";
    this.origin = origin;
  }
}

function defaultGenerateVersionId(): string {
  return randomUUID();
}

function defaultNow(): string {
  return new Date().toISOString();
}

/**
 * Fail-closed no runtime: a união de tipos já impede `"default"`, mas uma chamada
 * sem tipos poderia contorná-la; origens fora do conjunto recusam deterministicamente.
 */
function assertValidOrigin(origin: string): asserts origin is ImagePairConfigOrigin {
  if (!(IMAGE_GENERATION_CONFIG_ORIGINS as readonly string[]).includes(origin)) {
    throw new ImageGenerationConfigOriginInvalidError(origin);
  }
}

/**
 * Monta o snapshot tipado da configuração (D-12).
 *
 * Determinístico e sem I/O: os valores do par são **copiados** (alterar a
 * configuração de origem depois não afeta o snapshot) e o objeto retornado é
 * congelado. A versão vem de `context.configVersionId` ou do gerador injetável;
 * o instante de criação vem de `context.now` (ou do relógio do sistema). Config
 * ausente é erro (`ImageGenerationConfigMissingError`), nunca origem.
 */
export function buildImageGenerationConfigSnapshot(
  config: ImageModelPairConfig,
  context: BuildImageGenerationConfigSnapshotContext,
): ImageGenerationConfigSnapshot {
  if (!config) throw new ImageGenerationConfigMissingError();
  assertValidOrigin(context.origin);
  assertEligibleModelPair(config.primary);
  assertEligibleModelPair(config.fallback);

  const generateVersionId = context.generateVersionId ?? defaultGenerateVersionId;
  const now = context.now ?? defaultNow;
  const configVersionId = context.configVersionId ?? generateVersionId();

  return Object.freeze({
    campaignId: context.campaignId,
    primaryModel: config.primary.model,
    primaryQuality: config.primary.quality,
    fallbackModel: config.fallback.model,
    fallbackQuality: config.fallback.quality,
    configVersionId,
    origin: context.origin,
    ...(context.runId !== undefined ? { runId: context.runId } : {}),
    ...(context.traceId !== undefined ? { traceId: context.traceId } : {}),
    createdAt: now(),
  });
}

/**
 * Congela a configuração **vigente** para uma **nova campanha** (D-13). A
 * campanha passa a usar esta configuração; snapshots anteriores permanecem
 * intactos. Config vigente ausente é erro (fail-closed, D-12).
 */
export function resolveConfigForNewCampaign(
  currentConfig: CurrentImageGenerationConfig,
  campaignId: string,
  deps?: {
    generateVersionId?: () => string;
    now?: () => string;
    runId?: string;
    traceId?: string;
  },
): ImageGenerationConfigSnapshot {
  if (!currentConfig) throw new ImageGenerationConfigMissingError();
  assertValidOrigin(currentConfig.origin);

  return buildImageGenerationConfigSnapshot(currentConfig, {
    campaignId,
    origin: currentConfig.origin,
    configVersionId: currentConfig.configVersionId,
    generateVersionId: deps?.generateVersionId,
    now: deps?.now,
    runId: deps?.runId,
    traceId: deps?.traceId,
  });
}

/**
 * Reutiliza o snapshot **original** de uma campanha existente em uma nova geração
 * ou correção (D-13). A assinatura recebe **apenas** o snapshot: estruturalmente
 * não há como adotar a configuração vigente no admin, e o snapshot retornado é
 * exatamente o original (imutável).
 *
 * D-14: em operação **legada** sem snapshot, a ausência é estado esperado —
 * devolve `null` sem lançar.
 */
export function resolveConfigForCorrection(
  existingSnapshot: ImageGenerationConfigSnapshot | null | undefined,
): ImageGenerationConfigSnapshot | null {
  if (existingSnapshot === null || existingSnapshot === undefined) return null;
  return existingSnapshot;
}

/**
 * `true` quando a operação não possui snapshot (fluxo legado) — estado esperado,
 * nunca erro (D-14). Não altera o comportamento do fluxo legado.
 */
export function isLegacyOperationWithoutSnapshot(
  snapshot: ImageGenerationConfigSnapshot | null | undefined,
): snapshot is null | undefined {
  return snapshot === null || snapshot === undefined;
}

/** Reconstrói o par modelo–qualidade congelado do alvo a partir do snapshot. */
export function resolveSnapshotPairForTarget(
  snapshot: ImageGenerationConfigSnapshot,
  target: ImageModelTarget,
): { model: string; quality: ImageQuality } {
  if (target === "fallback") {
    return { model: snapshot.fallbackModel, quality: snapshot.fallbackQuality };
  }
  return { model: snapshot.primaryModel, quality: snapshot.primaryQuality };
}

function matchesSnapshotReference(
  snapshot: ImageGenerationConfigSnapshot,
  attempt: ImageGenerationTelemetryAttempt,
): boolean {
  if (snapshot.runId !== undefined && attempt.runId !== undefined && attempt.runId !== snapshot.runId) {
    return false;
  }
  if (
    snapshot.traceId !== undefined &&
    attempt.traceId !== undefined &&
    attempt.traceId !== snapshot.traceId
  ) {
    return false;
  }
  return true;
}

/**
 * Correlaciona o snapshot à telemetria da mesma operação por run/trace (D-14):
 * apenas as tentativas da operação são consideradas e cada uma recebe o par
 * modelo–qualidade congelado do seu alvo (principal ou fallback), permitindo
 * reconstruir qual par foi usado em cada tentativa e qual fallback foi acionado.
 *
 * Somente ids de operação entram na correlação — nenhum dado de conta ou segredo
 * (T-56.1-17).
 */
export function correlateSnapshotWithTelemetry(
  snapshot: ImageGenerationConfigSnapshot,
  attempts: ReadonlyArray<ImageGenerationTelemetryAttempt>,
): CorrelatedImageGenerationAttempt[] {
  return attempts
    .filter((attempt) => matchesSnapshotReference(snapshot, attempt))
    .map((attempt) => {
      const pair = resolveSnapshotPairForTarget(snapshot, attempt.target);
      return {
        attemptNumber: attempt.attemptNumber,
        target: attempt.target,
        model: pair.model,
        quality: pair.quality,
      };
    });
}
