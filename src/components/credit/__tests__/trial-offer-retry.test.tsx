// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { TrialOfferRetry } from "../trial-offer-retry";

describe("F50.2 TrialOfferRetry", () => {
  it("mostra retry somente em falha repetível", () => {
    const html = renderToString(<TrialOfferRetry status="retryable_failure" />);
    expect(html).toContain("Tentar novamente");
    expect(html).toContain("Não foi possível iniciar agora");
  });

  it("não oferece retry após expired_window", () => {
    const html = renderToString(<TrialOfferRetry status="expired_window" />);
    expect(html).toContain("janela de 28 dias já foi encerrada");
    expect(html).not.toContain("Tentar novamente");
  });

  it("não renderiza para estados sem falha", () => {
    expect(renderToString(<TrialOfferRetry status="started" />)).toBe("");
  });
});
