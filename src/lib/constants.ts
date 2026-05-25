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
