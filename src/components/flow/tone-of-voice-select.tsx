"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ChevronDown } from "lucide-react";
import {
  TONE_OF_VOICE_DESCRIPTIONS,
  TONE_OF_VOICE_OPTIONS,
  type StoreToneOfVoice,
} from "@/lib/store-onboarding/field-guidance";

/**
 * Seletor descritivo do Tom de Voz (Quick 260919-hju) — implementa o padrão
 * **Select-Only Combobox** do WAI-ARIA APG, sem dependência externa e restrito
 * ao campo de tom de voz da tela `/loja`.
 *
 * - Trigger é um `<input readOnly role="combobox">` (labelable nativo → preserva
 *   `htmlFor` e expõe nome "Tom de Voz" e valor "Popular" separadamente).
 * - O foco permanece no combobox; a opção ativa é indicada por
 *   `aria-activedescendant` (não há foco roving nos `<li>`).
 * - Seleção única via `aria-selected` (sem `aria-checked`).
 * - A listbox fica sempre no DOM, oculta com `hidden` quando fechada, mantendo
 *   `aria-controls` sempre resolvível.
 * - Typeahead com buffer multi-caractere (~500ms) + ciclo entre correspondências
 *   repetidas ("po" → Popular; "pr" → Profissional; "p" repetido alterna).
 * - Popup com altura real calculada (lado com mais espaço, margem do viewport).
 */

interface ToneOfVoiceSelectProps {
  value: string;
  onChange: (value: string) => void;
  inputId?: string;
  ariaDescribedby?: string;
}

const VIEWPORT_MARGIN = 8;
const MAX_POPUP_HEIGHT = 320;
const TYPEAHEAD_WINDOW_MS = 500;

