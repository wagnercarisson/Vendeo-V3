import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { listBenchPresets } from "@/lib/lab/bench/domain/preset-registry";
import {
  listBenchTestStores,
  type BenchTestStoreSummary,
} from "@/lib/lab/bench/domain/store-manifest";
import { getLabEnvironment } from "@/lib/lab/environment-guard";
import { supabaseAdmin } from "@/lib/supabase/server";

import { DisabledNotice } from "../../_components/disabled-notice";
import { BenchExpandWorkbench } from "./_components/bench-expand-workbench";
import type {
  BenchConfigOptions,
  BenchPresetOption,
} from "../_components/bench-workbench";

/**
 * Subpágina da operação **Expandir campanha pronta** (quick 261107-qvo).
 * Guarda de ambiente antes de qualquer leitura; lista apenas lojas de teste do
 * manifesto e presets habilitados/desabilitados. Nenhum provider é chamado.
 */

export const dynamic = "force-dynamic";

const EXPAND_CONFIG: BenchConfigOptions = {
  dimensions: {
    formato: [{ id: "9:16", label: "Vertical 9:16", enabled: true }],
  },
  defaults: { formato: "9:16" },
};

export default async function ExpandCampaignPage() {
  const env = getLabEnvironment();
  if (!env.enabled) {
    return <DisabledNotice reason={env.reason} />;
  }

  let stores: BenchTestStoreSummary[] = [];
  let presets: BenchPresetOption[] = [];
  let readFailed = false;

  try {
    stores = await listBenchTestStores({ client: supabaseAdmin });
    presets = listBenchPresets().map((preset) => ({
      id: preset.id,
      label: preset.label,
      capability: preset.capability,
      provider: preset.provider,
      model: preset.model,
      protocol: preset.protocol,
      quality: preset.quality,
      size: preset.size,
      enabled: preset.enabled,
      ...(preset.reason ? { reason: preset.reason } : {}),
    }));
  } catch {
    readFailed = true;
  }

  if (readFailed) {
    return (
      <ErrorState
        title="Não foi possível preparar a expansão"
        description="A leitura das lojas de teste ou dos presets falhou — verifique o motivo e tente novamente; nenhum custo é gerado em falhas de ambiente/leitura."
      />
    );
  }

  if (stores.length === 0) {
    return (
      <div className="max-w-6xl space-y-6">
        <PageHeader title="Expandir campanha pronta" />
        <EmptyState
          title="Nenhuma loja de teste"
          description="Preencha `fixtures/lab/bench/stores.json` com uma loja materializada no Supabase local antes de expandir uma campanha."
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title="Expandir campanha pronta" />
      <p className="text-sm leading-6 text-text-secondary font-body">
        Operação isolada da criação comercial: envie uma única campanha pronta,
        escolha modelo/qualidade, revise o prompt de expansão e confirme a
        geometria antes de qualquer chamada paga. A preservação visual é avaliada
        manualmente depois.
      </p>
      <BenchExpandWorkbench
        stores={stores}
        presets={presets}
        config={EXPAND_CONFIG}
      />
    </div>
  );
}
