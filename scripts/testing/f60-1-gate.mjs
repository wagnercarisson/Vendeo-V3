/**
 * F60.1 — gate específico da integração de artefatos de composição.
 *
 * Módulo sem shebang para poder ser importado diretamente pelas suítes
 * Vitest. Não reutiliza a janela de exclusividade das RPCs da F60 (a 60.1 não
 * toca essas RPCs).
 *
 * Loopback sozinho NÃO basta: o alvo precisa declarar `F60_1_TARGET` e o par
 * PostgreSQL/API precisa coincidir com o par autorizado daquele alvo. Isso
 * impede combinações como DB `54322` + API `57781`.
 */

const LOOPBACK_HOSTS = ['127.0.0.1', 'localhost', '[::1]', '::1'];

export const AUTHORIZED_F601_TARGETS = Object.freeze({
  'homolog-existing': Object.freeze({
    dbPort: '57782',
    dbPath: '/postgres',
    apiPort: '57781',
    requiresHomologAuthorization: true,
  }),
  'disposable-local': Object.freeze({
    dbPort: '54322',
    dbPath: '/postgres',
    apiPort: '54321',
    requiresHomologAuthorization: false,
  }),
});

function normalizeTargetKind(value) {
  return value === 'homolog-existing' || value === 'disposable-local'
    ? value
    : null;
}

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

function httpPort(parsed) {
  if (parsed.port) return parsed.port;
  return parsed.protocol === 'https:' ? '443' : '80';
}

export function evaluateF601Target(env = process.env) {
  const reasons = [];
  const targetKind = normalizeTargetKind(env.F60_1_TARGET);
  const expected = targetKind ? AUTHORIZED_F601_TARGETS[targetKind] : null;

  if (!targetKind) {
    reasons.push('F60_1_TARGET=homolog-existing|disposable-local');
  }

  const target = parsePostgresUrl(env.TEST_DATABASE_URL);
  if (!target || !isLoopbackHost(target.hostname)) {
    reasons.push('TEST_DATABASE_URL (PostgreSQL loopback)');
  } else if (expected) {
    if (String(target.port) !== expected.dbPort || target.pathname !== expected.dbPath) {
      reasons.push(
        `TEST_DATABASE_URL (esperado 127.0.0.1:${expected.dbPort}${expected.dbPath} para ${targetKind})`,
      );
    }
  }

  const supabaseUrl = parseHttpUrl(env.SUPABASE_URL);
  if (!supabaseUrl || !isLoopbackHost(supabaseUrl.hostname)) {
    reasons.push('SUPABASE_URL (HTTP loopback obrigatório; alvo remoto recusado)');
  } else if (expected && httpPort(supabaseUrl) !== expected.apiPort) {
    reasons.push(
      `SUPABASE_URL (esperado 127.0.0.1:${expected.apiPort} para ${targetKind})`,
    );
  }

  if (
    expected?.requiresHomologAuthorization &&
    env.F60_1_HOMOLOG_AUTHORIZED !== '1'
  ) {
    reasons.push(
      'F60_1_HOMOLOG_AUTHORIZED=1 (autorização explícita da 60.1 para homolog)',
    );
  }

  if (env.F60_TEST_ALLOW_WRITES !== '1') {
    reasons.push('F60_TEST_ALLOW_WRITES=1 (a suíte grava fixtures)');
  }

  return {
    ready: reasons.length === 0,
    reasons,
    targetKind,
    expected,
    target,
    supabaseUrl,
    homolog: targetKind === 'homolog-existing',
  };
}

export function f601GateStatus(env = process.env) {
  const result = evaluateF601Target(env);
  return { ready: result.ready, reasons: result.reasons };
}
