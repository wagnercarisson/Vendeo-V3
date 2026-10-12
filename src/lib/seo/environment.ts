/**
 * Discriminação fail-closed de ambiente (F51.2 / D-03 / D-06).
 *
 * Fonte única da condição combinada de indexabilidade: produção confirmada
 * (`VERCEL_ENV === "production"`) **e** origem canônica validada. Qualquer outra
 * combinação é não indexável. Nunca lança e nunca lê o ambiente de build local.
 *
 * Import **relativo** obrigatório: `next.config.ts` carrega este módulo em tempo
 * de carregamento do config, quando o alias `@/` do tsconfig não é garantidamente
 * resolvido.
 */

import { resolveCanonicalOrigin } from "./origin";

/** `true` somente quando `VERCEL_ENV === "production"`. */
export function isProductionConfirmed(): boolean {
  return process.env.VERCEL_ENV === "production";
}

/**
 * `true` somente com produção confirmada **e** origem canônica válida.
 * Qualquer outra combinação (preview, local, `VERCEL_ENV` ausente, produção com
 * origem ausente/inválida/não canônica) resulta em `false`.
 */
export function isIndexableEnvironment(): boolean {
  return isProductionConfirmed() && resolveCanonicalOrigin().status === "valid";
}

/**
 * Diagnóstico de conferência operacional: string não vazia quando `VERCEL_ENV`
 * está ausente/vazio (ambiente tratado como não indexável); `null` quando
 * definido.
 */
export function getEnvironmentDiagnostic(): string | null {
  const raw = process.env.VERCEL_ENV;
  if (raw === undefined || raw === "") {
    return "[seo/environment] VERCEL_ENV não exposto — ambiente tratado como não indexável (fail-closed); conferir antes da publicação";
  }
  return null;
}
