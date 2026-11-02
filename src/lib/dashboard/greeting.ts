import type { SupportedUiLocale } from "@/lib/i18n/locales";

/**
 * Período da saudação do dashboard.
 * - `welcome`: sem loja/nome.
 * - `neutral`: fuso nulo/inválido ou falha de formatação (nunca inventa fuso).
 */
export type GreetingPeriod =
  | "morning"
  | "afternoon"
  | "evening"
  | "neutral"
  | "welcome";

export interface GreetingMessages {
  readonly morning: string;
  readonly afternoon: string;
  readonly evening: string;
  readonly neutral: string;
  readonly welcome: string;
  readonly nameSeparator: string;
}

export interface ResolveDashboardGreetingInput {
  storeName: string | null;
  timeZone: string | null;
  locale: SupportedUiLocale;
  now: Date;
  messages: GreetingMessages;
}

export interface ResolvedDashboardGreeting {
  period: GreetingPeriod;
  storeName: string | null;
}

/**
 * Resolve o período da saudação no fuso da loja.
 *
 * Função pura: recebe `now` injetado, não acessa banco, relógio do servidor
 * (`getHours()`) nem infere fuso por locale/IP. `locale` é apenas o argumento do
 * formatador Intl. Fuso nulo, inválido ou falha de formatação ⇒ `neutral`. Sem
 * loja ⇒ `welcome`. O texto final (`messages[period]` + separador + nome) é
 * responsabilidade do consumidor.
 */
export function resolveDashboardGreeting(
  input: ResolveDashboardGreetingInput,
): ResolvedDashboardGreeting {
  const { storeName, timeZone, locale, now } = input;

  if (storeName === null || storeName.trim() === "") {
    return { period: "welcome", storeName: null };
  }

  if (timeZone === null || timeZone.trim() === "") {
    return { period: "neutral", storeName };
  }

  try {
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone,
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);

    const hourPart = parts.find((part) => part.type === "hour")?.value;
    if (hourPart === undefined) {
      return { period: "neutral", storeName };
    }

    let hour = Number(hourPart);
    if (Number.isNaN(hour)) {
      return { period: "neutral", storeName };
    }
    // Alguns ambientes normalizam meia-noite como "24".
    if (hour === 24) hour = 0;

    let period: GreetingPeriod;
    if (hour >= 6 && hour <= 11) {
      period = "morning";
    } else if (hour >= 12 && hour <= 17) {
      period = "afternoon";
    } else {
      period = "evening";
    }

    return { period, storeName };
  } catch {
    return { period: "neutral", storeName };
  }
}
