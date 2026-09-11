"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import CampaignProblemModal from "@/components/campaign/campaign-problem-modal";

interface CampaignApprovalViewProps {
  campaignId: string;
  versionId: string;
  imageUrl: string;
  productName: string;
  /** F37.2 (R1): exibe [Informar problema] quando a candidata é a v1 e ainda há oportunidade (sem consumo). */
  showProblemReport?: boolean;
}

// F37.2 (R1/R8): tela de revisão da candidata ativa com DOIS caminhos — [Aprovar
// arte] (primário, fluxo de aprovação protegida) e [Informar problema]
// (secundário, abre o modal de relato sem sair da página). Revisão 100% focada na
// arte — nenhuma entrega/cópia textual antes da aprovação; sem histórico
// recuperável (apenas a candidata ativa). Na v2 (sem oportunidade) apenas
// [Aprovar arte] é exibido.
//
// Proteções reais contra a corrida aprovar × consumir (não há guarda de UX neste
// componente): (a) o modal bloqueia interação/fechamento durante o processamento;
// (b) após o consumo a página deriva `regenerating` e renderiza `RegeneratingView`
// (esta view não é montada); (c) a garantia final é a RPC protegida no banco
// (`approve_campaign_candidate` valida `correction_in_progress=false` → 409).
export default function CampaignApprovalView({
  campaignId,
  versionId,
  imageUrl,
  productName,
  showProblemReport = false,
}: CampaignApprovalViewProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleApprove = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaign/${campaignId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Approval failed");
      }
      router.refresh();
    } catch {
      setError("Não foi possível aprovar. Tente novamente.");
      setIsSubmitting(false);
    }
  }, [campaignId, versionId, router]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-text-primary font-heading">
          Revise a arte
        </h2>
        <p className="text-sm text-text-muted font-body">
          Revise a arte antes de liberar: a IA pode cometer erros.
        </p>
      </div>

      <img
        src={imageUrl}
        alt={productName || "Candidata"}
        className="w-full rounded-xl shadow-md object-contain"
      />

      <Card>
        <div className="p-4">
          <p className="mb-4 text-sm text-text-muted font-body">
            Ao aprovar, a campanha é liberada para publicação. Se a arte tiver um
            defeito objetivo, informe o problema para uma correção.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={handleApprove}
              disabled={isSubmitting}
              loading={isSubmitting}
              aria-label="Aprovar arte"
              className="min-h-11"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isSubmitting ? "Aprovando..." : "Aprovar arte"}
            </Button>

            {showProblemReport && (
              <Button
                variant="secondary"
                size="md"
                onClick={() => setIsModalOpen(true)}
                disabled={isSubmitting}
                aria-label="Informar problema"
                className="min-h-11"
              >
                <MessageSquareWarning className="h-4 w-4" />
                Informar problema
              </Button>
            )}
          </div>

          {error && (
            <p
              className="mt-3 text-sm text-accent-red font-body"
              aria-live="polite"
            >
              {error}
            </p>
          )}
        </div>
      </Card>

      {isModalOpen && (
        <CampaignProblemModal
          campaignId={campaignId}
          candidateImageUrl={imageUrl}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
