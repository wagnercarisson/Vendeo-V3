"use client";

import { useEffect, useState } from "react";

// Discrete iOS install hint — shown ONLY on iPhone/iPad/iPod Safari outside of
// standalone mode. Renders null on initial SSR (visible starts false), so there
// is no hydration mismatch and no visual change on desktop/Android/standalone.
export function InstallHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    setVisible(isIos && !isStandalone);
  }, []);

  if (!visible) return null;

  return (
    <p className="text-xs text-text-muted font-body">
      Dica: use Compartilhar → &ldquo;Adicionar à Tela de Início&rdquo; para
      instalar o Vendeo.
    </p>
  );
}
