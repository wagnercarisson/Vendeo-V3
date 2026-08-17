"use client";

import { useEffect, useId, useRef } from "react";

const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TURNSTILE_SCRIPT_MARKER = "data-vendeo-turnstile";

interface TurnstileRenderOptions {
  sitekey: string;
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact" | "flexible";
}

interface TurnstileApi {
  render: (
    container: string | HTMLElement,
    options: TurnstileRenderOptions,
  ) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface CaptchaFieldProps {
  /** Recebe o token Turnstile quando o usuário resolve o desafio; null ao expirar/errar */
  onVerify: (token: string | null) => void;
  label?: string;
  hint?: string;
  className?: string;
  /** Quando muda, o widget é removido e recriado — reset pós-submit (T-42-08b, tokens single-use) */
  resetKey?: number;
}

// Guarda de duplicados: o script do Turnstile é compartilhado entre instâncias
// e só é removido quando a última instância montada desmonta. O script é
// rastreado no nível do módulo — se a instância criadora desmontar antes das
// demais, a remoção acontece na desmontagem da última (contador 0).
let mountedWidgetCount = 0;
let injectedTurnstileScript: HTMLScriptElement | null = null;

export function CaptchaField({
  onVerify,
  label = "Verificação de segurança",
  hint,
  className = "",
  resetKey = 0,
}: CaptchaFieldProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const rawId = useId();
  const containerId = `captcha-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const onVerifyRef = useRef(onVerify);
  onVerifyRef.current = onVerify;

  useEffect(() => {
    if (!siteKey) {
      return;
    }

    // Pós-hydration: token vazio até o widget resolver o desafio.
    onVerifyRef.current(null);

    // Injeta o script do Turnstile (render explícito), deduplicado por
    // data-attribute — duplicatas de injecção são evitadas entre instâncias.
    if (
      !injectedTurnstileScript &&
      !document.querySelector(`script[${TURNSTILE_SCRIPT_MARKER}]`)
    ) {
      injectedTurnstileScript = document.createElement("script");
      injectedTurnstileScript.src = TURNSTILE_SCRIPT_SRC;
      injectedTurnstileScript.async = true;
      injectedTurnstileScript.defer = true;
      injectedTurnstileScript.setAttribute(TURNSTILE_SCRIPT_MARKER, "true");
      document.head.appendChild(injectedTurnstileScript);
    }
    mountedWidgetCount += 1;

    let widgetId: string | null = null;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    const tryRender = () => {
      if (!window.turnstile) {
        return false;
      }
      const container = document.getElementById(containerId);
      if (!container) {
        return false;
      }
      widgetId = window.turnstile.render(container, {
        sitekey: siteKey,
        callback: (token: string) => onVerifyRef.current(token),
        "expired-callback": () => onVerifyRef.current(null),
        "error-callback": () => onVerifyRef.current(null),
        theme: "dark",
        size: "flexible",
      });
      return true;
    };

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = undefined;
      }
    };

    if (!tryRender()) {
      // O script pode ainda não ter carregado — aguarda a API ficar disponível.
      pollTimer = setInterval(() => {
        if (tryRender()) {
          stopPolling();
        }
      }, 250);
    }

    return () => {
      stopPolling();
      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
      mountedWidgetCount -= 1;
      if (mountedWidgetCount === 0 && injectedTurnstileScript?.parentNode) {
        injectedTurnstileScript.parentNode.removeChild(
          injectedTurnstileScript,
        );
        injectedTurnstileScript = null;
      }
    };
  }, [siteKey, containerId, resetKey]);

  if (!siteKey) {
    return null;
  }

  return (
    <div className={className}>
      <label htmlFor={containerId} className="sr-only">
        {label}
      </label>
      {/* Render explícito (turnstile.render no effect); data attributes
          mantidos por contrato de interface (inertes no modo explícito). */}
      <div
        id={containerId}
        className="cf-turnstile"
        data-sitekey={siteKey}
        data-callback="vendeo-turnstile-callback"
        data-theme="dark"
        data-size="flexible"
        aria-label="Verificação de segurança (não é robô)"
      />
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}