"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * F56.2b1b (UI-SPEC §Surface 3 / §Copywriting, B1B-D5/D7 / REQ-56.2.2-06/-07) —
 * Superfície 3: RESULTADO DESCONHECIDO. É ÂMBAR (atenção/incerteza) e NUNCA
 * vermelho (vermelho = falha confirmada). NÃO oferece ação de regeneração para
 * esta operação: a única ação de reenvio é "Verificar novamente" (SOMENTE
 * consulta — a rota
 * `/api/campaign/generation-status` é query-only e não inicia tentativa, geração
 * ou cobrança). Nunca promete continuidade/retomada.
 *
 * A referência de suporte é OPACA (`IMG-001` + referência) — nunca revela a
 * causa interna.
 *
 * F56.2b1b (Plano 06 — correção) — "Verificar novamente" CONSOME o estado
 * devolvido pela consulta: `delivered` ⇒ navega para a campanha; `refunded` ⇒
 * exibe o terminal PERSISTIDO (falha + crédito devolvido) e notifica o pai
 * (`onResolved`) para limpar/atualizar o estado — o usuário nunca fica preso na
 * Superfície 3; pendente (`reserved`/`art_uploaded`) ou desconhecido ⇒ mantém o
 * painel; resposta HTTP NÃO-OK ⇒ feedback seguro (sem terminal falso). NUNCA
 * inicia geração/ cobrança.
 */

export type UnknownResolution = "delivered" | "refunded";

interface UnknownResultPanelProps {
  /** Referência opaca de suporte (`IMG-001 ...`) — exibida em JetBrains Mono. */
  supportReference?: string | null;
  /** E-mail de suporte do ambiente (`SUPPORT_EMAIL`) para o mailto. */
  supportEmail?: string;
  /** Identidade da operação para a consulta query-only. */
  campaignId?: string | null;
  operationId?: string | null;
  /**
   * F56.2b1b (Plano 06 — correção): notifica o PAI da resolução consumida do
   * `generation-status`. Em `refunded` o pai DEVE limpar/atualizar o estado
   * (`unknownResult`) para não prender o usuário; em `delivered` a navegação já
   * leva à página da campanha.
   */
  onResolved?: (outcome: UnknownResolution) => void;
}

export function UnknownResultPanel({
  supportReference,
  supportEmail,
  campaignId,
  operationId,
  onResolved,
}: UnknownResultPanelProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recheckMessage, setRecheckMessage] = useState<string | null>(null);

  const canQueryOperation = Boolean(campaignId && operationId);

  const handleRecheck = async () => {
    setRecheckMessage(null);
    if (!canQueryOperation) {
      // Sem identidade: re-deriva o estado persistido (nunca inicia geração).
      router.refresh();
      return;
    }
    setChecking(true);
    try {
      const res = await fetch("/api/campaign/generation-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, operationId }),
      });
      // F56.2b1b (correção) — HTTP NÃO-OK ⇒ feedback SEGURO: nunca um terminal
      // falso. Mantém o painel na Superfície 3.
      if (!res.ok) {
        setRecheckMessage("Não foi possível verificar agora. Tente novamente.");
        return;
      }
      const data = await res.json().catch(() => null);
      // Consome o estado PERSISTIDO devolvido pela consulta. Nunca inicia
      // tentativa/geração/cobrança.
      const state = data?.operation?.state;
      if (state === "delivered") {
        onResolved?.("delivered");
        router.push(`/campanhas/${campaignId}`);
        return;
      }
      if (state === "refunded") {
        // Recorte 2 (Plano 09): terminal de estorno CONFIRMADO ⇒ DETALHE, que
        // reutiliza o `RefundedPanel` — SEM segunda superfície equivalente aqui.
        onResolved?.("refunded");
        router.push(`/campanhas/${campaignId}`);
        return;
      }
      // Pendente (`reserved`/`art_uploaded`) ou desconhecido ⇒ mantém o painel.
      router.refresh();
    } catch {
      setRecheckMessage("Não foi possível verificar agora. Tente novamente.");
    } finally {
      setChecking(false);
    }
  };

  /**
   * Recorte 2 (Plano 09 / CR-02) — AÇÃO EXPLÍCITA e autenticada do usuário para
   * RECUPERAR a arte íntegra já existente (sem regenerar). Faz POST na rota
   * dedicada (ownership/autorização no servidor) e, em `delivered`, navega à
   * campanha; caso contrário, apenas reconsulta (`router.refresh`, query-only).
   */
  const handleRecoverImage = async () => {
    setRecheckMessage(null);
    if (!canQueryOperation) return;
    setRecovering(true);
    try {
      const res = await fetch(`/api/campaign/${campaignId}/image-recovery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationId }),
      });
      if (!res.ok) {
        setRecheckMessage("Não foi possível recuperar a imagem agora. Tente novamente.");
        return;
      }
      const data = await res.json().catch(() => null);
      if (data?.recovery?.outcome === "delivered") {
        onResolved?.("delivered");
        router.push(`/campanhas/${campaignId}`);
        return;
      }
      router.refresh();
    } catch {
      setRecheckMessage("Não foi possível recuperar a imagem agora. Tente novamente.");
    } finally {
      setRecovering(false);
    }
  };

  return (
    <div
      role="alert"
      className="w-full rounded-lg border border-accent-amber/30 bg-accent-amber/10 px-4 py-4"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="h-5 w-5 text-accent-amber shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="flex-1 space-y-3">
          <div className="space-y-1">
            <p className="font-heading text-sm font-semibold text-accent-amber">
              Não foi possível confirmar a conclusão desta geração
            </p>
            <p className="text-xs text-accent-amber/90 font-body">
              Você pode verificar novamente ou falar com o suporte. Verificar novamente não inicia outra geração nem cobra outro crédito.
            </p>
          </div>

          {supportReference && (
            <p className="font-mono text-xs text-text-secondary break-all">
              Referência de suporte: {supportReference}
            </p>
          )}

          {recheckMessage && (
            <p className="text-xs text-accent-red font-body">{recheckMessage}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRecheck}
              loading={checking}
              disabled={checking || recovering}
            >
              Verificar novamente
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRecoverImage}
              loading={recovering}
              disabled={recovering || checking}
            >
              Recuperar imagem salva
            </Button>
            {supportEmail && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  window.location.href = `mailto:${supportEmail}`;
                }}
              >
                Falar com o suporte
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
