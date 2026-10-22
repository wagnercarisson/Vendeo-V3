import { buildAiModelSelectionView } from "@/lib/ai/ai-model-selection-view";
import { AiModelSelectionForm } from "./form";
import { ProductOneToOneImageModelSection } from "./image-model-pair-section";
import { VisualSignatureModelSection } from "./visual-signature-section";

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
          Configure os fluxos em ordem: Produto 1:1, Assinatura Visual, capacidades compartilhadas de
          texto/visão e geração de campanhas legada. Cada seção salva de forma independente, com
          auditoria e motivo obrigatório.
        </p>
      </header>

      {/* 1. Produto 1:1 — componente existente, intocado. */}
      <ProductOneToOneImageModelSection />

      {/* 2. Assinatura Visual — direção + preset dedicados. */}
      <VisualSignatureModelSection />

      {/* 3. Capacidades compartilhadas — texto/visão em uso. */}
      <section
        aria-labelledby="shared-capabilities-heading"
        className="space-y-4 border-t border-border pt-8"
      >
        <div>
          <h2
            id="shared-capabilities-heading"
            className="font-heading text-2xl font-bold text-text-primary sm:text-3xl"
          >
            Capacidades compartilhadas — texto/visão em uso
          </h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Seleção das capacidades compartilhadas de texto e visão. Elas continuam editáveis e em uso;
            a Assinatura Visual é configurada no card dedicado acima.
          </p>
        </div>
        <AiModelSelectionForm view={view} mode="shared" />
      </section>

      {/* 4. Geração de campanhas — legado. */}
      <section
        aria-labelledby="legacy-campaign-heading"
        className="space-y-4 border-t border-border pt-8"
      >
        <div>
          <h2
            id="legacy-campaign-heading"
            className="font-heading text-2xl font-bold text-text-primary sm:text-3xl"
          >
            Geração de campanhas — legado
          </h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Capacidades legadas de imagem de campanha (<code className="font-mono text-xs">campaign_image</code>{" "}
            e <code className="font-mono text-xs">campaign_image_edit</code>). O comportamento existente
            permanece preservado.
          </p>
        </div>
        <AiModelSelectionForm view={view} mode="legacy" />
      </section>
    </div>
  );
}
