"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { validateCnpj } from "@/lib/cnpj/validate";
import { normalizeCnpj } from "@/lib/cnpj/normalize";
import { hashCnpjRoot } from "@/lib/cnpj/hash";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CnpjUpdateForm({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [cnpj, setCnpj] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCnpjChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    let masked = digits;
    if (digits.length > 2) masked = digits.slice(0, 2) + "." + masked.slice(2);
    if (digits.length > 5) masked = masked.slice(0, 5) + "." + masked.slice(5);
    if (digits.length > 8) masked = masked.slice(0, 8) + "/" + masked.slice(8);
    if (digits.length > 12) masked = masked.slice(0, 12) + "-" + masked.slice(12);
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

    setSaving(true);
    try {
      const { normalized } = result;
      const rootHash = hashCnpjRoot(normalized.slice(0, 8));

      const res = await fetch("/api/store/update-cnpj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          cnpjNormalized: normalized,
          cnpjRootHash: rootHash,
          razaoSocial: razaoSocial || undefined,
          nomeFantasia: nomeFantasia || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Erro ao atualizar" }));
        throw new Error(data.error || "Erro ao atualizar CNPJ");
      }

      setSuccess(true);
      setTimeout(() => router.push("/"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar CNPJ");
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
        <input
          id="cnpj"
          type="text"
          value={cnpj}
          onChange={(e) => handleCnpjChange(e.target.value)}
          placeholder="XX.XXX.XXX/YYYY-ZZ"
          maxLength={18}
          className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm"
          required
        />
      </div>
      <div>
        <label htmlFor="razaoSocial" className="block text-sm font-medium mb-1">
          Razão Social <span className="text-muted-foreground">(opcional)</span>
        </label>
        <input
          id="razaoSocial"
          type="text"
          value={razaoSocial}
          onChange={(e) => setRazaoSocial(e.target.value)}
          placeholder="Razão social"
          maxLength={200}
          className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm"
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
        {saving ? "Salvando..." : "Atualizar CNPJ"}
      </Button>
    </form>
  );
}
