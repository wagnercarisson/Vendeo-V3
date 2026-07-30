export const BR_TIMEZONE = "America/Sao_Paulo";

export function formatDateBR(date: string | Date): string {
  return new Date(date).toLocaleDateString("pt-BR", {
    timeZone: BR_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTimeBR(date: string | Date): string {
  return new Date(date).toLocaleString("pt-BR", {
    timeZone: BR_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTimeFullBR(date: string | Date): string {
  return new Date(date).toLocaleString("pt-BR", {
    timeZone: BR_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatCurrencyBRL(valueCents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valueCents / 100);
}

export function parseCurrencyBRL(masked: string): number {
  if (!masked || masked.trim() === "") return 0;

  const cleaned = masked.replace(/[^\d,.]/g, "");

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  let normalized: string;

  if (lastComma === -1 && lastDot === -1) {
    normalized = cleaned;
  } else if (lastComma > lastDot) {
    const integerPart = cleaned.slice(0, lastComma).replace(/\./g, "");
    const decimalPart = cleaned.slice(lastComma + 1);
    normalized = integerPart + "." + decimalPart;
  } else {
    const integerPart = cleaned.slice(0, lastDot).replace(/\./g, "");
    const decimalPart = cleaned.slice(lastDot + 1);
    normalized = integerPart + "." + decimalPart;
  }

  const parsed = parseFloat(normalized);

  if (isNaN(parsed)) return 0;

  return Math.round(parsed * 100);
}
