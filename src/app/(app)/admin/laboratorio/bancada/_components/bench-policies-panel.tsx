"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Painel **somente leitura** de políticas e versões da bancada (F48.2.4, D2/D14/D16).
 *
 * Exibe as **políticas habilitadas** do recorte (intenção `oferta`, formato `1:1`,
 * tipo de conteúdo `produto`, estrutura `peca-unica`, tema `nenhum`) com
 * **identificador e versão**, a **versão do compositor** e a **versão do
 * prompt-base padrão**. Valores técnicos (ids/versões) em JetBrains Mono 500.
 *
 * Componente **presentacional**: os dados são resolvidos server-side
 * (`page.tsx`) e entregues como props iniciais. Nenhuma escrita, nenhuma chamada
 * de rede. Somente leitura.
 */

export interface BenchPromptPolicyView {
  /** Dimensão governada pela política (ex.: `intencao`). */
  dimension: string;
  /** Identificador estável da política (ex.: `policy.intencao.oferta`). */
  id: string;
  /** Valor habilitado no registry (ex.: `oferta`). */
  value: string;
  /** Versão estática da política (evidência). */
  version: string;
}

interface BenchPoliciesPanelProps {
  policies: BenchPromptPolicyView[];
  composerVersion: string;
  promptBaseVersion: string;
}

const DIMENSION_LABELS: Record<string, string> = {
  intencao: "Intenção",
  formato: "Formato",
  tipoConteudo: "Tipo de conteúdo",
  estrutura: "Estrutura",
  tema: "Tema",
};

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wider text-text-muted font-heading">
        {label}
      </dt>
      <dd className="break-words font-mono text-xs text-text-primary">{value}</dd>
    </div>
  );
}

export function BenchPoliciesPanel({
  policies,
  composerVersion,
  promptBaseVersion,
}: BenchPoliciesPanelProps) {
  return (
    <div data-testid="bench-policies-panel">
      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold text-text-primary">
            Políticas habilitadas
          </h2>
          <Badge variant="default">Somente leitura</Badge>
        </div>

        <dl className="grid gap-4 sm:grid-cols-2">
          <DataRow label="Versão do compositor" value={composerVersion || "—"} />
          <DataRow label="Prompt-base padrão" value={promptBaseVersion || "—"} />
        </dl>

        {policies.length === 0 ? (
          <p className="text-sm text-text-secondary font-body">
            Nenhuma política habilitada neste recorte.
          </p>
        ) : (
          <ul className="space-y-2">
            {policies.map((policy) => (
              <li
                key={policy.id}
                data-testid={`bench-policy-${policy.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-bg-deep/40 px-3 py-2"
              >
                <span className="font-heading text-sm text-text-primary">
                  {DIMENSION_LABELS[policy.dimension] ?? policy.dimension}
                </span>
                <span className="break-words font-mono text-xs text-text-secondary">
                  {policy.value} · {policy.id} · {policy.version}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
