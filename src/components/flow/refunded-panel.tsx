"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, LifeBuoy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CampaignFormRestore } from "@/lib/campaign/display";

/**
 * F56.2b2b (B2.2 / B2B-D5 / B2B-D9 / C4 — UI-SPEC §Surface "Falha confirmada com
 * estorno" + §Copywriting) — painel do estado `refunded` persistido.
 *
 * Regras DURAS (contrato aprovado):
 * - A mensagem EXATA (`EXACT_MESSAGE`) só aparece quando o estorno está
 *   PERSISTIDO e CONFIRMADO (`confirmed === true`) — nunca em
 *   `reserved`/`art_uploaded`/`delivered`/desconhecido.
 * - Sem confirmação (`confirmed !== true`): feedback HONESTO (âmbar), SEM anunciar
 *   crédito devolvido (`UNCONFIRMED_MESSAGE`) e apenas re-verificação query-only.
 * - A CTA `Gerar novamente com meus dados` navega para
 *   `/campanhas/nova?restoreFrom=<campaignId>` — é uma NOVA geração (cobrança
 *   normal), NUNCA a reabertura da operação estornada.
 * - A nota de escopo (`SCOPE_NOTE`) só é exibida quando o snapshot server-side foi
 *   resolvido (`restoredForm !== null`): não prometemos preservação de dados sem
 *   a leitura confirmada. A imagem (client-only) NUNCA é prometida.
 * - SEM import `product-1-1` (G-NA): estado/snapshot por props ESTRUTURAIS.
 * - Dark OLED, sem emoji, alvos ≥44px, `motion-safe:`/`motion-reduce:`.
 */

export const REFUNDED_EXACT_MESSAGE =
  "Não conseguimos concluir a comunicação desta geração. Seus dados foram preservados e o crédito foi estornado. Você pode gerar novamente.";
export const REFUNDED_SCOPE_NOTE =
  "Seus dados preenchidos foram mantidos. A imagem do produto pode precisar ser adicionada novamente.";
export const REFUNDED_NEW_GENERATION_NOTICE =
  "Esta é uma nova geração e será cobrada normalmente.";
export const REFUNDED_SUPPORT_CTA = "Falar com o suporte";
export const REFUNDED_UNCONFIRMED_MESSAGE =
  "Não foi possível confirmar o estorno agora. Tente novamente em instantes.";
export const REFUNDED_ACTION_ERROR_MESSAGE =
  "Não foi possível abrir o formulário agora. Tente de novo em instantes.";

interface RefundedPanelProps {
  /** Identidade da campanha estornada — vira a origem `restoreFrom` da CTA. */
  campaignId: string;
  /** E-mail de suporte do ambiente (`SUPPORT_EMAIL`) para o mailto. */
  supportEmail?: string;
  /**
   * `true` SOMENTE com o estorno PERSISTIDO/CONFIRMADO. Ausente ⇒ `false`
   * (fail-closed: amber honesto, sem anunciar crédito).
   */
  confirmed?: boolean;
  /**
   * Snapshot ESTRUTURAL resolvido SERVER-SIDE (C4 / B2B-D9). `null`/ausente ⇒
   * sem promessa de preservação de dados (a nota de escopo é omitida).
   */
  restoredForm?: CampaignFormRestore | null;
  /** Erro de rede/validação ao acionar a nova geração (`accent-red`). */
  actionError?: string | null;
}

export function RefundedPanel({
  campaignId,
  supportEmail,
  confirmed = false,
  restoredForm = null,
  actionError = null,
}: RefundedPanelProps) {
  const router = useRouter();

  // Estorno NÃO confirmado: amber honesto — SEM anunciar crédito devolvido.
  if (!confirmed) {
    return (
      <div
        role="alert"
        className="w-full rounded-lg border border-accent-amber/30 bg-accent-amber/10 px-4 py-4 motion-safe:transition-colors motion-reduce:transition-none"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="h-5 w-5 text-accent-amber shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="flex-1 space-y-3">
            <p className="text-sm text-accent-amber font-body">
              {REFUNDED_UNCONFIRMED_MESSAGE}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.refresh()}
            >
              Verificar novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 motion-safe:transition-opacity motion-reduce:transition-none">
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
            <p className="text-base text-text-primary font-body">
              {REFUNDED_EXACT_MESSAGE}
            </p>
            {restoredForm !== null && (
              <p className="text-sm text-text-secondary font-body">
                {REFUNDED_SCOPE_NOTE}
              </p>
            )}
            <p className="text-sm text-text-secondary font-body">
              {REFUNDED_NEW_GENERATION_NOTICE}
            </p>
          </div>
        </div>
      </div>

      {actionError && (
        <p role="alert" className="text-sm text-accent-red font-body">
          {actionError}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="md"
          onClick={() =>
            router.push(`/campanhas/nova?restoreFrom=${campaignId}`)
          }
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Gerar novamente com meus dados
        </Button>
        {supportEmail && (
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              window.location.href = `mailto:${supportEmail}`;
            }}
          >
            <LifeBuoy className="h-4 w-4" aria-hidden="true" />
            {REFUNDED_SUPPORT_CTA}
          </Button>
        )}
      </div>
    </div>
  );
}
