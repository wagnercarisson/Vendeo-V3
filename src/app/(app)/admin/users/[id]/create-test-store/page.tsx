"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { validateCnpj } from "@/lib/cnpj/validate";
import { formatCnpjInput, hasInvalidCnpjChars } from "@/lib/cnpj/input-mask";

export default function CreateTestStorePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [userId, setUserId] = useState<string>("");
  const [name, setName] = useState("");
  const [segment, setSegment] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cnpjInputError, setCnpjInputError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    params.then(p => setUserId(p.id));
  }, [params]);

  const handleCnpjChange = (raw: string) => {
    // Fail-closed: unknown characters never mutate the value; the controlled
    // input keeps the last valid value and the error blocks submission.
    if (hasInvalidCnpjChars(raw)) {
      setCnpjInputError("CNPJ inválido");
      return;
    }

    const next = formatCnpjInput(raw, cnpj);
    setCnpj(next);

    // Only a COMPLETE valid entry clears the error; empty keeps the block.
    if (!(validateCnpj(next) instanceof Error)) {
      setCnpjInputError(null);
    }
  };

  const handleCnpjPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    // Inspect the raw clipboard BEFORE maxLength truncates and before onChange,
    // so a hostile character after position 18 is never silently dropped.
    const rawPaste = e.clipboardData?.getData("text") ?? "";
    if (hasInvalidCnpjChars(rawPaste)) {
      e.preventDefault();
      setCnpjInputError("CNPJ inválido");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (cnpjInputError) { setError("CNPJ inválido"); return; }
    if (!name.trim()) { setError("Nome da loja é obrigatório"); return; }
    if (!segment) { setError("Segmento é obrigatório"); return; }
    if (!cnpj) { setError("CNPJ é obrigatório"); return; }

    const cnpjResult = validateCnpj(cnpj);
    if (cnpjResult instanceof Error) { setError("CNPJ inválido"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/stores/create-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          name: name.trim(),
          segment,
          cnpj: cnpjResult.normalized,
          razaoSocial: razaoSocial || undefined,
          nomeFantasia: nomeFantasia || undefined,
          city: city || undefined,
          state: state || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao criar loja de teste");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-md mx-auto py-8">
        <div className="flex items-start gap-3 bg-green-900/20 border border-green-700/30 rounded-lg px-4 py-3 mb-6">
          <CheckCircle2 className="w-5 h-5 text-accent-green shrink-0 mt-0.5" />
          <div>
            <p className="text-accent-green text-sm font-body font-semibold">Store de teste criada!</p>
            <p className="text-text-muted text-xs mt-1">A loja foi criada com status de teste.</p>
          </div>
        </div>
        <button
          onClick={() => router.push(`/admin/users/${userId}`)}
          className="text-accent-blue hover:underline text-sm"
        >
          Voltar para o usuário
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-8">
      <h1 className="text-2xl font-heading font-bold mb-2">Criar Store de Teste</h1>
      <p className="text-text-secondary text-sm mb-6">Cria uma loja com is_test_store=true. CNPJ não é consultado em API externa.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" value={userId} readOnly />

        <div>
          <label className="block text-xs font-heading font-semibold uppercase tracking-wider text-text-muted mb-1">Nome da Loja *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-bg-surface border border-border-light rounded-lg min-h-[44px] px-3.5 py-2.5 text-sm" placeholder="Loja de Teste" />
        </div>

        <div>
          <label className="block text-xs font-heading font-semibold uppercase tracking-wider text-text-muted mb-1">CNPJ * (validação local apenas)</label>
          <input type="text" value={cnpj} onPaste={handleCnpjPaste} onChange={e => handleCnpjChange(e.target.value)} className="w-full bg-bg-surface border border-border-light rounded-lg min-h-[44px] px-3.5 py-2.5 text-sm font-mono" placeholder="XX.XXX.XXX/XXXX-DV" maxLength={18} />
        </div>

        <div>
          <label className="block text-xs font-heading font-semibold uppercase tracking-wider text-text-muted mb-1">Razão Social</label>
          <input type="text" value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} className="w-full bg-bg-surface border border-border-light rounded-lg min-h-[44px] px-3.5 py-2.5 text-sm" />
        </div>

        <div>
          <label className="block text-xs font-heading font-semibold uppercase tracking-wider text-text-muted mb-1">Nome Fantasia</label>
          <input type="text" value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} className="w-full bg-bg-surface border border-border-light rounded-lg min-h-[44px] px-3.5 py-2.5 text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-heading font-semibold uppercase tracking-wider text-text-muted mb-1">Cidade</label>
            <input type="text" value={city} onChange={e => setCity(e.target.value)} className="w-full bg-bg-surface border border-border-light rounded-lg min-h-[44px] px-3.5 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-heading font-semibold uppercase tracking-wider text-text-muted mb-1">UF</label>
            <input type="text" value={state} onChange={e => setState(e.target.value)} className="w-full bg-bg-surface border border-border-light rounded-lg min-h-[44px] px-3.5 py-2.5 text-sm" maxLength={2} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-heading font-semibold uppercase tracking-wider text-text-muted mb-1">Segmento *</label>
          <select value={segment} onChange={e => setSegment(e.target.value)} className="w-full bg-bg-surface border border-border-light rounded-lg min-h-[44px] px-3.5 py-2.5 text-sm">
            <option value="">Selecione</option>
            <option value="moda-calcados-acessorios">Moda, Calçados e Acessórios</option>
            <option value="bebidas-adegas-conveniencia">Bebidas, Adega e Conveniência</option>
            <option value="padaria-confeitaria-doces">Padaria e Confeitaria</option>
            <option value="beleza-estetica">Beleza e Estética</option>
            <option value="mercados-mercearias">Mercados e Mercearias</option>
            <option value="outros">Outros</option>
          </select>
        </div>

        {(cnpjInputError ?? error) && (
          <div className="flex items-start gap-2 bg-red-900/20 border border-red-700/30 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 text-accent-red shrink-0 mt-0.5" />
            <p className="text-accent-red text-xs">{cnpjInputError ?? error}</p>
          </div>
        )}

        <button type="submit" disabled={saving} className="min-h-[44px] w-full px-8 py-2.5 bg-accent-blue text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</> : "Criar Store de Teste"}
        </button>
      </form>
    </div>
  );
}
