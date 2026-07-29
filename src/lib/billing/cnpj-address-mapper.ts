import type { CnpjLookupData } from "@/lib/cnpj/lookup-providers/types";
import type { StoreBillingInfo } from "@/lib/billing/store-billing-info";

export function getPreFillFromCnpj(
  cnpjData: CnpjLookupData,
): Partial<StoreBillingInfo> {
  const result: Partial<StoreBillingInfo> = {};

  if (cnpjData.logradouro) result.billing_address_street = cnpjData.logradouro;
  if (cnpjData.numero) result.billing_address_number = cnpjData.numero;
  if (cnpjData.complemento) result.billing_address_complement = cnpjData.complemento;
  if (cnpjData.bairro) result.billing_address_neighborhood = cnpjData.bairro;
  if (cnpjData.cidade) result.billing_address_city = cnpjData.cidade;
  if (cnpjData.uf) result.billing_address_state = cnpjData.uf;
  if (cnpjData.cep) result.billing_address_zipcode = cnpjData.cep;

  return result;
}
