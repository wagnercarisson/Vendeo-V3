"use client";

import {
  RUBRIC_CRITERIA,
  RUBRIC_CRITERION_LABELS,
  RUBRIC_STATES,
  RUBRIC_STATE_LABELS,
  type RubricCriterion,
  type RubricState,
} from "@/lib/lab/domain/rubric";

import { LabRadioGroup, type LabRadioOption } from "./lab-radio-group";
import { LabTextarea } from "./lab-textarea";

/**
 * Formulário da rubrica humana estruturada do Diretor (F48.2.1, D7).
 *
 * Renderiza os **nove** critérios de `RUBRIC_CRITERIA`, cada um com os quatro
 * estados (`adequate`/`minor_defect`/`critical_defect`/`not_applicable`) e
 * observação opcional, compondo os primitivos locais `LabRadioGroup` e
 * `LabTextarea`.
 *
 * Limite explícito do escopo: nenhuma nota automática é calculada ou exibida —
 * a decisão de qualidade é integralmente humana. O componente é controlado; o
 * estado vive no formulário de avaliação (que reinicia quando o par comparado
 * muda).
 */

export interface RubricDraftEntry {
  state?: RubricState;
  observation?: string;
}

export type RubricDraft = Partial<Record<RubricCriterion, RubricDraftEntry>>;

export interface RubricFormProps {
  value: RubricDraft;
  onChange: (next: RubricDraft) => void;
}

const STATE_OPTIONS: LabRadioOption[] = RUBRIC_STATES.map((state) => ({
  value: state,
  label: RUBRIC_STATE_LABELS[state],
}));

const STATE_DOT_CLASS: Record<RubricState, string> = {
  adequate: "bg-accent-green",
  minor_defect: "bg-accent-amber",
  critical_defect: "bg-accent-red",
  not_applicable: "bg-text-muted",
};

export function RubricForm({ value, onChange }: RubricFormProps) {
  function updateEntry(criterion: RubricCriterion, patch: RubricDraftEntry) {
    onChange({ ...value, [criterion]: { ...value[criterion], ...patch } });
  }

  return (
    <section
      aria-labelledby="lab-rubric-heading"
      className="space-y-4 rounded-xl border border-border bg-bg-deep/40 p-4"
    >
      <div className="space-y-1">
        <h3
          id="lab-rubric-heading"
          className="font-heading text-sm font-semibold text-text-primary"
        >
          Rubrica estruturada
        </h3>
        <p className="text-xs text-text-secondary font-body">
          Avalie cada critério do par comparado. Não há nota automática.
        </p>
      </div>

      <div className="space-y-5">
        {RUBRIC_CRITERIA.map((criterion) => {
          const entry = value[criterion] ?? {};
          return (
            <div
              key={criterion}
              data-testid={`lab-rubric-${criterion}`}
              className="space-y-2"
            >
              <div className="flex items-center gap-2">
                {entry.state && (
                  <span
                    aria-hidden="true"
                    data-testid={`lab-rubric-${criterion}-state`}
                    className={`inline-block h-2 w-2 shrink-0 rounded-full ${STATE_DOT_CLASS[entry.state]}`}
                  />
                )}
                <LabRadioGroup
                  name={`lab-rubric-${criterion}`}
                  legend={RUBRIC_CRITERION_LABELS[criterion]}
                  options={STATE_OPTIONS}
                  value={entry.state ?? ""}
                  onChange={(next) => updateEntry(criterion, { state: next as RubricState })}
                />
              </div>
              <LabTextarea
                label="Observação (opcional)"
                value={entry.observation ?? ""}
                onChange={(event) => updateEntry(criterion, { observation: event.target.value })}
                placeholder="Observação deste critério (opcional)"
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
