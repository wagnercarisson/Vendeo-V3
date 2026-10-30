"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";

import type { CommonMessages, SettingsMessages } from "@/lib/i18n/messages";

/**
 * F57.4 — estado de erro da leitura de preferências em `/configuracoes`.
 *
 * Não renderiza formulário nem dispara escrita: a única ação é recarregar a
 * leitura via `router.refresh()` (void — o pending vem da transition).
 */
export interface SettingsLoadErrorProps {
  messages: SettingsMessages;
  common: CommonMessages;
  lang?: string;
}

export function SettingsLoadError({
  messages,
  common,
  lang,
}: SettingsLoadErrorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRetry() {
    if (isPending) return;
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="p-5 space-y-4" lang={lang}>
      <p role="alert" className="text-sm text-text-muted font-body">
        {messages.error.load}
      </p>
      <button
        type="button"
        onClick={handleRetry}
        disabled={isPending}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-primary hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RotateCcw className="h-4 w-4" />
        )}
        {common.retry}
      </button>
    </div>
  );
}
