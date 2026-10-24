/**
 * F47.2 — limite zero de retries escopado ao smoke controlado.
 *
 * A variável é lida apenas pelos entry points da Assinatura Visual. Quando
 * ausente, legado, campanhas e outros consumidores mantêm a política atual.
 */
export function isVisualSignatureSmokeNoRetry(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.VENDEO_VS_SMOKE_NO_RETRY === "1";
}
