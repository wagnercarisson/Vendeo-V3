/**
 * F60.3 / 60.3-04 — Intentos duráveis da prova paga (helpers puros de filesystem).
 *
 * Este módulo é deliberadamente PURO em relação a infraestrutura: não importa
 * `server-only`, provider, SDK, Supabase, `sharp`, `expand` nem qualquer código de
 * produto. Ele existe para ser importável por teste sem o resolvedor de
 * `server-only` e sem tocar em banco, Storage, rede ou IA.
 *
 * Contrato de segurança (T-60.3-34):
 * - o intento é gravado ANTES do envio com criação EXCLUSIVA (`wx`); `EEXIST` é
 *   recusa explícita e NUNCA sobrescreve o arquivo existente;
 * - o intento nasce `status: "sending"` e só vira terminal DEPOIS que o manifesto
 *   terminal existe;
 * - se o processo morrer entre o envio e o manifesto, o intento permanece
 *   `sending` = pendente/desconhecido, nunca permissão para repetir;
 * - o payload nunca contém prompt, bytes, chave ou URL: `envIdentifiers` lista
 *   apenas NOMES de variáveis/flags, nunca valores de segredo.
 */

import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import path from "node:path";

export const DEFAULT_EVIDENCE_DIR = path.join("scripts", "f60.3", "evidence");

export const INTENT_STATUS = Object.freeze({
  sending: "sending",
  completed: "completed",
  failed: "failed",
  unknown: "unknown",
} as const);

export type IntentStatus = (typeof INTENT_STATUS)[keyof typeof INTENT_STATUS];

/** Status terminal: tudo que não é `sending`. */
export type TerminalIntentStatus = Exclude<IntentStatus, "sending">;

const TERMINAL_STATUSES: readonly TerminalIntentStatus[] = Object.freeze([
  INTENT_STATUS.completed,
  INTENT_STATUS.failed,
  INTENT_STATUS.unknown,
]);

const INTENT_FILE_PREFIX = "proof-intent-";
const INTENT_FILE_SUFFIX = ".json";

export interface ProofIntentPayload {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly sourceOperationId: string;
  readonly attemptRef: string;
  readonly sourceArtifactId: string;
  readonly sourceChecksumSha256: string;
  readonly estimatedPreCallUsd: number;
  readonly authorizedBudgetUsd: number;
  readonly pricingVersion: string;
  /** Comando (sem valores de segredo) que gerou o intento. */
  readonly command: string;
  /** NOMES de variáveis/flags exigidas — nunca valores. */
  readonly envIdentifiers: readonly string[];
}

export interface ProofIntentRecord extends ProofIntentPayload {
  readonly status: "sending";
  readonly createdAt: string;
}

export interface ProofIntentTerminalRecord extends ProofIntentPayload {
  readonly status: TerminalIntentStatus;
  readonly createdAt: string;
  readonly terminalManifest: string;
  readonly observedCostUsd: number | null;
  readonly settledAt: string;
}

export interface CreateIntentResult {
  readonly path: string;
  readonly record: ProofIntentRecord;
}

export interface MarkIntentTerminalInput {
  readonly status: TerminalIntentStatus;
  readonly terminalManifest: string;
  readonly observedCostUsd: number | null;
}

function assertOperationId(operationId: unknown): string {
  if (
    typeof operationId !== "string" ||
    operationId.length === 0 ||
    operationId.includes("/") ||
    operationId.includes("\\") ||
    operationId.includes("..")
  ) {
    throw new Error("proof_intent_operation_id_invalid");
  }
  return operationId;
}

