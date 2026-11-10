/**
 * F60.1 — gate específico da integração de artefatos de composição.
 *
 * Módulo sem shebang para poder ser importado diretamente pelas suítes
 * Vitest. Não reutiliza a janela de exclusividade das RPCs da F60 (a 60.1 não
 * toca essas RPCs).
 */
import { isHomologTarget } from './f60-window.mjs';

const LOOPBACK_HOSTS = ['127.0.0.1', 'localhost', '[::1]', '::1'];

function parsePostgresUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return null;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') return null;
    return parsed;
  } catch {
    return null;
  }
}

function parseHttpUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return null;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (/\.supabase\.(co|in|com)$/i.test(parsed.hostname)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isLoopbackHost(hostname) {
  return LOOPBACK_HOSTS.includes(String(hostname));
}

/**
 * Exige:
 * - `TEST_DATABASE_URL` PostgreSQL em host loopback;
 * - `SUPABASE_URL` HTTP(S) em host loopback;
 * - `F60_TEST_ALLOW_WRITES=1`;
 * - `F60_1_HOMOLOG_AUTHORIZED=1` quando o alvo for o homolog conhecido.
 */
export function evaluateF601Target(env = process.env) {
  const reasons = [];
  const target = parsePostgresUrl(env.TEST_DATABASE_URL);
  if (!target || !isLoopbackHost(target.hostname)) {
    reasons.push('TEST_DATABASE_URL (PostgreSQL loopback)');
  }
  if (target && isHomologTarget(target) && env.F60_1_HOMOLOG_AUTHORIZED !== '1') {
    reasons.push('F60_1_HOMOLOG_AUTHORIZED=1 (autorização explícita da 60.1 para homolog)');
  }
  if (env.F60_TEST_ALLOW_WRITES !== '1') {
    reasons.push('F60_TEST_ALLOW_WRITES=1 (a suíte grava fixtures)');
  }

  const supabaseUrl = parseHttpUrl(env.SUPABASE_URL);
  if (!supabaseUrl || !isLoopbackHost(supabaseUrl.hostname)) {
    reasons.push('SUPABASE_URL (HTTP loopback obrigatório; alvo remoto recusado)');
  }

  return {
    ready: reasons.length === 0,
    reasons,
    target,
    supabaseUrl,
    homolog: target ? isHomologTarget(target) : false,
  };
}

export function f601GateStatus(env = process.env) {
  const result = evaluateF601Target(env);
  return { ready: result.ready, reasons: result.reasons };
}
