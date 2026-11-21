"use client";

import { useState } from "react";

/**
 * Fixture sintética: hook chamado condicionalmente.
 * Deve disparar exatamente `react-hooks/rules-of-hooks` (severidade error).
 */
export function ConditionalHookFixture({ enabled }: { enabled: boolean }) {
  if (enabled) {
    const [count] = useState(0);
    return <span>{count}</span>;
  }
  return <span>desligado</span>;
}
