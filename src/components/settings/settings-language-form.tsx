"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";

import type { CommonMessages, SettingsMessages } from "@/lib/i18n/messages";
import type { SupportedUiLocale } from "@/lib/market-context";

/**
 * F57.4 — formulário de idioma da interface.
 *
 * - Sem PATCH no mount: a seleção nasce das props do servidor.
 * - Escrita exclusiva via `PATCH /api/preferences` (CAS + CSRF do servidor).
 * - Confirmação derivada de estado de sucesso (`saved`), nunca de uma string
 *   capturada nem de query string; sobrevive ao `router.refresh()`.
 * - `router.refresh()` retorna `void`: nada é promisificado; o pending da
 *   transition desabilita as ações de recarga.
 */

const UI_LOCALE_OPTIONS: ReadonlyArray<{
  value: SupportedUiLocale;
  labelKey: "optionPtBr" | "optionEs419";
}> = [
  { value: "pt-BR", labelKey: "optionPtBr" },
  { value: "es-419", labelKey: "optionEs419" },
];

type ErrorKey = keyof SettingsMessages["error"];

interface PreferenceDto {
  uiLocale: SupportedUiLocale;
  version: number;
}

function isSupportedUiLocale(value: unknown): value is SupportedUiLocale {
  return value === "pt-BR" || value === "es-419";
}

function parsePreferenceDto(body: unknown): PreferenceDto | null {
  if (body === null || typeof body !== "object") return null;
  const dto = body as Record<string, unknown>;
  if (!isSupportedUiLocale(dto.uiLocale)) return null;
  if (
    typeof dto.version !== "number" ||
    !Number.isInteger(dto.version) ||
    dto.version < 0
  ) {
    return null;
  }
  return { uiLocale: dto.uiLocale, version: dto.version };
}

function statusToErrorKey(status: number): ErrorKey {
  if (status === 409) return "conflict";
  if (status === 403) return "forbidden";
  if (status === 401) return "session";
  if (status === 400) return "validation";
  if (status >= 500) return "unavailable";
  return "validation";
}

export interface SettingsLanguageFormProps {
  initialLocale: SupportedUiLocale;
  initialVersion: number;
  messages: SettingsMessages;
  common: CommonMessages;
  lang?: string;
}

export function SettingsLanguageForm({
  initialLocale,
  initialVersion,
  messages,
  common,
  lang,
}: SettingsLanguageFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selected, setSelected] = useState<SupportedUiLocale>(initialLocale);
  const [savedLocale, setSavedLocale] = useState<SupportedUiLocale>(initialLocale);
  const [version, setVersion] = useState<number>(initialVersion);
  const [saving, setSaving] = useState(false);
  const [errorKey, setErrorKey] = useState<ErrorKey | null>(null);
  const [conflict, setConflict] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sincroniza com as novas props após `router.refresh()`; o estado de sucesso
  // permanece para a confirmação sobreviver ao refresh.
  useEffect(() => {
    setSelected(initialLocale);
    setSavedLocale(initialLocale);
    setVersion(initialVersion);
    setConflict(false);
    setErrorKey(null);
  }, [initialLocale, initialVersion]);

  const dirty = selected !== savedLocale;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setSaved(false);
    setErrorKey(null);
    setConflict(false);

    try {
      const res = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uiLocale: selected, expectedVersion: version }),
      });

      if (!res.ok) {
        setConflict(res.status === 409);
        setErrorKey(statusToErrorKey(res.status));
        return;
      }

      const dto = parsePreferenceDto(await res.json().catch(() => null));
      if (!dto) {
        setErrorKey("unavailable");
        return;
      }

      setSelected(dto.uiLocale);
      setSavedLocale(dto.uiLocale);
      setVersion(dto.version);
      setSaved(true);
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setErrorKey(error instanceof TypeError ? "connection" : "unavailable");
    } finally {
      setSaving(false);
    }
  }

  function handleReload() {
    setConflict(false);
    setErrorKey(null);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-5 space-y-4 sm:space-y-6"
      lang={lang}
    >
      <fieldset>
        <legend className="text-sm font-semibold text-text-primary font-heading">
          {messages.languageSection}
        </legend>
        <div className="mt-3 space-y-2">
          {UI_LOCALE_OPTIONS.map(({ value, labelKey }) => (
            <label
              key={value}
              htmlFor={`ui-locale-${value}`}
              className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-border px-4 py-2 text-sm text-text-primary font-body hover:bg-bg-elevated transition-colors"
            >
              <input
                id={`ui-locale-${value}`}
                type="radio"
                name="uiLocale"
                value={value}
                checked={selected === value}
                onChange={() => setSelected(value)}
                disabled={saving}
                className="h-4 w-4 accent-accent-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue"
              />
              <span>{messages[labelKey]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div
        role="status"
        aria-live="polite"
        className="min-h-[1.25rem] text-sm text-accent-green font-body"
      >
        {saved ? messages.saved : null}
      </div>

      {errorKey && (
        <p role="alert" className="text-sm text-accent-red font-body">
          {messages.error[errorKey]}
          {errorKey === "session" && (
            <>
              {" "}
              <Link
                href="/login"
                className="underline underline-offset-2 hover:text-text-primary"
              >
                {messages.login}
              </Link>
            </>
          )}
        </p>
      )}

      {conflict && (
        <button
          type="button"
          onClick={handleReload}
          disabled={isPending}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-primary hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          {messages.reload}
        </button>
      )}

      <button
        type="submit"
        disabled={!dirty || saving || isPending}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-accent-blue px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {saving ? messages.saving : common.save}
      </button>
    </form>
  );
}
