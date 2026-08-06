/**
 * Copy de bloqueio das abas do onboarding (F36, D16) — texto curto de ação
 * ("o que falta") por aba/motivo.
 *
 * Módulo puro: sem runtime de UI, sem ambiente de servidor, sem imports de
 * side-effect. Usado no aviso `blockedNotice`, no tooltip/aria-label do CTA
 * desktop "Continuar para Direção Visual" e no microcopy visível do "Continuar"
 * mobile (onde não há hover confiável).
 */

import type { OnboardingTab, TabBlockReason } from "./tabs";

const TAB_LABEL: Record<OnboardingTab, string> = {
  dados: "Dados",
  posicionamento: "Posicionamento",
  "direcao-visual": "Direção Visual",
};

/**
 * Motivo específico de bloqueio por aba. `label` permite sobrepor o nome da
 * aba exibido (mobile usa `labelMobile`, ex.: "Visual").
 */
export function tabBlockReasonText(
  tab: OnboardingTab,
  reason: TabBlockReason | undefined,
  label?: string,
): string {
  const name = label ?? TAB_LABEL[tab];
  switch (reason) {
    case "needs_basic_data":
      return `Informe o nome e o segmento da loja para liberar ${name}.`;
    case "needs_legal_acceptance":
      return `Aceite os Termos de Uso e a Política de Uso Aceitável para liberar ${name}.`;
    case "needs_tone_of_voice":
      return `Defina o tom de voz para liberar ${name}.`;
    case "needs_store_created":
      return "Salve os dados básicos da loja para liberar esta etapa.";
    case "fiscal_pending":
      return "Cadastro fiscal pendente. A navegação está livre, mas a geração de campanhas é liberada após o CNPJ.";
    default:
      return `Complete esta etapa para liberar ${name}.`;
  }
}
