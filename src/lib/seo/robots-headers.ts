/**
 * Matriz pura de `X-Robots-Tag` para `headers()` em `next.config.ts`
 * (F51.2 / D-07 / D-09 / D-10).
 *
 * Sempre inclui `/auth/:path*`, `/api/:path*` e `/docs/:path*` com
 * `X-Robots-Tag: noindex`. Adiciona a regra global `/(.*)` com
 * `X-Robots-Tag: noindex, nofollow` **somente** quando o ambiente não é
 * produção confirmada (`productionConfirmed === false`).
 *
 * A função é pura: não lê `process.env` (quem lê o ambiente é `next.config.ts`
 * via `isProductionConfirmed()`). Os valores literais vêm de `indexation-policy`.
 *
 * Nunca emite `Disallow`: um `Disallow` impediria o robô de ler o `noindex`
 * (D-07).
 */

import { NOINDEX_TAG, NOINDEX_TAG_GLOBAL } from "./indexation-policy";

export interface RobotsHeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

export function buildRobotsHeaders(input: { productionConfirmed: boolean }): RobotsHeaderRule[] {
  const rules: RobotsHeaderRule[] = [
    { source: "/auth/:path*", headers: [{ key: "X-Robots-Tag", value: NOINDEX_TAG }] },
    { source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: NOINDEX_TAG }] },
    { source: "/docs/:path*", headers: [{ key: "X-Robots-Tag", value: NOINDEX_TAG }] },
  ];

  if (!input.productionConfirmed) {
    rules.push({
      source: "/(.*)",
      headers: [{ key: "X-Robots-Tag", value: NOINDEX_TAG_GLOBAL }],
    });
  }

  return rules;
}
