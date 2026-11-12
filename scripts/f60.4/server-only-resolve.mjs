/**
 * F60.3 / 60.3-04 — Resolvedor de runtime para `server-only` (NÃO PAGO).
 *
 * Objetivo: permitir que o harness da prova (`scripts/f60.3/vertical-expansion-proof.ts`)
 * importe módulos `server-only` do produto em Node puro, fora do bundler do Next.
 *
 * Uso (a partir da RAIZ do repositório):
 *   node --import ./scripts/f60.3/server-only-resolve.mjs --import tsx <script> <flags>
 *
 * Se for executado de outro diretório, o `--import` precisa receber o caminho
 * absoluto em `file://` (ex.: `--import file:///C:/.../scripts/f60.3/server-only-resolve.mjs`).
 * A resolução interna do alvo não depende de `cwd`: ela é derivada de `import.meta.url`.
 *
 * Requisito de runtime: Node >= 22.15 / 24 (`module.registerHooks`). Não existe
 * fallback para `module.register` — ele exigiria um loader em arquivo separado e
 * não é suportado aqui de propósito, para manter o hook síncrono e determinístico.
 *
 * O alvo é o mesmo de `vitest.shared.ts::resolveServerOnly`:
 * `node_modules/next/dist/compiled/server-only/empty.js`. O contrato de
 * `resolve` exige uma URL (`file://...`), nunca um caminho de filesystem.
 *
 * ESCOPO: este arquivo existe APENAS para o harness de prova. Ele não altera
 * runtime de produto, build, testes existentes nem configuração do Next.
 */

import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const targetPath = fileURLToPath(
  new URL("../../node_modules/next/dist/compiled/server-only/empty.js", import.meta.url),
);

if (!existsSync(targetPath)) {
  throw new Error(
    "f60.3: alvo de `server-only` ausente (node_modules/next/dist/compiled/server-only/empty.js); " +
      "instale as dependências antes de rodar o harness da prova.",
  );
}

const targetUrl = pathToFileURL(targetPath).href;

/** Mapeia exatamente `server-only` para o módulo vazio oficial do Next. */
export function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: targetUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

/** Delega o carregamento; nenhum outro módulo é interceptado. */
export function load(url, context, nextLoad) {
  return nextLoad(url, context);
}

registerHooks({ resolve, load });
