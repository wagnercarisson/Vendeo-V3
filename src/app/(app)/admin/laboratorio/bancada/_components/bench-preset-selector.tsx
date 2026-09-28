"use client";

import { Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { LabSelect } from "../../_components/lab-select";
import type { BenchConfigOptions, BenchPresetOption } from "./bench-workbench";

/**
 * Seletor de formato/modelo/qualidade e dimensões travadas da bancada (F48.2.2, D6/D7).
 *
 * `formato` (`1:1`), `modelo` e `qualidade` são selecionáveis **entre os presets
 * habilitados**; presets não confirmados aparecem desabilitados **com motivo
 * explícito**. As dimensões `intenção`, `tipo de conteúdo`, `estrutura` e `tema`
 * estão **travadas no primeiro recorte** e são exibidas como fixas (badges, não
 * editáveis). O caminho é direto single-shot — sem fallback.
 */

interface BenchPresetSelectorProps {
  presets: BenchPresetOption[];
  config: BenchConfigOptions;
  presetId: string;
  onChange: (presetId: string) => void;
  disabled?: boolean;
}

const LOCKED_DIMENSIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "intencao", label: "Intenção" },
  { key: "tipoConteudo", label: "Tipo de conteúdo" },
  { key: "estrutura", label: "Estrutura" },
  { key: "tema", label: "Tema" },
];

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function BenchPresetSelector({
  presets,
  config,
  presetId,
  onChange,
  disabled = false,
}: BenchPresetSelectorProps) {
  const selected = presets.find((preset) => preset.id === presetId) ?? null;
  const enabledPresets = presets.filter((preset) => preset.enabled);

  const models = unique(presets.map((preset) => preset.model));
  const model = selected?.model ?? enabledPresets[0]?.model ?? models[0] ?? "";
  const qualities = unique(
    presets.filter((preset) => preset.model === model).map((preset) => preset.quality),
  );
  const quality = selected?.quality ?? qualities[0] ?? "";

  function enabledPresetFor(nextModel: string, nextQuality: string): BenchPresetOption | null {
    return (
      enabledPresets.find(
        (preset) => preset.model === nextModel && preset.quality === nextQuality,
      ) ?? null
    );
  }

  function disabledReasonForModel(nextModel: string): string | null {
    const candidates = presets.filter((preset) => preset.model === nextModel);
    if (candidates.some((preset) => preset.enabled)) return null;
    return candidates.find((preset) => preset.reason)?.reason ?? "indisponível";
  }

  function optionLabel(dimension: string, value: string): string {
    const entry = (config.dimensions[dimension] ?? []).find(
      (option) => option.id === value,
    );
    return entry?.label ?? value;
  }

  function handleModelChange(nextModel: string) {
    const target = enabledPresetFor(nextModel, quality);
    if (target) onChange(target.id);
  }

  function handleQualityChange(nextQuality: string) {
    const target = enabledPresetFor(model, nextQuality);
    if (target) onChange(target.id);
  }

  const formatOptions = config.dimensions.formato ?? [];
  const formatValue = config.defaults.formato ?? "1:1";

  return (
    <section
      data-testid="bench-preset-selector"
      className="space-y-4 rounded-xl border border-border bg-bg-surface p-5"
      aria-labelledby="bench-preset-title"
    >
      <h2
        id="bench-preset-title"
        className="font-heading text-lg font-semibold text-text-primary"
      >
        Formato, modelo e qualidade
      </h2>

      <div className="grid gap-4 sm:grid-cols-3">
        <LabSelect label="Formato" value={formatValue} disabled={disabled} onChange={() => {}}>
          {formatOptions.map((option) => (
            <option key={option.id} value={option.id} disabled={!option.enabled}>
              {option.enabled
                ? option.label
                : `${option.label} — indisponível: ${option.reason ?? "indisponível"}`}
            </option>
          ))}
        </LabSelect>

        <LabSelect
          label="Modelo"
          value={model}
          disabled={disabled}
          onChange={(event) => handleModelChange(event.target.value)}
        >
          {models.map((candidate) => {
            const reason = disabledReasonForModel(candidate);
            return (
              <option key={candidate} value={candidate} disabled={reason !== null}>
                {reason === null ? candidate : `${candidate} — indisponível: ${reason}`}
              </option>
            );
          })}
        </LabSelect>

        <LabSelect
          label="Qualidade"
          value={quality}
          disabled={disabled}
          onChange={(event) => handleQualityChange(event.target.value)}
        >
          {qualities.map((candidate) => {
            const available = enabledPresetFor(model, candidate) !== null;
            return (
              <option key={candidate} value={candidate} disabled={!available}>
                {available ? candidate : `${candidate} — indisponível`}
              </option>
            );
          })}
        </LabSelect>
      </div>

      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-muted font-heading">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          Dimensões travadas no primeiro recorte
        </p>
        <div className="flex flex-wrap gap-2">
          {LOCKED_DIMENSIONS.map((dimension) => (
            <span
              key={dimension.key}
              data-testid={`bench-locked-${dimension.key}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-elevated px-3 py-1 text-xs font-heading text-text-secondary"
            >
              <span className="text-text-muted">{dimension.label}:</span>
              <span className="text-text-primary">
                {optionLabel(dimension.key, config.defaults[dimension.key] ?? "")}
              </span>
            </span>
          ))}
        </div>
      </div>

      {presets.some((preset) => !preset.enabled) && (
        <ul className="space-y-1 text-xs text-accent-amber font-body">
          {presets
            .filter((preset) => !preset.enabled)
            .map((preset) => (
              <li key={preset.id}>
                {preset.label} — indisponível: {preset.reason ?? "indisponível"}
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}