function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function ToneOfVoiceSelect({
  value,
  onChange,
  inputId = "tone_of_voice",
  ariaDescribedby,
}: ToneOfVoiceSelectProps) {
  const base = useId();
  const listboxId = `${base}-listbox`;
  const optionId = useCallback(
    (optionValue: string) => `${base}-opt-${optionValue}`,
    [base],
  );

  const [open, setOpen] = useState(false);
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const [popupStyle, setPopupStyle] = useState<{
    maxHeight: number;
    above: boolean;
  } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  const typeaheadBufferRef = useRef("");
  const typeaheadAtRef = useRef(0);

  const selectedOption = TONE_OF_VOICE_OPTIONS.find((o) => o.value === value);
  const displayValue = selectedOption?.label ?? "";

  const optionValues = TONE_OF_VOICE_OPTIONS.map((o) => o.value);

  const resolveActive = useCallback(
    (preferred: string | null, direction: "down" | "up"): string => {
      if (preferred && optionValues.includes(preferred as StoreToneOfVoice)) {
        return preferred;
      }
      if (direction === "up") {
        return optionValues[optionValues.length - 1];
      }
      return optionValues[0];
    },
    [optionValues],
  );

  const openList = useCallback(
    (direction: "down" | "up") => {
      setActiveValue(resolveActive(value, direction));
      setOpen(true);
    },
    [resolveActive, value],
  );

  const closeList = useCallback(() => {
    setOpen(false);
  }, []);

  const closeAndFocus = useCallback(() => {
    setOpen(false);
    inputRef.current?.focus();
  }, []);

  const select = useCallback(
    (optionValue: string) => {
      onChange(optionValue);
      setActiveValue(optionValue);
      setOpen(false);
    },
    [onChange],
  );

  const moveActive = useCallback(
    (step: number) => {
      setActiveValue((current) => {
        const currentIndex = optionValues.findIndex((v) => v === current);
        const baseIndex = currentIndex === -1 ? 0 : currentIndex;
        const nextIndex =
          (baseIndex + step + optionValues.length) % optionValues.length;
        return optionValues[nextIndex];
      });
    },
    [optionValues],
  );

  const jumpActive = useCallback(
    (target: "first" | "last") => {
      setActiveValue(
        target === "first"
          ? optionValues[0]
          : optionValues[optionValues.length - 1],
      );
    },
    [optionValues],
  );

  const cycleTypeaheadMatch = useCallback(
    (matches: StoreToneOfVoice[]): string => {
      const idx = matches.findIndex((m) => m === activeValue);
      return matches[(idx + 1) % matches.length];
    },
    [activeValue],
  );

  const typeahead = useCallback(
    (char: string) => {
      const now = Date.now();
      if (now - typeaheadAtRef.current > TYPEAHEAD_WINDOW_MS) {
        typeaheadBufferRef.current = "";
      }
      typeaheadAtRef.current = now;

      const candidate = (typeaheadBufferRef.current + char).toLowerCase();
      let matches = TONE_OF_VOICE_OPTIONS.filter((o) =>
        normalizeLabel(o.label).startsWith(candidate),
      ).map((o) => o.value);

      if (matches.length === 0) {
        // Reinicia o buffer com a tecla atual (ex.: "pp" → "p"), permitindo o
        // ciclo entre correspondências repetidas ("p" alterna Profissional/Popular).
        typeaheadBufferRef.current = char.toLowerCase();
        matches = TONE_OF_VOICE_OPTIONS.filter((o) =>
          normalizeLabel(o.label).startsWith(char.toLowerCase()),
        ).map((o) => o.value);
      } else {
        typeaheadBufferRef.current = candidate;
      }

      if (matches.length > 0) {
        setActiveValue(cycleTypeaheadMatch(matches));
        setOpen(true);
      }
    },
    [cycleTypeaheadMatch],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const key = event.key;
      const printable =
        key.length === 1 && /\S/.test(key) && !event.ctrlKey && !event.metaKey && !event.altKey;

      if (key === "ArrowDown") {
        event.preventDefault();
        if (!open) openList("down");
        else moveActive(1);
      } else if (key === "ArrowUp") {
        event.preventDefault();
        if (!open) openList("up");
        else moveActive(-1);
      } else if (key === "Enter") {
        event.preventDefault();
        if (!open) openList("down");
        else if (activeValue) select(activeValue);
      } else if (key === " ") {
        event.preventDefault();
        if (!open) openList("down");
        else if (activeValue) select(activeValue);
      } else if (key === "Escape") {
        if (open) {
          event.preventDefault();
          closeAndFocus();
        }
      } else if (key === "Home") {
        if (open) {
          event.preventDefault();
          jumpActive("first");
        }
      } else if (key === "End") {
        if (open) {
          event.preventDefault();
          jumpActive("last");
        }
      } else if (printable) {
        typeahead(key);
      }
    },
    [open, activeValue, openList, moveActive, select, closeAndFocus, jumpActive, typeahead],
  );

  const toggleOpen = useCallback(() => {
    setOpen((current) => {
      if (!current) {
        setActiveValue(resolveActive(value, "down"));
      }
      return !current;
    });
  }, [resolveActive, value]);

  // Fechamento por clique/toque externo. Não fecha por `focusout` — o foco
  // permanece no combobox e a opção é selecionada via clique (pointer).
  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocPointerDown);
    return () => document.removeEventListener("mousedown", onDocPointerDown);
  }, [open]);

  // Altura real do popup: mede espaço acima/abaixo e escolhe o lado com mais
  // espaço útil, aplicando maxHeight = min(320, espaçoDoLado - margem).
  useLayoutEffect(() => {
    if (!open) {
      setPopupStyle(null);
      return;
    }
    const trigger = inputRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight || 0;
    const spaceBelow = Math.max(0, viewportHeight - rect.bottom - VIEWPORT_MARGIN);
    const spaceAbove = Math.max(0, rect.top - VIEWPORT_MARGIN);
    const above = spaceAbove > spaceBelow;
    const available = above ? spaceAbove : spaceBelow;
    const maxHeight = Math.min(MAX_POPUP_HEIGHT, available);
    setPopupStyle({ maxHeight, above });
  }, [open]);

  // Mantém a opção ativa visível dentro da listbox (guarda para jsdom).
  useEffect(() => {
    if (!open) return;
    const listbox = listboxRef.current;
    if (!listbox) return;
    const activeEl = listbox.querySelector(
      `[data-active="true"]`,
    ) as HTMLElement | null;
    if (activeEl && typeof activeEl.scrollIntoView === "function") {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [open, activeValue]);

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          readOnly
          role="combobox"
          aria-autocomplete="none"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open && activeValue ? optionId(activeValue) : undefined}
          aria-describedby={ariaDescribedby || undefined}
          value={displayValue}
          placeholder="Selecione"
          onClick={toggleOpen}
          onKeyDown={onKeyDown}
          className="w-full cursor-pointer caret-transparent select-none bg-bg-surface border border-border-light rounded-lg min-h-[44px] px-3.5 py-2.5 text-text-primary text-sm font-body transition-colors duration-200 hover:border-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/20 pr-10"
        />
        <ChevronDown
          aria-hidden="true"
          className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </div>

      <ul
        ref={listboxRef}
        id={listboxId}
        role="listbox"
        hidden={!open}
        style={popupStyle ? { maxHeight: popupStyle.maxHeight } : undefined}
        className={`absolute left-0 right-0 z-50 w-full overflow-y-auto overscroll-contain rounded-lg border border-border-light bg-bg-surface shadow-lg ${
          popupStyle?.above ? "bottom-full mb-1" : "top-full mt-1"
        }`}
      >
        {TONE_OF_VOICE_OPTIONS.map((option) => {
          const isSelected = option.value === value;
          const isActive = option.value === activeValue;
          return (
            <li
              key={option.value}
              id={optionId(option.value)}
              role="option"
              aria-selected={isSelected}
              data-active={isActive ? "true" : "false"}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(option.value)}
              className="cursor-pointer min-h-[44px] px-3.5 py-2.5 focus-visible:ring-2 focus-visible:ring-accent-blue/20"
            >
              <span
                className={`block text-sm font-body ${
                  isSelected
                    ? "text-accent-blue font-medium"
                    : "text-text-primary"
                }`}
              >
                {option.label}
              </span>
              <span className="block text-xs font-body text-text-secondary whitespace-normal break-words mt-0.5">
                {TONE_OF_VOICE_DESCRIPTIONS[option.value]}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
