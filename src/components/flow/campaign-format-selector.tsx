"use client";

import { useState } from "react";

import type { CampaignFormatValue } from "./use-campaign-form";

const SQUARE_LABEL = "Quadrado 1:1 - feed";
const VERTICAL_LABEL = "Vertical 9:16 - Stories e Reels (imagem estática)";

export const CAMPAIGN_FORMAT_HELPER =
  "Imagem estática, sem vídeo. As áreas seguras seguem a política do Vendeo e podem variar conforme a plataforma.";

export const CAMPAIGN_FORMAT_JOINT_HELPER =
  "Dois formatos usam dois créditos: o quadrado para o feed e o vertical para Stories/Reels.";

export const CAMPAIGN_FORMAT_VERTICAL_DISABLED_HELPER =
  "O formato Vertical 9:16 está temporariamente indisponível. O formato 1:1 continua disponível.";

export const CAMPAIGN_FORMAT_JOINT_DISABLED_HELPER =
  "Os dois formatos estão temporariamente indisponíveis. Você pode manter o formato já escolhido ou usar o 1:1.";

export const CAMPAIGN_FORMAT_REQUIRES_ONE =
  "Selecione ao menos um formato para continuar.";

interface CampaignFormatSelectorProps {
  value: CampaignFormatValue;
  onChange: (format: CampaignFormatValue) => void;
  disabled?: boolean;
  /**
   * Quando `false`, o seletor permanece visível, mas o 9:16 fica desabilitado.
   * Evita que o controle “desapareça” quando a flag está OFF.
   */
  verticalEnabled?: boolean;
}

/**
 * F59/D-03 / F60.7 C2 — seletor de formato do fluxo NOVO.
 *
 * Dois checkboxes nativos derivam o `CampaignFormatValue`:
 * - somente quadrado ⇒ `1:1`
 * - somente vertical ⇒ `9:16`
 * - ambos ⇒ `1:1+9:16`
 *
 * Pelo menos um formato permanece marcado: a tentativa de desmarcar o último
 * NÃO chama `onChange` e exibe um aviso acessível.
 */
