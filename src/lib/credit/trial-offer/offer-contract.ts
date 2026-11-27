/**
 * Contrato puro do catálogo versionado de ofertas (F63).
 *
 * Este módulo NÃO importa Supabase, Next, `server-only` nem faz I/O. Ele serve
 * tanto ao runtime server-only (`offer.ts`) quanto aos testes locais e de
 * banco que precisam dos mesmos nomes de RPC, tipos e listas de campos.
 */

/** Frequência de liberação aceita por `trial_offer_versions.release_frequency`. */
export type TrialOfferFrequency = "once" | "daily" | "weekly" | "monthly";

/** Condições publicadas de uma versão (nove colunas, camelCase). */
export interface TrialOfferConditions {
  offerKey: string;
  versionId: string;
  versionLabel: string;
  publicName: string;
  durationDays: number;
  maxTotalCredits: number;
  releaseFrequency: TrialOfferFrequency;
  creditsPerRelease: number | null;
  /** `published_at` em ISO-8601; publicação é o único marcador de vigência. */
  publishedAt: string;
}

/**
 * Projeção pública da versão vigente: exatamente seis campos.
 * Sem UUIDs, `offer_key`, auditoria, dados de concessão ou contagem de
 * liberações (a contagem depende de `started_at` e pertence ao calendário).
 */
export interface TrialOfferPublic {
  versionLabel: string;
  publicName: string;
  durationDays: number;
  maxTotalCredits: number;
  releaseFrequency: TrialOfferFrequency;
  creditsPerRelease: number | null;
}

/** Uma liberação do calendário derivado. */
export interface TrialOfferRelease {
  seq: number;
  dueAt: string;
  amount: number;
}

/** Calendário derivado de uma versão publicada para um `startedAt`. */
export interface TrialOfferSchedule {
  expiresAt: string;
  releases: TrialOfferRelease[];
  total: number;
}

/** Nomes exatos das funções SQL de leitura (service_role). */
export const TRIAL_OFFER_RPC = {
  conditions: "trial_offer_conditions",
  publicOffer: "trial_offer_public_offer",
  schedule: "trial_offer_release_schedule",
} as const;

/** Lista fechada de frequências aceitas. */
export const TRIAL_OFFER_FREQUENCIES = ["once", "daily", "weekly", "monthly"] as const;

/** Campos snake_case retornados por `trial_offer_public_offer()`. */
export const PUBLIC_OFFER_FIELDS = [
  "version_label",
  "public_name",
  "duration_days",
  "max_total_credits",
  "release_frequency",
  "credits_per_release",
] as const;

/** Campos snake_case retornados por `trial_offer_conditions()`. */
export const CONDITIONS_FIELDS = [
  "offer_key",
  "version_id",
  "version_label",
  "public_name",
  "duration_days",
  "max_total_credits",
  "release_frequency",
  "credits_per_release",
  "published_at",
] as const;

/**
 * Chaves que NUNCA podem aparecer na projeção pública, mesmo com valor nulo.
 * `release_count` é proibido porque a contagem depende de `started_at`.
 */
export const FORBIDDEN_PUBLIC_FIELDS = [
  "id",
  "offer_key",
  "version_id",
  "published_by",
  "created_by",
  "publication_reason",
  "releases",
  "release_count",
] as const;
