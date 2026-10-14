// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  usePathname: () => "/campanhas/[id]",
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {},
  createServerClient: vi.fn(),
}));

vi.mock("@/components/campaign/campaign-approval-view", () => ({
  default: () => <div>CampaignApprovalView</div>,
}));

import CampaignPageClient from "../client";
import type { CampaignPageProps, NewFlowCopyRecoveryView } from "@/lib/campaign/display";
import {
  registerCopyRecoveryDrivingHandle,
  clearCopyRecoveryDrivingHandle,
} from "@/lib/campaign/copy-recovery-driving";

/**
 * F56.2b2a (B2.1 / Plano 04-05) — PROVA browser/render do FLUXO
 * iniciadora→resultado→espera→2ª automática (critérios 26/27 + lacuna 7/§3.14).
 *
 * O HANDLE DE CONDUÇÃO (registrado pela aba que INICIA a geração) é a ÚNICA
 * fonte que autoriza a emissão da próxima AUTOMÁTICA. `reload`/outra aba NÃO
 * têm o handle (memória do módulo, por aba) ⇒ `isDriving === false` ⇒ APENAS
 * ACOMPANHAM. Cada NOVA automática gera um `requestToken` PRÓPRIO (T2≠T3); só o
 * reenvio do MESMO acionamento reutiliza o token. Provider SIMULADO — o teste
 * apenas verifica o ACIONAMENTO (fetch), nunca um provider real.
 */

const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const CTA = "Gerar os textos novamente";

const BASE_PROPS: CampaignPageProps = {
  imageUrl: "https://img.example/art.jpg",
  caption: "Legenda",
  hashtags: ["#promo"],
  ctaPost: "Compre agora",
  displayStatus: "ready",
  productName: "Produto Teste",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  downloadUrl: `/api/campaign/${CAMPAIGN_ID}/download`,
  campaignId: CAMPAIGN_ID,
  isPublicationCopyEdited: false,
};

function recoveryView(
  overrides: Partial<NewFlowCopyRecoveryView> = {},
): NewFlowCopyRecoveryView {
  return {
    state: "aguardando",
    autoAttempts: 1,
    manualAttempts: 0,
    waitRemainingMs: 5000,
    canRetry: false,
    ...overrides,
  };
}

function fetchMock() {
  return globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
}

function copyRecoveryCalls() {
  return fetchMock().mock.calls.filter(([url]) =>
    String(url).includes(`/api/campaign/${CAMPAIGN_ID}/copy-recovery`),
  );
}

function bodies() {
  return copyRecoveryCalls().map(([, init]) =>
    JSON.parse(String((init as RequestInit).body)) as {
      mode: string;
      operationId: string;
      requestToken: string;
    },
  );
}

function renderRecovery(
  view: NewFlowCopyRecoveryView | null,
  extra: Partial<NonNullable<CampaignPageProps["newFlow"]>> = {},
) {
  return render(
    <CampaignPageClient
      {...BASE_PROPS}
      newFlow={{ state: "delivered", operationId: OPERATION_ID, recovery: view, ...extra }}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  clearCopyRecoveryDrivingHandle();
  const mock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", mock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  clearCopyRecoveryDrivingHandle();
});

describe("copy-recovery-driving — só a aba iniciadora emite a 2ª automática", () => {
  it("(critério 26) aba DIRIGENTE: conta a espera reportada e emite UMA automática com token PRÓPRIO ao fim", async () => {
    registerCopyRecoveryDrivingHandle({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID });
    vi.useFakeTimers();
    renderRecovery(recoveryView({ waitRemainingMs: 5000 }));

    expect(screen.getByText(/Nova tentativa em 5s/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: CTA })).toBeDisabled();
    expect(copyRecoveryCalls()).toHaveLength(0);

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    const callBodies = bodies();
    expect(callBodies).toHaveLength(1);
    expect(callBodies[0].mode).toBe("auto_retry");
    expect(callBodies[0].operationId).toBe(OPERATION_ID);
    expect(typeof callBodies[0].requestToken).toBe("string");
    expect(callBodies[0].requestToken.length).toBeGreaterThan(0);
  });

  it("(§3.14) reload/outra aba (SEM handle): conta a espera mas NÃO emite nenhuma automática", async () => {
    vi.useFakeTimers();
    renderRecovery(recoveryView({ waitRemainingMs: 5000 }));

    expect(screen.getByText(/Nova tentativa em 5s/)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(20000);
    });

    expect(copyRecoveryCalls()).toHaveLength(0);
  });

  it("(critério 27) 3 automáticas dirigidas: T2≠T3 (token NOVO por acionamento), nunca duplica", async () => {
    registerCopyRecoveryDrivingHandle({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID });
    vi.useFakeTimers();

    const { rerender } = renderRecovery(
      recoveryView({ autoAttempts: 1, waitRemainingMs: 5000 }),
    );

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(copyRecoveryCalls()).toHaveLength(1);

    // O servidor avança para a 2ª espera (10s, auto=2) — o poll refletiria isso.
    rerender(
      <CampaignPageClient
        {...BASE_PROPS}
        newFlow={{
          state: "delivered",
          operationId: OPERATION_ID,
          recovery: recoveryView({ autoAttempts: 2, waitRemainingMs: 10000 }),
        }}
      />,
    );
    expect(screen.getByText(/Nova tentativa em 10s/)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    const callBodies = bodies();
    expect(callBodies).toHaveLength(2);
    expect(callBodies.every((b) => b.mode === "auto_retry")).toBe(true);
    // T1≠T2 (cada NOVA automática gera token próprio).
    expect(callBodies[0].requestToken).not.toBe(callBodies[1].requestToken);
  });

  it("(UI-SPEC 4ª rodada) reload/outra aba com espera VENCIDA: CTA MANUAL habilitada e ZERO automáticas", async () => {
    vi.useFakeTimers();
    renderRecovery(
      recoveryView({ autoAttempts: 1, manualAttempts: 0, waitRemainingMs: 0, canRetry: true }),
    );

    expect(screen.getByRole("button", { name: CTA })).toBeEnabled();

    await act(async () => {
      vi.advanceTimersByTime(20000);
    });

    // Ninguém agenda a próxima automática fora da aba dirigente.
    expect(copyRecoveryCalls()).toHaveLength(0);
  });

  it("(UI-SPEC 4ª rodada) aba dirigente com início MANUAL já feito: guarda extra NÃO emite automática (ciclo fechado)", async () => {
    registerCopyRecoveryDrivingHandle({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID });
    vi.useFakeTimers();
    renderRecovery(
      recoveryView({ autoAttempts: 1, manualAttempts: 1, waitRemainingMs: 0, canRetry: true }),
    );

    await act(async () => {
      vi.advanceTimersByTime(20000);
    });

    expect(copyRecoveryCalls()).toHaveLength(0);
  });

  it("(UI-SPEC 4ª rodada) aba dirigente com espera VENCIDA na chegada: emite UMA automática imediata com token novo", async () => {
    registerCopyRecoveryDrivingHandle({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID });
    renderRecovery(
      recoveryView({ autoAttempts: 1, manualAttempts: 0, waitRemainingMs: 0, canRetry: false }),
    );

    await waitFor(() => expect(copyRecoveryCalls()).toHaveLength(1));
    const callBodies = bodies();
    expect(callBodies[0].mode).toBe("auto_retry");
    expect(callBodies[0].requestToken.length).toBeGreaterThan(0);

    await act(async () => {});
    // UMA única emissão no MESMO episódio persistido (não duplica).
    expect(copyRecoveryCalls()).toHaveLength(1);
  });
});