export function CampaignFormatSelector({
  value,
  onChange,
  disabled = false,
  verticalEnabled = true,
}: CampaignFormatSelectorProps) {
  const [requiresOneWarning, setRequiresOneWarning] = useState(false);
  const squareChecked = value === "1:1" || value === "1:1+9:16";
  const verticalChecked = value === "9:16" || value === "1:1+9:16";
  const verticalUnavailable = !verticalEnabled && !disabled;

  const select = (next: CampaignFormatValue) => {
    setRequiresOneWarning(false);
    onChange(next);
  };

  const handleSquareChange = (checked: boolean) => {
    if (checked) {
      select(verticalChecked ? "1:1+9:16" : "1:1");
      return;
    }
    if (verticalChecked) {
      select("9:16");
      return;
    }
    setRequiresOneWarning(true);
  };

  const handleVerticalChange = (checked: boolean) => {
    if (checked) {
      select(squareChecked ? "1:1+9:16" : "9:16");
      return;
    }
    if (squareChecked) {
      select("1:1");
      return;
    }
    setRequiresOneWarning(true);
  };

  const squareDisabled = disabled;
  const verticalDisabled = disabled || !verticalEnabled;

  return (
    <section
      data-testid="flow-campaign-format-selector"
      aria-labelledby="campaignFormat-heading"
      className="space-y-2"
    >
      <h2
        id="campaignFormat-heading"
        className="text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2"
      >
        Formato da campanha
      </h2>
      <fieldset className="space-y-2">
        <legend className="sr-only">Selecione o formato da campanha</legend>
        <div className="space-y-2">
          <label
            className={`flex min-h-[44px] items-start gap-3 rounded-lg border p-3 transition-colors focus-within:ring-2 focus-within:ring-accent-blue/40 ${
              squareChecked
                ? "border-accent-green bg-accent-green/5"
                : "border-border-light hover:border-text-muted"
            } ${squareDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
          >
            <input
              type="checkbox"
              name="campaignFormatSquare"
              value="1:1"
              checked={squareChecked}
              onChange={(event) => handleSquareChange(event.target.checked)}
              disabled={squareDisabled}
              aria-describedby="campaignFormat-helper"
              className="mt-0.5 h-4 w-4 accent-accent-green"
            />
            <span className="min-w-0 flex-1 break-words text-sm font-body text-text-primary">
              {SQUARE_LABEL}
            </span>
          </label>

          <label
            className={`flex min-h-[44px] items-start gap-3 rounded-lg border p-3 transition-colors focus-within:ring-2 focus-within:ring-accent-blue/40 ${
              verticalChecked
                ? "border-accent-green bg-accent-green/5"
                : "border-border-light hover:border-text-muted"
            } ${verticalDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
          >
            <input
              type="checkbox"
              name="campaignFormatVertical"
              value="9:16"
              checked={verticalChecked}
              onChange={(event) => handleVerticalChange(event.target.checked)}
              disabled={verticalDisabled}
              aria-describedby={
                verticalUnavailable
                  ? "campaignFormat-helper campaignFormat-vertical-disabled"
                  : "campaignFormat-helper"
              }
              className="mt-0.5 h-4 w-4 accent-accent-green"
            />
            <span className="min-w-0 flex-1 break-words text-sm font-body text-text-primary">
              {VERTICAL_LABEL}
            </span>
          </label>
        </div>
        <p
          id="campaignFormat-helper"
          className="text-xs font-body text-text-secondary"
        >
          {CAMPAIGN_FORMAT_HELPER}
        </p>
        {squareChecked && verticalChecked && (
          <p
            data-testid="flow-campaign-format-joint-helper"
            className="text-xs font-body text-text-secondary"
          >
            {CAMPAIGN_FORMAT_JOINT_HELPER}
          </p>
        )}
        {requiresOneWarning && (
          <p
            role="status"
            data-testid="flow-campaign-format-requires-one"
            className="text-xs font-body text-accent-red"
          >
            {CAMPAIGN_FORMAT_REQUIRES_ONE}
          </p>
        )}
        {verticalUnavailable && (
          <p
            id="campaignFormat-vertical-disabled"
            role="status"
            data-testid="flow-campaign-format-vertical-disabled"
            className="text-xs font-body text-amber-800"
          >
            {CAMPAIGN_FORMAT_VERTICAL_DISABLED_HELPER}
          </p>
        )}
      </fieldset>
    </section>
  );
}

/**
 * F60.7 C2/C6 — resumo NÃO editável dos formatos escolhidos durante a geração.
 * Mantém os mesmos labels e a semântica de checkbox, mas não oferece ação,
 * foco de edição nem os helpers/avisos exclusivos da seleção.
 */
export function CampaignFormatSummary({
  value,
}: {
  value: CampaignFormatValue;
}) {
  const squareChecked = value === "1:1" || value === "1:1+9:16";
  const verticalChecked = value === "9:16" || value === "1:1+9:16";

  const rowClass = (checked: boolean) =>
    `flex min-h-[44px] cursor-default items-start gap-3 rounded-lg border p-3 ${
      checked
        ? "border-accent-green bg-accent-green/5"
        : "border-border-light"
    }`;

  return (
    <section
      data-testid="flow-campaign-format-summary"
      aria-labelledby="campaignFormat-summary-heading"
      className="space-y-2"
    >
      <h2
        id="campaignFormat-summary-heading"
        className="text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2"
      >
        Formato da campanha
      </h2>
      <fieldset className="space-y-2">
        <legend className="sr-only">Formatos escolhidos para a campanha</legend>
        <label className={rowClass(squareChecked)}>
          <input
            type="checkbox"
            name="campaignFormatSummarySquare"
            value="1:1"
            checked={squareChecked}
            disabled
            aria-readonly="true"
            className="mt-0.5 h-4 w-4 accent-accent-green disabled:opacity-100"
          />
          <span className="min-w-0 flex-1 break-words text-sm font-body text-text-primary">
            {SQUARE_LABEL}
          </span>
        </label>
        <label className={rowClass(verticalChecked)}>
          <input
            type="checkbox"
            name="campaignFormatSummaryVertical"
            value="9:16"
            checked={verticalChecked}
            disabled
            aria-readonly="true"
            className="mt-0.5 h-4 w-4 accent-accent-green disabled:opacity-100"
          />
          <span className="min-w-0 flex-1 break-words text-sm font-body text-text-primary">
            {VERTICAL_LABEL}
          </span>
        </label>
      </fieldset>
    </section>
  );
}
