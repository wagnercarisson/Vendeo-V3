export interface CnpjLookupProvider {
  lookup(cnpj: string): Promise<LookupResult>;
}

export type LookupResult =
  | { status: "resolved"; data: CnpjLookupData }
  | { status: "not_found" }
  | { status: "unavailable" };

export type CnpjLookupData = {
  cnpj_normalized: string;
  razao_social: string;
  nome_fantasia: string | null;
  situacao_cadastral: string;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cnae_principal: string | null;
  cnae_descricao: string | null;
  data_situacao: string | null;
  data_abertura: string | null;
  porte: string | null;
};

export type LookupOutcome =
  | { status: "resolved"; data: CnpjLookupData }
  | { status: "not_found" }
  | { status: "unavailable" };
