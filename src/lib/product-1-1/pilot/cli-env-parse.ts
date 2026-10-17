/**
 * F56.2b2c (B2.3) — Parser PURO de valores do CLI do Supabase.
 *
 * O CLI devolve as URLs **entre aspas** (`API_URL="http://127.0.0.1:57781"`) e escreve
 * avisos em `stderr` (que NÃO são falha). Este módulo (espelhado no runner PowerShell)
 * remove aspas e valida host local + porta esperada. Sem I/O; testável localmente.
 */
export interface ParsedCliUrl {
  readonly value: string;
  readonly host: string;
  readonly port: number;
  readonly localPortOk: boolean;
}

export function unquoteCliValue(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return "";
  return raw.trim().replace(/^["']+/, "").replace(/["']+$/, "").trim();
}

export function parseCliEnvLine(
  line: string | null | undefined,
  key: string,
): string | null {
  if (!line) return null;
  const re = new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`);
  const match = re.exec(line);
  if (!match) return null;
  return unquoteCliValue(match[1]);
}

export function parseLocalCliUrl(
  raw: string | null | undefined,
  expectedPort: number,
): ParsedCliUrl {
  const value = unquoteCliValue(raw);
  let host = "";
  let port = 0;
  try {
    const url = new URL(value);
    host = url.hostname;
    port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  } catch {
    host = "";
    port = 0;
  }
  const localHost = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host);
  return { value, host, port, localPortOk: localHost && port === expectedPort };
}
