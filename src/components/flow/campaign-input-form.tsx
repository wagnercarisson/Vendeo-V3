"use client";

import { useCampaignForm, inferIntent } from "./use-campaign-form";
import type { CampaignFormFields, CampaignProductFormImage } from "./use-campaign-form";
import { CampaignImageUpload } from "./campaign-image-upload";
import { GenerationProgress } from "./generation-progress";
import { BADGE_OPTIONS, BADGE_OPTIONS_BY_INTENT } from "@/lib/constants";
import { MAX_CAMPAIGN_IMAGES } from "@/lib/image-generation/config";
import { MandatoryArtworkField } from "@/components/campaign/mandatory-artwork-field";
import { IllustrativeNoticeField } from "@/components/campaign/illustrative-notice-field";
import { ValidityField } from "@/components/campaign/validity-field";
import type { CampaignIntent } from "@/lib/campaign/types";
import {
  AlertCircle,
  AlertTriangle,
  Coins,
  Loader2,
} from "lucide-react";
import { CreditCta } from "@/components/credit/credit-cta";
import { useOperationCosts } from "@/hooks/use-operation-costs";
import { ErrorState } from "@/components/ui/error-state";

interface CampaignInputFormProps {
  storeId?: string;
  balance?: number | null;
  supportEmail?: string;
}

