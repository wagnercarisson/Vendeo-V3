"use client";

interface MandatoryArtworkFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export function MandatoryArtworkField({ value, onChange }: MandatoryArtworkFieldProps) {
  return (
    <div>
      <label
        htmlFor="mandatoryArtworkText"
        className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2"
      >
        Texto obrigatório na arte{" "}
        <span className="font-normal normal-case tracking-normal text-text-disabled">
          (opcional)
        </span>
      </label>
      <textarea
        id="mandatoryArtworkText"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ex: Imagens meramente ilustrativas"
        maxLength={200}
        rows={2}
        className="min-h-[44px] w-full bg-bg-surface border border-border-light rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 resize-none hover:border-text-muted"
      />
    </div>
  );
}
