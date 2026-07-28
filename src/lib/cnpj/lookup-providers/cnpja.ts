import type { CnpjLookupProvider, LookupResult, CnpjLookupData } from "./types";

const TIMEOUT_MS = 5000;
const MAX_RETRIES = 1;
const BASE_URL = "https://open.cnpja.com/office";
const USER_AGENT = "Vendeo/1.0";

function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal, headers: { "User-Agent": USER_AGENT } }).finally(() => clearTimeout(timer));
}

function mapResponse(data: Record<string, unknown>, cnpj: string): CnpjLookupData {
  const company = data.company as Record<string, unknown> | undefined;
  const address = data.address as Record<string, unknown> | undefined;
  const registration = data.registration as Record<string, unknown> | undefined;
  const status = data.status as Record<string, unknown> | undefined;
  const mainActivity = (data.main_activity as Record<string, unknown>) || (data.mainActivity as Record<string, unknown>) || null;

  return {
    cnpj_normalized: cnpj,
    razao_social: (data.name as string) || (company?.name as string) || "",
    nome_fantasia: (data.alias as string) || null,
    situacao_cadastral: (status?.text as string) || (data.status_text as string) || "",
    cep: (address?.zip as string) || null,
    logradouro: (address?.street as string) || null,
    numero: (address?.number as string) || null,
    complemento: (address?.details as string) || null,
    bairro: (address?.district as string) || null,
    cidade: (address?.city as string) || null,
    uf: (address?.state as string) || null,
    cnae_principal: (mainActivity?.code as string) || (mainActivity?.id as string) || null,
    cnae_descricao: (mainActivity?.text as string) || null,
    data_situacao: (status?.since as string) || (status?.date as string) || null,
    data_abertura: (registration?.date as string) || (data.founded as string) || null,
    porte: (data.size as string) || null,
  };
}

export class CnpjaProvider implements CnpjLookupProvider {
  async lookup(cnpj: string): Promise<LookupResult> {
    const url = `${BASE_URL}/${cnpj}`;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetchWithTimeout(url, TIMEOUT_MS);

        if (response.status === 200) {
          const data: Record<string, unknown> = await response.json();
          if (!data || typeof data !== "object") {
            return { status: "unavailable" };
          }
          return { status: "resolved", data: mapResponse(data, cnpj) };
        }

        if (response.status === 404) {
          return { status: "not_found" };
        }

        if (response.status === 429 || response.status >= 500) {
          console.error(`[CnpjaProvider] HTTP ${response.status} for ${cnpj}`);
          if (attempt < MAX_RETRIES) continue;
          return { status: "unavailable" };
        }

        console.error(`[CnpjaProvider] unexpected HTTP ${response.status} for ${cnpj}`);
        if (attempt < MAX_RETRIES) continue;
        return { status: "unavailable" };
      } catch (err) {
        console.error(`[CnpjaProvider] attempt ${attempt + 1} failed:`, err instanceof Error ? err.message : String(err));
        if (attempt < MAX_RETRIES) continue;
        return { status: "unavailable" };
      }
    }

    return { status: "unavailable" };
  }
}
