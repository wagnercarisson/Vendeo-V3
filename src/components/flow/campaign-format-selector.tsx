"use client";

import type { CampaignFormatValue } from "./use-campaign-form";

const FORMAT_OPTIONS: ReadonlyArray<{
  value: CampaignFormatValue;
  label: string;
}> = [
  { value: "1:1", label: "Quadrado 1:1 - feed" },
  {
    value: "9:16",
    label: "Vertical 9:16 - Stories e Reels (imagem estática)",
  },
  {
    value: "1:1+9:16",
    label: "Dois formatos - Quadrado 1:1 + Vertical 9:16",
  },
];

export const CAMPAIGN_FORMAT_HELPER =
  "Imagem estática, sem vídeo. As áreas seguras seguem a política do Vendeo e podem variar conforme a plataforma.";

export const CAMPAIGN_FORMAT_JOINT_HELPER =
  "Dois formatos usam dois créditos: o quadrado para o feed e o vertical para Stories/Reels.";

export const CAMPAIGN_FORMAT_VERTICAL_DISABLED_HELPER =
  "O formato Vertical 9:16 está temporariamente indisponível. O formato 1:1 continua disponível.";

export const CAMPAIGN_FORMAT_JOINT_DISABLED_HELPER =
  "Os dois formatos estão temporariamente indisponíveis. Você pode manter o formato já escolhido ou usar o 1:1.";

interface CampaignFormatSelectorProps {
  value: CampaignFormatValue;
  onChange: (format: CampaignFormatValue) => void;
  disabled?: boolean;
  /**
   * Quando `false`, o seletor permanece visível, mas o 9:16 fica desabilitado.
   * Evita que o controle “desapareça” quando a flag está OFF.
   */
  verticalEnabled?: boolean;
  /**
   * C2 — a opção conjunta permanece VISÍVEL no fluxo elegível e fica
   * desabilitada quando a flag vertical está OFF. O valor restaurado não é
   * trocado silenciosamente.
   */
  jointEnabled?: boolean;
}

/**
 * F59/D-03 / F60.7 C2 — seletor de formato do fluxo NOVO. Montado sob
 * elegibilidade; opções verticais só ficam habilitadas quando a flag está ON.
 */
export function CampaignFormatSelector({
  value,
  onChange,
  disabled = false,
  verticalEnabled = true,
  jointEnabled = true,
}: CampaignFormatSelectorProps) {
  const verticalUnavailable = !verticalEnabled && !disabled;
  const jointUnavailable = !jointEnabled && !disabled;

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
          {FORMAT_OPTIONS.map((option) => {
            const optionDisabled =
              disabled ||
              (option.value === "9:16" && !verticalEnabled) ||
              (option.value === "1:1+9:16" && !jointEnabled);
            return (
              <label
                key={option.value}
                className={`flex min-h-[44px] items-start gap-3 rounded-lg border p-3 transition-colors focus-within:ring-2 focus-within:ring-accent-blue/40 ${
                  value === option.value
                    ? "border-accent-green bg-accent-green/5"
                    : "border-border-light hover:border-text-muted"
                } ${optionDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
              >
                <input
                  type="radio"
                  name="campaignFormat"
                  value={option.value}
                  checked={value === option.value}
                  onChange={() => onChange(option.value)}
                  disabled={optionDisabled}
                  aria-describedby="campaignFormat-helper"
                  className="mt-0.5 h-4 w-4 accent-accent-green"
                />
                <span className="min-w-0 flex-1 break-words text-sm font-body text-text-primary">
                  {option.label}
                </span>
              </label>
            );
          })}
        </div>
        <p
          id="campaignFormat-helper"
          className="text-xs font-body text-text-secondary"
        >
          {CAMPAIGN_FORMAT_HELPER}
        </p>
        {value === "1:1+9:16" && (
          <p
            data-testid="flow-campaign-format-joint-helper"
            className="text-xs font-body text-text-secondary"
          >
            {CAMPAIGN_FORMAT_JOINT_HELPER}
          </p>
        )}
        {verticalUnavailable && (
          <p
            role="status"
            data-testid="flow-campaign-format-vertical-disabled"
            className="text-xs font-body text-amber-800"
          >
            {CAMPAIGN_FORMAT_VERTICAL_DISABLED_HELPER}
          </p>
        )}
        {jointUnavailable && (
          <p
            role="status"
            data-testid="flow-campaign-format-joint-disabled"
            className="text-xs font-body text-amber-800"
          >
            {CAMPAIGN_FORMAT_JOINT_DISABLED_HELPER}
          </p>
        )}
      </fieldset>
    </section>
  );
}
