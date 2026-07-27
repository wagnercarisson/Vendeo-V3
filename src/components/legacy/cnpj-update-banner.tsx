"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight } from "lucide-react";

export function CnpjUpdateBanner({
  storeId,
  hasCnpj,
}: {
  storeId: string;
  hasCnpj: boolean;
}) {
  if (hasCnpj) return null;

  return (
    <div className="flex items-start gap-3 bg-amber-900/20 border border-amber-700/30 rounded-lg px-4 py-3 mb-6">
      <AlertCircle className="w-5 h-5 text-accent-amber shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-accent-amber text-sm font-heading font-semibold">
          Atualize seus dados cadastrais
        </p>
        <p className="text-text-muted text-xs font-body mt-0.5">
          Para continuar usando o Vendeo, informe seu CNPJ. Seus dados atuais
          (cr\u00e9ditos, campanhas) ser\u00e3o mantidos.
        </p>
        <Link
          href="/cadastro/cnpj"
          className="mt-2 inline-flex items-center gap-1.5 text-accent-blue hover:text-accent-blue/80 text-xs font-body underline transition-colors"
        >
          Atualizar CNPJ agora <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
