import { compareBusinessName } from "@/lib/cnpj/similarity";
import { cnaeCompatibilityFor } from "@/lib/cnpj/cnae-mapping";
import type { FreemiumEligibilityInput, FreemiumEligibilityOutput } from "./types";

export function normalizeCity(city: string): string {
  return city
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

export function computeSimilarity(
  name: string,
  razaoSocial: string,
  nomeFantasia?: string
): number {
  const score = compareBusinessName(name, razaoSocial, nomeFantasia);
  return score.bestScore;
}

export function evaluateFreemiumEligibility(
  input: FreemiumEligibilityInput
): FreemiumEligibilityOutput {
  const signals = {
    cnpjExists: input.lookupOutcome === "resolved" ? true : null,
    situacaoCadastral: input.officialData?.situacao_cadastral || null,
    nameSimilarity: input.officialData
      ? computeSimilarity(
          input.storeName,
          input.officialData.razao_social,
          input.officialData.nome_fantasia ?? undefined
        )
      : null,
    cityMatch:
      input.officialData?.cidade && input.city
        ? normalizeCity(input.city) === normalizeCity(input.officialData.cidade)
        : null,
    stateMatch:
      input.officialData?.uf && input.state
        ? input.state.toUpperCase() === input.officialData.uf.toUpperCase()
        : null,
    rootEligible: input.rootEligible,
    // D9: tri-state preenchido via cnae-mapping quando há officialData; null caso contrário
    cnaeCompatible: input.officialData
      ? cnaeCompatibilityFor(input.segment, input.officialData.cnae_principal ?? null)
      : null,
  };

  if (input.lookupOutcome === "not_found") {
    return {
      decision: "reject",
      reasons: ["cnpj_not_found"],
      score: 0,
      signals,
    };
  }

  if (signals.situacaoCadastral === "BAIXADA") {
    return {
      decision: "reject",
      reasons: ["cnpj_baixada"],
      score: 10,
      signals,
    };
  }

  if (signals.situacaoCadastral === "NULA") {
    return {
      decision: "reject",
      reasons: ["cnpj_nula"],
      score: 10,
      signals,
    };
  }

  // D10 — situação não-vazia ≠ ATIVA (ex.: SUSPENSA, INAPTA) → review genérico `situacao_nao_ativa`
  // (D8 — corrige a lacuna F33: INAPTA atravessava e podia aprovar; substitui o bloco SUSPENSA).
  if (
    input.lookupOutcome === "resolved" &&
    signals.situacaoCadastral !== null &&
    signals.situacaoCadastral.trim().toUpperCase() !== "ATIVA"
  ) {
    return {
      decision: "review",
      reasons: ["situacao_nao_ativa"],
      score: 30,
      signals,
    };
  }

  // D10 — situação vazia/ausente em resposta resolvida → defer `dados_oficiais_incompletos`
  // (nunca aprova, sem review ruidoso; distingue de BAIXADA/NULA já tratados acima).
  if (input.lookupOutcome === "resolved" && signals.situacaoCadastral === null) {
    return {
      decision: "defer",
      reasons: ["dados_oficiais_incompletos"],
      score: 0,
      signals,
    };
  }

  if (input.rootEligible === false) {
    return {
      decision: "reject",
      reasons: ["root_already_used"],
      score: 20,
      signals,
    };
  }

  if (input.lookupOutcome === "unavailable" || !input.officialData) {
    return {
      decision: "defer",
      reasons: ["api_unavailable"],
      score: 0,
      signals,
    };
  }

  if (signals.nameSimilarity !== null && signals.nameSimilarity < 0.6) {
    return {
      decision: "review",
      reasons: ["nome_divergente"],
      score: 40,
      signals,
    };
  }

  // D7 — cidade/UF preenchidas (pré-gate no caller; motor nunca recebe nulos):
  // preenchidas sem contrapartida oficial → review `localizacao_oficial_indisponivel`
  if (
    (input.city !== null && !input.officialData.cidade) ||
    (input.state !== null && !input.officialData.uf)
  ) {
    return {
      decision: "review",
      reasons: ["localizacao_oficial_indisponivel"],
      score: 40,
      signals,
    };
  }

  if (signals.cityMatch === false) {
    return {
      decision: "review",
      reasons: ["cidade_divergente"],
      score: 40,
      signals,
    };
  }

  if (signals.stateMatch === false) {
    return {
      decision: "review",
      reasons: ["uf_divergente"],
      score: 40,
      signals,
    };
  }

  // D9 — CNAE incompatível → review `segmento_cnae_divergente` (NUNCA reject); unknown → neutro
  if (signals.cnaeCompatible === "incompatible") {
    return {
      decision: "review",
      reasons: ["segmento_cnae_divergente"],
      score: 40,
      signals,
    };
  }

  let score = 50;
  if (signals.cnpjExists) score += 10;
  if (signals.rootEligible) score += 10;
  if (signals.nameSimilarity !== null && signals.nameSimilarity >= 0.6) score += 10;
  if (signals.cityMatch) score += 10;
  if (signals.stateMatch) score += 10;

  return {
    decision: "approved",
    reasons: [],
    score,
    signals,
  };
}
