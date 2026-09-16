import { FlaskConical } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  listScenarioVersions as readScenarioVersions,
  type LabScenarioVersionSummary,
} from "@/lib/lab/api/experiment-queries";
import { getLabEnvironment as readLabEnvironment } from "@/lib/lab/environment-guard";
import { supabaseAdmin } from "@/lib/supabase/server";

import { DisabledNotice } from "../_components/disabled-notice";
import { LabTable } from "../_components/lab-table";

/**
 * Lista **somente leitura** dos cenários versionados do laboratório (F48.1, D4/D12).
 *
 * Os cenários nascem de fixtures versionadas e são materializados pelo bootstrap
 * local — esta tela não cria, altera nem remove nada. Apenas metadados e o hash
 * abreviado são exibidos: nenhum conteúdo de cenário nem base64 de imagem
 * controlada atravessa a interface (T-48-1-74).
 */

export const dynamic = "force-dynamic";

function abbreviateHash(hash: string): string {
  return hash ? hash.slice(0, 12) : "—";
}

function formatDate(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

const HEAD_CLASS =
  "px-3 py-2 font-heading text-xs uppercase tracking-wider text-text-muted";

export default async function LaboratorioCenariosPage() {
  const env = readLabEnvironment();
  if (!env.enabled) {
    return <DisabledNotice reason={env.reason} />;
  }

  let scenarios: LabScenarioVersionSummary[] = [];
  let readFailed = false;

  try {
    scenarios = await readScenarioVersions(supabaseAdmin);
  } catch {
    readFailed = true;
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title="Cenários" />
      <p className="text-sm leading-6 text-text-secondary font-body">
        Cenários versionados disponíveis para os experimentos. Somente leitura: o
        conteúdo nasce de fixtures controladas e é materializado pelo bootstrap
        local do laboratório.
      </p>

      {readFailed ? (
        <ErrorState
          title="Não foi possível ler os cenários"
          description="A leitura dos cenários versionados falhou — verifique o motivo e tente novamente; nenhum custo é gerado em falhas de ambiente/budget."
        />
      ) : scenarios.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="Nenhum cenário disponível"
          description="Rode o bootstrap local do laboratório para materializar os cenários versionados a partir das fixtures."
        />
      ) : (
        <LabTable
          caption="Cenários versionados (somente leitura)"
          head={
            <>
              <th scope="col" className={HEAD_CLASS}>
                Slug
              </th>
              <th scope="col" className={HEAD_CLASS}>
                Nome
              </th>
              <th scope="col" className={HEAD_CLASS}>
                Versão
              </th>
              <th scope="col" className={HEAD_CLASS}>
                Intent
              </th>
              <th scope="col" className={HEAD_CLASS}>
                Formato
              </th>
              <th scope="col" className={HEAD_CLASS}>
                Idioma
              </th>
              <th scope="col" className={HEAD_CLASS}>
                Hash
              </th>
              <th scope="col" className={HEAD_CLASS}>
                Criado em
              </th>
            </>
          }
        >
          {scenarios.map((scenario) => (
            <tr key={scenario.id} className="border-t border-border">
              <td className="px-3 py-2 font-mono text-xs text-text-secondary">
                {scenario.slug}
              </td>
              <td className="px-3 py-2 text-text-primary">
                {scenario.name}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-text-secondary">
                v{scenario.version}
              </td>
              <td className="px-3 py-2 text-text-secondary">
                {scenario.intent}
              </td>
              <td className="px-3 py-2 text-text-secondary">
                {scenario.format}
              </td>
              <td className="px-3 py-2 text-text-secondary">
                {scenario.locale}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-text-muted">
                <span title={scenario.contentHash}>
                  {abbreviateHash(scenario.contentHash)}
                </span>
              </td>
              <td className="px-3 py-2 text-xs text-text-muted">
                {formatDate(scenario.createdAt)}
              </td>
            </tr>
          ))}
        </LabTable>
      )}
    </div>
  );
}
