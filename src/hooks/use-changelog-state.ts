import { useCallback, useEffect, useState } from "react";

export const CHANGELOG_SEEN_KEY = "vendeo:last_seen_changelog_id";
export const CHANGELOG_DISMISSED_KEY = "vendeo:dismissed_changelog_announcement_id";

const CHANGELOG_VIEWED_EVENT = "vendeo:changelog-viewed";

export interface UseChangelogStateReturn {
  lastSeenId: string | null;
  dismissedId: string | null;
  markChangelogAsViewed: (latestEntryId: string, latestAnnouncementId?: string) => void;
  dismissAnnouncement: (id: string) => void;
  hasUnseen: (latestId: string) => boolean;
  isAnnouncementVisible: (entryId: string) => boolean;
}

function readLocalStorageValues(): {
  lastSeenId: string | null;
  dismissedId: string | null;
} {
  try {
    return {
      lastSeenId: window.localStorage.getItem(CHANGELOG_SEEN_KEY),
      dismissedId: window.localStorage.getItem(CHANGELOG_DISMISSED_KEY),
    };
  } catch {
    return { lastSeenId: null, dismissedId: null };
  }
}

/**
 * Controla o estado de leitura do changelog via localStorage com duas chaves
 * independentes (SSR-safe: localStorage é acessado APENAS dentro de useEffect
 * e handlers, nunca durante o render — F35-STATE-01).
 */
export function useChangelogState(): UseChangelogStateReturn {
  const [lastSeenId, setLastSeenId] = useState<string | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    const { lastSeenId: seen, dismissedId: dismissed } = readLocalStorageValues();
    setLastSeenId(seen);
    setDismissedId(dismissed);

    const sync = () => {
      const values = readLocalStorageValues();
      setLastSeenId(values.lastSeenId);
      setDismissedId(values.dismissedId);
    };

    window.addEventListener("storage", sync);
    window.addEventListener(CHANGELOG_VIEWED_EVENT, sync);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CHANGELOG_VIEWED_EVENT, sync);
    };
  }, []);

  const markChangelogAsViewed = useCallback(
    (latestEntryId: string, latestAnnouncementId?: string) => {
      try {
        window.localStorage.setItem(CHANGELOG_SEEN_KEY, latestEntryId);
        if (latestAnnouncementId) {
          window.localStorage.setItem(
            CHANGELOG_DISMISSED_KEY,
            latestAnnouncementId,
          );
        }
      } catch {
        // localStorage indisponível (ex: modo privado) — estado em memória segue funcionando
      }
      setLastSeenId(latestEntryId);
      if (latestAnnouncementId) {
        setDismissedId(latestAnnouncementId);
      }
      window.dispatchEvent(new CustomEvent(CHANGELOG_VIEWED_EVENT));
    },
    [],
  );

  const dismissAnnouncement = useCallback((id: string) => {
    try {
      window.localStorage.setItem(CHANGELOG_DISMISSED_KEY, id);
    } catch {
      // mesmo tratamento defensivo de markChangelogAsViewed
    }
    setDismissedId(id);
  }, []);

  const hasUnseen = useCallback(
    (latestId: string) => {
      if (!latestId) return false;
      return lastSeenId !== latestId;
    },
    [lastSeenId],
  );

  const isAnnouncementVisible = useCallback(
    (entryId: string) => {
      if (!entryId) return false;
      return dismissedId !== entryId;
    },
    [dismissedId],
  );

  return {
    lastSeenId,
    dismissedId,
    markChangelogAsViewed,
    dismissAnnouncement,
    hasUnseen,
    isAnnouncementVisible,
  };
}
