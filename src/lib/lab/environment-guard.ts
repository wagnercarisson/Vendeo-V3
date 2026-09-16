import "server-only";

/**
 * Guarda de ambiente do Laboratório de IA (F48.1, D2) — **fail-closed / local-only**.
 *
 * O laboratório executa IA real (chamadas pagas) e só pode existir apontando para
 * um Supabase **local** ou para um host explicitamente permitido. Qualquer
 * configuração ausente, inválida ou ambígua resulta em recusa.
 *
 * Ordem de avaliação (todas as regras são fail-closed):
 *  1. A flag do laboratório precisa ser exatamente a string `"true"` (default `false`).
 *  2. A URL do Supabase precisa existir e ser parseável.
 *  3. O hostname precisa ser local (`localhost`/`127.0.0.1`/`::1`/`0.0.0.0`)
 *     ou estar na allowlist CSV de hosts permitidos.
 *  4. Hosts de produção conhecidos (`*.supabase.co`/`*.supabase.in`/`*.supabase.com`)
 *     são **sempre** bloqueados, mesmo quando presentes na allowlist.
 *
 * A decisão usa **apenas** as três variáveis de ambiente da guarda — nunca o modo
 * de execução do build (que também assume valor de produção em builds locais).
 * A guarda expõe apenas o **hostname** — nunca a URL completa, path, query ou chave.
 * O hostname da URL e cada entrada da allowlist são canonicalizados (lowercase, sem
 * colchetes de IPv6 e sem ponto final de FQDN) **antes** de qualquer comparação,
 * para que `abcd.supabase.co.` não contorne o bloqueio de produção.
 */

/** Os 5 motivos possíveis da guarda. `"ok"` é o único que habilita a superfície. */
export const LAB_ENVIRONMENT_REASONS = [
  "ok",
  "disabled_flag",
  "missing_url",
  "non_local_supabase",
  "remote_blocked",
] as const;

export type LabEnvironmentReason = (typeof LAB_ENVIRONMENT_REASONS)[number];

export interface LabEnvironmentState {
  /** `true` somente quando `reason === "ok"`. */
  enabled: boolean;
  /** Hostname normalizado do Supabase, ou `null` quando a URL é ausente/inválida. */
  supabaseHost: string | null;
  /** `true` quando o hostname é um dos hosts locais conhecidos. */
  local: boolean;
  reason: LabEnvironmentReason;
}

/** Hosts locais de desenvolvimento (Supabase CLI / Docker). */
const LOCAL_SUPABASE_HOSTS: ReadonlySet<string> = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
]);

/** Domínios de produção conhecidos — bloqueio incondicional (vence a allowlist). */
const PRODUCTION_SUPABASE_DOMAINS = ["supabase.co", "supabase.in", "supabase.com"] as const;

function isProductionSupabaseHost(host: string): boolean {
  return PRODUCTION_SUPABASE_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
}

/**
 * Normaliza um hostname para a forma canônica usada em **todas** as comparações
 * (bloqueio de produção e allowlist): trim, lowercase, remoção dos colchetes de
 * IPv6 (`[::1]` → `::1`) e remoção de ponto(s) final(is) de FQDN
 * (`abcd.supabase.co.` → `abcd.supabase.co`). Sem essa canonicalização um FQDN
 * com ponto final contornaria o bloqueio de produção.
 */
function normalizeHostname(hostname: string): string {
  let normalized = hostname.trim().toLowerCase();
  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    normalized = normalized.slice(1, -1);
  }
  return normalized.replace(/\.+$/, "");
}

/** CSV → conjunto de hostnames canônicos (mesma normalização do host da URL). */
function readAllowedHosts(raw: string | undefined): ReadonlySet<string> {
  if (!raw) return new Set<string>();
  return new Set(
    raw
      .split(",")
      .map((entry) => normalizeHostname(entry))
      .filter((entry) => entry.length > 0),
  );
}

/** Mensagens determinísticas — contêm o `reason` e, no máximo, o hostname. */
function deniedMessage(reason: LabEnvironmentReason, host: string | null): string {
  switch (reason) {
    case "disabled_flag":
      return "Laboratório desabilitado: VENDEO_LAB_ENABLED não é 'true'";
    case "missing_url":
      return "Laboratório desabilitado: NEXT_PUBLIC_SUPABASE_URL ausente ou inválida";
    case "non_local_supabase":
      return `Laboratório desabilitado: host '${host ?? "desconhecido"}' não é local nem permitido`;
    case "remote_blocked":
      return `Laboratório bloqueado: host de produção '${host ?? "desconhecido"}'`;
    default:
      return "Laboratório habilitado";
  }
}

/**
 * Erro da guarda. Carrega apenas o `reason` e, na mensagem, o hostname —
 * nunca a URL completa, path, query ou chave.
 */
export class LabEnvironmentError extends Error {
  readonly reason: LabEnvironmentReason;

  constructor(reason: LabEnvironmentReason, host: string | null = null) {
    super(deniedMessage(reason, host));
    this.name = "LabEnvironmentError";
    this.reason = reason;
  }
}

/**
 * Avalia o ambiente do laboratório sem lançar. Único ponto de leitura das
 * variáveis de ambiente da guarda.
 */
export function getLabEnvironment(): LabEnvironmentState {
  // (1) Flag estrita: qualquer valor diferente da string "true" recusa.
  if (process.env.VENDEO_LAB_ENABLED !== "true") {
    return { enabled: false, supabaseHost: null, local: false, reason: "disabled_flag" };
  }

  // (2) URL ausente, vazia ou não parseável → recusa.
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!rawUrl) {
    return { enabled: false, supabaseHost: null, local: false, reason: "missing_url" };
  }

  let host: string;
  try {
    host = normalizeHostname(new URL(rawUrl).hostname);
  } catch {
    return { enabled: false, supabaseHost: null, local: false, reason: "missing_url" };
  }

  if (!host) {
    return { enabled: false, supabaseHost: null, local: false, reason: "missing_url" };
  }

  // (3) Bloqueio incondicional de produção — avaliado ANTES da allowlist.
  if (isProductionSupabaseHost(host)) {
    return { enabled: false, supabaseHost: host, local: false, reason: "remote_blocked" };
  }

  // (4) Host local ou explicitamente permitido.
  const local = LOCAL_SUPABASE_HOSTS.has(host);
  const allowed = readAllowedHosts(process.env.VENDEO_LAB_ALLOWED_SUPABASE_HOSTS).has(host);

  if (local || allowed) {
    return { enabled: true, supabaseHost: host, local, reason: "ok" };
  }

  return { enabled: false, supabaseHost: host, local: false, reason: "non_local_supabase" };
}

/**
 * Versão lançadora da guarda. Deve ser o primeiro contrato consumido por toda
 * página e toda rota do laboratório, antes de qualquer acesso às tabelas
 * `lab_*`, ao storage do laboratório ou aos providers (nenhuma chamada paga
 * antes da guarda).
 */
export function assertLabEnvironment(): LabEnvironmentState {
  const state = getLabEnvironment();
  if (state.reason !== "ok") {
    throw new LabEnvironmentError(state.reason, state.supabaseHost);
  }
  return state;
}

/** Corpo padronizado que as rotas do laboratório devolvem com HTTP 403. */
export function labEnvironmentDeniedBody(reason: LabEnvironmentReason): {
  error: "environment_blocked";
  reason: LabEnvironmentReason;
} {
  return { error: "environment_blocked", reason };
}
