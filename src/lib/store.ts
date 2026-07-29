import type { LogoStatus } from '@/lib/visual-signature/types';

export interface Store {
  id: string;
  user_id: string;
  name: string;
  segment: string;
  city: string | null;
  state: string | null;
  brand_color: string | null;
  logo_url: string | null;
  subsegment: string | null;
  tone_of_voice: string | null;
  positioning: string | null;
  short_description: string | null;
  slogan: string | null;
  logo_status: LogoStatus | null;
  identity_state: string | null;
  text_only_origin: string | null;
  manual_color_override: boolean;
  previous_identity_snapshot: Record<string, unknown> | null;
  visual_signature_attempts: number;
  created_at: string;
  updated_at: string;
  cnpj_normalized: string | null;
  cnpj_root_hash: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj_validation_score: Record<string, unknown> | null;
  verification_status: string;
  verification_data: Record<string, unknown> | null;
  cnpj_official_data: Record<string, unknown> | null;
  cnpj_lookup_hash: string | null;
  verification_requested_at: string | null;
  verification_decided_at: string | null;
  verification_reasons: string[] | null;
  is_test_store: boolean;
}

export const SEGMENT_COLOR_FALLBACK: Record<string, string> = {
  "moda-calcados-acessorios": "#EC4899",
  "bebidas-adegas-conveniencia": "#DC2626",
  "padaria-confeitaria-doces": "#F59E0B",
  "beleza-estetica": "#D946EF",
  "petshop": "#F97316",
  "variedades-utilidades": "#A855F7",
  "mercados-mercearias": "#22C55E",
  "restaurantes-lanchonetes": "#EF4444",
  "farmacia-saude": "#10B981",
  "casa-decoracao": "#84CC16",
  "eletronicos-tecnologia": "#3B82F6",
  "servicos-locais": "#0EA5E9",
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
