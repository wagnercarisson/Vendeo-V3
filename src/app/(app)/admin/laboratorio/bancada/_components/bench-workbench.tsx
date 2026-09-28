"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { BenchBrandingPanel, type BenchBrandingView } from "./bench-branding-panel";
import {
  BenchCampaignForm,
  EMPTY_BENCH_CAMPAIGN_FORM,
  type BenchCampaignFormValue,
} from "./bench-campaign-form";
import { BenchImageUpload, type BenchUploadResult } from "./bench-image-upload";
import { BenchPresetSelector } from "./bench-preset-selector";
import { BenchPromptEditor } from "./bench-prompt-editor";
import { BenchStoreSelector, type BenchStoreOption } from "./bench-store-selector";

/**
 * Contêiner cliente da bancada (F48.2.2, D15).
 *
 * A página `bancada/page.tsx` é um server component (guarda de ambiente +
 * leitura server-side de lojas/presets). Este contêiner é o dono do estado que
 * atravessa os painéis:
 *  - a loja de teste selecionada e o branding (somente leitura) carregado por ela;
 *  - o formulário mínimo produto/oferta, o prompt manual e o preset escolhido;
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
  const { stores, presets, config } = props;

  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [branding, setBranding] = useState<BenchBrandingView | null>(null);
  const [brandingLoading, setBrandingLoading] = useState(false);
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<BenchCampaignFormValue>(
    EMPTY_BENCH_CAMPAIGN_FORM,
  );
  const [prompt, setPrompt] = useState("");
  const [presetId, setPresetId] = useState(
    presets.find((preset) => preset.enabled)?.id ?? presets[0]?.id ?? "",
  );
  const [upload, setUpload] = useState<BenchUploadResult | null>(null);

  const operationRef = useRef<{ id: string; fingerprint: string } | null>(null);

  const getOperationId = useCallback((fingerprint: string): string => {
    const current = operationRef.current;
    if (current && current.fingerprint === fingerprint) return current.id;
    const id = crypto.randomUUID();
    operationRef.current = { id, fingerprint };
    return id;
  }, []);

  function handleStoreChange(nextStoreId: string) {
    setStoreId(nextStoreId);
    // O draft pertence à loja: trocar de loja invalida o upload anterior.
    setUpload(null);
    operationRef.current = null;
  }

  useEffect(() => {
    if (!storeId) {
      setBranding(null);
      return;
    }
    let cancelled = false;
    setBrandingLoading(true);
    setBrandingError(null);

    fetch(
      `/api/admin/laboratorio/bancada/branding?storeId=${encodeURIComponent(storeId)}`,
      { method: "GET" },
    )
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          branding?: BenchBrandingView;
        };
        if (cancelled) return;
        if (!response.ok || !data.branding) {
          setBrandingError("Não foi possível carregar o branding da loja de teste.");
        } else {
          setBranding(data.branding);
        }
        setBrandingLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setBrandingError("Não foi possível carregar o branding da loja de teste.");
        setBrandingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [storeId]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <BenchStoreSelector
          stores={stores}
          value={storeId}
          onChange={handleStoreChange}
        />
        <BenchBrandingPanel
          branding={branding}
          loading={brandingLoading}
          error={brandingError}
        />
        <BenchCampaignForm value={campaign} onChange={setCampaign} />
        <BenchImageUpload
          storeId={storeId}
          getOperationId={getOperationId}
          onUploaded={setUpload}
        />
        <BenchPromptEditor value={prompt} onChange={setPrompt} />
        <BenchPresetSelector
          presets={presets}
          config={config}
          presetId={presetId}
          onChange={setPresetId}
        />
      </div>
      <div className="space-y-6" data-testid="bench-result-column" />
    </div>
  );
}
