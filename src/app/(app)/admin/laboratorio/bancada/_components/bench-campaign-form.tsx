"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BADGE_OPTIONS_BY_INTENT } from "@/lib/constants";
import type { CampaignIntent } from "@/lib/campaign/types";
import { availableBenchIntents } from "@/lib/lab/bench/domain/intent-price-matrix";
import {
  MANDATORY_ARTWORK_MAX,
  PRODUCT_DESCRIPTION_MAX,
  PRODUCT_NAME_MAX,
  buildValidityDisplayText,
  cleanBadgeForIntent,
  formatPriceCents,
  isPreserveImageContextAvailable,
  resolvePreserveImageContext,
  validateBadge,
  validateDiscountedPrice,
  validateMandatoryArtworkText,
  validateOriginalPrice,
  validateProductDescription,
  validateProductName,
  validateValidityEndDate,
  validateValidityStartDate,
  type BenchValidityMode,
} from "@/lib/lab/bench/domain/form-rules";

import { LabRadioGroup } from "../../_components/lab-radio-group";
import { LabSelect } from "../../_components/lab-select";
import { LabTextarea } from "../../_components/lab-textarea";

/**
 * Formulário **fiel** produto/oferta da bancada (F48.2.3, D13/D14; spec
 * `lab-bench-form-parity` + `lab-admin-ui`).
 *
 * Reproduz os campos e comportamentos programáticos relevantes do formulário
 * produtivo (nome 60, descrição 120, preços de/por com normalização por
 * dígitos→centavos, selo por intenção, intenção com derivação/seleção, "Preservar
 * imagem original" — exibido só em Destaque/Exclusivo e limpo ao mudar para
 * Oferta —, validade, aviso "Imagem meramente ilustrativa" e informações
 * obrigatórias na arte 200), reutilizando as regras puras de `form-rules.ts`.
 *
 * As imagens do produto são enviadas pelo componente `BenchImageUpload`. A
 * validação é **inline no blur** (nunca só no submit). Desktop-only.
 */

export interface BenchCampaignFormValue {
  productName: string;
  productDescription: string;
  /** Preço de venda em centavos (0 = vazio). */
  priceCents: number;
  /** Preço original em centavos (0 = vazio). */
  originalPriceCents: number;
  badge: string;
  campaignIntent: CampaignIntent;
  preserveImageContext: boolean;
  validityMode: BenchValidityMode;
  validityStartDate: string;
  validityEndDate: string;
  validityCustomText: string;
  showIllustrativeNotice: boolean;
  mandatoryArtworkText: string;
}

export const EMPTY_BENCH_CAMPAIGN_FORM: BenchCampaignFormValue = {
  productName: "",
  productDescription: "",
  priceCents: 0,
  originalPriceCents: 0,
  badge: "",
  campaignIntent: "offer",
  preserveImageContext: false,
  validityMode: "",
  validityStartDate: "",
  validityEndDate: "",
  validityCustomText: "",
  showIllustrativeNotice: true,
  mandatoryArtworkText: "",
};

interface BenchCampaignFormProps {
  value: BenchCampaignFormValue;
  onChange: (next: BenchCampaignFormValue) => void;
  disabled?: boolean;
}

const INTENT_LABELS: Record<CampaignIntent, string> = {
  offer: "Oferta",
  spotlight: "Destaque",
  exclusive: "Exclusivo",
};

const VALIDITY_OPTIONS: ReadonlyArray<{ value: BenchValidityMode; label: string }> = [
  { value: "", label: "Sem validade" },
  { value: "until-date", label: "Até uma data" },
  { value: "range", label: "Período" },
  { value: "today", label: "Somente hoje" },
  { value: "stock", label: "Enquanto durarem os estoques" },
  { value: "custom", label: "Personalizado" },
];

/** Normalização monetária por dígitos→centavos (idêntica ao produtivo). */
function digitsToCents(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 0 ? 0 : Number.parseInt(digits, 10);
}

function displayPrice(cents: number): string {
  return cents > 0 ? formatPriceCents(cents) : "";
}

function CheckboxField({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-text-primary font-body"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-accent-blue"
      />
      {label}
    </label>
  );
}

