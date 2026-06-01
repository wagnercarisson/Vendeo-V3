"use client";

import { useState, useCallback, useTransition } from "react";
import { Sparkles, Wand2, Image as ImageIcon, Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { VisualSignaturePicker } from "./visual-signature-picker";
import {
  generateVariations,
  generateAutomatic,
  activateSignature,
  listSignatures,
} from "@/lib/visual-signature/server-actions";
import type { CascadeResult } from "@/lib/visual-signature/types";

type ModalState =
  | { phase: "options" }
  | { phase: "generating"; label: string }
  | { phase: "picker"; variations: CascadeResult[] }
  | { phase: "success"; isFallback?: boolean }
  | { phase: "error"; message: string };

interface VisualSignatureModalProps {
  storeId: string;
  storeName: string;
  segment: string;
  brandColor: string;
  onClose: () => void;
  onLogoUpload: () => void;
}

export function VisualSignatureModal({
  storeId,
  storeName,
  segment,
  brandColor,
  onClose,
  onLogoUpload,
}: VisualSignatureModalProps) {
  const [state, setState] = useState<ModalState>({ phase: "options" });
  const [selectedVariation, setSelectedVariation] = useState<CascadeResult | null>(null);
  const [, startTransition] = useTransition();

  const handleOption1 = useCallback(() => {
    setState({ phase: "generating", label: "Gerando assinaturas..." });
    startTransition(async () => {
      try {
        const result = await generateVariations(storeId);
        if (result.success) {
          setState({ phase: "picker", variations: result.variations });
        } else {
          setState({ phase: "error", message: result.error });
        }
      } catch {
        setState({
          phase: "error",
          message: "Não conseguimos criar sua assinatura visual agora. Tente novamente ou envie seu logotipo.",
        });
      }
    });
  }, [storeId, startTransition]);

  const handleOption2Or3 = useCallback(() => {
    setState({ phase: "generating", label: "Criando assinatura visual..." });
    startTransition(async () => {
      try {
        const result = await generateAutomatic(storeId);
        if (result.success) {
          setState({ phase: "success", isFallback: result.isFallback });
        } else {
          setState({ phase: "error", message: result.error });
        }
      } catch {
        setState({
          phase: "error",
          message: "Não conseguimos criar sua assinatura visual agora. Tente novamente ou envie seu logotipo.",
        });
      }
    });
  }, [storeId, startTransition]);

  const handleConfirmPicker = useCallback(async () => {
    if (!selectedVariation) return;

    setState({ phase: "generating", label: "Salvando..." });
    try {
      const signatures = await listSignatures(storeId);
      const target = signatures.find(
        (s) => s.storage_path === selectedVariation.storagePath
      );
      if (!target) {
        throw new Error("Assinatura não encontrada");
      }
      await activateSignature(storeId, target.id);
      setState({ phase: "success" });
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "Erro ao salvar assinatura",
      });
    }
  }, [storeId, selectedVariation]);

  const handleRetry = useCallback(() => {
    setState({ phase: "options" });
    setSelectedVariation(null);
  }, []);

  const renderContent = () => {
    switch (state.phase) {
      case "options":
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleOption1}
              className="flex flex-col items-center text-center gap-3 p-6 rounded-xl border-2 border-border-light hover:border-accent-green hover:bg-bg-elevated transition-all duration-200"
            >
              <Sparkles className="w-8 h-8 text-accent-blue" />
              <div>
                <p className="text-text-primary font-heading font-semibold text-sm">
                  Gerar 3 opções para eu escolher
                </p>
                <p className="text-text-muted text-xs font-body mt-1">
                  Criamos 3 variações para você escolher a que mais combina
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={handleOption2Or3}
              className="flex flex-col items-center text-center gap-3 p-6 rounded-xl border-2 border-border-light hover:border-accent-green hover:bg-bg-elevated transition-all duration-200"
            >
              <Wand2 className="w-8 h-8 text-accent-green" />
              <div>
                <p className="text-text-primary font-heading font-semibold text-sm">
                  Deixar o Vendeo escolher por mim
                </p>
                <p className="text-text-muted text-xs font-body mt-1">
                  Nosso sistema cria a melhor assinatura para sua loja
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={handleOption2Or3}
              className="flex flex-col items-center text-center gap-3 p-6 rounded-xl border-2 border-border-light hover:border-accent-green hover:bg-bg-elevated transition-all duration-200"
            >
              <ImageIcon className="w-8 h-8 text-accent-amber" />
              <div>
                <p className="text-text-primary font-heading font-semibold text-sm">
                  Tenho logotipo, mas vou enviar depois
                </p>
                <p className="text-text-muted text-xs font-body mt-1">
                  Criamos uma assinatura temporária — você pode substituir depois pelo logotipo
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={onLogoUpload}
              className="flex flex-col items-center text-center gap-3 p-6 rounded-xl border-2 border-border-light hover:border-accent-green hover:bg-bg-elevated transition-all duration-200"
            >
              <Upload className="w-8 h-8 text-accent-red" />
              <div>
                <p className="text-text-primary font-heading font-semibold text-sm">
                  Tenho logotipo e quero enviar agora
                </p>
                <p className="text-text-muted text-xs font-body mt-1">
                  Faça upload do logotipo da sua loja
                </p>
              </div>
            </button>
          </div>
        );

      case "generating":
        return (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-accent-green" />
            <p className="text-text-primary font-body text-sm">{state.label}</p>
          </div>
        );

      case "picker":
        return (
          <div>
            <h3 className="text-text-primary font-heading font-semibold text-base mb-4">
              Escolha sua assinatura visual
            </h3>
            <VisualSignaturePicker
              variations={state.variations}
              selectedId={selectedVariation?.storagePath ?? null}
              onSelect={setSelectedVariation}
              onConfirm={handleConfirmPicker}
              isLoading={false}
            />
          </div>
        );

      case "success":
        return (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <CheckCircle2 className="w-12 h-12 text-accent-green" />
            {state.isFallback ? (
              <>
                <p className="text-text-primary font-heading font-semibold text-lg text-center">
                  Assinatura visual criada!
                </p>
                <p className="text-text-secondary text-sm font-body text-center max-w-sm">
                  Criamos uma assinatura simples temporária. Você pode gerar opções melhores ou enviar seu logotipo.
                </p>
              </>
            ) : (
              <p className="text-text-primary font-heading font-semibold text-lg">
                Assinatura visual criada com sucesso!
              </p>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-accent-green text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200"
            >
              Continuar
            </button>
          </div>
        );

      case "error":
        return (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <AlertCircle className="w-10 h-10 text-accent-red" />
            <p className="text-text-primary font-body text-sm text-center max-w-sm">
              {state.message}
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="px-6 py-2.5 bg-accent-green text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200"
            >
              Tentar novamente
            </button>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-surface rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
        <h2 className="text-text-primary font-heading font-bold text-lg mb-2">
          Assinatura Visual
        </h2>
        <p className="text-text-secondary text-sm font-body mb-6">
          Escolha como sua loja será identificada visualmente nas campanhas
        </p>
        {renderContent()}
      </div>
    </div>
  );
}
