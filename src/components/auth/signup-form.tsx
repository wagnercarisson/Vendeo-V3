"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/supabase/site-url";
import { CaptchaField, CAPTCHA_HINT_TEXT } from "@/components/auth/captcha-field";
import {
  PrivacyAcknowledgeModal,
} from "@/components/legal/privacy-acknowledge-modal";
import {
  CommunicationsConsentModal,
} from "@/components/legal/communications-consent-modal";
import { buildDocumentInfo } from "@/lib/legal/document-content";
import { useRouter } from "next/navigation";
import { useState, FormEvent, MouseEvent } from "react";
import { Mail, Lock, Loader2 } from "lucide-react";

interface LegalDocumentInfo {
  label: string;
  version: string;
  url: string;
}

interface SignupFormProps {
  captchaEnabled: boolean;
  policyDocument?: LegalDocumentInfo | null;
  termsDocument?: LegalDocumentInfo | null;
}

const GENERIC_ERROR = "Não foi possível concluir. Tente novamente.";

export function SignupForm({
  captchaEnabled,
  policyDocument,
  termsDocument,
}: SignupFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [legalDoc, setLegalDoc] = useState<LegalDocumentInfo | null>(null);
  const [communicationsOpen, setCommunicationsOpen] = useState(false);
  const [communicationsOptIn, setCommunicationsOptIn] = useState(false);

  const privacyDoc =
    policyDocument ??
    buildDocumentInfo("privacy_policy", "v1.3") ?? {
      label: "Política de Privacidade",
      version: "v1.3",
      url: "/docs/legal/privacy-policy-v1-3.md",
    };
  const termsDoc =
    termsDocument ??
    buildDocumentInfo("terms_of_service", "v1.4") ?? {
      label: "Termos de Uso",
      version: "v1.4",
      url: "/docs/legal/terms-of-service-v1-4.md",
    };

  function setPrivacyPending() {
    const pending = {
      privacyAcknowledged: true,
      communicationsOptIn,
    };
    try {
      window.localStorage.setItem("privacyPending", JSON.stringify(pending));
    } catch {
      // storage indisponível — o PrivacyRecovery não consegue processar,
      // mas o fluxo principal não pode quebrar por isso.
    }
  }

  function openLegalDoc(
    e: MouseEvent<HTMLAnchorElement>,
    doc: LegalDocumentInfo,
  ) {
    // Clique normal abre o modal informativo; modifier-click / botão != 0
    // preserva o href (abrir em nova aba, copiar link).
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    setLegalDoc(doc);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirm = formData.get("confirm") as string;

    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    // D3: token Turnstile exigido apenas quando captchaEnabled (flag off
    // restaura o comportamento F41 — cadastro sem desafio).
    if (captchaEnabled && !captchaToken) {
      return;
    }

    setLoading(true);

    try {
      const supabase = createBrowserClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${getSiteUrl()}/auth/confirm`,
          ...(captchaEnabled && captchaToken ? { captchaToken } : {}),
        },
      });

      // Anti-enumeração D2: sucesso E "already registered" → mesma resposta.
      // Nunca revelar se o email já existe.
      const isAlreadyRegistered =
        signUpError &&
        /already registered|already been registered|existe|registered/i.test(
          signUpError.message ?? "",
        );

      if (!signUpError || isAlreadyRegistered) {
        setPrivacyPending();
        router.replace("/check-email?type=signup");
        return;
      }

      // Erro operacional (captcha, rede, etc.) — mensagem genérica.
      setError(GENERIC_ERROR);
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setLoading(false);
      // T-42-08b: tokens Turnstile são single-use — reseta após o submit.
      // Só se aplica com captcha ativo (sem widget, não há token a resetar).
      if (captchaEnabled) {
        setCaptchaToken(null);
        setCaptchaResetKey((key) => key + 1);
      }
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="signup-email" className="mb-1 block text-sm font-medium text-slate-300">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              id="signup-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-lg border border-slate-600 bg-slate-800 py-3 pl-10 pr-3 text-slate-50 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              style={{ minHeight: "44px" }}
            />
          </div>
        </div>

        <div>
          <label htmlFor="signup-password" className="mb-1 block text-sm font-medium text-slate-300">
            Senha
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              id="signup-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 py-3 pl-10 pr-3 text-slate-50 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              style={{ minHeight: "44px" }}
            />
          </div>
        </div>

        <div>
          <label htmlFor="signup-confirm" className="mb-1 block text-sm font-medium text-slate-300">
            Confirmar senha
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              id="signup-confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 py-3 pl-10 pr-3 text-slate-50 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              style={{ minHeight: "44px" }}
            />
          </div>
        </div>

        <label className="flex items-start gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={communicationsOptIn}
            onChange={(e) => setCommunicationsOptIn(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 accent-blue-600"
          />
          <span className="text-slate-300">
            Quero receber comunicações comerciais (opcional).{" "}
            <button
              type="button"
              onClick={() => setCommunicationsOpen(true)}
              className="text-blue-400 hover:text-blue-300 hover:underline"
            >
              Saiba mais
            </button>
          </span>
        </label>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {captchaEnabled && (
          <CaptchaField
            onVerify={setCaptchaToken}
            resetKey={captchaResetKey}
            hint={CAPTCHA_HINT_TEXT}
          />
        )}

        <p className="text-xs text-slate-400">
          Ao clicar em Criar conta, você concorda com os{" "}
          <a
            href="/termos"
            onClick={(e) => openLegalDoc(e, termsDoc)}
            className="text-blue-400 hover:text-blue-300 hover:underline"
          >
            Termos de Uso
          </a>{" "}
          e declara ciência da{" "}
          <a
            href="/privacidade"
            onClick={(e) => openLegalDoc(e, privacyDoc)}
            className="text-blue-400 hover:text-blue-300 hover:underline"
          >
            Política de Privacidade
          </a>{" "}
          do Vendeo.
        </p>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-lg bg-blue-600 py-3 font-medium text-white transition-colors duration-200 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          style={{ minHeight: "44px" }}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            "Criar conta"
          )}
        </button>
      </form>

      {legalDoc && (
        <PrivacyAcknowledgeModal
          mode="informative"
          open={true}
          onOpenChange={(open) => {
            if (!open) setLegalDoc(null);
          }}
          policyDocument={legalDoc}
        />
      )}
      <CommunicationsConsentModal
        open={communicationsOpen}
        onOpenChange={setCommunicationsOpen}
        onConfirm={async () => {
          setCommunicationsOptIn(true);
          return true;
        }}
      />
    </>
  );
}
