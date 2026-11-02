/**
 * Extrator determinístico de trecho editorial para o anúncio compacto (F58).
 *
 * Deriva o trecho do próprio conteúdo existente (primeiro bloco textual não
 * vazio, aceitando parágrafo ou primeiro item de lista). Nunca resume por IA,
 * nunca traduz e nunca inventa texto. Sem entrada textual, retorna `null`.
 */

const HEADING_REGEX = /^#{1,6}\s+/;
const LIST_ITEM_REGEX = /^(?:[-*+]|\d+\.)\s+/;
const FRONTMATTER_FENCE_REGEX = /^(?:---|\+\+\+)$/;
const CODE_FENCE_REGEX = /^(?:```|~~~)/;

const ELLIPSIS = "…";

/** Remove marcação simples, mantendo apenas o texto editorial. */
function stripInlineMarkup(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`/g, "");
}

/** Corta no limite de palavra anterior a `maxLength` e acrescenta `…`. */
function truncateAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const slice = text.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > 0 ? slice.slice(0, lastSpace) : slice;

  return `${cut.trimEnd()}${ELLIPSIS}`;
}

export function buildAnnouncementExcerpt(
  body: string,
  maxLength = 200,
): string | null {
  if (typeof body !== "string" || body.trim() === "") return null;

  const lines = body.split(/\r?\n/);
  const blockLines: string[] = [];
  let inCodeFence = false;
  let collecting = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (CODE_FENCE_REGEX.test(trimmed)) {
      if (collecting) break;
      inCodeFence = !inCodeFence;
      continue;
    }

    if (inCodeFence) continue;

    if (trimmed === "" || FRONTMATTER_FENCE_REGEX.test(trimmed)) {
      if (collecting) break;
      continue;
    }

    if (HEADING_REGEX.test(trimmed)) {
      if (collecting) break;
      continue;
    }

    const isListItem = LIST_ITEM_REGEX.test(trimmed);

    if (!collecting) {
      collecting = true;
      blockLines.push(
        isListItem ? trimmed.replace(LIST_ITEM_REGEX, "") : trimmed,
      );
      // Um item de lista é sempre um candidato de uma única linha.
      if (isListItem) break;
      continue;
    }

    if (isListItem) break;

    blockLines.push(trimmed);
  }

  if (blockLines.length === 0) return null;

  const text = blockLines.join(" ").replace(/\s+/g, " ").trim();
  if (text === "") return null;

  const cleaned = stripInlineMarkup(text).replace(/\s+/g, " ").trim();
  if (cleaned === "") return null;

  return truncateAtWordBoundary(cleaned, maxLength);
}
