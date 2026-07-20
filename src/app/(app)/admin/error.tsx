"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin error:", error);
  }, [error]);

  return (
    <div>
      <ErrorState
        role="alert"
        title="Algo deu errado"
        description="Não foi possível carregar esta página. Tente novamente ou volte ao painel principal."
        action={{
          label: "Tentar novamente",
          onClick: () => reset(),
        }}
      />
      <div className="mt-4 text-center">
        <Link
          href="/admin"
          className="text-sm text-accent-blue hover:underline focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Voltar ao painel administrativo
        </Link>
      </div>
    </div>
  );
}