export function BenchCampaignForm({
  value,
  onChange,
  disabled = false,
}: BenchCampaignFormProps) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const errors: Record<string, string | undefined> = {};
  if (touched.productName) errors.productName = validateProductName(value.productName) ?? undefined;
  if (touched.productDescription) {
    errors.productDescription = validateProductDescription(value.productDescription) ?? undefined;
  }
  if (touched.priceCents) {
    errors.priceCents = validateDiscountedPrice(value.priceCents, value.campaignIntent) ?? undefined;
  }
  if (touched.originalPriceCents) {
    errors.originalPriceCents =
      validateOriginalPrice(value.originalPriceCents, value.priceCents) ?? undefined;
  }
  if (touched.badge) errors.badge = validateBadge(value.badge, value.campaignIntent) ?? undefined;
  if (touched.mandatoryArtworkText) {
    errors.mandatoryArtworkText =
      validateMandatoryArtworkText(value.mandatoryArtworkText) ?? undefined;
  }
  if (touched.validityEndDate) {
    errors.validityEndDate =
      validateValidityEndDate({
        validityMode: value.validityMode,
        validityEndDate: value.validityEndDate,
      }) ?? undefined;
  }
  if (touched.validityStartDate) {
    errors.validityStartDate =
      validateValidityStartDate({
        validityMode: value.validityMode,
        validityStartDate: value.validityStartDate,
        validityEndDate: value.validityEndDate,
      }) ?? undefined;
  }

  function markTouched(field: string) {
    setTouched((previous) => ({ ...previous, [field]: true }));
  }

  function setField<K extends keyof BenchCampaignFormValue>(
    field: K,
    next: BenchCampaignFormValue[K],
  ) {
    onChange({ ...value, [field]: next });
  }

  /** Preços: normaliza por dígitos→centavos e re-deriva a intenção. */
  function handlePrice(field: "priceCents" | "originalPriceCents", raw: string) {
    const next: BenchCampaignFormValue = { ...value, [field]: digitsToCents(raw) };
    onChange(next);
  }

  function handleIntent(intent: CampaignIntent) {
    onChange({
      ...value,
      campaignIntent: intent,
      badge: cleanBadgeForIntent(value.badge, intent),
      preserveImageContext: resolvePreserveImageContext(intent, value.preserveImageContext),
    });
  }

  const validityDisplay = buildValidityDisplayText({
    validityMode: value.validityMode,
    validityStartDate: value.validityStartDate,
    validityEndDate: value.validityEndDate,
    validityCustomText: value.validityCustomText,
  });

  const compatibleIntents = availableBenchIntents(value.originalPriceCents, value.priceCents);
  const intentCompatible = compatibleIntents.includes(value.campaignIntent);
  const hasValidity =
    value.validityMode !== "" ||
    value.validityStartDate.length > 0 ||
    value.validityEndDate.length > 0 ||
    value.validityCustomText.length > 0;
  const validityIncompatible = value.campaignIntent !== "offer" && hasValidity;

  const intentOptions = compatibleIntents.map(
    (intent) => ({ value: intent, label: INTENT_LABELS[intent] }),
  );

  return (
    <section
      data-testid="bench-campaign-form"
      className="space-y-4 rounded-xl border border-border bg-bg-surface p-5"
      aria-labelledby="bench-campaign-form-title"
    >
      <h2
        id="bench-campaign-form-title"
        className="font-heading text-lg font-semibold text-text-primary"
      >
        Produto e oferta
      </h2>

      <Input
        label="Nome do produto"
        data-bench-text-field="product.name"
        value={value.productName}
        disabled={disabled}
        maxLength={PRODUCT_NAME_MAX}
        error={errors.productName}
        onChange={(event) => setField("productName", event.target.value)}
        onBlur={() => markTouched("productName")}
      />

      <LabTextarea
        label="Descrição (opcional)"
        data-bench-text-field="product.description"
        value={value.productDescription}
        disabled={disabled}
        maxLength={PRODUCT_DESCRIPTION_MAX}
        rows={2}
        hint={`Opcional — até ${PRODUCT_DESCRIPTION_MAX} caracteres.`}
        error={errors.productDescription}
        onChange={(event) => setField("productDescription", event.target.value)}
        onBlur={() => markTouched("productDescription")}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Preço original"
          inputMode="numeric"
          value={displayPrice(value.originalPriceCents)}
          disabled={disabled}
          error={errors.originalPriceCents}
          onChange={(event) => handlePrice("originalPriceCents", event.target.value)}
          onBlur={() => markTouched("originalPriceCents")}
        />
        <Input
          label="Preço de venda"
          inputMode="numeric"
          value={displayPrice(value.priceCents)}
          disabled={disabled}
          error={errors.priceCents}
          onChange={(event) => handlePrice("priceCents", event.target.value)}
          onBlur={() => markTouched("priceCents")}
        />
      </div>

      <LabRadioGroup
        name="bench-campaign-intent"
        legend="Intenção da campanha"
        options={intentOptions}
        value={value.campaignIntent}
        onChange={(next) => handleIntent(next as CampaignIntent)}
      />

      {!intentCompatible ? (
        <div
          role="alert"
          data-testid="bench-intent-price-guard"
          className="rounded-lg border border-accent-amber/50 bg-accent-amber/10 p-3 text-sm text-text-primary font-body"
        >
          <p>Os preços informados não são compatíveis com a intenção atual. Escolha uma nova intenção antes de compor.</p>
          {compatibleIntents.length > 0 ? (
            <p className="mt-1 text-xs text-text-secondary">
              Opções compatíveis: {compatibleIntents.map((intent) => INTENT_LABELS[intent]).join(" ou ")}.
            </p>
          ) : (
            <p className="mt-1 text-xs text-text-secondary">
              Informe um preço de venda ou remova o preço original isolado.
            </p>
          )}
        </div>
      ) : null}

      <LabSelect
        label="Selo promocional"
        value={value.badge}
        disabled={disabled}
        error={errors.badge}
        onChange={(event) => setField("badge", event.target.value)}
        onBlur={() => markTouched("badge")}
      >
        <option value="">Selecione…</option>
        {BADGE_OPTIONS_BY_INTENT[value.campaignIntent].map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </LabSelect>

      {isPreserveImageContextAvailable(value.campaignIntent) ? (
        <CheckboxField
          id="bench-preserve-image-context"
          label="Preservar imagem original"
          checked={value.preserveImageContext}
          disabled={disabled}
          onChange={(checked) => setField("preserveImageContext", checked)}
        />
      ) : null}

      <LabSelect
        label="Validade da oferta"
        value={value.validityMode}
        disabled={disabled}
        onChange={(event) => setField("validityMode", event.target.value as BenchValidityMode)}
      >
        {VALIDITY_OPTIONS.map((option) => (
          <option key={option.value || "none"} value={option.value}>
            {option.label}
          </option>
        ))}
      </LabSelect>

      {value.validityMode === "range" ? (
        <Input
          label="Data inicial"
          type="date"
          value={value.validityStartDate}
          disabled={disabled}
          error={errors.validityStartDate}
          onChange={(event) => setField("validityStartDate", event.target.value)}
          onBlur={() => markTouched("validityStartDate")}
        />
      ) : null}

      {value.validityMode === "until-date" || value.validityMode === "range" ? (
        <Input
          label="Data final"
          type="date"
          value={value.validityEndDate}
          disabled={disabled}
          error={errors.validityEndDate}
          onChange={(event) => setField("validityEndDate", event.target.value)}
          onBlur={() => markTouched("validityEndDate")}
        />
      ) : null}

      {value.validityMode === "custom" ? (
        <Input
          label="Texto da validade"
          value={value.validityCustomText}
          disabled={disabled}
          onChange={(event) => setField("validityCustomText", event.target.value)}
        />
      ) : null}

      {validityDisplay ? (
        <p className="text-xs text-text-muted font-body">
          Exibição da validade: <span className="font-mono">{validityDisplay}</span>
        </p>
      ) : null}

      {validityIncompatible ? (
        <div
          role="alert"
          data-testid="bench-validity-intent-guard"
          className="space-y-2 rounded-lg border border-accent-amber/50 bg-accent-amber/10 p-3 text-sm text-text-primary font-body"
        >
          <p>A validade está preservada, mas só pode ser usada em Oferta. Remova-a explicitamente para continuar com esta intenção.</p>
          <Button
            type="button"
            variant="secondary"
            data-testid="bench-clear-validity-button"
            onClick={() =>
              onChange({
                ...value,
                validityMode: "",
                validityStartDate: "",
                validityEndDate: "",
                validityCustomText: "",
              })
            }
          >
            Remover validade para continuar
          </Button>
        </div>
      ) : null}

      <CheckboxField
        id="bench-illustrative-notice"
        label="Imagem meramente ilustrativa"
        checked={value.showIllustrativeNotice}
        disabled={disabled}
        onChange={(checked) => setField("showIllustrativeNotice", checked)}
      />

      <LabTextarea
        label="Informações obrigatórias na arte"
        data-bench-text-field="product.mandatoryArtworkText"
        value={value.mandatoryArtworkText}
        disabled={disabled}
        maxLength={MANDATORY_ARTWORK_MAX}
        rows={2}
        hint={`Até ${MANDATORY_ARTWORK_MAX} caracteres.`}
        error={errors.mandatoryArtworkText}
        onChange={(event) => setField("mandatoryArtworkText", event.target.value)}
        onBlur={() => markTouched("mandatoryArtworkText")}
      />
    </section>
  );
}
