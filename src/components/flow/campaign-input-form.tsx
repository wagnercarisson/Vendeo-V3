"use client";

import { useCampaignForm } from "./use-campaign-form";
import type { CampaignFormFields } from "./use-campaign-form";
import { CampaignImageUpload } from "./campaign-image-upload";
import { BADGE_OPTIONS } from "@/lib/constants";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

interface CampaignInputFormProps {}

export function CampaignInputForm({}: CampaignInputFormProps) {
  const {
    fields,
    fieldErrors,
    touched,
    setField,
    handleBlur,
    displayPriceOriginal,
    displayPriceDiscounted,
    handlePriceOriginalChange,
    handlePriceDiscountedChange,
    imagePreviewUrl,
    isSubmitting,
    submitSuccess,
    handleSubmit,
    resetSubmit,
  } = useCampaignForm();

  if (submitSuccess) {
    return (
      <div>
        <div className="mb-6 flex items-start gap-3 bg-green-900/20 border border-green-700/30 rounded-lg px-4 py-3">
          <CheckCircle2 className="w-5 h-5 text-accent-green shrink-0 mt-0.5" />
          <p className="text-accent-green text-sm font-body flex-1">
            Dados da campanha registrados!
          </p>
          <button
            type="button"
            onClick={resetSubmit}
            className="text-text-muted hover:text-text-primary text-xs underline transition-colors duration-200 shrink-0"
          >
            Editar dados
          </button>
        </div>

        <FormContent
          fields={fields}
          fieldErrors={fieldErrors}
          touched={touched}
          setField={setField}
          handleBlur={handleBlur}
          displayPriceOriginal={displayPriceOriginal}
          displayPriceDiscounted={displayPriceDiscounted}
          handlePriceOriginalChange={handlePriceOriginalChange}
          handlePriceDiscountedChange={handlePriceDiscountedChange}
          imagePreviewUrl={imagePreviewUrl}
          isSubmitting={isSubmitting}
          handleSubmit={handleSubmit}
        />
      </div>
    );
  }

  return (
    <FormContent
      fields={fields}
      fieldErrors={fieldErrors}
      touched={touched}
      setField={setField}
      handleBlur={handleBlur}
      displayPriceOriginal={displayPriceOriginal}
      displayPriceDiscounted={displayPriceDiscounted}
      handlePriceOriginalChange={handlePriceOriginalChange}
      handlePriceDiscountedChange={handlePriceDiscountedChange}
      imagePreviewUrl={imagePreviewUrl}
      isSubmitting={isSubmitting}
      handleSubmit={handleSubmit}
    />
  );
}

interface FormContentProps {
  fields: CampaignFormFields;
  fieldErrors: Record<string, string | undefined>;
  touched: Record<string, boolean>;
  setField: (field: keyof CampaignFormFields, value: string | number | File | null) => void;
  handleBlur: (field: keyof CampaignFormFields) => void;
  displayPriceOriginal: string;
  displayPriceDiscounted: string;
  handlePriceOriginalChange: (raw: string) => void;
  handlePriceDiscountedChange: (raw: string) => void;
  imagePreviewUrl: string | null;
  isSubmitting: boolean;
  handleSubmit: () => void;
}

