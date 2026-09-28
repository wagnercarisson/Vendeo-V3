"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { LabTextarea } from "../../_components/lab-textarea";

/**
 * Formulário mínimo produto/oferta da bancada (F48.2.2, D-snapshot).
 *
 * Compõe o `input` global e o `lab-textarea` local para capturar o essencial da
 * campanha (produto + oferta). A validação é **inline no blur** (nunca só no
 * submit): o campo obrigatório vazio recebe a mensagem acessível no momento em
 * que perde o foco.
 */

export interface BenchCampaignFormValue {
  productName: string;
  productDescription: string;
  offerText: string;
}

export const EMPTY_BENCH_CAMPAIGN_FORM: BenchCampaignFormValue = {
  productName: "",
  productDescription: "",
  offerText: "",
};

interface BenchCampaignFormProps {
  value: BenchCampaignFormValue;
  onChange: (next: BenchCampaignFormValue) => void;
  disabled?: boolean;
}

type FieldName = keyof BenchCampaignFormValue;

export function BenchCampaignForm({
  value,
  onChange,
  disabled = false,
}: BenchCampaignFormProps) {
  const [touched, setTouched] = useState<Record<FieldName, boolean>>({
    productName: false,
    productDescription: false,
    offerText: false,
  });

  const errors: Partial<Record<FieldName, string>> = {};
  if (touched.productName && value.productName.trim().length === 0) {
    errors.productName = "Informe o nome do produto.";
  }
  if (touched.offerText && value.offerText.trim().length === 0) {
    errors.offerText = "Informe o texto da oferta.";
  }

  function setField(field: FieldName, next: string) {
    onChange({ ...value, [field]: next });
  }

  function markTouched(field: FieldName) {
    setTouched((previous) => ({ ...previous, [field]: true }));
  }

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
        label="Produto"
        value={value.productName}
        disabled={disabled}
        error={errors.productName}
        onChange={(event) => setField("productName", event.target.value)}
        onBlur={() => markTouched("productName")}
      />

      <LabTextarea
        label="Descrição do produto"
        value={value.productDescription}
        disabled={disabled}
        rows={2}
        hint="Opcional — detalhes que ajudam a compor a peça."
        onChange={(event) => setField("productDescription", event.target.value)}
      />

      <LabTextarea
        label="Oferta"
        value={value.offerText}
        disabled={disabled}
        error={errors.offerText}
        rows={3}
        hint="Ex.: 'De R$ 39,90 por R$ 29,90 só hoje'."
        onChange={(event) => setField("offerText", event.target.value)}
        onBlur={() => markTouched("offerText")}
      />
    </section>
  );
}
