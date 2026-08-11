import { Badge } from "@/components/ui/badge";
import type { CostBadge as CostBadgeType } from "@/lib/ai-cost/operation-runs-service";

export const COST_BADGE_LABELS: Record<CostBadgeType, string> = {
  provider_reported: "Custo reportado pelo provider",
  "provisional image tool estimate": "Estimativa provisória de ferramenta de imagem",
  partial: "Estimativa parcial",
  estimated: "Estimado",
  not_available: "Custo não disponível",
};

/** Badge de confiança do custo (D5) — exibido junto de cada valor. */
export function CostBadge({ badge }: { badge: CostBadgeType }) {
  return (
    <Badge variant="default" data-badge={badge} data-testid={`cost-badge-${badge}`}>
      {COST_BADGE_LABELS[badge]}
    </Badge>
  );
}

/**
 * Legend fixa (D5): estimativas operacionais, NÃO custo financeiro
 * reconciliado — combate a interpretação de "verdade financeira".
 */
export function CostBadgeLegend() {
  return (
    <p className="text-xs text-muted-foreground">
      Estimativas operacionais — não custo financeiro reconciliado.
    </p>
  );
}
