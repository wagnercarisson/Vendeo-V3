export interface CnpjLookupProvider {
  /**
   * Declared, code-level capability. Defaults to `false` on every provider:
   * a 404 for an alphanumeric CNPJ is only conclusive (`not_found`) when the
   * provider explicitly guarantees support for the alphanumeric format.
   */
  readonly supportsAlphanumeric: boolean;
  lookup(cnpj: string): Promise<LookupResult>;
}

export type LookupResult =
  | { status: "resolved"; data: CnpjLookupData }
  | { status: "not_found" }
  | { status: "unsupported_format" }
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
  | { status: "unsupported_format" }
  | { status: "unavailable" };