export function CampaignInputForm({ storeId, balance, supportEmail }: CampaignInputFormProps) {
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
    submitError,
    setSubmitError,
    handleSubmit,
    pendingConflict,
    handleConflictContinue,
    handleConflictCorrect,
    handleConflictCancel,
    phases,
    addImage,
    removeImage,
  } = useCampaignForm(storeId);

  if (isSubmitting) {
    return (
      <GenerationProgress
        phases={phases}
        error={submitError}
        onRetry={submitError ? handleSubmit : undefined}
      />
    );
  }

  return (
    <div className="space-y-4">
      {submitError && !pendingConflict && (
        <ErrorState
          role="alert"
          title="Não foi possível gerar a campanha"
          description={submitError}
          action={{
            label: "Tentar novamente",
            onClick: handleSubmit,
          }}
        />
      )}

      {pendingConflict?.type === "strong_conflict" && (
        <div className="bg-red-900/20 border border-red-700/30 rounded-lg px-4 py-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-accent-red shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="text-accent-red text-sm font-body font-semibold">
                Categoria do produto não corresponde à imagem
              </p>
              <p className="text-red-300/80 text-xs font-body">
                A imagem enviada parece ser de outro tipo de produto. Para evitar uma campanha incorreta e consumo desnecessário de geração, corrija o nome do produto ou troque a imagem antes de continuar.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {pendingConflict.suggestedProductName && (
              <button
                type="button"
                onClick={handleConflictCorrect}
                className="min-h-[44px] px-3 py-1.5 bg-red-700/30 text-red-200 text-xs rounded-lg hover:bg-red-700/50 transition-colors"
              >
                Usar &quot;{pendingConflict.suggestedProductName}&quot;
              </button>
            )}
            <button
              type="button"
              onClick={handleConflictCancel}
              className="min-h-[44px] px-3 py-1.5 bg-bg-surface text-text-muted text-xs rounded-lg hover:text-text-primary transition-colors"
            >
              Corrigir nome
            </button>
            <button
              type="button"
              onClick={handleConflictCancel}
              className="min-h-[44px] px-3 py-1.5 bg-bg-surface text-text-muted text-xs rounded-lg hover:text-text-primary transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {pendingConflict && pendingConflict.type !== "strong_conflict" && (
        <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg px-4 py-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="text-yellow-300 text-sm font-body font-semibold">
                {pendingConflict.type === "conflict"
                  ? "Produto digitado não corresponde à imagem"
                  : "Correspondência produto × imagem não confirmada"}
              </p>
              <p className="text-yellow-300/80 text-xs font-body">
                {pendingConflict.type === "conflict"
                  ? "O nome do produto informado parece não corresponder à imagem enviada. Gerar mesmo assim pode consumir 1 geração e resultar em uma arte com informações incorretas."
                  : "Não foi possível confirmar se o nome do produto corresponde à imagem. A arte gerada pode conter dados ou nomes divergentes. Gerar consome 1 geração."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {pendingConflict.suggestedProductName && (
              <button
                type="button"
                onClick={handleConflictCorrect}
                className="min-h-[44px] px-3 py-1.5 bg-yellow-700/30 text-yellow-200 text-xs rounded-lg hover:bg-yellow-700/50 transition-colors"
              >
                Usar &quot;{pendingConflict.suggestedProductName}&quot;
              </button>
            )}
            <button
              type="button"
              onClick={handleConflictContinue}
              className="min-h-[44px] px-3 py-1.5 bg-orange-600/80 text-white text-xs rounded-lg hover:bg-orange-600 transition-colors"
            >
              Continuar mesmo assim — pode gerar arte incorreta
            </button>
            <button
              type="button"
              onClick={handleConflictCancel}
              className="min-h-[44px] px-3 py-1.5 bg-bg-surface text-text-muted text-xs rounded-lg hover:text-text-primary transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

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
        addImage={addImage}
        removeImage={removeImage}
        balance={balance}
        supportEmail={supportEmail}
      />
    </div>
  );
}

interface FormContentProps {
  fields: CampaignFormFields;
  fieldErrors: Record<string, string | undefined>;
  touched: Record<string, boolean>;
  setField: (field: keyof CampaignFormFields, value: string | number | boolean | File | null | undefined | CampaignProductFormImage[]) => void;
  handleBlur: (field: keyof CampaignFormFields) => void;
  displayPriceOriginal: string;
  displayPriceDiscounted: string;
  handlePriceOriginalChange: (raw: string) => void;
  handlePriceDiscountedChange: (raw: string) => void;
  imagePreviewUrl: string | null;
  isSubmitting: boolean;
  handleSubmit: () => void;
  addImage: (file: File, source: "upload" | "camera") => void;
  removeImage: (id: string) => void;
  balance?: number | null;
  supportEmail?: string;
}

function IntentSelector({
  value,
  onChange,
  availableOptions,
  disabled,
}: {
  value: CampaignIntent;
  onChange: (intent: CampaignIntent) => void;
  availableOptions: CampaignIntent[];
  disabled: boolean;
}) {
  const labels: Record<CampaignIntent, string> = {
    offer: "Oferta",
    spotlight: "Destaque",
    exclusive: "Exclusivo",
  };

  return (
    <div className="space-y-2">
      <span className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2">
        Intenção da campanha
      </span>
      <div className="space-y-2">
        {availableOptions.map((intent) => (
          <label
            key={intent}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              value === intent
                ? "border-accent-green bg-accent-green/5"
                : "border-border-light hover:border-text-muted"
            }`}
          >
            <input
              type="radio"
              name="campaignIntent"
              value={intent}
              checked={value === intent}
              onChange={() => onChange(intent)}
              disabled={disabled}
              className="h-4 w-4 accent-accent-green"
            />
            <span className="text-text-primary text-sm font-body flex-1">
              {labels[intent]}
            </span>

          </label>
        ))}
      </div>
    </div>
  );
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
  addImage,
  removeImage,
  balance,
  supportEmail,
}: FormContentProps) {
  const { costs, status: costStatus } = useOperationCosts();
  const campaignCost = costs?.campaign_generation;
  const costUnavailable = costStatus !== "loaded";
  const costDisabled = costStatus === "loaded" && campaignCost !== undefined && !campaignCost.enabled;
  const insufficientBalance =
    balance !== undefined &&
    balance !== null &&
    campaignCost !== undefined &&
    balance < campaignCost.costCredits;
  const submitDisabled =
    isSubmitting ||
    costUnavailable ||
    costDisabled ||
    insufficientBalance ||
    balance === null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      noValidate
      className="space-y-5"
    >
      <h2 className="text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2">
        Produto
      </h2>
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
          disabled={isSubmitting}
          className={`min-h-[44px] w-full bg-bg-surface border rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 ${
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
            disabled={isSubmitting}
            className={`min-h-[44px] w-full bg-bg-surface border rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 resize-none ${
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

      <CampaignImageUpload
        productImages={fields.productImages}
        error={touched.productImages ? fieldErrors.productImages ?? null : null}
        onAdd={addImage}
        onRemove={removeImage}
      />

      <div className="flex items-start gap-2">
        <h3 className="text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-1">
          Imagens adicionais
        </h3>
      </div>
      <p className="text-text-muted text-xs font-body mb-3">
        Opcional — até {MAX_CAMPAIGN_IMAGES - 1} imagens de apoio (ângulos, variações, combos). A primeira imagem é a principal.
      </p>

      <h2 className="text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2">
        Oferta
      </h2>
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
          inputMode="decimal"
          value={displayPriceOriginal}
          onChange={(e) => handlePriceOriginalChange(e.target.value)}
          onBlur={() => handleBlur("originalPriceCents")}
          placeholder="R$ 0,00"
          disabled={isSubmitting}
          className={`min-h-[44px] w-full bg-bg-surface border rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 ${
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
          inputMode="decimal"
          value={displayPriceDiscounted}
          onChange={(e) => handlePriceDiscountedChange(e.target.value)}
          onBlur={() => handleBlur("discountedPriceCents")}
          placeholder="R$ 0,00"
          disabled={isSubmitting}
          className={`min-h-[44px] w-full bg-bg-surface border rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 ${
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
          htmlFor="badge"
          className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2"
        >
          Selo promocional{fields.campaignIntent === "offer" ? " *" : " "}
          {fields.campaignIntent !== "offer" && (
            <span className="font-normal normal-case tracking-normal text-text-disabled">
              (opcional)
            </span>
          )}
        </label>
        <select
          id="badge"
          value={fields.badge}
          onChange={(e) => setField("badge", e.target.value)}
          onBlur={() => handleBlur("badge")}
          disabled={isSubmitting}
          className={`min-h-[44px] w-full bg-bg-surface border rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 ${
            touched.badge && fieldErrors.badge
              ? "border-accent-red"
              : "border-border-light hover:border-text-muted"
          }`}
        >
          {fields.campaignIntent === "offer" ? (
            <option value="" disabled>
              Selecione o badge
            </option>
          ) : (
            <option value="">Nenhum</option>
          )}
          {BADGE_OPTIONS_BY_INTENT[fields.campaignIntent].map((opt) => (
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

      <IntentSelector
        value={fields.campaignIntent}
        onChange={(intent) => setField("campaignIntent", intent)}
        availableOptions={
          (() => {
            const inferred = inferIntent(fields.originalPriceCents, fields.discountedPriceCents);
            if (inferred === "offer") return ["offer"];
            if (fields.discountedPriceCents !== undefined && (fields.discountedPriceCents ?? 0) > 0) {
              return ["offer", "spotlight"];
            }
            return ["spotlight", "exclusive"];
          })()
        }
        disabled={isSubmitting}
      />

      {fields.campaignIntent !== "offer" && (
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={fields.preserveImageContext}
            onChange={(e) => setField("preserveImageContext", e.target.checked)}
            disabled={isSubmitting}
            className="mt-0.5 h-4 w-4 rounded border-border-light bg-bg-surface text-accent-green focus:ring-accent-green/20"
          />
          <span className="text-text-primary text-sm font-body">
            Preservar imagem original
          </span>
        </label>
      )}

      {fields.campaignIntent === "offer" && (
        <ValidityField
          mode={fields.validityMode}
          startDate={fields.validityStartDate}
          endDate={fields.validityEndDate}
          customText={fields.validityCustomText}
          disabled={isSubmitting}
          onModeChange={(m) => setField("validityMode", m)}
          onStartDateChange={(d) => setField("validityStartDate", d)}
          onEndDateChange={(d) => setField("validityEndDate", d)}
          onCustomTextChange={(t) => setField("validityCustomText", t)}
        />
      )}

      <h2 className="text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2">
        Avisos e texto obrigatório
      </h2>

      <IllustrativeNoticeField
        checked={fields.showIllustrativeNotice}
        onChange={(c) => setField("showIllustrativeNotice", c)}
      />

      <MandatoryArtworkField
        value={fields.mandatoryArtworkTextFree}
        onChange={(v) => setField("mandatoryArtworkTextFree", v)}
      />

      <div className="pt-2 space-y-3">
        {balance !== undefined && (
          <div className={`flex items-center gap-2 text-sm font-body ${
            balance !== null && balance > 0
              ? "text-accent-green"
              : balance === 0
                ? "text-accent-red"
                : "text-accent-amber"
          }`}>
            <Coins className="h-4 w-4" />
            {balance !== null ? (
              <>
                <span>Saldo: <strong>{balance}</strong> crédito(s)</span>
                <span className="text-text-muted">·</span>
                <span>
                  {costStatus === "loaded" && campaignCost
                    ? (campaignCost.enabled
                        ? `Custo: ${campaignCost.costCredits}`
                        : "Operação desativada")
                    : costStatus === "unavailable"
                      ? "Serviço indisponível no momento"
                      : "Custo: …"}
                </span>
              </>
            ) : (
              <span>Não foi possível confirmar seu saldo. Tente novamente.</span>
            )}
          </div>
        )}

        {balance === 0 && (
          <CreditCta variant="zero" supportEmail={supportEmail} />
        )}

        <p className="text-xs text-text-muted">
          Use apenas materiais que você tem autorização para divulgar. Revise textos, preços e imagens antes de publicar: a IA pode cometer erros.
        </p>

        <button
          type="submit"
          disabled={submitDisabled}
          title={
            costUnavailable
              ? (costStatus === "loading"
                  ? "Verificando custo da geração..."
                  : "Serviço indisponível no momento. Tente novamente em alguns instantes.")
              : costDisabled
                ? "Operação desativada no momento."
                : insufficientBalance
                  ? "Você precisa de créditos para gerar uma campanha"
                  : balance === null
                    ? "Não foi possível confirmar seu saldo"
                    : undefined
          }
          className="min-h-[44px] w-full sm:w-auto px-8 py-2.5 bg-accent-green text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

        {balance === null && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-sm text-accent-green hover:underline font-medium"
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
