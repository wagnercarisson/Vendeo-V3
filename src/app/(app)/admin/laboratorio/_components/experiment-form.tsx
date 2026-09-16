"use client";

import { useRouter } from "next/navigation";
import { AlertCircle, Save } from "lucide-react";
import { useState, type ChangeEvent, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  ActiveCampaignImageTarget,
  LabScenarioVersionSummary,
} from "@/lib/lab/api/experiment-queries";
import {
  DEFAULT_MAX_RUNS_PER_EXPERIMENT,
  MAX_REPETITIONS,
  MAX_RUNS_PER_EXPERIMENT,
  MAX_SCENARIOS_PER_EXPERIMENT,
} from "@/lib/lab/limits";

import { LabSelect } from "./lab-select";
import { LabTextarea } from "./lab-textarea";

/**
 * Formulário de criação de experimento do Laboratório de IA (F48.1, D5/D12/D14).
 *
 * Comparação **prompt-only**: a dimensão alterada é fixa em `prompt` e o modelo é
 * fixo e idêntico para as duas variantes — a tela **não** oferece nenhum controle
 * editável de dimensão nem de modelo (comparação de modelo é F48.2, T-48-1-71).
 * Os limites (`MAX_SCENARIOS_PER_EXPERIMENT`, `MAX_REPETITIONS`,
 * `MAX_RUNS_PER_EXPERIMENT`, default) vêm da fonte única `@/lib/lab/limits`.
 *
 * A candidata é um override em memória: nenhum arquivo de `prompts/` é alterado
 * pela interface (T-48-1-72). A validação de visão é sempre dispensada
 * (`skipInputValidation: true`, D7).
 */

export interface ExperimentFormProps {
  modelTarget: ActiveCampaignImageTarget;
  scenarios: LabScenarioVersionSummary[];
  defaultParams: { size: string; quality: string };
  promptName: string;
}

interface FormValues {
  name: string;
  objective: string;
  hypothesis: string;
  scenarioVersionIds: string[];
  repetitions: number;
  maxRuns: number;
  candidateContent: string;
}

type FieldKey = keyof FormValues;

const MIN_CANDIDATE_LENGTH = 20;

const API_ERROR_MESSAGES: Record<string, string> = {
  unsupported_changed_dimension:
    "Somente a dimensão prompt é comparável nesta etapa; modelo e configuração ficam para a próxima",
  model_target_not_in_catalog:
    "O modelo alvo do experimento não está ativo no catálogo de modelos",
  invalid_payload: "Os dados enviados são inválidos. Revise os campos e tente novamente",
  environment_blocked: "O laboratório está bloqueado neste ambiente",
};

function describeApiError(code: unknown, status: number): string {
  if (typeof code === "string" && API_ERROR_MESSAGES[code]) {
    return API_ERROR_MESSAGES[code];
  }
  return `Não foi possível criar o experimento (erro ${status}). Tente novamente`;
}

function FixedField({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-text-secondary font-heading">
        {label}
      </span>
      <p
        data-testid={testId}
        className="min-h-[44px] w-full break-words rounded-lg border border-border bg-bg-deep/40 px-3 py-2 font-mono text-sm text-text-primary"
      >
        {value}
      </p>
    </div>
  );
}

