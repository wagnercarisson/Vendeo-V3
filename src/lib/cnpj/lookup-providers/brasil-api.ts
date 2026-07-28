import type { CnpjLookupProvider, LookupResult, CnpjLookupData } from "./types";

const TIMEOUT_MS = 5000;
const MAX_RETRIES = 1;
const BASE_URL = "https://brasilapi.com.br/api/cnpj/v1";
const USER_AGENT = "Vendeo/1.0";

function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal, headers: { "User-Agent": USER_AGENT } }).finally(() => clearTimeout(timer));
}

function mapResponse(data: Record<string, unknown>, cnpj: string): CnpjLookupData {
  return {
    cnpj_normalized: cnpj,
    razao_social: (data.razao_social as string) || "",
    nome_fantasia: (data.nome_fantasia as string) || null,
    situacao_cadastral: (data.situacao_cadastral as string) || "",
    cep: (data.cep as string) || null,
    logradouro: (data.logradouro as string) || null,
    numero: (data.numero as string) || null,
    complemento: (data.complemento as string) || null,
    bairro: (data.bairro as string) || null,
    cidade: (data.cidade as string) || null,
    uf: (data.uf as string) || null,
    cnae_principal: (data.cnae_principal as string) || null,
    cnae_descricao: (data.cnae_descricao as string) || null,
    data_situacao: (data.data_situacao as string) || null,
    data_abertura: (data.data_abertura as string) || null,
    porte: (data.porte as string) || null,
  };
}

export class BrasilApiProvider implements CnpjLookupProvider {
  async lookup(cnpj: string): Promise<LookupResult> {
    const url = `${BASE_URL}/${cnpj}`;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetchWithTimeout(url, TIMEOUT_MS);

        if (response.status === 200) {
          const data: Record<string, unknown> = await response.json();
          if (!data || typeof data !== "object" || !data.razao_social) {
            return { status: "unavailable" };
          }
          return { status: "resolved", data: mapResponse(data, cnpj) };
        }

        if (response.status === 404) {
          return { status: "not_found" };
        }

        if (response.status === 429 || response.status >= 500) {
          console.error(`[BrasilApiProvider] HTTP ${response.status} for ${cnpj}`);
          if (attempt < MAX_RETRIES) continue;
          return { status: "unavailable" };
        }

        console.error(`[BrasilApiProvider] unexpected HTTP ${response.status} for ${cnpj}`);
        if (attempt < MAX_RETRIES) continue;
        return { status: "unavailable" };
      } catch (err) {
        console.error(`[BrasilApiProvider] attempt ${attempt + 1} failed:`, err instanceof Error ? err.message : String(err));
        if (attempt < MAX_RETRIES) continue;
        return { status: "unavailable" };
      }
    }

    return { status: "unavailable" };
  }
}
