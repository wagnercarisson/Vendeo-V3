"use client";

import { useEffect } from "react";

/**
 * Fixture sintética: efeito lê uma dependência que não foi declarada.
 * Deve disparar exatamente `react-hooks/exhaustive-deps`.
 */
export function EffectDepsFixture({ label }: { label: string }) {
  useEffect(() => {
    console.log(label);
  }, []);

  return <span>{label}</span>;
}
