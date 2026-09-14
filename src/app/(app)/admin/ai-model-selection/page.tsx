import { buildAiModelSelectionView } from "@/lib/ai/ai-model-selection-view";
import { AiModelSelectionForm } from "./form";

export const dynamic = "force-dynamic";

export default async function AdminAiModelSelectionPage() {
  const view = await buildAiModelSelectionView();

  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-accent-blue">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-blue" />
          Operação de IA
        </div>
        <h1 className="font-heading text-2xl font-bold text-text-primary sm:text-3xl">Modelos de IA</h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Escolha o modelo usado por capacidade. A tela mostra o alvo efetivamente resolvido,
          o default do sistema e qualquer configuração persistida que precise de atenção.
        </p>
      </header>
      <AiModelSelectionForm view={view} />
    </div>
  );
}
