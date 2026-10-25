import "server-only";
import {
  resolveVisualSignatureGenerationConfig,
  VisualSignatureModelConfigError,
  VISUAL_SIGNATURE_MODEL_CONFIG_INVALID,
  type VisualSignatureGenerationConfig,
  type VisualSignatureGenerationConfigResolution,
} from "./model-config";

/**
 * View administrativa discriminada da configuração dedicada da Assinatura
 * Visual.
 *
 * - `dedicated`: linha dedicada válida (fonte única: `model-config.ts`).
 * - `legacy`: ausência CONFIRMADA — caminho legado legítimo.
 * - `error`: falha de leitura/validação. NUNCA é convertida em `legacy`, para
 *   que a UI não exiba falha como ausência.
 *
 * Sem cache: cada invocação executa o resolver exatamente uma vez.
 */

export type VisualSignatureAdminConfigView =
  | { status: "dedicated"; config: VisualSignatureGenerationConfig }
  | { status: "legacy" }
  | { status: "error"; code: "read_failed" | "invalid" };

export function toVisualSignatureAdminConfigView(
  resolution: VisualSignatureGenerationConfigResolution,
): VisualSignatureAdminConfigView {
  if (resolution.source === "dedicated") {
    return { status: "dedicated", config: resolution.config };
  }
  return { status: "legacy" };
}

type VisualSignatureConfigResolver = () => Promise<VisualSignatureGenerationConfigResolution>;

export async function buildVisualSignatureAdminConfigView(
  resolver: VisualSignatureConfigResolver = resolveVisualSignatureGenerationConfig,
): Promise<VisualSignatureAdminConfigView> {
  try {
    return toVisualSignatureAdminConfigView(await resolver());
  } catch (error) {
    const code =
      error instanceof VisualSignatureModelConfigError &&
      error.code === VISUAL_SIGNATURE_MODEL_CONFIG_INVALID
        ? "invalid"
        : "read_failed";
    console.error("[visual-signature-admin-config-view]", { code });
    return { status: "error", code };
  }
}
