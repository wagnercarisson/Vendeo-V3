import { buildVisualSignatureModelConfigView } from "@/lib/ai/visual-signature-model-config-view";
import { VisualSignatureConfigForm } from "./visual-signature-form";

/**
 * F47.1 (D10) — seção "Assinatura Visual — direção e preset de imagem".
 *
 * Componente de servidor: lê o view model e delega ao formulário cliente. A
 * composição mantém Produto 1:1, seletor genérico e configuração dedicada
 * independentes.
 */
export const dynamic = "force-dynamic";

export async function VisualSignatureModelSection() {
  const view = await buildVisualSignatureModelConfigView();

  return (
    <section
      id="assinatura-visual-modelos"
      aria-labelledby="visual-signature-model-heading"
      className="scroll-mt-6 space-y-6 border-t border-border pt-8"
    >
      <header className="max-w-3xl">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-accent-blue">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-blue" />
          Operação de IA
        </div>
        <h2
          id="visual-signature-model-heading"
          className="font-heading text-2xl font-bold text-text-primary sm:text-3xl"
        >
          Assinatura Visual — direção e preset de imagem
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Escolha o orquestrador e o preset de imagem da Assinatura Visual. A configuração é
          dedicada, auditada e independente do Produto 1:1 e da seleção genérica.
        </p>
      </header>

      <VisualSignatureConfigForm view={view} />
    </section>
  );
}
