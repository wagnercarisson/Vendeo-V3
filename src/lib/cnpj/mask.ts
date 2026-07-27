export function maskCnpj(normalized: string): string {
  if (normalized.length !== 14 || !/^\d{14}$/.test(normalized)) {
    return normalized;
  }
  const suffix = normalized.slice(8, 12);
  return `**.***.***/${suffix}-**`;
}