export function ExperimentForm({
  modelTarget,
  scenarios,
  defaultParams,
  promptName,
}: ExperimentFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>({
    name: "",
    objective: "",
    hypothesis: "",
    scenarioVersionIds: [],
    repetitions: 1,
    maxRuns: DEFAULT_MAX_RUNS_PER_EXPERIMENT,
    candidateContent: "",
  });
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function validateField(field: FieldKey, current: FormValues): string | undefined {
    switch (field) {
      case "name":
        return current.name.trim() ? undefined : "Informe o nome do experimento";
      case "objective":
        return current.objective.trim() ? undefined : "Informe o objetivo";
      case "hypothesis":
        return current.hypothesis.trim() ? undefined : "Informe a hipótese";
      case "scenarioVersionIds":
        if (current.scenarioVersionIds.length === 0) {
          return "Selecione ao menos 1 cenário";
        }
        return current.scenarioVersionIds.length > MAX_SCENARIOS_PER_EXPERIMENT
          ? `Selecione no máximo ${MAX_SCENARIOS_PER_EXPERIMENT} cenários`
          : undefined;
      case "repetitions":
        return current.repetitions >= 1 && current.repetitions <= MAX_REPETITIONS
          ? undefined
          : `Escolha de 1 a ${MAX_REPETITIONS} repetições`;
      case "maxRuns":
        return current.maxRuns >= 1 && current.maxRuns <= MAX_RUNS_PER_EXPERIMENT
          ? undefined
          : `O teto deve ficar entre 1 e ${MAX_RUNS_PER_EXPERIMENT}`;
      case "candidateContent":
        return current.candidateContent.trim().length >= MIN_CANDIDATE_LENGTH
          ? undefined
          : `Escreva ao menos ${MIN_CANDIDATE_LENGTH} caracteres no prompt candidato`;
      default:
        return undefined;
    }
  }

  function validateAll(current: FormValues): Partial<Record<FieldKey, string>> {
    const next: Partial<Record<FieldKey, string>> = {};
    const fields: FieldKey[] = [
      "name",
      "objective",
      "hypothesis",
      "scenarioVersionIds",
      "repetitions",
      "maxRuns",
      "candidateContent",
    ];
    for (const field of fields) {
      const message = validateField(field, current);
      if (message) next[field] = message;
    }
    return next;
  }

  function handleBlur(field: FieldKey) {
    const message = validateField(field, values);
    setErrors((previous) => {
      const merged = { ...previous };
      if (message) merged[field] = message;
      else delete merged[field];
      return merged;
    });
  }

  function handleScenariosChange(event: ChangeEvent<HTMLSelectElement>) {
    const selected = Array.from(event.target.selectedOptions).map(
      (option) => option.value,
    );

    if (selected.length > MAX_SCENARIOS_PER_EXPERIMENT) {
      setValues((previous) => ({
        ...previous,
        scenarioVersionIds: selected.slice(0, MAX_SCENARIOS_PER_EXPERIMENT),
      }));
      setErrors((previous) => ({
        ...previous,
        scenarioVersionIds: `Selecione no máximo ${MAX_SCENARIOS_PER_EXPERIMENT} cenários`,
      }));
      return;
    }

    setValues((previous) => ({ ...previous, scenarioVersionIds: selected }));
    setErrors((previous) => {
      const merged = { ...previous };
      if (selected.length === 0) {
        merged.scenarioVersionIds = "Selecione ao menos 1 cenário";
      } else {
        delete merged.scenarioVersionIds;
      }
      return merged;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateAll(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/admin/laboratorio/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          objective: values.objective.trim(),
          hypothesis: values.hypothesis.trim(),
          changedDimension: "prompt",
          modelTarget,
          params: { ...defaultParams, skipInputValidation: true },
          repetitions: values.repetitions,
          maxRuns: values.maxRuns,
          scenarioVersionIds: values.scenarioVersionIds,
          baseline: { promptName },
          candidate: { promptName, promptContent: values.candidateContent },
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        experimentId?: string;
      };

      if (!response.ok) {
        setSubmitError(describeApiError(data.error, response.status));
        setSubmitting(false);
        return;
      }

      router.push(`/admin/laboratorio/experimentos/${data.experimentId}`);
    } catch {
      setSubmitError(
        "Não foi possível criar o experimento. Verifique a conexão e tente novamente",
      );
      setSubmitting(false);
    }
  }

  const modelLabel = `${modelTarget.provider}/${modelTarget.model} (${modelTarget.protocol})`;

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Nome"
          value={values.name}
          error={errors.name}
          onChange={(event) =>
            setValues((previous) => ({ ...previous, name: event.target.value }))
          }
          onBlur={() => handleBlur("name")}
        />
        <Input
          label="Objetivo"
          value={values.objective}
          error={errors.objective}
          onChange={(event) =>
            setValues((previous) => ({
              ...previous,
              objective: event.target.value,
            }))
          }
          onBlur={() => handleBlur("objective")}
        />
      </div>

      <LabTextarea
        label="Hipótese"
        value={values.hypothesis}
        error={errors.hypothesis}
        onChange={(event) =>
          setValues((previous) => ({
            ...previous,
            hypothesis: event.target.value,
          }))
        }
        onBlur={() => handleBlur("hypothesis")}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <FixedField
          label="Dimensão alterada"
          value="prompt"
          testId="lab-changed-dimension"
        />
        <FixedField
          label="Modelo (fixo e idêntico nas duas variantes)"
          value={modelLabel}
          testId="lab-model-fixed"
        />
      </div>

      <div className="rounded-xl border border-border bg-bg-surface p-4 text-sm text-text-secondary font-body">
        <p className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent-blue" aria-hidden="true" />
          <span>
            A comparação desta etapa é prompt-only: modelo e parâmetros são fixos e
            idênticos para o baseline e a candidata. Não há comparação de modelo aqui.
          </span>
        </p>
      </div>

      <LabSelect
        label="Cenários"
        multiple
        size={Math.min(4, Math.max(2, scenarios.length))}
        hint={`Selecione de 1 a ${MAX_SCENARIOS_PER_EXPERIMENT} cenários. Use Ctrl (ou Cmd) para marcar mais de um.`}
        error={errors.scenarioVersionIds}
        value={values.scenarioVersionIds}
        onChange={handleScenariosChange}
        onBlur={() => handleBlur("scenarioVersionIds")}
      >
        {scenarios.map((scenario) => (
          <option key={scenario.id} value={scenario.id}>
            {scenario.slug} · {scenario.name} v{scenario.version}
          </option>
        ))}
      </LabSelect>

      <div className="grid gap-4 sm:grid-cols-2">
        <LabSelect
          label="Repetições"
          value={String(values.repetitions)}
          error={errors.repetitions}
          onChange={(event) =>
            setValues((previous) => ({
              ...previous,
              repetitions: Number(event.target.value),
            }))
          }
          onBlur={() => handleBlur("repetitions")}
        >
          {Array.from({ length: MAX_REPETITIONS }, (_, index) => index + 1).map(
            (repetition) => (
              <option key={repetition} value={repetition}>
                {repetition}
              </option>
            ),
          )}
        </LabSelect>

        <Input
          label="Teto de execuções"
          type="number"
          min={1}
          max={MAX_RUNS_PER_EXPERIMENT}
          value={values.maxRuns}
          error={errors.maxRuns}
          onChange={(event) =>
            setValues((previous) => ({
              ...previous,
              maxRuns: Number(event.target.value),
            }))
          }
          onBlur={() => handleBlur("maxRuns")}
        />
      </div>

      <FixedField
        label="Prompt sob teste (baseline oficial)"
        value={promptName}
        testId="lab-baseline-prompt"
      />

      <LabTextarea
        label="Prompt candidato (override em memória)"
        value={values.candidateContent}
        error={errors.candidateContent}
        hint="O conteúdo é congelado apenas no snapshot do experimento: nenhum arquivo oficial de prompt é alterado."
        onChange={(event) =>
          setValues((previous) => ({
            ...previous,
            candidateContent: event.target.value,
          }))
        }
        onBlur={() => handleBlur("candidateContent")}
      />

      {submitError && (
        <p
          role="alert"
          className="flex items-center gap-1 text-sm text-accent-red font-body"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {submitError}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          data-testid="lab-create-button"
          loading={submitting}
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          Criar experimento
        </Button>
      </div>
    </form>
  );
}
