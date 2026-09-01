"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import type { ValidityMode } from "@/components/flow/use-campaign-form";
import {
  formatDateInput,
  isValidDateInput,
  parseDateInput,
} from "@/components/flow/use-campaign-form";

interface ValidityFieldProps {
  mode: ValidityMode;
  startDate: string;
  endDate: string;
  customText: string;
  disabled?: boolean;
  /** Erros de data vindos do hook (D2/D5) — renderizados inline abaixo do input. */
  startDateError?: string | null;
  endDateError?: string | null;
  onStartDateBlur?: () => void;
  onEndDateBlur?: () => void;
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

function ErrorText({ message }: { message: string }) {
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-accent-red text-xs">
      <AlertCircle className="w-3.5 h-3.5" />
      {message}
    </p>
  );
}

/**
 * Máscara dd/mm/aaaa: aceita só dígitos, insere "/" automaticamente após o
 * 2º e o 4º dígito e tolera apagar separadores. Nunca apaga o texto parcial
 * do usuário durante a digitação (só trunca em 8 dígitos, o teto do formato).
 */
function applyDateMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Estado local do input de data mascarado (Quick 1 — desvio consciente do
 * design "zero useState" da F40-05: necessário para a máscara).
 *
 * Regra anti-ISO-stale (crítica): o draft é APENAS para exibição; o parent
 * (`onChange`) é atualizado em TODA mudança do draft — completo e válido →
 * emite ISO; incompleto/inválido → emite "". Nunca mantém o ISO antigo quando
 * o campo visível já mudou.
 *
 * Re-sync do draft com a prop ISO externa via useEffect apenas quando o campo
 * NÃO está em edição (guarda de foco) — cobre restauração de draft/mudança de
 * fonte externa sem sobrescrever digitação em andamento.
 */
function useDateInput(isoValue: string, onChange: (iso: string) => void) {
  const [draft, setDraft] = useState(() => formatDateInput(isoValue));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) {
      setDraft(formatDateInput(isoValue));
    }
  }, [isoValue]);

  const handleChange = (raw: string) => {
    const masked = applyDateMask(raw);
    setDraft(masked);
    onChange(isValidDateInput(masked) ? parseDateInput(masked) : "");
  };

  const handleFocus = () => {
    focused.current = true;
  };

  const handleBlur = () => {
    focused.current = false;
  };

  return { draft, handleChange, handleFocus, handleBlur };
}

export function ValidityField({
  mode,
  startDate,
  endDate,
  customText,
  disabled,
  startDateError,
  endDateError,
  onStartDateBlur,
  onEndDateBlur,
  onModeChange,
  onStartDateChange,
  onEndDateChange,
  onCustomTextChange,
}: ValidityFieldProps) {
  const endDateInput = useDateInput(endDate, onEndDateChange);
  const startDateInput = useDateInput(startDate, onStartDateChange);

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
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={10}
            placeholder="dd/mm/aaaa"
            value={endDateInput.draft}
            onChange={(e) => endDateInput.handleChange(e.target.value)}
            onFocus={endDateInput.handleFocus}
            onBlur={() => {
              endDateInput.handleBlur();
              onEndDateBlur?.();
            }}
            disabled={disabled}
            aria-label="Data final"
            className={inputClasses}
          />
          {endDateError && <ErrorText message={endDateError} />}
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
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={10}
            placeholder="dd/mm/aaaa"
            value={startDateInput.draft}
            onChange={(e) => startDateInput.handleChange(e.target.value)}
            onFocus={startDateInput.handleFocus}
            onBlur={() => {
              startDateInput.handleBlur();
              onStartDateBlur?.();
            }}
            disabled={disabled}
            aria-label="Data inicial"
            className={inputClasses}
          />
          {startDateError && <ErrorText message={startDateError} />}
          <label
            htmlFor="validityRangeEndDate"
            className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-1"
          >
            Data final
          </label>
          <input
            id="validityRangeEndDate"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={10}
            placeholder="dd/mm/aaaa"
            value={endDateInput.draft}
            onChange={(e) => endDateInput.handleChange(e.target.value)}
            onFocus={endDateInput.handleFocus}
            onBlur={() => {
              endDateInput.handleBlur();
              onEndDateBlur?.();
            }}
            disabled={disabled}
            aria-label="Data final do intervalo"
            className={inputClasses}
          />
          {endDateError && <ErrorText message={endDateError} />}
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
          A data aparece no formato dd/mm/aaaa na campanha.
        </p>
      )}
    </div>
  );
}