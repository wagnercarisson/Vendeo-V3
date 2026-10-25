import { buildAiModelSelectionView } from "@/lib/ai/ai-model-selection-view";
import { buildVisualSignatureAdminConfigView } from "@/lib/visual-signature/admin-config-view";
import { AiModelSelectionForm } from "./form";
import { ProductOneToOneImageModelSection } from "./image-model-pair-section";

export const dynamic = "force-dynamic";

export default async function AdminAiModelSelectionPage() {
  const view = await buildAiModelSelectionView();
  const visualSignatureCapability = view.capabilities.find(
    (item) => item.capability === "visual_signature_image",
  );
  const visualSignatureConfigView = await buildVisualSignatureAdminConfigView();

  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-accent-blue">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-blue" />
          Operação de IA
        </div>
        <h1 className="font-heading text-2xl font-bold text-text-primary sm:text-3xl">Modelos de IA</h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Configure, em um único lugar, os modelos por capacidade e o par de imagem do fluxo
          Produto 1:1. Cada seção salva de forma independente, com auditoria e motivo obrigatório.
        </p>
      </header>

      <section aria-labelledby="other-capabilities-heading" className="space-y-4">
        <div>
          <h2 id="other-capabilities-heading" className="font-heading text-2xl font-bold text-text-primary sm:text-3xl">
            Demais capacidades
          </h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Seleção de modelos por capacidade, preservando os agrupamentos existentes. A Assinatura
            Visual tem configuração dedicada no grupo Imagem; as demais capacidades de imagem
            pertencem ao fluxo legado. O fluxo Produto 1:1 é configurado na seção seguinte.
          </p>
        </div>
        <AiModelSelectionForm
          view={view}
          visualSignatureConfigView={visualSignatureConfigView}
          inheritedVisualSignatureOrchestrator={
            visualSignatureCapability?.current.primary.model ?? "gpt-5.5"
          }
          inheritedVisualSignatureOrchestratorSource={visualSignatureCapability?.source ?? "default"}
        />
      </section>

      <ProductOneToOneImageModelSection />
    </div>
  );
}
