"use client";

import { useState } from "react";

/**
 * Contraparte válida de `rules-of-hooks.fixture.tsx`: hook no topo do componente.
 */
export function ConditionalHookValid({ enabled }: { enabled: boolean }) {
  const [count] = useState(0);
  return <span>{enabled ? count : 0}</span>;
}
