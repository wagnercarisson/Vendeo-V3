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

export const SEGMENT_COLOR_FALLBACK: Record<string, string> = {
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

export function getDefaultBrandColor(segment: string): string {
  return SEGMENT_COLOR_FALLBACK[segment] ?? SEGMENT_COLOR_FALLBACK["outros"];
}

export function getStoreInitials(storeName: string): string {
  const words = storeName.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return storeName.trim().slice(0, 2).toUpperCase();
}
