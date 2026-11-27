import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FORBIDDEN_PUBLIC_FIELDS,
  TRIAL_OFFER_FREQUENCIES,
  TRIAL_OFFER_RPC,
  type TrialOfferConditions,
  type TrialOfferFrequency,
  type TrialOfferPublic,
  type TrialOfferRelease,
  type TrialOfferSchedule,
} from "./offer-contract";

/**
 * Cliente mínimo aceito pelo módulo: apenas `rpc`.
 * O `service_role` tem poderes administrativos; a injeção existe para testes e
 * para consumidores que já possuam um cliente resolvido.
 */
export type TrialOfferRpcClient = Pick<SupabaseClient, "rpc">;

/**
 * Erro de leitura fail-closed do catálogo versionado.
 * `code` identifica a classe da falha sem expor o payload bruto; `field`
 * aponta o campo recusado quando aplicável; `cause` preserva o erro original
 * do Supabase.
 */
export class TrialOfferReadError extends Error {
  readonly code: string;
  readonly field?: string;

  constructor(code: string, message: string, field?: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "TrialOfferReadError";
    this.code = code;
    if (field !== undefined) this.field = field;
  }
}

const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

type UnknownRecord = Record<string, unknown>;

let cachedRpcClient: TrialOfferRpcClient | null = null;

function fail(code: string, message: string, field?: string, cause?: unknown): never {
  throw new TrialOfferReadError(code, message, field, cause);
}

/**
 * Resolve o cliente UMA única vez. Sem cliente injetado, o import de
 * `@/lib/supabase/server` é dinâmico para que o módulo possa ser carregado
 * (por testes locais) sem as variáveis de ambiente do Supabase.
 */
async function resolveRpcClient(client?: TrialOfferRpcClient): Promise<TrialOfferRpcClient> {
  if (client !== undefined) return client;
  if (cachedRpcClient === null) {
    const { supabaseAdmin } = await import("@/lib/supabase/server");
    cachedRpcClient = supabaseAdmin;
  }
  return cachedRpcClient;
}

function asRecord(value: unknown, field: string): UnknownRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("invalid_payload", `${field} must be a JSON object`, field);
  }
  return value as UnknownRecord;
}

function requireString(record: UnknownRecord, key: string, field: string = key): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(
      value === undefined ? "missing_field" : "invalid_field",
      `${field} must be a non-empty string`,
      field,
    );
  }
  return value;
}

function requirePositiveInt(record: UnknownRecord, key: string, field: string = key): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    fail(
      value === undefined ? "missing_field" : "invalid_field",
      `${field} must be a positive integer`,
      field,
    );
  }
  return value;
}

function requireNullablePositiveInt(
  record: UnknownRecord,
  key: string,
  field: string = key,
): number | null {
  if (!(key in record)) {
    fail("missing_field", `${field} is required`, field);
  }
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    fail("invalid_field", `${field} must be a positive integer or null`, field);
  }
  return value;
}

function requireFrequency(record: UnknownRecord, key: string, field: string = key): TrialOfferFrequency {
  const value = record[key];
  if (
    typeof value !== "string" ||
    !(TRIAL_OFFER_FREQUENCIES as readonly string[]).includes(value)
  ) {
    fail(
      value === undefined ? "missing_field" : "invalid_field",
      `${field} must be one of ${TRIAL_OFFER_FREQUENCIES.join(", ")}`,
      field,
    );
  }
  return value as TrialOfferFrequency;
}

function requireIsoTimestamp(value: unknown, field: string): string {
  if (typeof value !== "string" || !ISO_TIMESTAMP_PATTERN.test(value)) {
    fail(
      value === undefined ? "missing_field" : "invalid_field",
      `${field} must be an ISO-8601 timestamp`,
      field,
    );
  }
  if (!Number.isFinite(Date.parse(value))) {
    fail("invalid_field", `${field} must be a valid ISO-8601 timestamp`, field);
  }
  return value;
}

function requireIsoTimestampField(record: UnknownRecord, key: string, field: string = key): string {
  return requireIsoTimestamp(record[key], field);
}

function normalizeVersionId(versionId: string | null): string | null {
  if (versionId === null) return null;
  if (typeof versionId !== "string" || versionId.trim().length === 0) {
    fail("invalid_field", "version_id must be a non-empty string or null", "version_id");
  }
  return versionId;
}

