import { describe, expect, it } from "vitest";

import {
  deriveGenerationUi,
  GENERATION_UI_MESSAGES,
} from "../generation-ui";

describe("F60.7 C2/C6 — mensagens da geração", () => {
  it("processamento normal: aguarde, sem ação", () => {
    expect(
      deriveGenerationUi({
        processing: {
          canContinue: true,
          stepInProgress: false,
          recovery: "auto",
        },
      }),
    ).toMatchObject({
      message: "A geração está em processamento. Aguarde.",
      action: "none",
    });
  });

  it("finalização automática: quase pronto, sem ação", () => {
    expect(
      deriveGenerationUi({
        processing: {
          canContinue: true,
          stepInProgress: false,
          partial: "finalization_pending",
          recovery: "auto",
        },
      }),
    ).toMatchObject({
      message: "Quase pronto!",
      action: "none",
    });
  });

  it("continuação manual: orientação e botão", () => {
    expect(
      deriveGenerationUi({
        processing: {
          canContinue: true,
          stepInProgress: false,
          continuationsExhausted: true,
          recovery: "manual",
        },
      }),
    ).toMatchObject({
      message: "Clique em ‘Continuar geração’ para concluir.",
      action: "continue",
    });
  });

  it("etapa em andamento: verificar novamente", () => {
    expect(
      deriveGenerationUi({
        processing: {
          canContinue: true,
          stepInProgress: true,
        },
      }),
    ).toMatchObject({
      message: GENERATION_UI_MESSAGES.stepInProgress,
      action: "verify",
    });
  });

  it("atualização indisponível: não é falha da campanha", () => {
    expect(
      deriveGenerationUi({
        processing: {
          canContinue: false,
          stepInProgress: false,
          partial: "unavailable",
        },
      }),
    ).toMatchObject({
      message: "Não foi possível atualizar o andamento.",
      action: "verify",
      tone: "warning",
    });
  });

  it("parcial indeterminado: consulta honesta", () => {
    expect(
      deriveGenerationUi({
        processing: {
          canContinue: false,
          stepInProgress: false,
          partial: "indeterminate",
        },
      }),
    ).toMatchObject({
      message: "Um formato ficou pronto, mas o outro ainda não foi confirmado.",
      action: "verify",
    });
  });

  it("finalização pendente sem ação permitida: consulta", () => {
    expect(
      deriveGenerationUi({
        processing: {
          canContinue: false,
          stepInProgress: false,
          partial: "finalization_pending",
          recovery: "manual",
        },
      }),
    ).toMatchObject({
      message: "A campanha ainda não foi finalizada.",
      action: "verify",
    });
  });

  it("finalização pendente com ação permitida: continuar", () => {
    expect(
      deriveGenerationUi({
        processing: {
          canContinue: true,
          stepInProgress: false,
          partial: "finalization_pending",
          recovery: "manual",
        },
      }),
    ).toMatchObject({
      message: "Clique em ‘Continuar geração’ para concluir.",
      action: "continue",
    });
  });

  it("envio inicial: mensagem única de processamento", () => {
    expect(deriveGenerationUi({ isSubmitting: true })).toMatchObject({
      message: "A geração está em processamento. Aguarde.",
      action: "none",
    });
  });
});