/** Caminho determinístico do intento: `proof-intent-<operationId>.json`. */
export function proofIntentPath(
  operationId: string,
  evidenceDir: string = DEFAULT_EVIDENCE_DIR,
): string {
  return path.join(
    evidenceDir,
    `${INTENT_FILE_PREFIX}${assertOperationId(operationId)}${INTENT_FILE_SUFFIX}`,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTerminalStatus(value: unknown): value is TerminalIntentStatus {
  return TERMINAL_STATUSES.includes(value as TerminalIntentStatus);
}

function parseIntentFile(filePath: string): ProofIntentRecord | ProofIntentTerminalRecord {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    throw new Error("proof_intent_malformed");
  }
  if (!isRecord(raw)) throw new Error("proof_intent_malformed");
  if (raw.status !== INTENT_STATUS.sending && !isTerminalStatus(raw.status)) {
    throw new Error("proof_intent_malformed");
  }
  return raw as unknown as ProofIntentRecord | ProofIntentTerminalRecord;
}

/**
 * Cria o intento com EXCLUSIVIDADE. `EEXIST` é propagado: quem chama deve
 * recusar a execução com `providerCalls: 0` — nunca sobrescrever.
 */
export function createIntentExclusive(
  payload: ProofIntentPayload,
  evidenceDir: string = DEFAULT_EVIDENCE_DIR,
): CreateIntentResult {
  const filePath = proofIntentPath(payload.operationId, evidenceDir);
  mkdirSync(path.dirname(filePath), { recursive: true });

  const record: ProofIntentRecord = Object.freeze({
    status: INTENT_STATUS.sending,
    ...payload,
    envIdentifiers: Object.freeze([...payload.envIdentifiers]),
    createdAt: new Date().toISOString(),
  });

  let fd: number | null = null;
  try {
    fd = openSync(filePath, "wx");
    writeSync(fd, `${JSON.stringify(record, null, 2)}\n`, null, "utf8");
  } finally {
    if (fd !== null) closeSync(fd);
  }

  return Object.freeze({ path: filePath, record });
}

/** Lê o intento; `null` quando ausente. Arquivo corrompido lança (bloqueia). */
export function readIntent(
  operationId: string,
  evidenceDir: string = DEFAULT_EVIDENCE_DIR,
): ProofIntentRecord | ProofIntentTerminalRecord | null {
  const filePath = proofIntentPath(operationId, evidenceDir);
  if (!existsSync(filePath)) return null;
  return parseIntentFile(filePath);
}

/**
 * Atualiza o MESMO arquivo do intento para um status terminal, com escrita
 * atômica (temporário + rename). Só é permitido a partir de `sending`.
 */
export function markIntentTerminal(
  operationId: string,
  input: MarkIntentTerminalInput,
  evidenceDir: string = DEFAULT_EVIDENCE_DIR,
): ProofIntentTerminalRecord {
  if (!isTerminalStatus(input.status)) {
    throw new Error("proof_intent_terminal_status_invalid");
  }
  if (typeof input.terminalManifest !== "string" || input.terminalManifest.length === 0) {
    throw new Error("proof_intent_terminal_manifest_invalid");
  }
  const filePath = proofIntentPath(operationId, evidenceDir);
  if (!existsSync(filePath)) throw new Error("proof_intent_missing");

  const current = parseIntentFile(filePath);
  if (current.status !== INTENT_STATUS.sending) {
    throw new Error("proof_intent_already_terminal");
  }

  const updated: ProofIntentTerminalRecord = Object.freeze({
    ...current,
    status: input.status,
    terminalManifest: input.terminalManifest,
    observedCostUsd:
      typeof input.observedCostUsd === "number" && Number.isFinite(input.observedCostUsd)
        ? input.observedCostUsd
        : null,
    settledAt: new Date().toISOString(),
  });

  const tempPath = `${filePath}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  renameSync(tempPath, filePath);

  return updated;
}

/** Lista os arquivos de intento presentes (nomes, ordenados). */
export function listIntents(evidenceDir: string = DEFAULT_EVIDENCE_DIR): readonly string[] {
  if (!existsSync(evidenceDir)) return Object.freeze([]);
  return Object.freeze(
    readdirSync(evidenceDir)
      .filter(
        (name) => name.startsWith(INTENT_FILE_PREFIX) && name.endsWith(INTENT_FILE_SUFFIX),
      )
      .sort(),
  );
}
