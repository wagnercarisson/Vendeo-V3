import type { SupabaseClient } from "@supabase/supabase-js";

import type { AiCapability, AiProtocol, AiProvider } from "@/lib/ai/model-resolver";
import { BENCH_MODEL_ALLOWLIST } from "./bench-model-allowlist";

/**
 * Registry de presets de modelo/qualidade da bancada (F48.2.2, D7) — módulo
 * **puro e testável**.
 *
 * Cada preset é `{ id, label, capability, provider, model, protocol, quality,
 * size, enabled, reason? }`, validado contra a **allowlist própria da bancada**
 * (`BENCH_MODEL_ALLOWLIST` — **não** o `MODEL_ALLOWLIST` produtivo) e contra o
 * catálogo ativo (`ai_model_catalog`) em modo **somente leitura**.
 *
 * ## Estado inicial (obrigatório)
 *
 * **Nenhum preset está habilitado** antes do CHECKPOINT 1: todos os quatro
 * candidatos nascem `enabled: false` com `reason: "spike_pendente"`. O plano 04
 * habilita apenas os presets confirmados pelo spike (e mantém `responses`
 * indisponível salvo exigência confirmada). Nenhum CHECK por valor e nenhuma
 * tabela de presets no banco (D7).
 */

// ─── Tipo do preset ──────────────────────────────────────────────────────────

export interface BenchPreset {
  id: string;
  label: string;
  capability: AiCapability;
  provider: AiProvider;
  model: string;
  protocol: AiProtocol;
  quality: string;
  size: string;
  enabled: boolean;
  /** Motivo explícito quando `enabled: false`. */
  reason?: string;
}

// ─── Candidatos (todos desabilitados antes do CHECKPOINT 1) ──────────────────

const SPIKE_PENDENTE = "spike_pendente";

export const BENCH_PRESETS: readonly BenchPreset[] = [
  {
    id: "gpt-image-2-low",
    label: "GPT Image 2 · low",
    capability: "campaign_image",
    provider: "openai",
    model: "gpt-image-2",
    protocol: "images",
    quality: "low",
    size: "1024x1024",
    enabled: false,
    reason: SPIKE_PENDENTE,
  },
  {
    id: "gpt-image-2-medium",
    label: "GPT Image 2 · medium",
    capability: "campaign_image",
    provider: "openai",
    model: "gpt-image-2",
    protocol: "images",
    quality: "medium",
    size: "1024x1024",
    enabled: false,
    reason: SPIKE_PENDENTE,
  },
  {
    id: "gpt-image-2.5-flare-low",
    label: "GPT Image 2.5 Flare · low",
    capability: "campaign_image",
    provider: "openai",
    model: "gpt-image-2.5-flare",
    protocol: "images",
    quality: "low",
    size: "1024x1024",
    enabled: false,
    reason: SPIKE_PENDENTE,
  },
  {
    id: "gpt-image-2.5-flare-medium",
    label: "GPT Image 2.5 Flare · medium",
    capability: "campaign_image",
    provider: "openai",
    model: "gpt-image-2.5-flare",
    protocol: "images",
    quality: "medium",
    size: "1024x1024",
    enabled: false,
    reason: SPIKE_PENDENTE,
  },
];

// ─── Erros determinísticos ───────────────────────────────────────────────────

/**
 * Lançado quando o preset não existe ou está desabilitado. Carrega o motivo
 * (ex.: `spike_pendente`) para que a rota devolva `preset_not_enabled` (400).
 */
export class BenchPresetError extends Error {
  readonly code = "preset_not_enabled" as const;
  readonly presetId: string;
  readonly reason?: string;

  constructor(presetId: string, reason?: string) {
    super(`preset_not_enabled:${presetId}${reason ? ` (${reason})` : ""}`);
    this.name = "BenchPresetError";
    this.presetId = presetId;
    this.reason = reason;
  }
}

/** Lançado quando o alvo do preset não existe no catálogo ativo (leitura). */
export class BenchPresetNotInCatalogError extends Error {
  readonly code = "preset_not_in_catalog" as const;
  readonly presetId: string;

  constructor(preset: BenchPreset) {
    super(`preset_not_in_catalog:${preset.provider}/${preset.model}/${preset.protocol}`);
    this.name = "BenchPresetNotInCatalogError";
    this.presetId = preset.id;
  }
}

// ─── Leitura e resolução ─────────────────────────────────────────────────────

/** Lista os presets (habilitados e desabilitados com motivo) para a UI/API. */
export function listBenchPresets(): readonly BenchPreset[] {
  return BENCH_PRESETS;
}

/**
 * Resolve um preset habilitado. Preset inexistente ou desabilitado ⇒
 * `BenchPresetError` (`preset_not_enabled`) com o motivo.
 */
export function resolveBenchPreset(id: string): BenchPreset {
  const preset = BENCH_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) throw new BenchPresetError(id, "preset_inexistente");
  if (!preset.enabled) throw new BenchPresetError(id, preset.reason);
  return preset;
}

// ─── Validação contra a allowlist própria da bancada ─────────────────────────

/**
 * Valida `provider`/`model`/`protocol` do preset contra a **allowlist própria da
 * bancada** (`BENCH_MODEL_ALLOWLIST`) — nunca contra o `MODEL_ALLOWLIST`
 * produtivo. O parâmetro opcional permite compor allowlists em testes.
 */
export function validatePresetAgainstAllowlist(
  preset: BenchPreset,
  allowlist: Record<AiProvider, Record<string, readonly AiProtocol[]>> = BENCH_MODEL_ALLOWLIST,
): { ok: true } {
  const providerModels = allowlist[preset.provider];
  if (!providerModels) {
    throw new Error(`[bench-preset] provider "${preset.provider}" fora da allowlist da bancada`);
  }
  const allowedProtocols = providerModels[preset.model];
  if (!allowedProtocols) {
    throw new Error(
      `[bench-preset] modelo "${preset.model}" fora da allowlist da bancada (provider "${preset.provider}")`,
    );
  }
  if (!allowedProtocols.includes(preset.protocol)) {
    throw new Error(
      `[bench-preset] protocolo "${preset.protocol}" incompatível com o modelo "${preset.model}" na bancada`,
    );
  }
  return { ok: true };
}

// ─── Validação contra o catálogo ativo (somente leitura) ─────────────────────

/**
 * Confirma que o alvo do preset existe como linha **ativa** do catálogo para a
 * capability do preset. Falha de leitura é fail-closed; nenhuma linha do catálogo
 * é criada/alterada (somente leitura).
 */
export async function validatePresetAgainstCatalog(
  preset: BenchPreset,
  client: SupabaseClient,
): Promise<{ ok: true }> {
  const { data, error } = await client
    .from("ai_model_catalog")
    .select("id")
    .eq("capability", preset.capability)
    .eq("provider", preset.provider)
    .eq("model", preset.model)
    .eq("protocol", preset.protocol)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(`bench_preset_catalog_read_failed:${error.message}`);
  }
  if (!data) {
    throw new BenchPresetNotInCatalogError(preset);
  }
  return { ok: true };
}
