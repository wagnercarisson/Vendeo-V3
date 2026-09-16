// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { LabEnvironmentReason } from "@/lib/lab/environment-guard";

import {
  DisabledNotice,
  LAB_DISABLED_NOTE,
  LAB_DISABLED_TITLE,
  LAB_REASON_LABELS,
} from "../disabled-notice";

/**
 * F48.1 (48-1-09, task 9.1) — estado de ambiente desabilitado.
 *
 * Os 4 motivos de recusa da guarda precisam renderizar o mesmo título, o motivo
 * legível correspondente e o aviso de que nada foi acessado. Nenhum caractere
 * emoji pode aparecer (design system: ícones apenas via `lucide-react`).
 */

const REFUSAL_REASONS: LabEnvironmentReason[] = [
  "disabled_flag",
  "missing_url",
  "non_local_supabase",
  "remote_blocked",
];

const EMOJI_PATTERN =
  /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

describe("DisabledNotice", () => {
  it.each(REFUSAL_REASONS)(
    "exibe o título, o motivo legível e o aviso para o reason %s",
    (reason) => {
      render(<DisabledNotice reason={reason} />);

      expect(screen.getByText(LAB_DISABLED_TITLE)).toBeInTheDocument();
      expect(screen.getByText(LAB_REASON_LABELS[reason])).toBeInTheDocument();
      expect(screen.getByText(/Nenhuma tabela/)).toBeInTheDocument();
      expect(screen.getByText(reason)).toBeInTheDocument();
    },
  );

  it("descreve que nada foi acessado sem revelar host, URL ou chave", () => {
    render(<DisabledNotice reason="remote_blocked" />);

    expect(screen.getByText(LAB_DISABLED_NOTE)).toBeInTheDocument();
    expect(screen.queryByText(/https?:\/\//)).toBeNull();
    expect(screen.queryByText(/supabase\.co/)).toBeNull();
  });

  it("não usa emojis em nenhum dos motivos de recusa", () => {
    for (const reason of REFUSAL_REASONS) {
      const { container, unmount } = render(<DisabledNotice reason={reason} />);
      expect(EMOJI_PATTERN.test(container.textContent ?? "")).toBe(false);
      unmount();
    }
  });
});
