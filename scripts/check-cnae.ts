/**
 * check:cnae — validação de não-contradição do mapeamento CNAE em build/CI (D9).
 *
 * Roda `assertNoCnaeContradictions()` sobre `CNAE_SEGMENT_MAP`: se o mesmo código
 * (classe OU subclasse) aparecer nas listas positiva e negativa do mesmo segmento,
 * o processo falha com exit != 0 → erro de build, nunca runtime.
 *
 * Executado via `npm run check:cnae` (tsx), anexado ao script `build`.
 */
import { assertNoCnaeContradictions } from "../src/lib/cnpj/cnae-mapping";

assertNoCnaeContradictions();
console.log("check:cnae OK — no contradictions in CNAE_SEGMENT_MAP");