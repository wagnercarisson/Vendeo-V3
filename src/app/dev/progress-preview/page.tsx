import { notFound } from "next/navigation";
import { ProgressPreviewClient } from "./preview-client";

/**
 * F56.2b2c (B2.3) — página de reprodução LOCAL (dev-only). Não é rota pública
 * permanente: em produção retorna 404. Sem provider, sem flags, sem geração paga.
 */
export const dynamic = "force-static";

export default function ProgressPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ProgressPreviewClient />;
}
