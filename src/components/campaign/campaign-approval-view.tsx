"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface CampaignApprovalViewProps {
  campaignId: string;
  versionId: string;
  imageUrl: string;
  productName: string;
}

// F37.1 (D7/decisões 3/12): tela de revisão da candidata ativa. Revisão 100%
// focada na arte — nenhuma entrega/cópia textual é exibida antes da aprovação,
// sem histórico recuperável (apenas a candidata ativa é exibida). O botão de
// correção é ausente nesta fatia (correção é 37.2) e nenhuma janela de diálogo
// é utilizada.
export default function CampaignApprovalView({
  campaignId,
  versionId,
  imageUrl,
  productName,
}: CampaignApprovalViewProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            Ao aprovar, a campanha é liberada para publicação.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={handleApprove}
              disabled={isSubmitting}
              loading={isSubmitting}
              aria-label="Aprovar e liberar campanha"
              className="min-h-11"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isSubmitting ? "Aprovando..." : "Aprovar e liberar campanha"}
            </Button>
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
    </div>
  );
}
