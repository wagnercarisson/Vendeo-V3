export interface ParseResult {
  frontmatter: Record<string, unknown>;
  body: string;
}

/**
 * Parser próprio de frontmatter YAML (subconjunto) sem dependências externas.
 * - Valida que a primeira linha é exatamente `---`
 * - Localiza a linha de fechamento `---`
 * - Parseia linhas `chave: valor` (split APENAS no primeiro `:`)
 * - Remove aspas simples/duplas opcionais de valores escalares
 * - Retorna o body após o fechamento, trimado
 */
export function parseFrontmatter(raw: string): ParseResult {
  const lines = raw.split("\n");

  if (lines[0]?.trim() !== "---") {
    throw new Error("Frontmatter de abertura ausente");
  }

  const closingIndex = lines.slice(1).findIndex((line) => line.trim() === "---");
  if (closingIndex === -1) {
    throw new Error("--- de fechamento não encontrado");
  }

  const frontmatter: Record<string, unknown> = {};
  for (const line of lines.slice(1, 1 + closingIndex)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;
    const key = trimmed.slice(0, colonIndex).trim();
    const value = stripQuotes(trimmed.slice(colonIndex + 1).trim());
    frontmatter[key] = value;
  }

  const body = lines.slice(1 + closingIndex + 1).join("\n").trim();
  return { frontmatter, body };
}

function stripQuotes(value: string): string {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
