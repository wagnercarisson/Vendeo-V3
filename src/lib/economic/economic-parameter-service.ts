import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { EconomicParameterKey, EconomicParameterResolution } from "./types";
import { ECONOMIC_PARAMETER_KEYS } from "./types";

/**
 * Default/fallback de TODOS os parâmetros econômicos (D1): 1.00 (conservador).
 * Usado quando a linha não existe em `economic_parameters` (fail-open).
 */
export const DEFAULT_ECONOMIC_PARAMETER_VALUE = 1.0;

/**
 * Erro de indisponibilidade dos parâmetros econômicos (fail-closed, padrão
 * OperationCostUnavailableError / AiCostAdminUnavailableError) — a rota
 * mapeia para 503.
 */
export class EconomicParameterUnavailableError extends Error {
  constructor(
    public readonly key?: EconomicParameterKey,
    message?: string,
  ) {
    super(
      message ??
        (key
          ? `Falha ao ler parâmetro econômico: ${key}`
          : "Falha ao ler parâmetros econômicos"),
    );
    this.name = "EconomicParameterUnavailableError";
  }
}

/**
 * Camada única de leitura dos parâmetros econômicos (D2) — módulo de servidor
 * (padrão `OperationCostService` F38):
 *
 * - `getParameter`: linha inexistente → default seguro 1.00 (fail-open, log
 *   aviso); erro real de leitura → `EconomicParameterUnavailableError`
 *   (fail-closed → API 503).
 * - `getAll`: mescla tabela + fallback para as duas chaves, expondo `source`
 *   para o admin.
 *
 * NUNCA altera a tabela — leitura apenas (escrita é via RPC
 * `admin_set_economic_parameter`, 38-2-04).
 */
export class EconomicParameterService {
  constructor(private readonly client: SupabaseClient = supabaseAdmin) {}

  async getParameter(
    key: EconomicParameterKey,
  ): Promise<EconomicParameterResolution> {
    const { data, error } = await this.client
      .from("economic_parameters")
      .select("key, value")
      .eq("key", key)
      .maybeSingle();

    if (error) {
      // Erro REAL de leitura (não é linha inexistente) → fail-closed.
      console.error("[economic] getParameter error", error.message);
      throw new EconomicParameterUnavailableError(key, error.message);
    }

    if (!data) {
      // Linha inexistente → default seguro 1.00 (fail-open, D1).
      console.warn(
        `[economic] linha ${key} inexistente — usando fallback 1.00`,
      );
      return { key, value: DEFAULT_ECONOMIC_PARAMETER_VALUE, source: "fallback" };
    }

    // NUMERIC do Postgres chega como string | number — normalizar com Number
    // e validar finito. value <= 0 não deveria existir (CHECK value > 0 no
    // banco); defesa: se value <= 0, log + fallback 1.00 (T-38.2-10).
    const value = Number(data.value);
    if (!Number.isFinite(value) || value <= 0) {
      console.warn(
        `[economic] linha ${key} com valor inválido (${String(data.value)}) — usando fallback 1.00`,
      );
      return { key, value: DEFAULT_ECONOMIC_PARAMETER_VALUE, source: "fallback" };
    }

    return { key, value, source: "table" };
  }

  async getAll(): Promise<EconomicParameterResolution[]> {
    const { data, error } = await this.client
      .from("economic_parameters")
      .select("key, value");

    if (error) {
      // Erro real de leitura → fail-closed.
      console.error("[economic] getAll error", error.message);
      throw new EconomicParameterUnavailableError(undefined, error.message);
    }

    // Ordem fixa das chaves + merge com fallback (source visível para o admin).
    return ECONOMIC_PARAMETER_KEYS.map((key) => {
      const row = data?.find((d) => d.key === key);
      if (!row) {
        return {
          key,
          value: DEFAULT_ECONOMIC_PARAMETER_VALUE,
          source: "fallback" as const,
        };
      }
      const value = Number(row.value);
      if (!Number.isFinite(value) || value <= 0) {
        console.warn(
          `[economic] linha ${key} com valor inválido (${String(row.value)}) — usando fallback 1.00`,
        );
        return {
          key,
          value: DEFAULT_ECONOMIC_PARAMETER_VALUE,
          source: "fallback" as const,
        };
      }
      return { key, value, source: "table" as const };
    });
  }
}
