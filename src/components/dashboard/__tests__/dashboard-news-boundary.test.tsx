// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";

import { ptBRDashboardMessages } from "@/lib/i18n/dashboard";
import type { ChangelogEntry } from "@/lib/changelog/types";

const captured = vi.hoisted(() => ({
  props: null as null | {
    entry?: unknown;
    compact?: boolean;
    excerpt?: string | null;
  },
}));

vi.mock("@/components/changelog/changelog-announcement", () => ({
  ChangelogAnnouncement: (props: typeof captured.props) => {
    captured.props = props;
    return <div data-testid="announcement" />;
  },
}));

import { DashboardNews } from "../dashboard-news";

function makeEntry(): ChangelogEntry {
  return {
    frontmatter: {
      id: "campanhas-mais-qualidade-novos-cenarios",
      title: "Campanhas com mais qualidade e novos cenários",
      date: "2026-10-19",
      milestone: "v1.5",
      category: "feature",
      importance: "major",
      announcement: "card",
    },
    body: "## O que mudou\n\n- Primeiro item do corpo completo.",
    slug: "2026-10-19-campanhas-mais-qualidade-novos-cenarios",
  };
}

describe("DashboardNews — fronteira do payload", () => {
  it("envia ao anúncio compacto apenas frontmatter e trecho, sem body nem slug", () => {
    const entry = makeEntry();

    renderToString(
      <DashboardNews
        entry={entry}
        excerpt="Trecho editorial derivado."
        labels={ptBRDashboardMessages.news}
      />,
    );

    expect(captured.props).not.toBeNull();
    expect(captured.props?.compact).toBe(true);
    expect(captured.props?.excerpt).toBe("Trecho editorial derivado.");
    expect(captured.props?.entry).toEqual({ frontmatter: entry.frontmatter });
    expect(captured.props?.entry).not.toHaveProperty("body");
    expect(captured.props?.entry).not.toHaveProperty("slug");
  });
});
