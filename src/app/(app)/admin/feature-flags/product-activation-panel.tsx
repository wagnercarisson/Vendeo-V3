"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { ProductActivationMode } from "@/lib/product-1-1/activation/schemas";
import type { ProductActivationState } from "@/lib/product-1-1/activation/activation-state";

type Mode = ProductActivationMode;

const MODES: Array<{ value: Mode; label: string; description: string }> = [
  {
    value: "off",
    label: "Desligado (legado)",
    description: "Novas geracoes voltam ao fluxo legado; campanhas existentes sao preservadas.",
  },
  {
    value: "test_stores",
    label: "Somente lojas de teste",
    description: "Novo fluxo habilitado para lojas com is_test_store=true.",
  },
  {
    value: "all_stores",
    label: "Todas as lojas",
    description: "Abertura geral: exige as autorizacoes all_stores e test_stores.",
  },
];

function modeLabel(mode: ProductActivationState["mode"]): string {
  if (mode === "off") return "Desligado (legado)";
  if (mode === "test_stores") return "Somente lojas de teste";
  if (mode === "all_stores") return "Todas as lojas";
  return "Estado inconsistente";
}

export function ProductActivationPanel({
  initialState,
  initialError,
}: {
  initialState: ProductActivationState | null;
  initialError?: string | null;
}) {
  const [state, setState] = useState<ProductActivationState | null>(initialState);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState<Mode | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [success, setSuccess] = useState<string | null>(null);

  async function activate(mode: Mode) {
    if (!reason.trim()) {
      setError("Motivo obrigatorio");
      return;
    }
    if (mode === "all_stores" && confirm.trim() !== "ALL_STORES") {
      setError('Digite ALL_STORES para confirmar a abertura geral');
      return;
    }

    setLoading(mode);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/admin/product-1-1-activation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          reason: reason.trim(),
          operationId: crypto.randomUUID(),
          ...(mode === "all_stores" ? { confirm: "ALL_STORES" } : {}),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || `Erro ${response.status}`);
      }

      // O endpoint relê o estado após a RPC. Em replay idempotente, o modo
      // historico NAO e exibido como atual.
      if (body.currentState) {
        setState(body.currentState as ProductActivationState);
      }
      setSuccess(`Estado atual verificado: ${modeLabel(body.currentMode)}.`);
      setReason("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao ativar");
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-border p-4">
      <div>
        <h2 className="text-lg font-semibold">Produto 1:1 - ativacao</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Acao administrativa auditada. A RPC executa flags e autorizacoes em uma
          unica transacao; falhas revertem tudo. O checkpoint humano registra a
          autorizacao operacional.
        </p>
      </div>

      <div className="rounded-md border border-border bg-bg-surface p-3 text-sm">
        <div className="font-medium">
          Estado atual:{" "}
          <span data-testid="activation-current-mode">
            {state ? modeLabel(state.mode) : "indisponivel"}
          </span>
        </div>
        {state && (
          <div className="mt-1 text-xs text-muted-foreground">
            Flags: teste={String(state.flags.testStores)} | geral=
            {String(state.flags.allStores)} | autorizacoes: teste=
            {state.authorizations.testStores} | geral=
            {state.authorizations.allStores}
          </div>
        )}
      </div>

      <label className="block text-sm">
        Motivo da alteracao (obrigatorio)
        <input
          type="text"
          value={reason}
          disabled={loading !== null}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ex.: janela de validacao aprovada"
          className="mt-1 w-full rounded-md border border-border bg-bg-surface px-2 py-1 text-sm disabled:opacity-50"
        />
      </label>

      <label className="block text-sm">
        Confirmacao para todas as lojas
        <input
          type="text"
          value={confirm}
          disabled={loading !== null}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Digite ALL_STORES"
          className="mt-1 w-full rounded-md border border-border bg-bg-surface px-2 py-1 text-sm disabled:opacity-50"
        />
      </label>

      <div className="grid gap-2 md:grid-cols-3">
        {MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            disabled={loading !== null}
            onClick={() => activate(mode.value)}
            className="rounded-md border border-border px-3 py-2 text-left text-sm font-medium disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-1">
              {loading === mode.value && <Loader2 className="h-3 w-3 animate-spin" />}
              {mode.label}
            </span>
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              {mode.description}
            </span>
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {success && <p className="text-xs text-accent-green">{success}</p>}
    </section>
  );
}
