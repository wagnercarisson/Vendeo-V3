"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Ajuda expansível (progressive disclosure) acessível (F49, D2/D13).
 *
 * Disclosure **colapsado por padrão** (`useState(false)`). A região revelada
 * permanece **sempre no DOM**, ocultada com o atributo `hidden` quando
 * colapsada — assim `aria-controls` sempre aponta para um elemento existente e
 * a ajuda não ocupa altura permanente. Acionável por teclado
 * (`<button type="button">`), com `aria-expanded` coerente e foco visível;
 * touch target ≥ 44px.
 *
 * Proibido (D2/D13): tooltip como único veículo, lista permanente de regras,
 * altura permanente quando colapsado, `aria-controls` apontando para elemento
 * inexistente.
 */

interface ExpandableHelpProps {
  summary: string;
  children: React.ReactNode;
  id?: string;
  className?: string;
}

export function ExpandableHelp({
  summary,
  children,
  id,
  className = "",
}: ExpandableHelpProps) {
  const [isOpen, setIsOpen] = useState(false);
  const generatedId = useId();
  const regionId = id ?? generatedId;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={regionId}
        className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-heading uppercase tracking-wider text-text-secondary hover:text-text-primary transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/20 cursor-pointer"
      >
        {summary}
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      <div
        id={regionId}
        hidden={!isOpen}
        className="mt-2 text-sm text-text-secondary font-body leading-relaxed"
      >
        {children}
      </div>
    </div>
  );
}
