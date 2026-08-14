"use client";

import type { ValidityMode } from "@/components/flow/use-campaign-form";

interface ValidityFieldProps {
  mode: ValidityMode;
  startDate: string;
  endDate: string;
  customText: string;
  disabled?: boolean;
  onModeChange: (mode: ValidityMode) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onCustomTextChange: (text: string) => void;
}

const MODE_LABELS: { value: ValidityMode; label: string }[] = [
  { value: "", label: "Nenhuma" },
  { value: "until-date", label: "Até uma data" },
  { value: "range", label: "De até" },
  { value: "today", label: "Somente hoje" },
  { value: "stock", label: "Enquanto durarem os estoques" },
  { value: "custom", label: "Texto personalizado" },
];

const inputClasses =
  "min-h-[44px] w-full bg-bg-surface border border-border-light rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20";

export function ValidityField({
  mode,
  startDate,
  endDate,
  customText,
  disabled,
  onModeChange,
  onStartDateChange,
  onEndDateChange,
  onCustomTextChange,
}: ValidityFieldProps) {
  return (
    <div className="space-y-3">
      <label
        htmlFor="validityMode"
        className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2"
      >
        Validade da oferta
      </label>
      <select
        id="validityMode"
        value={mode}
        onChange={(e) => onModeChange(e.target.value as ValidityMode)}
        disabled={disabled}
        className={inputClasses}
      >
        {MODE_LABELS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {mode === "until-date" && (
        <div className="space-y-2">
          <label
            htmlFor="validityEndDate"
            className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-1"
          >
            Data final
          </label>
          <input
            id="validityEndDate"
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            disabled={disabled}
            aria-label="Data final"
            className={inputClasses}
          />
        </div>
      )}

      {mode === "range" && (
        <div className="space-y-2">
          <label
            htmlFor="validityStartDate"
            className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-1"
          >
            Data inicial
          </label>
          <input
            id="validityStartDate"
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            disabled={disabled}
            aria-label="Data inicial"
            className={inputClasses}
          />
          <label
            htmlFor="validityRangeEndDate"
            className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-1"
          >
            Data final
          </label>
          <input
            id="validityRangeEndDate"
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            disabled={disabled}
            aria-label="Data final do intervalo"
            className={inputClasses}
          />
        </div>
      )}

      {mode === "custom" && (
        <div className="space-y-2">
          <label
            htmlFor="validityCustomText"
            className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-1"
          >
            Texto da validade
          </label>
          <input
            id="validityCustomText"
            type="text"
            value={customText}
            onChange={(e) => onCustomTextChange(e.target.value)}
            disabled={disabled}
            maxLength={60}
            placeholder="Ex: Oferta válida por tempo limitado"
            className={inputClasses}
          />
        </div>
      )}

      {(mode === "until-date" || mode === "range" || mode === "custom") && (
        <p className="text-xs text-text-muted">
          A data aparece no formato dd/mm na campanha.
        </p>
      )}
    </div>
  );
}
