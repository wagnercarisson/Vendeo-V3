"use client";

import { AlertTriangle } from "lucide-react";
import type { ImageModelPairConfigView } from "@/lib/ai/image-model-pair-config-view";

/**
 * Aviso permanente (região B) de que a configuração NÃO está ativa em produção
 * (D-23 / T-56.1-32). Não-dismissível e presente em todos os estados da tela.
 */
export function ImageModelPairInactiveBanner() {
  return (
    <div className="rounded-xl border border-accent-amber/20 bg-accent-amber/5 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent-amber" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-heading text-sm font-semibold text-accent-amber">
            Esta configuração NÃO está ativa em produção.
          </p>
          <p className="text-sm text-text-secondary">
            Ela prepara o novo fluxo de imagem Produto 1:1. Nenhuma campanha usa estes modelos e o fluxo
            atual permanece inalterado.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Placeholder da região E — implementação completa na Task 2. */
export function ImageModelPairConfigForm({ view }: { view: ImageModelPairConfigView }) {
  return (
    <section aria-labelledby="pair-config-form-heading" className="space-y-4" data-eligible-models={view.eligibleModels.length}>
      <h2 id="pair-config-form-heading" className="font-heading text-lg font-semibold text-text-primary">
        Configuração do par
      </h2>
    </section>
  );
}
