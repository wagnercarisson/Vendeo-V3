"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { validateCnpj } from "@/lib/cnpj/validate";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CnpjUpdateForm({
  storeId,
  existingCnpj,
  existingRazaoSocial,
  existingNomeFantasia,
}: {
  storeId: string;
  existingCnpj?: string;
  existingRazaoSocial?: string;
  existingNomeFantasia?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const [cnpj, setCnpj] = useState(existingCnpj ?? "");
  const [razaoSocial, setRazaoSocial] = useState(existingRazaoSocial ?? "");
  const [nomeFantasia, setNomeFantasia] = useState(existingNomeFantasia ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCnpjChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 14);
    let masked = digits;
    if (digits.length > 2) masked = digits.slice(0, 2) + "." + digits.slice(2);
    if (digits.length > 5) masked = digits.slice(0, 2) + "." + digits.slice(2, 5) + "." + digits.slice(5);
    if (digits.length > 8) masked = digits.slice(0, 2) + "." + digits.slice(2, 5) + "." + digits.slice(5, 8) + "/" + digits.slice(8);
    if (digits.length > 12) masked = digits.slice(0, 2) + "." + digits.slice(2, 5) + "." + digits.slice(5, 8) + "/" + digits.slice(8, 12) + "-" + digits.slice(12, 14);
    setCnpj(masked);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const result = validateCnpj(cnpj);
    if (result instanceof Error) {
      setError("CNPJ inválido. Verifique os dígitos e tente novamente.");
      return;
    }

    if (!razaoSocial.trim()) {
      setError("Razão social é obrigatória.");
      return;
    }

    const nomeFantasiaFinal = nomeFantasia.trim() || razaoSocial.trim();

    setSaving(true);
    try {
      const { normalized } = result;

      if (existingCnpj) {
        const res = await fetch(`/api/store/${storeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razaoSocial: razaoSocial.trim(),
            nomeFantasia: nomeFantasiaFinal,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Erro ao atualizar" }));
          throw new Error(data.error || "Erro ao atualizar dados cadastrais");
        }
      } else {
        const res = await fetch("/api/store/update-cnpj", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeId,
            cnpjNormalized: normalized,
            razaoSocial: razaoSocial.trim(),
            nomeFantasia: nomeFantasiaFinal,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Erro ao atualizar" }));
          throw new Error(data.error || "Erro ao atualizar CNPJ");
        }
      }

      setSuccess(true);
      setTimeout(async () => {
        const readinessRes = await fetch("/api/store/check-readiness", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storeId }),
        });
        const readiness = await readinessRes.json();

        if (!readiness.ready && readiness.missing?.some((m: { item: string }) => m.item === "brand_profile")) {
          router.push("/loja?required=visual-direction&message=cnpj-updated");
        } else if (returnTo) {
          router.push(returnTo);
        } else {
          router.push("/dashboard");
        }
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar");
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="flex items-center gap-3 bg-green-900/20 border border-green-700/30 rounded-lg px-4 py-3">
        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
        <div>
          <p className="text-green-500 text-sm font-heading font-semibold">
            Dados cadastrais atualizados com sucesso!
          </p>
          <p className="text-text-muted text-xs mt-0.5">
            Seus créditos e campanhas foram mantidos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="cnpj" className="block text-sm font-medium mb-1">
          CNPJ *
        </label>
        {existingCnpj ? (
          <div className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-muted">
            {existingCnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}
          </div>
        ) : (
          <input
            id="cnpj"
            type="text"
            value={cnpj}
            onChange={(e) => handleCnpjChange(e.target.value)}
            onBlur={() => {
              const digits = cnpj.replace(/\D/g, "");
              if (digits.length === 14) {
                const result = validateCnpj(cnpj);
                if (result instanceof Error) {
                  setError("CNPJ inválido. Verifique os dígitos e tente novamente.");
                }
              }
            }}
            placeholder="XX.XXX.XXX/YYYY-ZZ"
            maxLength={18}
            className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm"
            required
          />
        )}
      </div>
      <div>
        <label htmlFor="razaoSocial" className="block text-sm font-medium mb-1">
          Razão Social *
        </label>
        <input
          id="razaoSocial"
          type="text"
          value={razaoSocial}
          onChange={(e) => setRazaoSocial(e.target.value)}
          placeholder="Razão social"
          maxLength={200}
          className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm"
          required
        />
      </div>
      <div>
        <label htmlFor="nomeFantasia" className="block text-sm font-medium mb-1">
          Nome Fantasia <span className="text-muted-foreground">(opcional)</span>
        </label>
        <input
          id="nomeFantasia"
          type="text"
          value={nomeFantasia}
          onChange={(e) => setNomeFantasia(e.target.value)}
          placeholder="Nome fantasia"
          maxLength={200}
          className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm"
        />
        <p className="text-xs text-text-muted mt-1">
          Se não informado, será usado o nome da Razão Social.
        </p>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-accent-red text-xs">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={saving}
        loading={saving}
        className="w-full"
      >
        {saving ? "Salvando..." : existingCnpj ? "Completar dados cadastrais" : "Atualizar CNPJ"}
      </Button>
    </form>
  );
}
