export function isCnpjDuplicateError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string; details?: string };
  if (e.code !== "23505") return false;
  const text = `${e.message ?? ""} ${e.details ?? ""}`;
  return text.includes("idx_stores_cnpj_normalized") || text.includes("cnpj_normalized");
}

import { NextResponse } from "next/server";

export function CNPJ_DUPLICATE_RESPONSE() {
  return NextResponse.json(
    {
      error: "Este CNPJ já está cadastrado em outra loja. Verifique o número informado ou fale com o suporte caso esta empresa seja sua.",
      code: "cnpj_already_registered",
    },
    { status: 409 }
  );
}
