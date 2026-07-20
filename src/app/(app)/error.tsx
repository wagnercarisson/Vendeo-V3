"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <ErrorState
      role="alert"
      title="Algo deu errado"
      description="Não foi possível carregar esta página. Tente novamente ou entre em contato com o suporte se o problema persistir."
      action={{
        label: "Tentar novamente",
        onClick: () => reset(),
      }}
    />
  );
}