function FormContent({
  fields,
  fieldErrors,
  touched,
  setField,
  handleBlur,
  displayPriceOriginal,
  displayPriceDiscounted,
  handlePriceOriginalChange,
  handlePriceDiscountedChange,
  imagePreviewUrl,
  isSubmitting,
  handleSubmit,
}: FormContentProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      noValidate
      className="space-y-5"
    >
      <div>
        <label
          htmlFor="productName"
          className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2"
        >
          Nome do Produto *
        </label>
        <input
          id="productName"
          type="text"
          value={fields.productName}
          onChange={(e) => setField("productName", e.target.value)}
          onBlur={() => handleBlur("productName")}
          placeholder="Ex: Tênis Runner Pro"
          maxLength={60}
          className={`w-full bg-bg-surface border rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 ${
            touched.productName && fieldErrors.productName
              ? "border-accent-red"
              : "border-border-light hover:border-text-muted"
          }`}
        />
        {touched.productName && fieldErrors.productName && (
          <p className="mt-1.5 flex items-center gap-1.5 text-accent-red text-xs">
            <AlertCircle className="w-3.5 h-3.5" />
            {fieldErrors.productName}
          </p>
        )}
      </div>

      <CampaignImageUpload
        imageFile={fields.imageFile}
        error={touched.imageFile ? fieldErrors.imageFile ?? null : null}
        previewUrl={imagePreviewUrl}
        onSelect={(file) => setField("imageFile", file)}
      />

      <div>
        <label
          htmlFor="originalPrice"
          className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2"
        >
          Preço Original{" "}
          <span className="font-normal normal-case tracking-normal text-text-disabled">
            (opcional)
          </span>
        </label>
        <input
          id="originalPrice"
          type="text"
          value={displayPriceOriginal}
          onChange={(e) => handlePriceOriginalChange(e.target.value)}
          onBlur={() => handleBlur("originalPriceCents")}
          placeholder="R$ 0,00"
          className={`w-full bg-bg-surface border rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 ${
            touched.originalPriceCents && fieldErrors.originalPriceCents
              ? "border-accent-red"
              : "border-border-light hover:border-text-muted"
          }`}
        />
        {touched.originalPriceCents && fieldErrors.originalPriceCents && (
          <p className="mt-1.5 flex items-center gap-1.5 text-accent-red text-xs">
            <AlertCircle className="w-3.5 h-3.5" />
            {fieldErrors.originalPriceCents}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="discountedPrice"
          className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2"
        >
          Preço com Desconto *
        </label>
        <input
          id="discountedPrice"
          type="text"
          value={displayPriceDiscounted}
          onChange={(e) => handlePriceDiscountedChange(e.target.value)}
          onBlur={() => handleBlur("discountedPriceCents")}
          placeholder="R$ 0,00"
          className={`w-full bg-bg-surface border rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 ${
            touched.discountedPriceCents && fieldErrors.discountedPriceCents
              ? "border-accent-red"
              : "border-border-light hover:border-text-muted"
          }`}
        />
        {touched.discountedPriceCents && fieldErrors.discountedPriceCents && (
          <p className="mt-1.5 flex items-center gap-1.5 text-accent-red text-xs">
            <AlertCircle className="w-3.5 h-3.5" />
            {fieldErrors.discountedPriceCents}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2"
        >
          Descrição{" "}
          <span className="font-normal normal-case tracking-normal text-text-disabled">
            (opcional)
          </span>
        </label>
        <div className="relative">
          <textarea
            id="description"
            value={fields.description}
            onChange={(e) => setField("description", e.target.value)}
            onBlur={() => handleBlur("description")}
            placeholder="Ex: 20% OFF em todo o estoque"
            maxLength={120}
            rows={3}
            className={`w-full bg-bg-surface border rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 resize-none ${
              touched.description && fieldErrors.description
                ? "border-accent-red"
                : "border-border-light hover:border-text-muted"
            }`}
          />
          <p className="text-xs text-text-muted text-right mt-1">
            {fields.description.length}/120
          </p>
        </div>
        {touched.description && fieldErrors.description && (
          <p className="mt-1.5 flex items-center gap-1.5 text-accent-red text-xs">
            <AlertCircle className="w-3.5 h-3.5" />
            {fieldErrors.description}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="badge"
          className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2"
        >
          Badge Promocional *
        </label>
        <select
          id="badge"
          value={fields.badge}
          onChange={(e) => setField("badge", e.target.value)}
          onBlur={() => handleBlur("badge")}
          className={`w-full bg-bg-surface border rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 ${
            touched.badge && fieldErrors.badge
              ? "border-accent-red"
              : "border-border-light hover:border-text-muted"
          }`}
        >
          <option value="" disabled>
            Selecione o badge
          </option>
          {BADGE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {touched.badge && fieldErrors.badge && (
          <p className="mt-1.5 flex items-center gap-1.5 text-accent-red text-xs">
            <AlertCircle className="w-3.5 h-3.5" />
            {fieldErrors.badge}
          </p>
        )}
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:w-auto px-8 py-2.5 bg-accent-green text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Criando...
            </>
          ) : (
            "Criar Campanha"
          )}
        </button>
      </div>
    </form>
  );
}
