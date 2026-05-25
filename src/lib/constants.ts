export const VALID_SEGMENTS = [
  "moda-vestuario",
  "alimentacao-bebidas",
  "beleza-estetica",
  "saude-farmacia",
  "casa-decoracao",
  "eletronicos-tecnologia",
  "petshop",
  "servicos",
  "variedades",
  "outros",
] as const;

export type Segment = (typeof VALID_SEGMENTS)[number];

export const SEGMENT_LABELS: Record<Segment, string> = {
  "moda-vestuario": "Moda e Vestuário",
  "alimentacao-bebidas": "Alimentação e Bebidas",
  "beleza-estetica": "Beleza e Estética",
  "saude-farmacia": "Saúde e Farmácia",
  "casa-decoracao": "Casa e Decoração",
  "eletronicos-tecnologia": "Eletrônicos e Tecnologia",
  "petshop": "Pet Shop",
  "servicos": "Serviços",
  "variedades": "Variedades",
  "outros": "Outros",
};

export const BRAZILIAN_STATES = [
  { value: "AC", label: "Acre" },
  { value: "AL", label: "Alagoas" },
  { value: "AP", label: "Amapá" },
  { value: "AM", label: "Amazonas" },
  { value: "BA", label: "Bahia" },
  { value: "CE", label: "Ceará" },
  { value: "DF", label: "Distrito Federal" },
  { value: "ES", label: "Espírito Santo" },
  { value: "GO", label: "Goiás" },
  { value: "MA", label: "Maranhão" },
  { value: "MT", label: "Mato Grosso" },
  { value: "MS", label: "Mato Grosso do Sul" },
  { value: "MG", label: "Minas Gerais" },
  { value: "PA", label: "Pará" },
  { value: "PB", label: "Paraíba" },
  { value: "PR", label: "Paraná" },
  { value: "PE", label: "Pernambuco" },
  { value: "PI", label: "Piauí" },
  { value: "RJ", label: "Rio de Janeiro" },
  { value: "RN", label: "Rio Grande do Norte" },
  { value: "RS", label: "Rio Grande do Sul" },
  { value: "RO", label: "Rondônia" },
  { value: "RR", label: "Roraima" },
  { value: "SC", label: "Santa Catarina" },
  { value: "SP", label: "São Paulo" },
  { value: "SE", label: "Sergipe" },
  { value: "TO", label: "Tocantins" },
] as const;

export const BADGE_OPTIONS = [
  "Oferta",
  "Promoção",
  "Queima de Estoque",
  "Novidade",
  "Últimas Unidades",
] as const;

export type BadgeOption = (typeof BADGE_OPTIONS)[number];
