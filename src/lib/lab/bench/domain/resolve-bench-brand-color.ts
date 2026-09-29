import { getDefaultBrandColor } from "@/lib/store";

/**
 * Resolução cromática fiel da bancada (F48.2.3, D16).
 *
 * Módulo **puro** — sem I/O, sem `process.env`, sem client Supabase e sem
 * importar qualquer serviço produtivo. Reproduz **exatamente** a precedência
 * produtiva efetiva de `resolveStoreIdentity` (`src/lib/store-identity-service.ts`)
 * **sem editá-lo**:
 *
 *   1. `brand_colors_chosen[0]` válido (hex) vence;
 *   2. senão, `safe_color_tokens.primary` válido;
 *   3. senão, `inferred_primary_color` válido **apenas em `source === "text_only"`**;
 *   4. senão, `stores.brand_color`;
 *   5. senão, `getDefaultBrandColor(segment)`.
 *
 * **Ausência de perfil synced = ausência de perfil** (`profile` nulo): não existe
 * fallback `without_logo`. A paridade com o produtivo é comprovada por teste em
 * `__tests__/resolve-bench-brand-color.test.ts`. Nenhuma precedência nova é
 * inventada e nenhuma paleta é expandida.
 *
 * Nota de fidelidade: como no produtivo, quando `brand_colors_chosen` **tem**
 * itens mas o primeiro é inválido, a precedência **não** cai para o token seguro
 * (o ramo `else if` não é executado). Esse comportamento é reproduzido de
 * propósito para manter paridade byte a byte.
 */

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/** Campos cromáticos persistidos do **único perfil `status='synced'`**. */
export interface BenchBrandColorProfile {
  source?: string | null;
  status?: string | null;
  safe_color_tokens?: Record<string, string> | null;
  brand_colors_chosen?: Array<string | null> | null;
  inferred_primary_color?: string | null;
}

/** Campos de loja relevantes à resolução cromática. */
export interface BenchBrandColorStore {
  brand_color?: string | null;
  segment: string;
}

/**
 * Resolve o `brandColor` pela precedência produtiva exata. Função **pura** e
 * determinística; `profile === null` significa ausência de perfil synced.
 */
export function resolveBenchBrandColor(
  profile: BenchBrandColorProfile | null,
  store: BenchBrandColorStore,
): string {
  let brandColor = store.brand_color ?? getDefaultBrandColor(store.segment);

  if (!profile) return brandColor;

  if (profile.source === "text_only" && profile.status === "synced") {
    const tokenColor = profile.safe_color_tokens?.primary;
    if (tokenColor && HEX_COLOR.test(tokenColor)) {
      brandColor = tokenColor;
    } else if (profile.inferred_primary_color && HEX_COLOR.test(profile.inferred_primary_color)) {
      brandColor = profile.inferred_primary_color;
    }
  }

  const chosen = profile.brand_colors_chosen;
  if (chosen && chosen.length > 0) {
    const primaryColor = chosen[0];
    if (primaryColor && HEX_COLOR.test(primaryColor)) {
      brandColor = primaryColor;
    }
  } else if (profile.safe_color_tokens?.primary) {
    const tokenColor = profile.safe_color_tokens.primary;
    if (HEX_COLOR.test(tokenColor)) {
      brandColor = tokenColor;
    }
  }

  return brandColor;
}
