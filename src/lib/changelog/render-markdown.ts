/**
 * Renderer controlado de markdown — subconjunto: `## heading`, parágrafos,
 * `- listas` e `**negrito**`. Retorna HTML sanitizado com APENAS as tags
 * h2/p/ul/li/strong. Todo texto bruto é HTML-escapado ANTES de aplicar tags
 * (XSS: `<script>` vira `&lt;script&gt;`). Sintaxe não suportada lança Error
 * no build/CI, nunca em runtime.
 */
export function renderMarkdown(md: string): string {
  const lines = md.split("\n");
  const output: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    assertSupported(trimmed, i + 1);

    if (trimmed.startsWith("## ")) {
      output.push(`<h2>${applyBold(escapeHtml(trimmed.slice(3).trim()))}</h2>`);
      i++;
      continue;
    }

    if (trimmed.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        const item = lines[i].trim().slice(2).trim();
        items.push(`<li>${applyBold(escapeHtml(item))}</li>`);
        i++;
      }
      output.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (trimmed === "") {
      i++;
      continue;
    }

    output.push(`<p>${applyBold(escapeHtml(trimmed))}</p>`);
    i++;
  }

  return output.join("\n");
}

function assertSupported(line: string, lineNumber: number): void {
  if (line.startsWith("# ")) {
    throw new Error(
      `Sintaxe não suportada na linha ${lineNumber}: heading com "# " único. Use "## " para títulos.`
    );
  }
  if (line.startsWith("> ")) {
    throw new Error(`Sintaxe não suportada na linha ${lineNumber}: blockquote ("> ").`);
  }
  if (line.startsWith("```")) {
    throw new Error(`Sintaxe não suportada na linha ${lineNumber}: code fence ("\`\`\`").`);
  }
  if (line.includes("![") || line.includes("](")) {
    throw new Error(`Sintaxe não suportada na linha ${lineNumber}: imagem ou link.`);
  }
}

/** HTML-escape de todo texto bruto ANTES de aplicar as tags permitidas. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Aplica `**negrito**` → `<strong>...</strong>` sobre texto já escapado. */
function applyBold(text: string): string {
  const parts = text.split("**");
  if (parts.length % 2 === 0) {
    // `**` sem fechamento → trata como texto literal (já escapado), sem lançar.
    return text;
  }
  let result = parts[0];
  for (let i = 1; i < parts.length; i++) {
    result += i % 2 === 1 ? `<strong>${parts[i]}</strong>` : parts[i];
  }
  return result;
}
