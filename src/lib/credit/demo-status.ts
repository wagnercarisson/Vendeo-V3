export type DemoStatus = "active" | "expiring_soon" | "exhausted" | "expired" | "none";

export interface DemoStatusInput {
  demoBalance: number;
  demoExpiresAt: string | null;
  originDemoGrantTxId?: string | null;
}

export function getDemoStatus(input: DemoStatusInput, now = new Date()): DemoStatus {
  if (!input.originDemoGrantTxId) return "none";
  const expiresAt = input.demoExpiresAt ? new Date(input.demoExpiresAt).getTime() : NaN;
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) return "expired";
  if (input.demoBalance <= 0) return "exhausted";
  return expiresAt - now.getTime() <= 24 * 60 * 60 * 1000 ? "expiring_soon" : "active";
}

export function formatRelativeExpiry(expiresAt: string, now = new Date()): string {
  const hours = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 3_600_000));
  if (hours >= 24) {
    const days = Math.ceil(hours / 24);
    return `expira em ${days} ${days === 1 ? "dia" : "dias"}`;
  }
  return `expira em ${hours} ${hours === 1 ? "hora" : "horas"}`;
}
