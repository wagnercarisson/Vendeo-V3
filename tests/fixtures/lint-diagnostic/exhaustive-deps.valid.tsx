"use client";

import { useEffect } from "react";

/**
 * Contraparte válida de `exhaustive-deps.fixture.tsx`: dependência declarada.
 */
export function EffectDepsValid({ label }: { label: string }) {
  useEffect(() => {
    console.log(label);
  }, [label]);

  return <span>{label}</span>;
}
