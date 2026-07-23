"use client";

import { useEffect, useState, useCallback } from "react";

interface PendingPrivacy {
  privacyAcknowledged: boolean;
  communicationsOptIn: boolean;
}

export function PrivacyRecovery() {
  const [pending, setPending] = useState<PendingPrivacy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const processPending = useCallback(async (data: PendingPrivacy) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/legal/acknowledge-privacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ communicationsOptIn: data.communicationsOptIn }),
      });

      if (res.ok) {
        sessionStorage.removeItem("privacyPending");
        setPending(null);
      } else {
        setError("Não foi possível registrar sua ciência da Política de Privacidade.");
      }
    } catch {
      setError("Erro de conexão ao registrar ciência de privacidade.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("privacyPending");
      if (stored) {
        const data = JSON.parse(stored) as PendingPrivacy;
        if (data.privacyAcknowledged) {
          setPending(data);
          processPending(data);
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [processPending]);

  if (!error) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg bg-amber-900/90 px-4 py-3 shadow-lg border border-amber-700/50">
      <p className="text-sm text-amber-200">
        {error}
      </p>
      <button
        onClick={() => setError(null)}
        className="mt-2 text-xs text-amber-300 underline hover:text-amber-100"
      >
        Dispensar
      </button>
    </div>
  );
}
