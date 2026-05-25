export interface Store {
  id: string;
  name: string;
  segment: string;
  city: string | null;
  state: string | null;
  brand_color: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

const SEGMENT_COLOR_FALLBACK: Record<string, string> = {
  "moda-vestuario": "#F43F5E",
  "alimentacao-bebidas": "#DC2626",
  "beleza-estetica": "#D946EF",
  "saude-farmacia": "#10B981",
  "casa-decoracao": "#84CC16",
  "eletronicos-tecnologia": "#3B82F6",
  "petshop": "#F97316",
  "servicos": "#0EA5E9",
  "variedades": "#A855F7",
  "outros": "#22C55E",
};

export function resolveStoreIdentity(store: Pick<Store, "name" | "logo_url" | "segment" | "brand_color">) {
  const logo = store.logo_url ?? store.name;
  const color = store.brand_color ?? SEGMENT_COLOR_FALLBACK[store.segment] ?? SEGMENT_COLOR_FALLBACK["outros"];
  return { logo, color };
}