function assertCreditsConsistency(
  total: number,
  credits: number | null,
  frequency: TrialOfferFrequency,
): void {
  if (frequency === "once") {
    if (credits !== null) {
      fail(
        "invalid_field",
        "credits_per_release must be null when release_frequency is once",
        "credits_per_release",
      );
    }
    return;
  }

  if (credits === null) {
    fail(
      "invalid_field",
      "credits_per_release is required for a recurring release_frequency",
      "credits_per_release",
    );
  }

  if (!Number.isInteger(credits) || credits <= 0 || credits > total) {
    fail(
      "invalid_field",
      "credits_per_release must be a positive integer not greater than max_total_credits",
      "credits_per_release",
    );
  }
}

function throwRpcError(rpcName: string, error: unknown): never {
  fail("rpc_error", `${rpcName} failed`, undefined, error);
}

function mapPublicOffer(data: unknown, requestedVersionId?: string): TrialOfferPublic {
  const record = asRecord(data, TRIAL_OFFER_RPC.publicOffer);

  if (
    requestedVersionId !== undefined &&
    "version_id" in record &&
    record.version_id !== requestedVersionId
  ) {
    fail(
      "invalid_payload",
      "public offer payload does not match the requested version",
      "version_id",
    );
  }

  for (const forbidden of FORBIDDEN_PUBLIC_FIELDS) {
    if (forbidden in record) {
      fail(
        "invalid_payload",
        `public offer payload must not expose ${forbidden}`,
        forbidden,
      );
    }
  }

  const versionLabel = requireString(record, "version_label");
  const publicName = requireString(record, "public_name");
  const durationDays = requirePositiveInt(record, "duration_days");
  const maxTotalCredits = requirePositiveInt(record, "max_total_credits");
  const releaseFrequency = requireFrequency(record, "release_frequency");
  const creditsPerRelease = requireNullablePositiveInt(record, "credits_per_release");

  assertCreditsConsistency(maxTotalCredits, creditsPerRelease, releaseFrequency);

  return {
    versionLabel,
    publicName,
    durationDays,
    maxTotalCredits,
    releaseFrequency,
    creditsPerRelease,
  };
}

function mapConditions(data: unknown, requestedVersionId?: string): TrialOfferConditions {
  const record = asRecord(data, TRIAL_OFFER_RPC.conditions);

  const offerKey = requireString(record, "offer_key");
  const versionId = requireString(record, "version_id");
  const versionLabel = requireString(record, "version_label");
  const publicName = requireString(record, "public_name");
  const durationDays = requirePositiveInt(record, "duration_days");
  const maxTotalCredits = requirePositiveInt(record, "max_total_credits");
  const releaseFrequency = requireFrequency(record, "release_frequency");
  const creditsPerRelease = requireNullablePositiveInt(record, "credits_per_release");
  const publishedAt = requireIsoTimestampField(record, "published_at");

  if (requestedVersionId !== undefined && versionId !== requestedVersionId) {
    fail(
      "invalid_field",
      "conditions payload does not match the requested version_id",
      "version_id",
    );
  }

  assertCreditsConsistency(maxTotalCredits, creditsPerRelease, releaseFrequency);

  return {
    offerKey,
    versionId,
    versionLabel,
    publicName,
    durationDays,
    maxTotalCredits,
    releaseFrequency,
    creditsPerRelease,
    publishedAt,
  };
}

