/**
 * Interpolação e resolução de chave (F57.4) — puro, sem `server-only` e sem
 * importar catálogos.
 *
 * Manter este módulo livre de catálogos garante que componentes cliente que só
 * precisam de `formatMessage` (ex.: sino de notificações) não puxem o catálogo
 * espanhol para o bundle.
 */

import type { Messages } from "./messages";

export type MessageParams = Record<string, string | number>;

const PLACEHOLDER = /\{([a-zA-Z0-9_]+)\}/g;

function hasOwn(params: MessageParams, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(params, key);
}

/**
 * Substitui apenas `{nome}` presentes em `params`. Placeholders sem parâmetro
 * permanecem literais. Nunca interpreta HTML, `eval` ou `new Function`.
 */
export function formatMessage(
  template: string,
  params: MessageParams = {},
): string {
  return template.replace(PLACEHOLDER, (match, name: string) =>
    hasOwn(params, name) ? String(params[name]) : match,
  );
}

function getByPath(catalog: unknown, keyPath: string): string | undefined {
  let current: unknown = catalog;
  for (const segment of keyPath.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" ? current : undefined;
}

/**
 * Resolve caminho pontuado com fallback para pt-BR e, por último, para a
 * própria chave. Capacidade de biblioteca em profundidade de defesa: a UI usa
 * `messages.*` tipados + `formatMessage`; nenhum componente é obrigado a
 * chamar `translate`.
 */
export function translate(
  catalog: Messages,
  fallback: Messages,
  keyPath: string,
  params: MessageParams = {},
): string {
  const value = getByPath(catalog, keyPath) ?? getByPath(fallback, keyPath);

  if (value === undefined) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[i18n] chave ausente: ${keyPath}`);
    }
    return keyPath;
  }

  return formatMessage(value, params);
}
