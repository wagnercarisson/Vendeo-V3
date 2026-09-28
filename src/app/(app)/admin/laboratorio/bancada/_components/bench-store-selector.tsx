"use client";

import { Store } from "lucide-react";

import { LabSelect } from "../../_components/lab-select";

/**
 * Seletor da loja de teste da bancada (F48.2.2, D4).
 *
 * Lista **apenas** as lojas presentes no manifesto local **E** materializadas no
 * Supabase local (o cruzamento é feito server-side por `listBenchTestStores`).
 * Uma loja fora do manifesto nunca é oferecida — logo não há caminho de UI para
 * iniciar uma geração com loja recusada. Reutiliza o primitivo local `lab-select`
 * (rótulo associado, `aria-invalid`/`aria-describedby` e alvo de toque de 44px).
 */

export interface BenchStoreOption {
  id: string;
  label: string;
  name: string;
  segment: string;
}

interface BenchStoreSelectorProps {
  stores: BenchStoreOption[];
  value: string;
  onChange: (storeId: string) => void;
  disabled?: boolean;
}

export function BenchStoreSelector({
  stores,
  value,
  onChange,
  disabled = false,
}: BenchStoreSelectorProps) {
  if (stores.length === 0) {
    return (
      <div
        data-testid="bench-store-empty"
        className="rounded-lg border border-border bg-bg-deep/40 p-4 text-sm text-text-secondary font-body"
      >
        Nenhuma loja de teste no manifesto. Preencha `fixtures/lab/bench/stores.json`
        com lojas materializadas no Supabase local antes de gerar.
      </div>
    );
  }

  return (
    <div data-testid="bench-store-selector" className="flex flex-col gap-2">
      <LabSelect
        label="Loja de teste"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        hint="Somente lojas do manifesto local materializadas no Supabase local."
      >
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.label} · {store.name}
          </option>
        ))}
      </LabSelect>
      <p className="flex items-center gap-1.5 text-xs text-text-muted font-body">
        <Store className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Lojas fora do manifesto são recusadas e não iniciam geração.
      </p>
    </div>
  );
}