function mapSchedule(
  data: unknown,
  conditions: TrialOfferConditions,
  startedAt: string,
): TrialOfferSchedule {
  const record = asRecord(data, TRIAL_OFFER_RPC.schedule);
  const expiresAt = requireIsoTimestampField(record, "expires_at");

  const rawReleases = record.releases;
  if (!Array.isArray(rawReleases)) {
    fail(
      rawReleases === undefined ? "missing_field" : "invalid_payload",
      "releases must be an array",
      "releases",
    );
  }
  if (rawReleases.length === 0) {
    fail("schedule_empty", "releases must not be empty", "releases");
  }

  const total = requirePositiveInt(record, "total");

  const releases: TrialOfferRelease[] = [];
  let sum = 0;

  for (let index = 0; index < rawReleases.length; index += 1) {
    const item = asRecord(rawReleases[index], `releases[${index}]`);
    const seq = item.seq;

    if (typeof seq !== "number" || !Number.isInteger(seq) || seq !== index) {
      fail(
        "non_contiguous_seq",
        `releases[${index}].seq must equal ${index}`,
        `releases[${index}].seq`,
      );
    }

    const dueAt = requireIsoTimestamp(item.due_at, `releases[${index}].due_at`);
    const amount = requirePositiveInt(item, "amount", `releases[${index}].amount`);

    sum += amount;
    releases.push({ seq, dueAt, amount });
  }

  if (sum !== total) {
    fail(
      "total_mismatch",
      `release schedule total ${total} does not match the sum of releases ${sum}`,
      "total",
    );
  }

  if (total !== conditions.maxTotalCredits) {
    fail(
      "total_mismatch",
      `release schedule total ${total} does not match max_total_credits ${conditions.maxTotalCredits}`,
      "total",
    );
  }

  const first = releases[0];
  if (Date.parse(first.dueAt) !== Date.parse(startedAt)) {
    fail(
      "invalid_field",
      "the first release must occur at started_at",
      "releases[0].due_at",
    );
  }

  const last = releases[releases.length - 1];
  if (Date.parse(last.dueAt) >= Date.parse(expiresAt)) {
    fail(
      "invalid_field",
      "the last release must occur strictly before expires_at",
      "expires_at",
    );
  }

  return { expiresAt, releases, total };
}

/**
 * Lê a projeção pública da versão vigente. Leitura pura e fail-closed: não
 * infere contagem de liberações, não consulta `enabled` e não reserva nada.
 */
export async function readCurrentTrialOffer(
  client?: TrialOfferRpcClient,
): Promise<TrialOfferPublic> {
  const rpcClient = await resolveRpcClient(client);
  const { data, error } = await rpcClient.rpc(TRIAL_OFFER_RPC.publicOffer);

  if (error) throwRpcError(TRIAL_OFFER_RPC.publicOffer, error);
  if (data === null || data === undefined) {
    fail("invalid_payload", `${TRIAL_OFFER_RPC.publicOffer} returned no payload`);
  }

  return mapPublicOffer(data);
}

/**
 * Lê as condições da versão vigente (`versionId = null`) ou de uma versão
 * publicada específica. Leitura pura e fail-closed; não reserva parcelas.
 */
export async function readTrialOfferConditions(
  versionId: string | null = null,
  client?: TrialOfferRpcClient,
): Promise<TrialOfferConditions> {
  const requestedVersionId = normalizeVersionId(versionId);
  const rpcClient = await resolveRpcClient(client);

  const { data, error } = await rpcClient.rpc(TRIAL_OFFER_RPC.conditions, {
    p_version_id: requestedVersionId,
  });

  if (error) throwRpcError(TRIAL_OFFER_RPC.conditions, error);
  if (data === null || data === undefined) {
    fail("invalid_payload", `${TRIAL_OFFER_RPC.conditions} returned no payload`);
  }

  return mapConditions(data, requestedVersionId ?? undefined);
}

/**
 * Deriva o calendário de uma versão publicada a partir de `startedAt`.
 *
 * O cliente é resolvido UMA única vez (injetado ou lazy) e o MESMO cliente é
 * reutilizado em `trial_offer_conditions` e `trial_offer_release_schedule`.
 * Leitura pura e fail-closed: cruza o total com `max_total_credits` da mesma
 * versão e nunca reserva, grava ou altera créditos.
 */
export async function readTrialOfferSchedule(
  versionId: string,
  startedAt: string,
  client?: TrialOfferRpcClient,
): Promise<TrialOfferSchedule> {
  const requestedVersionId = normalizeVersionId(versionId);
  if (requestedVersionId === null) {
    fail("invalid_field", "version_id must not be null", "version_id");
  }

  const isoStartedAt = requireIsoTimestamp(startedAt, "started_at");

  // Resolução única: o parâmetro `client` não é mais usado depois daqui.
  const rpcClient = await resolveRpcClient(client);

  // Conditions primeiro: se falhar, o calendário não é solicitado.
  const conditions = await readTrialOfferConditions(requestedVersionId, rpcClient);

  const { data, error } = await rpcClient.rpc(TRIAL_OFFER_RPC.schedule, {
    p_version_id: requestedVersionId,
    p_started_at: isoStartedAt,
  });

  if (error) throwRpcError(TRIAL_OFFER_RPC.schedule, error);
  if (data === null || data === undefined) {
    fail("invalid_payload", `${TRIAL_OFFER_RPC.schedule} returned no payload`);
  }

  return mapSchedule(data, conditions, isoStartedAt);
}
