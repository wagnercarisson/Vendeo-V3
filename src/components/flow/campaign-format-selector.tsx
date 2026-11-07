"use client";

const FORMAT_OPTIONS = [
  { value: "1:1" as const, label: "Quadrado 1:1 - feed" },
  {
    value: "9:16" as const,
    label: "Vertical 9:16 - Stories e Reels (imagem estática)",
  },
];

export const CAMPAIGN_FORMAT_HELPER =
  "Imagem estática, sem vídeo. As áreas seguras seguem a política do Vendeo e podem variar conforme a plataforma.";

export const CAMPAIGN_FORMAT_VERTICAL_DISABLED_HELPER =
  "O formato Vertical 9:16 está temporariamente indisponível. O formato 1:1 continua disponível.";

interface CampaignFormatSelectorProps {
  value: "1:1" | "9:16";
  onChange: (format: "1:1" | "9:16") => void;
  disabled?: boolean;
  /**
   * Quando `false`, o seletor permanece visível, mas apenas o 9:16 fica
   * desabilitado. Evita que o controle “desapareça” quando a flag está OFF.
   */
  verticalEnabled?: boolean;
}

/**
 * F59/D-03 — seletor de formato do fluxo NOVO. Montado sob elegibilidade; a
 * opção vertical só fica habilitada quando a flag está ON (ou há rascunho
 * vertical restaurado, caso em que o formulário inteiro fica pausado).
 */
export function CampaignFormatSelector({
  value,
  onChange,
  disabled = false,
  verticalEnabled = true,
}: CampaignFormatSelectorProps) {
  const verticalUnavailable = !verticalEnabled && !disabled;

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
              disabled || (option.value === "9:16" && !verticalEnabled);
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
        {verticalUnavailable && (
          <p
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
