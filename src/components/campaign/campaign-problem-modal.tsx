"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CampaignProblemModalProps {
  campaignId: string;
  candidateImageUrl: string | null;
  onClose: () => void;
}

// F37.2 (R1/R2): modal "Informar problema" de 1 etapa. Relata um defeito objetivo
// da arte sem sair da página. O envio cria caso + tentativa via rota problem-report
// e ramifica pela resposta: JSON (blocked/unclear/analysis_failed → orientação) ou
// NDJSON (eligible → stream de geração da v2 até done/error).
type ModalState =
  | { kind: "idle" }
  | { kind: "processing"; message: string }
  | { kind: "guidance"; analysisState: string; guidance: string }
  | { kind: "error"; message: string };

const PUNCTUATION_ONLY_REGEX = /^[\s\p{P}\p{S}]*$/u;

const PHASE_LABELS: Record<string, string> = {
  input_validation: "Validando as informações...",
  prompt_assembly: "Preparando a correção...",
  image_generation: "Gerando a nova arte...",
  quality_review: "Revisando a nova arte...",
};

export default function CampaignProblemModal({
  campaignId,
  candidateImageUrl,
  onClose,
}: CampaignProblemModalProps) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [state, setState] = useState<ModalState>({ kind: "idle" });

  const isProcessing = state.kind === "processing";

  // Fechamentos sem efeito: [Cancelar], X, ESC e backdrop. Durante o processamento
  // o modal não fecha (o stream está em andamento).
  const closeIfIdle = useCallback(() => {
    if (!isProcessing) {
      onClose();
    }
  }, [isProcessing, onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeIfIdle();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeIfIdle]);

  const consumeNdjson = useCallback(
    async (body: ReadableStream<Uint8Array>) => {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let outcome: { kind: "done" } | { kind: "error"; message: string } | null =
        null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let event: Record<string, unknown>;
          try {
            event = JSON.parse(trimmed) as Record<string, unknown>;
          } catch {
            continue;
          }

          if (event.type === "phase") {
            const phase = typeof event.phase === "string" ? event.phase : "";
            setState({
              kind: "processing",
              message: PHASE_LABELS[phase] ?? "Processando a correção...",
            });
          } else if (event.type === "result") {
            outcome = { kind: "done" };
          } else if (event.type === "error") {
            outcome = {
              kind: "error",
              message:
                typeof event.message === "string" && event.message
                  ? event.message
                  : "Não foi possível gerar a correção. Tente novamente.",
            };
          }
        }
      }

      if (outcome?.kind === "done") {
        router.refresh();
        onClose();
      } else if (outcome?.kind === "error") {
        setState({ kind: "error", message: outcome.message });
      } else {
        setState({
          kind: "error",
          message: "A análise terminou sem resposta. Tente novamente.",
        });
      }
    },
    [router, onClose]
  );

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || PUNCTUATION_ONLY_REGEX.test(trimmed)) {
      setInlineError("Descreva o problema na arte para continuar");
      return;
    }

    setInlineError(null);
    setState({ kind: "processing", message: "Analisando o relato..." });

    try {
      const res = await fetch(`/api/campaign/${campaignId}/problem-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });

      const contentType = res.headers.get("Content-Type") ?? "";

      if (contentType.includes("application/x-ndjson")) {
        if (!res.body) {
          throw new Error("Não foi possível iniciar a correção. Tente novamente.");
        }
        await consumeNdjson(res.body);
        return;
      }

      const data = (await res.json().catch(() => null)) as
        | { analysisState?: string; guidance?: string; message?: string }
        | null;

      if (!res.ok) {
        // Apresenta SEMPRE a mensagem PT-BR da API (nunca o código técnico).
        throw new Error(
          data?.message || "Não foi possível enviar o relato. Tente novamente."
        );
      }

      setState({
        kind: "guidance",
        analysisState: data?.analysisState ?? "unclear",
        guidance:
          data?.guidance ||
          "Não conseguimos identificar um defeito objetivo. Reformule o relato.",
      });
      router.refresh();
    } catch (err) {
      setState({
        kind: "error",
        message:
          err instanceof Error
            ? err.message
            : "Não foi possível enviar o relato. Tente novamente.",
      });
    }
  }, [text, campaignId, consumeNdjson, router]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={closeIfIdle}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Informar problema na arte"
        className="max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-xl border border-border bg-bg-elevated p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold text-text-primary">
            Informar problema na arte
          </h2>
          <button
            type="button"
            onClick={closeIfIdle}
            disabled={isProcessing}
            aria-label="Fechar"
            className="flex h-9 w-9 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-lg text-text-secondary transition-colors duration-200 hover:bg-bg-surface hover:text-text-primary focus:ring-2 focus:ring-accent-green focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            ×
          </button>
        </div>

        {candidateImageUrl && (
          <img
            src={candidateImageUrl}
            alt="Arte candidata"
            className="mt-4 w-full rounded-lg border border-border object-contain"
          />
        )}

        <div className="mt-4 space-y-2 text-sm text-text-secondary font-body">
          <p className="font-medium text-text-primary">
            O que pode ser corrigido:
          </p>
          <p>
            Defeitos objetivos da arte — elemento cortado, texto ilegível, dado
            divergente do briefing, informação inventada, elemento duplicado,
            produto deformado ou composição que impeça a publicação.
          </p>
          <p className="font-medium text-text-primary">O que não é corrigido:</p>
          <p>
            Mudanças de gosto/preferência, alteração de preço, validade, produto,
            badge, fundo ou identidade, ou rebriefing. Para outra opção visual,
            gere uma nova campanha.
          </p>
        </div>

        <div className="mt-4">
          <label
            htmlFor="campaign-problem-text"
            className="mb-1 block text-sm font-medium text-text-primary font-heading"
          >
            Descreva o problema na arte
          </label>
          <textarea
            id="campaign-problem-text"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              if (inlineError) setInlineError(null);
            }}
            disabled={isProcessing}
            rows={4}
            maxLength={2000}
            className="w-full rounded-lg border border-border bg-bg-surface p-3 text-sm text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-green focus:outline-none font-body disabled:opacity-60"
            placeholder="Ex.: o preço saiu cortado na borda da arte"
          />
          {inlineError && (
            <p className="mt-2 text-sm text-accent-red font-body" aria-live="polite">
              {inlineError}
            </p>
          )}
        </div>

        {state.kind === "processing" && (
          <p className="mt-3 flex items-center gap-2 text-sm text-text-secondary font-body" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin text-accent-green" />
            {state.message}
          </p>
        )}

        {state.kind === "guidance" && (
          <div className="mt-3 rounded-lg border border-border bg-bg-surface p-3">
            <p className="text-sm text-text-primary font-body">{state.guidance}</p>
            <p className="mt-1 text-xs text-text-muted font-body">
              Você pode reformular o relato ou voltar e aprovar a arte.
            </p>
          </div>
        )}

        {state.kind === "error" && (
          <p
            className="mt-3 flex items-start gap-2 text-sm text-accent-red font-body"
            aria-live="polite"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {state.message}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            disabled={isProcessing}
            loading={isProcessing}
            aria-label="Enviar para análise"
            className="min-h-[44px]"
          >
            <Send className="h-4 w-4" />
            Enviar para análise
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={closeIfIdle}
            disabled={isProcessing}
            aria-label="Cancelar"
            className="min-h-[44px]"
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
