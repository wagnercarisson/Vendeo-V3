"use client";

import { useState } from "react";

import { BenchStoreSelector, type BenchStoreOption } from "./bench-store-selector";

/**
 * Contêiner cliente da bancada (F48.2.2, D15).
 *
 * A página `bancada/page.tsx` é um server component (guarda de ambiente +
 * leitura server-side de lojas/presets). Este contêiner é o dono do estado que
 * atravessa os painéis:
 *  - a loja de teste selecionada;
 *  - o `operationId` estável (reutilizado por fingerprint entre upload e
 *    confirmação) e o `runId`/`references` elevados do upload em `draft` para o
 *    painel de execução.
 *
 * Ele mantém apenas estado de UI; nenhuma chamada paga parte daqui.
 */

export interface BenchPresetOption {
  id: string;
  label: string;
  capability: string;
  provider: string;
  model: string;
  protocol: string;
  quality: string;
  size: string;
  enabled: boolean;
  reason?: string;
}

export interface BenchConfigDimensionOption {
  id: string;
  label: string;
  enabled: boolean;
  reason?: string;
}

export interface BenchConfigOptions {
  dimensions: Record<string, BenchConfigDimensionOption[]>;
  defaults: Record<string, string>;
}

export interface BenchWorkbenchProps {
  stores: BenchStoreOption[];
  presets: BenchPresetOption[];
  config: BenchConfigOptions;
}

export function BenchWorkbench(props: BenchWorkbenchProps) {
  const { stores } = props;
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <BenchStoreSelector
          stores={stores}
          value={storeId}
          onChange={setStoreId}
        />
      </div>
      <div className="space-y-6" />
    </div>
  );
}
