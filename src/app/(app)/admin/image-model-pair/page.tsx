import { redirect } from "next/navigation";

/**
 * Rota legada preservada. A configuração do par de modelos do Produto 1:1 foi
 * incorporada à página unificada `/admin/ai-model-selection` como a seção
 * "Imagem de campanhas — Produto 1:1". Links e atalhos existentes continuam
 * funcionando por meio deste redirecionamento.
 *
 * A proteção administrativa é preservada pelo layout `admin` (`requireAdmin`),
 * que envolve esta rota antes de qualquer redirecionamento.
 */
export const dynamic = "force-dynamic";

export default function AdminImageModelPairPage() {
  redirect("/admin/ai-model-selection#produto-1-1-imagem");
}
