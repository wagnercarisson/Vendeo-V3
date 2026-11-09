/**
 * F60 — validação compartilhada entre runner e suíte Postgres.
 * Reconhece endereços loopback equivalentes e avalia a janela de exclusividade.
 */
export const HOMOLOG_HOSTS = ["127.0.0.1", "localhost", "[::1]", "::1"];

/** Qualquer alvo gravável do F60 precisa ser loopback; remoto é sempre recusado. */
export const LOOPBACK_HOSTS = HOMOLOG_HOSTS;

export function isHomologTarget({ hostname, port, pathname }) {
  return (
    HOMOLOG_HOSTS.includes(String(hostname)) &&
    String(port) === "57782" &&
    String(pathname) === "/postgres"
  );
}

/**
 * Formato aceito: "<início ISO> / <fim ISO> / <responsável>".
 * Separadores aceitos: " / ", "|" ou ";" (com espaços opcionais).
 */
export function parseF60Window(value) {
  if (typeof value !== "string") return null;
  const parts = value
    .split(/\s*\/\s*|\s*\|\s*|\s*;\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 3) return null;
  const [startRaw, endRaw, responsible] = parts;
  const start = Date.parse(startRaw);
  const end = Date.parse(endRaw);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  if (!responsible) return null;
  return { start, end, responsible, startRaw, endRaw };
}

/**
 * `active` exige now dentro de [start, end].
 * `closed` = fim no passado; `future` = início no futuro; `invalid` = formato.
 */
export function evaluateF60Window(value, now = Date.now()) {
  const parsed = parseF60Window(value);
  if (!parsed) return { status: "invalid", parsed: null };
  if (now < parsed.start) return { status: "future", parsed };
  if (now > parsed.end) return { status: "closed", parsed };
  return { status: "active", parsed };
}

/**
 * Preflight ÚNICO compartilhado por runner, `test-status` e TODAS as suítes
 * Postgres do F60. Recusa fail-closed antes de qualquer conexão/pool:
 * - URL ausente/inválida ou protocolo diferente de `postgresql:`/`postgres:`;
 * - host que não seja loopback (alvo remoto NUNCA é aceito);
 * - homolog (`127.0.0.1:57782/postgres` e equivalentes) sem
 *   `F60_HOMOLOG_AUTHORIZED=1` e janela vigente;
 * - qualquer alvo sem `F60_TEST_ALLOW_WRITES=1`.
 */
export function evaluateF60Target(value, env = {}, now = Date.now()) {
  const errors = [];
  let url = null;
  try {
    url = new URL(String(value ?? ""));
  } catch {
    errors.push("TEST_DATABASE_URL (URL PostgreSQL válida)");
  }

  if (url) {
    if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
      errors.push("TEST_DATABASE_URL (protocolo postgresql://)");
    }
    if (!LOOPBACK_HOSTS.includes(String(url.hostname))) {
      errors.push("TEST_DATABASE_URL (loopback obrigatório; alvo remoto recusado)");
    }
    if (isHomologTarget(url)) {
      if (env.F60_HOMOLOG_AUTHORIZED !== "1") {
        errors.push(
          "F60_HOMOLOG_AUTHORIZED=1 (nova autorização; janela do 60-01 encerrada)",
        );
      }
      const window = evaluateF60Window(env.F60_EXCLUSIVITY_WINDOW, now);
      if (window.status !== "active") {
        errors.push(`F60_EXCLUSIVITY_WINDOW (${window.status}; exige janela vigente)`);
      }
    }
  }

  if (env.F60_TEST_ALLOW_WRITES !== "1") {
    errors.push("F60_TEST_ALLOW_WRITES=1 (a suíte grava fixtures)");
  }

  return {
    ok: errors.length === 0,
    url,
    homolog: url ? isHomologTarget(url) : false,
    errors,
  };
}

/** Variante que lança; usada dentro das suítes ANTES de criar o pool. */
export function assertF60Target(value, env = {}) {
  const result = evaluateF60Target(value, env);
  if (!result.ok) {
    throw new Error(`F60 preflight recusou o alvo: ${result.errors.join("; ")}`);
  }
  return result.url;
}
