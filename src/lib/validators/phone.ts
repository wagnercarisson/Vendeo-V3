/**
 * Máscara progressiva de WhatsApp no formato (11) 99999-9999.
 *
 * Função pura (sem React, sem server-only) espelhando o padrão de
 * src/lib/validators/color.ts. Idempotente: valor já mascarado passa
 * inalterado, não-dígitos são removidos e a entrada é truncada em 11
 * dígitos (15 caracteres finais — dentro do limite `max(20)` do schema
 * zod de POST /api/access-requests).
 */
export function maskWhatsApp(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";

  if (digits.length > 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length > 2) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  return digits;
}
