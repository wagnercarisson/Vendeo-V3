/**
 * Resolução pura e determinística da identidade visual da bancada (F48.2.3).
 *
 * Módulo **puro** — sem I/O, sem variáveis de ambiente, sem cliente de banco e
 * sem importar qualquer serviço produtivo. Reproduz **exatamente** a seleção de
 * identidade de `resolveStoreIdentity` (`src/lib/store-identity-service.ts`)
 * **sem editá-lo**:
 *
 *   - `identity_state = 'text_only'` → nenhuma imagem de identidade;
 *   - `identity_state = 'logo'` → seleciona a variante por prioridade
 *     `normalized → original → on_dark` **pela presença do registro ativo**
 *     (nunca pela URL assinada) e devolve o descritor com `storagePath`;
 *   - `identity_state = 'visual_signature'` → seleciona a assinatura ativa e
 *     devolve o descritor com `storagePath`;
 *   - estado ausente/desconhecido → nenhuma imagem (fail-closed), sem conversão
 *     silenciosa para `text_only`.
 *
 * Regra de fidelidade: a seleção **não depende do sucesso da assinatura**. A
 * assinatura do asset escolhido é responsabilidade do chamador (I/O); se ela
 * falhar, o descritor selecionado é preservado com a URL nula e um motivo de
 * falha — **nunca** há fallback para a variante seguinte nem para outro tipo de
 * identidade. Este módulo devolve apenas o **descritor** (`kind`, `variantType`,
 * `storagePath`) — nenhuma URL é produzida aqui.
 */

// ─── Conjunto fechado de estados (espelha o CHECK do banco) ───────────────────

export const BENCH_IDENTITY_STATES = ["text_only", "logo", "visual_signature"] as const;

export type BenchIdentityStateValue = (typeof BENCH_IDENTITY_STATES)[number];

/** Estado reconhecido pelo resolver; `unknown` representa ausente/desconhecido. */
export type BenchIdentityState = BenchIdentityStateValue | "unknown";

// ─── Contrato do resolver ────────────────────────────────────────────────────

/** Variante ativa de logo (presença do registro basta; URL é do chamador). */
export interface BenchIdentityLogoAsset {
  variantType: string;
  storagePath: string;
}

/** Descritor canônico da identidade selecionada — **sem** URL assinada. */
export interface BenchIdentityReference {
  kind: "logo" | "visual_signature";
  variantType: string | null;
  storagePath: string;
}

export interface BenchIdentityResolution {
  identityState: BenchIdentityState;
  reference: BenchIdentityReference | null;
  reason: string;
}

export interface BenchIdentityInput {
  identityState: string | null | undefined;
  logoAssets: readonly BenchIdentityLogoAsset[];
  visualSignature: { storagePath: string } | null;
}

// ─── Prioridade canônica das variantes de logo (paridade produtiva) ──────────

const LOGO_VARIANT_PRIORITY = ["normalized", "original", "on_dark"] as const;

function isKnownIdentityState(value: unknown): value is BenchIdentityStateValue {
  return (
    typeof value === "string" &&
    (BENCH_IDENTITY_STATES as readonly string[]).includes(value)
  );
}

/**
 * Resolve a referência de identidade a partir do estado e dos registros ativos.
 * Função **pura** e determinística (mesma entrada ⇒ mesma saída).
 */
export function resolveBenchIdentity(input: BenchIdentityInput): BenchIdentityResolution {
  const { identityState, logoAssets, visualSignature } = input;

  if (!isKnownIdentityState(identityState)) {
    return { identityState: "unknown", reference: null, reason: "unknown_identity_state" };
  }

  if (identityState === "text_only") {
    return { identityState, reference: null, reason: "text_only:no_identity_image" };
  }

  if (identityState === "logo") {
    const assets = Array.isArray(logoAssets) ? logoAssets : [];
    let selected: BenchIdentityLogoAsset | undefined;
    for (const variantType of LOGO_VARIANT_PRIORITY) {
      const found = assets.find((asset) => asset.variantType === variantType);
      if (found) {
        selected = found;
        break;
      }
    }
    if (!selected || !selected.storagePath) {
      return { identityState, reference: null, reason: "logo:missing_active_asset" };
    }
    return {
      identityState,
      reference: {
        kind: "logo",
        variantType: selected.variantType,
        storagePath: selected.storagePath,
      },
      reason: "logo:selected",
    };
  }

  if (!visualSignature || !visualSignature.storagePath) {
    return {
      identityState,
      reference: null,
      reason: "visual_signature:missing_active_signature",
    };
  }
  return {
    identityState,
    reference: {
      kind: "visual_signature",
      variantType: null,
      storagePath: visualSignature.storagePath,
    },
    reason: "visual_signature:selected",
  };
}
