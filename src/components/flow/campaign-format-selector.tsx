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

interface CampaignFormatSelectorProps {
  value: "1:1" | "9:16";
  onChange: (format: "1:1" | "9:16") => void;
  disabled?: boolean;
}

/**
 * F59/D-03 — seletor de formato do fluxo NOVO. Só é montado sob elegibilidade e
 * (flag ON ou rascunho vertical pausado); o legado não o renderiza.
 */
export function CampaignFormatSelector({
  value,
  onChange,
  disabled = false,
}: CampaignFormatSelectorProps) {
  return (
    <section
      data-testid="flow-campaign-format-selector"
      aria-labelledby="campaignFormat-legend"
      className="space-y-2"
    >
      <fieldset className="space-y-2">
        <legend id="campaignFormat-legend" className="sr-only">
          Selecione o formato da campanha
        </legend>
        <div className="space-y-2">
          {FORMAT_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex min-h-[44px] items-start gap-3 rounded-lg border p-3 transition-colors focus-within:ring-2 focus-within:ring-accent-blue/40 ${
                value === option.value
                  ? "border-accent-green bg-accent-green/5"
                  : "border-border-light hover:border-text-muted"
              } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              <input
                type="radio"
                name="campaignFormat"
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                disabled={disabled}
                aria-describedby="campaignFormat-helper"
                className="mt-0.5 h-4 w-4 accent-accent-green"
              />
              <span className="flex-1 text-sm font-body text-text-primary">
                {option.label}
              </span>
            </label>
          ))}
        </div>
        <p
          id="campaignFormat-helper"
          className="text-xs font-body text-text-secondary"
        >
          {CAMPAIGN_FORMAT_HELPER}
        </p>
      </fieldset>
    </section>
  );
}
