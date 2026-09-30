import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  BENCH_REGISTRY_DIMENSIONS,
  DEFAULT_BENCH_CONFIG,
  listBenchConfigOptions,
} from "@/lib/lab/bench/domain/config-registry";
import {
  BENCH_PROMPT_POLICY_REGISTRY,
  PROMPT_POLICY_DIMENSIONS,
} from "@/lib/lab/bench/domain/policies/registry";
import { listBenchPresets } from "@/lib/lab/bench/domain/preset-registry";
import { COMPOSER_VERSION } from "@/lib/lab/bench/domain/prompt-composer";
import { resolveBenchDefaultPromptBase } from "@/lib/lab/bench/domain/prompt-base";
import {
  listBenchTestStores,
  type BenchTestStoreSummary,
} from "@/lib/lab/bench/domain/store-manifest";
import { getLabEnvironment } from "@/lib/lab/environment-guard";
import { supabaseAdmin } from "@/lib/supabase/server";

import { DisabledNotice } from "../_components/disabled-notice";
import { BenchWorkbench } from "./_components/bench-workbench";
import type {
  BenchConfigOptions,
  BenchPresetOption,
} from "./_components/bench-workbench";
import type { BenchPromptPolicyView } from "./_components/bench-policies-panel";

/**
 * Página da bancada de geração (F48.2.2, D15).
 *
 * A guarda de ambiente (`getLabEnvironment()`) é avaliada **antes** de qualquer
 * leitura. Quando ela recusa, a página renderiza **apenas** o aviso de
 * indisponibilidade: nenhuma tabela `lab_*`, tabela de loja/branding, storage do
 * laboratório ou provider é acessado (T-48-2-2-37).
 *
 * No caminho habilitado, lê server-side as lojas de teste do manifesto local
 * (`listBenchTestStores`, somente leitura) e os presets habilitados/desabilitados
 * (`listBenchPresets`). O contêiner cliente recebe esses dados já resolvidos —
 * nenhum fetch de loja/preset parte do navegador.
 */

export const dynamic = "force-dynamic";

function buildConfigOptions(): BenchConfigOptions {
  const dimensions: BenchConfigOptions["dimensions"] = {};
  for (const dimension of BENCH_REGISTRY_DIMENSIONS) {
    dimensions[dimension] = listBenchConfigOptions(dimension).map((entry) => ({
      id: entry.id,
      label: entry.label,
      enabled: entry.enabled,
      ...(entry.reason ? { reason: entry.reason } : {}),
    }));
  }
  return { dimensions, defaults: { ...DEFAULT_BENCH_CONFIG } };
}

/**
 * Políticas habilitadas do recorte (id/valor/versão) resolvidas server-side a
 * partir do registry puro — entregues como **props iniciais** (D2/D16).
 */
function buildEnabledPolicies(): BenchPromptPolicyView[] {
  return PROMPT_POLICY_DIMENSIONS.flatMap((dimension) => {
    const policy = BENCH_PROMPT_POLICY_REGISTRY[dimension];
    if (!policy) return [];
    return [
      {
        dimension,
        id: policy.id,
        value: policy.value,
        version: policy.version,
      },
    ];
  });
}

export default async function BancadaPage() {
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
        title="Não foi possível preparar a bancada"
        description="A leitura das lojas de teste ou dos presets falhou — verifique o motivo e tente novamente; nenhum custo é gerado em falhas de ambiente/leitura."
      />
    );
  }

  if (stores.length === 0) {
    return (
      <div className="max-w-6xl space-y-6">
        <PageHeader title="Bancada" />
        <EmptyState
          title="Nenhuma geração ainda"
          description="Selecione uma loja de teste, envie as imagens do produto, escreva o prompt e escolha modelo/qualidade para gerar a primeira imagem. Nenhuma loja de teste está no manifesto local ainda — preencha `fixtures/lab/bench/stores.json`."
        />
      </div>
    );
  }

  // Prompt-base padrão versionado resolvido server-side a partir da configuração
  // inicial — semeado no editor como **prop inicial** (a UI nunca espera
  // `POST /compose` para exibir o padrão) (D6/D16).
  const defaultPromptBase = resolveBenchDefaultPromptBase(DEFAULT_BENCH_CONFIG);

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title="Bancada" />
      <p className="text-sm leading-6 text-text-secondary font-body">
        Bancada de geração isolada da produção: loja de teste do manifesto local,
        branding completo como fonte de verdade, prompt manual e caminho direto
        single-shot. Nenhuma promoção/publicação ocorre nesta fase.
      </p>
      <BenchWorkbench
        stores={stores}
        presets={presets}
        config={buildConfigOptions()}
        defaultPromptBase={defaultPromptBase.content}
        promptBaseVersion={defaultPromptBase.version}
        enabledPolicies={buildEnabledPolicies()}
        composerVersion={COMPOSER_VERSION}
      />
    </div>
  );
}
