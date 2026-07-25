"use client";

import { RotateCcw } from "lucide-react";
import type { CampaignSpec } from "@/lib/campaign-intelligence/schema";
import type { CampaignAdjustments } from "./types";

interface CampaignAdjustmentsPanelProps {
  originalSpec: CampaignSpec;
  adjustments: CampaignAdjustments;
  onAdjustmentChange: (key: string, value: string) => void;
  onUndo: (key: string) => void;
}

function UndoButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Desfazer alteração"
      className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200"
    >
      <RotateCcw className="w-4 h-4" />
    </button>
  );
}

export function CampaignAdjustmentsPanel({
  originalSpec,
  adjustments,
  onAdjustmentChange,
  onUndo,
}: CampaignAdjustmentsPanelProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-6">
      <div>
        <h2 className="text-base font-heading font-semibold text-gray-900">
          Ajustes Rápidos
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Altere o conteúdo da campanha visualmente. As alterações são locais e
          não afetam o original.
        </p>
      </div>

      {/* Title Field */}
      <div>
        <label className="block text-gray-500 text-xs font-heading font-medium uppercase tracking-wider mb-2">
          Texto da Chamada
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={
              adjustments.title ?? originalSpec.commercial_copy.title
            }
            onChange={(e) => onAdjustmentChange("title", e.target.value)}
            maxLength={120}
            className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 focus:border-accent-blue"
          />
          {adjustments.title !== undefined && (
            <UndoButton onClick={() => onUndo("title")} />
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Original: &quot;{originalSpec.commercial_copy.title}&quot;
        </p>
      </div>

      {/* Discounted Price Field */}
      <div>
        <label className="block text-gray-500 text-xs font-heading font-medium uppercase tracking-wider mb-2">
          Preço com Desconto
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={
              adjustments.discountedPriceDisplay ??
              (originalSpec.offer.discounted_price_display ?? "")
            }
            onChange={(e) =>
              onAdjustmentChange("discountedPriceDisplay", e.target.value)
            }
            maxLength={120}
            className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 focus:border-accent-blue"
          />
          {adjustments.discountedPriceDisplay !== undefined && (
            <UndoButton onClick={() => onUndo("discountedPriceDisplay")} />
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1">
            Original: &quot;{originalSpec.offer.discounted_price_display ?? "não informado"}&quot;
        </p>
      </div>

      {/* Badge Text Field */}
      <div>
        <label className="block text-gray-500 text-xs font-heading font-medium uppercase tracking-wider mb-2">
          Texto do Badge
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={
              adjustments.badgeText ?? (originalSpec.offer.badge_text ?? "")
            }
            onChange={(e) =>
              onAdjustmentChange("badgeText", e.target.value)
            }
            maxLength={20}
            className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 focus:border-accent-blue"
          />
          {adjustments.badgeText !== undefined && (
            <UndoButton onClick={() => onUndo("badgeText")} />
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Original: &quot;{originalSpec.offer.badge_text}&quot;
        </p>
      </div>

      {/* Hook Field */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-gray-500 text-xs font-heading font-medium uppercase tracking-wider">
            Texto do Benefício
          </label>
          <span className="text-xs text-gray-400">
            {(adjustments.hook ?? originalSpec.commercial_copy.hook).length}/120
          </span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={adjustments.hook ?? originalSpec.commercial_copy.hook}
            onChange={(e) => onAdjustmentChange("hook", e.target.value)}
            maxLength={120}
            className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 focus:border-accent-blue"
          />
          {adjustments.hook !== undefined && (
            <UndoButton onClick={() => onUndo("hook")} />
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Original: &quot;{originalSpec.commercial_copy.hook}&quot;
        </p>
      </div>

      {/* CTA Field */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-gray-500 text-xs font-heading font-medium uppercase tracking-wider">
            Chamada para Ação
          </label>
          <span className="text-xs text-gray-400">
            {(adjustments.cta ?? originalSpec.commercial_copy.cta).length}/60
          </span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={adjustments.cta ?? originalSpec.commercial_copy.cta}
            onChange={(e) => onAdjustmentChange("cta", e.target.value)}
            maxLength={60}
            className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 focus:border-accent-blue"
          />
          {adjustments.cta !== undefined && (
            <UndoButton onClick={() => onUndo("cta")} />
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Original: &quot;{originalSpec.commercial_copy.cta}&quot;
        </p>
      </div>
    </div>
  );
}
