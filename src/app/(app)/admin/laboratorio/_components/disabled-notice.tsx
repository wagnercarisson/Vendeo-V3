import { ShieldAlert } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { LabEnvironmentReason } from "@/lib/lab/environment-guard";

/**
 * Estado de ambiente desabilitado do laboratório (F48.1, D2/D12, T-48-1-69).
 *
 * A guarda de ambiente (`getLabEnvironment()`) é avaliada **antes** de qualquer
 * leitura de `lab_*`, do storage do laboratório ou do catálogo. Quando ela recusa,
 * as páginas renderizam apenas este aviso: nenhuma consulta é feita e nenhum
 * provider é tocado. O `reason` é sempre exibido de forma legível — nunca a URL
 * do projeto, path, query ou chave (D15).
 *
 * Componente de servidor: não usa estado, efeitos nem APIs do navegador.
 */

/** Título único do estado desabilitado (contrato de copy da fase). */
export const LAB_DISABLED_TITLE = "Laboratório desabilitado neste ambiente";

/** Aviso que explicita a ausência de acesso a dados/providers. */
export const LAB_DISABLED_NOTE =
  "Nenhuma tabela lab_*, storage do laboratório ou provider de IA foi acessado.";

/** Motivo legível por `reason` da guarda. `ok` nunca chega aqui. */
export const LAB_REASON_LABELS: Record<LabEnvironmentReason, string> = {
  ok: "—",
  disabled_flag: "A flag VENDEO_LAB_ENABLED não está ativa",
  missing_url: "NEXT_PUBLIC_SUPABASE_URL ausente ou inválida",
  non_local_supabase: "O Supabase apontado não é local nem está na allowlist",
  remote_blocked: "Host de produção bloqueado pelo laboratório",
};

export function DisabledNotice({ reason }: { reason: LabEnvironmentReason }) {
  return (
    <div className="flex justify-center py-12">
      <Card className="w-full max-w-xl p-6">
        <div className="flex items-start gap-4">
          <ShieldAlert
            className="mt-0.5 h-6 w-6 shrink-0 text-accent-amber"
            aria-hidden="true"
          />
          <div className="space-y-2">
            <h1 className="font-heading text-lg font-semibold text-text-primary">
              {LAB_DISABLED_TITLE}
            </h1>
            <p className="text-sm text-text-secondary font-body">
              Motivo:{" "}
              <span className="font-mono text-xs text-accent-amber">{reason}</span>
            </p>
            <p className="text-sm text-text-secondary font-body">
              {LAB_REASON_LABELS[reason]}
            </p>
            <p className="text-xs text-text-muted font-body">{LAB_DISABLED_NOTE}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
