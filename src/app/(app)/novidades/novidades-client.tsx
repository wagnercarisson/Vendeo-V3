"use client";

import { useEffect } from "react";

import { useChangelogState } from "@/hooks/use-changelog-state";

interface NovidadesClientProps {
  latestEntryId: string | null;
  latestAnnouncementId?: string;
}

/**
 * Efeito colateral de marcação de visualização: ao montar (visita a
 * /novidades), atualiza SEEN_KEY e, se houver anúncio ativo, também
 * DISMISSED_KEY (D3/D4 — visitar /novidades limpa indicador E dispensa
 * anúncio ativo). Renderiza vazio.
 */
export function NovidadesClient({
  latestEntryId,
  latestAnnouncementId,
}: NovidadesClientProps) {
  const { markChangelogAsViewed } = useChangelogState();

  useEffect(() => {
    if (latestEntryId) {
      markChangelogAsViewed(latestEntryId, latestAnnouncementId);
    }
  }, [latestEntryId, latestAnnouncementId, markChangelogAsViewed]);

  return null;
}
