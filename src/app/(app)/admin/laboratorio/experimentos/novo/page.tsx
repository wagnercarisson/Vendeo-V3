import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { IMAGE_GENERATION_QUALITY, IMAGE_GENERATION_SIZE } from "@/lib/image-generation/config";
import {
  getActiveCampaignImageTarget,
  listScenarioVersions,
  type ActiveCampaignImageTarget,
  type LabScenarioVersionSummary,
} from "@/lib/lab/api/experiment-queries";
import { PROMPT_UNDER_TEST } from "@/lib/lab/domain/prompt-snapshot";
import { getLabEnvironment as readLabEnvironment } from "@/lib/lab/environment-guard";
import { supabaseAdmin } from "@/lib/supabase/server";

import { DisabledNotice } from "../../_components/disabled-notice";
import { ExperimentForm } from "../../_components/experiment-form";

/**
 * Página de criação de experimento (F48.1, D5/D12).
 *
 * O alvo de modelo é lido **server-side** do catálogo F47 (somente leitura) e os
 * parâmetros padrão vêm de `src/lib/image-generation/config.ts` — o formulário
 * cliente nunca lê `process.env`. Sem alvo ativo de `campaign_image`, nenhum
 * formulário é exibido: a comparação prompt-only exige um modelo fixo real.
 */

export const dynamic = "force-dynamic";

export default async function NovoExperimentoPage() {
  const env = readLabEnvironment();
  if (!env.enabled) {
    return <DisabledNotice reason={env.reason} />;
  }

  let target: ActiveCampaignImageTarget | null = null;
  let scenarios: LabScenarioVersionSummary[] = [];
  let readFailed = false;

  try {
    [target, scenarios] = await Promise.all([
      getActiveCampaignImageTarget(supabaseAdmin),
      listScenarioVersions(supabaseAdmin),
    ]);
  } catch {
    readFailed = true;
  }

  if (readFailed) {
    return (
      <ErrorState
        title="Não foi possível preparar o experimento"
        description="A leitura do catálogo de modelos ou dos cenários falhou — verifique o motivo e tente novamente; nenhum custo é gerado em falhas de ambiente/budget."
      />
    );
  }

  if (!target) {
    return (
      <ErrorState
        title="Sem alvo ativo para campaign_image"
        description="O catálogo de modelos não tem um alvo ativo para a capacidade campaign_image. Ative um modelo no catálogo antes de criar o experimento — nenhum formulário é exibido sem um alvo fixo."
      />
    );
  }

  if (scenarios.length === 0) {
    return (
      <ErrorState
        title="Nenhum cenário disponível"
        description="Rode o bootstrap local do laboratório para materializar os cenários versionados a partir das fixtures antes de criar o experimento."
      />
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Novo experimento" />
      <p className="text-sm leading-6 text-text-secondary font-body">
        A comparação é prompt-only e local-first: o modelo é fixo e idêntico para o
        baseline e a candidata, e a candidata é um override em memória — nenhum
        arquivo oficial de prompt é alterado.
      </p>
      <ExperimentForm
        modelTarget={target}
        scenarios={scenarios}
        defaultParams={{
          size: IMAGE_GENERATION_SIZE,
          quality: IMAGE_GENERATION_QUALITY,
        }}
        promptName={PROMPT_UNDER_TEST}
      />
    </div>
  );
}
