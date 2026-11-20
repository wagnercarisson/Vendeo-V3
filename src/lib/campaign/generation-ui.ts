/**
 * F60.7 C2/C6 — mensagens e ações da tela de geração.
 *
 * Uma única mensagem principal por situação, em linguagem de lojista. Nenhum
 * termo interno (operação, cadeia, projeção, limite, inFlight, requestId) deve
 * aparecer aqui.
 */
export const GENERATION_UI_MESSAGES = {
  processing: "A geração está em processamento. Aguarde.",
  almostReady: "Quase pronto!",
  manualContinue: "Clique em ‘Continuar geração’ para concluir.",
  stepInProgress:
    "A geração está em processamento. Aguarde; se demorar, verifique novamente.",
  unavailable: "Não foi possível atualizar o andamento.",
  unknown: "Ainda não foi possível confirmar o resultado desta campanha.",
  partialPending:
    "Um formato ficou pronto, mas o outro ainda não foi confirmado.",
  finalizationPending: "A campanha ainda não foi finalizada.",
} as const;

export type GenerationUiAction = "none" | "verify" | "continue";

export interface GenerationUiProcessing {
  canContinue: boolean;
  stepInProgress: boolean;
  continuationsExhausted?: boolean;
  partial?: "indeterminate" | "finalization_pending" | "unavailable" | null;
  recovery?: "auto" | "manual";
}

export interface GenerationUiState {
  message: string;
  action: GenerationUiAction;
  tone: "neutral" | "warning";
  busy: boolean;
}

export function deriveGenerationUi(input: {
  isSubmitting?: boolean;
  processing?: GenerationUiProcessing | null;
}): GenerationUiState {
  if (input.isSubmitting) {
    return {
      message: GENERATION_UI_MESSAGES.processing,
      action: "none",
      tone: "neutral",
      busy: true,
    };
  }

  const processing = input.processing;
  if (!processing) {
    return {
      message: GENERATION_UI_MESSAGES.processing,
      action: "none",
      tone: "neutral",
      busy: false,
    };
  }

  if (processing.partial === "unavailable") {
    return {
      message: GENERATION_UI_MESSAGES.unavailable,
      action: "verify",
      tone: "warning",
      busy: false,
    };
  }

  if (processing.partial === "indeterminate") {
    return {
      message: GENERATION_UI_MESSAGES.partialPending,
      action: "verify",
      tone: "warning",
      busy: false,
    };
  }

  const manual =
    processing.recovery === "manual" ||
    processing.continuationsExhausted === true ||
    !processing.canContinue;

  if (processing.partial === "finalization_pending") {
    if (!manual) {
      return {
        message: GENERATION_UI_MESSAGES.almostReady,
        action: "none",
        tone: "neutral",
        busy: true,
      };
    }
    if (processing.canContinue && !processing.stepInProgress) {
      return {
        message: GENERATION_UI_MESSAGES.manualContinue,
        action: "continue",
        tone: "neutral",
        busy: false,
      };
    }
    return {
      message: GENERATION_UI_MESSAGES.finalizationPending,
      action: "verify",
      tone: "warning",
      busy: false,
    };
  }

  if (processing.stepInProgress) {
    return {
      message: GENERATION_UI_MESSAGES.stepInProgress,
      action: "verify",
      tone: "neutral",
      busy: false,
    };
  }

  if (manual) {
    if (processing.canContinue) {
      return {
        message: GENERATION_UI_MESSAGES.manualContinue,
        action: "continue",
        tone: "neutral",
        busy: false,
      };
    }
    return {
      message: GENERATION_UI_MESSAGES.stepInProgress,
      action: "verify",
      tone: "neutral",
      busy: false,
    };
  }

  return {
    message: GENERATION_UI_MESSAGES.processing,
    action: "none",
    tone: "neutral",
    busy: true,
  };
}
