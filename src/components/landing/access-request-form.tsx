"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { STORE_SEGMENTS } from "@/lib/constants";
import { maskWhatsApp } from "@/lib/validators/phone";

type FormState = "idle" | "submitting" | "error";

export function AccessRequestForm({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const [state, setState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("submitting");
    setErrorMessage("");

    const formData = new FormData(e.currentTarget);
    const payload = {
      email: formData.get("email"),
      store_name: formData.get("store_name"),
      segment: formData.get("segment"),
      whatsapp: formData.get("whatsapp"),
    };

    try {
      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setState("error");
        setErrorMessage("Não foi possível registrar sua solicitação. Tente novamente.");
        return;
      }

      // Resposta idêntica para novo e duplicado — não distinguir (anti-enumeração)
      onSuccess?.();
    } catch {
      setState("error");
      setErrorMessage("Erro de conexão. Tente novamente.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        name="email"
        type="email"
        label="Email"
        placeholder="voce@loja.com.br"
        required
        autoComplete="email"
      />
      <Input
        name="store_name"
        label="Nome da loja"
        placeholder="Sua loja"
        maxLength={100}
        autoComplete="organization"
      />
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="access-request-segment"
          className="text-sm font-medium text-text-primary font-heading"
        >
          Segmento
        </label>
        <select
          id="access-request-segment"
          name="segment"
          defaultValue=""
          className="min-h-[44px] rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder-text-muted transition-colors duration-200 focus:ring-2 focus:ring-accent-green focus:outline-none"
        >
          <option value="">Prefiro não informar</option>
          {STORE_SEGMENTS.map((segment) => (
            <option key={segment.value} value={segment.value}>
              {segment.label}
            </option>
          ))}
        </select>
      </div>
      <Input
        name="whatsapp"
        label="WhatsApp"
        placeholder="(00) 00000-0000"
        value={whatsapp}
        onChange={(e) => setWhatsapp(maskWhatsApp(e.target.value))}
        maxLength={15}
        autoComplete="tel"
      />

      {state === "error" && errorMessage && (
        <p role="alert" className="text-sm text-accent-red">
          {errorMessage}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        loading={state === "submitting"}
        disabled={state === "submitting"}
      >
        {state === "submitting" ? "Enviando..." : "Solicitar acesso free"}
      </Button>
    </form>
  );
}
