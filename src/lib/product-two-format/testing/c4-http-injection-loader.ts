import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { RunNineSixteenDeps } from "@/lib/product-9-16-two-stage/orchestration/types";

/**
 * Loader TEST-ONLY da injeção determinística para a jornada HTTP real de C4-I.
 *
 * Habilitado somente com:
 * - `F60_7_C4_TEST_INJECTION=1`;
 * - `NODE_ENV !== "production"`;
 * - `VERCEL !== "1"`.
 *
 * Fora disso retorna `undefined` sem importar o módulo de injeção. Nenhuma
 * alteração de flags/configuração; a proteção é explícita e falha fechada.
 */
export async function loadC4HttpInjection(
  client: SupabaseClient,
): Promise<RunNineSixteenDeps | undefined> {
  if (process.env.F60_7_C4_TEST_INJECTION !== "1") return undefined;
  if (process.env.NODE_ENV === "production") return undefined;
  if (process.env.VERCEL === "1") return undefined;

  const { createC4HttpInjection } = await import("./c4-http-injection");
  return createC4HttpInjection({ client });
}
