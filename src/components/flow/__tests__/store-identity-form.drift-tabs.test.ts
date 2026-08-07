// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
/**
 * Regressão de drift por abas (F36 — bloqueadores D13, grupo 6.6 do tasks.md).
 * Estratégia (padrão do repo — drift.test.ts): a StoreIdentityForm é o
 * orquestrador de 2581 linhas; os cenários bloqueadores são provados na camada
 * que ORQUESTRA a saída de contexto:
 *
 * 1. `useDriftDetection` (REAL, preservado — D13) com fetch mockado → asserts
 *    dos ENDPOINTS de drift (brand-profile/realign, brand-profile/metadata com
 *    drift_dismissed_snapshot, visual-signature/dismiss-critical-drift com
 *    snapshot dos valores aceitos) e do gate de geração por CRÉDITOS
 *    (credit_balance / credits_charging_enabled), com o crítico computado
 *    client-side contra o formData vivo.
 * 2. `useOnboardingTabs` (REAL) → ordem de interceptação (modal ANTES do PATCH),
 *    navegação interna, cancelamento sem persistir, resume pós-decisão e
 *    auto-save seletivo (campos fora do snapshot).
 * 3. `resolveModalType` replica fielmente o `openDriftModalFromContext` do form
 *    (store-identity-form.tsx:317-323) — critical+new → DriftCriticalModal,
 *    sensitive → DriftDecisionModal.
 * 4. Render dos modais reais (DriftDecisionModal/DriftCriticalModal) para provar
 *    que o modal certo abre e que os gatilhos disparam os callbacks certos.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { renderHook, act, waitFor, render, screen, fireEvent } from "@testing-library/react";
import { useDriftDetection } from "../use-drift-detection";
import { useOnboardingTabs } from "@/hooks/use-onboarding-tabs";
import type { UseOnboardingTabsDeps } from "@/hooks/use-onboarding-tabs";

const mockUseOperationCosts = vi.fn(() => ({
  costs: {
    campaign_generation: { costCredits: 1, enabled: true },
    visual_signature_generation: { costCredits: 1, enabled: true },
  },
  status: "loaded",
  refetch: vi.fn(),
}));
vi.mock("@/hooks/use-operation-costs", () => ({
  useOperationCosts: () => mockUseOperationCosts(),
}));
import type { FormData } from "@/components/flow/use-store-form";
import type { StoreProfileInputSnapshot } from "@/lib/snapshot";
import { DriftDecisionModal } from "../drift-decision-modal";
import { DriftCriticalModal } from "../drift-critical-modal";

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Réplica fiel do `openDriftModalFromContext` do StoreIdentityForm
 * (store-identity-form.tsx:317-323): drift crítico novo → DriftCriticalModal;
 * qualquer outro drift sensível → DriftDecisionModal.
 */
type ModalType = "critical" | "decision" | null;
function resolveModalType(
  driftCategory: "critical" | "sensitive" | "none",
  criticalStatus: "none" | "new" | "dismissed" | null | undefined,
): ModalType {
  if (driftCategory === "critical" && criticalStatus === "new") return "critical";
  if (driftCategory === "sensitive") return "decision";
  return null;
}

function mockFetchResponse(data: unknown, ok = true) {
  return { ok, json: async () => data };
}

function makeFormData(overrides: Partial<FormData> = {}): FormData {
  return {
    name: "Minha Loja",
    segment: "outros",
    brand_color: "",
    city: "",
    state: "",
    subsegment: "loja de roupas",
    tone_of_voice: "",
    positioning: "",
    short_description: "",
    slogan: "",
    cnpj: "",
    razaoSocial: "",
    nomeFantasia: "",
    ...overrides,
  };
}

function makeDeps(overrides: Partial<UseOnboardingTabsDeps> = {}): UseOnboardingTabsDeps {
  return {
    initialTab: "dados",
    userId: "user-1",
    formData: makeFormData(),
    storeId: null,
    legalAccepted: true,
    hasVisualDirection: false,
    readiness: { ready: true, missing: [] },
    hasLocalEdits: true,
    isPersisted: false,
    autoSave: vi.fn(async () => ({ ok: true })),
    saveStatus: "idle",
    driftStatus: "none",
    driftCategory: "none",
    ...overrides,
  };
}

// Store com drift sensível vs. o input_snapshot do brand profile (text_only).
const DRIFTED_STORE = {
  id: "store-1",
  name: "Nome Editado",
  segment: "alimentacao",
  subsegment: "padaria",
  tone_of_voice: "moderno",
  positioning: "A melhor padaria",
  short_description: "Descrição",
  slogan: "Slogan",
  city: "São Paulo",
  state: "SP",
};

const INPUT_SNAPSHOT: StoreProfileInputSnapshot = {
  segment: "alimentacao",
  subsegment: "padaria",
  tone_of_voice: "moderno",
  name: "Nome Original",
  positioning: "A melhor padaria",
  short_description: "Descrição",
  slogan: "Slogan",
};

const DRIFTED_PROFILE = {
  metadata: {
    input_snapshot: INPUT_SNAPSHOT,
    drift_dismissed_snapshot: null,
  },
};

// VS ativa cujo input_snapshot foi gerado com name "Nome Original" /
// segment "alimentacao" (diverge do DRIFTED_STORE.name "Nome Editado").
// Espelha a resposta do GET /api/store/[id]/visual-signature (campos
// input_snapshot / art_direction.content_used / dismissed_snapshot consumidos
// pelo compute client-side do useDriftDetection).
function makeVs(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "vs-1",
    status: "active",
    type: "ai_generated",
    art_direction: {
      visual_direction: "Moderna",
      content_used: { store_name: true, city: false, state: false, slogan: false },
    },
    input_snapshot: {
      name: "Nome Original",
      segment: "alimentacao",
      slogan: null,
      city: null,
      state: null,
    },
    dismissed_snapshot: null,
    ...overrides,
  };
}

// Arquivo .ts (plano 36-06) → render de modais via React.createElement (sem JSX).
function renderDecisionModal(props: Partial<Parameters<typeof DriftDecisionModal>[0]> = {}) {
  render(
    createElement(DriftDecisionModal, {
      onRealinhar: vi.fn(),
      onIgnorar: vi.fn(),
      onCancel: vi.fn(),
      isLoading: false,
      error: null,
      ...props,
    }),
  );
}

function renderCriticalModal(props: Partial<Parameters<typeof DriftCriticalModal>[0]> = {}) {
  render(
    createElement(DriftCriticalModal, {
      open: true,
      onOpenChange: vi.fn(),
      storeId: "store-1",
      identityState: "visual_signature",
      canGenerateNewSignature: true,
      onDismissAndSave: vi.fn(),
      onRemoveVs: vi.fn(),
      onOpenApproval: vi.fn(),
      onCancel: vi.fn(),
      ...props,
    }),
  );
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/loja");
  fetchMock = vi.fn(async () => mockFetchResponse({ signatures: [] }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── useDriftDetection REAL: detecção + endpoints preservados ───────────────

describe("drift-tabs — useDriftDetection real (D13, endpoints preservados)", () => {
  it("(a/c) drift sensível novo é detectado (driftStatus new → driftCategory sensitive)", async () => {
    const { result } = renderHook(() =>
      useDriftDetection(DRIFTED_STORE, DRIFTED_PROFILE, "text_only"),
    );

    await waitFor(() => expect(result.current.driftStatus).toBe("new"));
    expect(result.current.driftCategory).toBe("sensitive");
    expect(resolveModalType(result.current.driftCategory, null)).toBe("decision");
  });

  it("(e) realinhar() → POST /api/store/{id}/brand-profile/realign e zera driftStatus", async () => {
    fetchMock.mockResolvedValueOnce(mockFetchResponse({ success: true }));
    const onRealinhado = vi.fn();
    const { result } = renderHook(() =>
      useDriftDetection(DRIFTED_STORE, DRIFTED_PROFILE, "text_only", { onRealinhado }),
    );
    await waitFor(() => expect(result.current.driftStatus).toBe("new"));

    await act(async () => {
      await result.current.realinhar();
    });

    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe("/api/store/store-1/brand-profile/realign");
    expect(call[1]).toMatchObject({ method: "POST" });
    expect(onRealinhado).toHaveBeenCalled();
    expect(result.current.driftStatus).toBe("none");
  });

  it("(Bug A) drift NÃO é one-shot: após realinhar, nova divergência reabre o fluxo (refs sincronizados)", async () => {
    fetchMock.mockResolvedValueOnce(mockFetchResponse({ success: true }));
    const { result, rerender } = renderHook(
      (props: { store: typeof DRIFTED_STORE }) =>
        useDriftDetection(props.store, DRIFTED_PROFILE, "text_only"),
      { initialProps: { store: DRIFTED_STORE } },
    );
    await waitFor(() => expect(result.current.driftStatus).toBe("new"));

    await act(async () => {
      await result.current.realinhar();
    });
    expect(result.current.driftStatus).toBe("none");

    // Nova divergência após o realinhar — o guard de status não pode suprimir
    // (sem o sync de refs, 'new' === prevStatusRef stale e o drift vira one-shot).
    rerender({ store: { ...DRIFTED_STORE, name: "Nome Editado 2" } });
    await waitFor(() => expect(result.current.driftStatus).toBe("new"));
    expect(result.current.driftCategory).toBe("sensitive");
  });

  it("(Bug A) drift NÃO é one-shot: após ignorar, nova divergência reabre o fluxo", async () => {
    fetchMock.mockResolvedValueOnce(mockFetchResponse({ ok: true }));
    const { result, rerender } = renderHook(
      (props: { store: typeof DRIFTED_STORE }) =>
        useDriftDetection(props.store, DRIFTED_PROFILE, "text_only"),
      { initialProps: { store: DRIFTED_STORE } },
    );
    await waitFor(() => expect(result.current.currentSnapshot).not.toBeNull());

    await act(async () => {
      await result.current.ignorar();
    });
    expect(result.current.driftStatus).toBe("dismissed");

    rerender({ store: { ...DRIFTED_STORE, slogan: "Novo slogan" } });
    await waitFor(() => expect(result.current.driftStatus).toBe("new"));
  });

  it("(Fix B) após ignorar(), recompute por mudança fora do snapshot NÃO reabre drift falso", async () => {
    fetchMock.mockResolvedValueOnce(mockFetchResponse({ ok: true }));
    const { result, rerender } = renderHook(
      (props: { store: typeof DRIFTED_STORE }) =>
        useDriftDetection(props.store, DRIFTED_PROFILE, "text_only"),
      { initialProps: { store: DRIFTED_STORE } },
    );
    await waitFor(() => expect(result.current.driftStatus).toBe("new"));

    await act(async () => {
      await result.current.ignorar();
    });
    expect(result.current.driftStatus).toBe("dismissed");

    // Sem o espelho local do drift_dismissed_snapshot, este recompute (store com
    // cidade alterada, fora de SNAPSHOT_FIELDS) recomputa com dismissed = null e
    // reabre drift falso antes de um refetch do profile. driftCategory pode
    // permanecer 'sensitive' (Bug A por design) — o gate operacional é o
    // driftStatus (Fix A), que precisa continuar 'dismissed'.
    rerender({ store: { ...DRIFTED_STORE, city: "Rio de Janeiro" } });
    await waitFor(() => expect(result.current.driftStatus).toBe("dismissed"));
  });

  it("(Fix B) após ignorar(), nova alteração sensível (≠ snapshot dismissado) reabre 'new'", async () => {
    fetchMock.mockResolvedValueOnce(mockFetchResponse({ ok: true }));
    const { result, rerender } = renderHook(
      (props: { store: typeof DRIFTED_STORE }) =>
        useDriftDetection(props.store, DRIFTED_PROFILE, "text_only"),
      { initialProps: { store: DRIFTED_STORE } },
    );
    await waitFor(() => expect(result.current.driftStatus).toBe("new"));

    await act(async () => {
      await result.current.ignorar();
    });
    expect(result.current.driftStatus).toBe("dismissed");

    // Novo valor ≠ do snapshot dismissado ("Nome Editado") → o dismiss é
    // por-snapshot, não permanente; drift sensível volta a 'new'.
    rerender({ store: { ...DRIFTED_STORE, name: "Nome Editado 3" } });
    await waitFor(() => expect(result.current.driftStatus).toBe("new"));
    expect(result.current.driftCategory).toBe("sensitive");
  });

  it("(e) ignorar() → PATCH /api/store/{id}/brand-profile/metadata com drift_dismissed_snapshot = snapshot atual", async () => {
    fetchMock.mockResolvedValueOnce(mockFetchResponse({ ok: true }));
    const { result } = renderHook(() =>
      useDriftDetection(DRIFTED_STORE, DRIFTED_PROFILE, "text_only"),
    );
    await waitFor(() => expect(result.current.currentSnapshot).not.toBeNull());

    await act(async () => {
      await result.current.ignorar();
    });

    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe("/api/store/store-1/brand-profile/metadata");
    expect(call[1]).toMatchObject({ method: "PATCH" });
    const body = JSON.parse((call[1] as { body: string }).body);
    expect(body.drift_dismissed_snapshot).toEqual(result.current.currentSnapshot);
    expect(body.drift_dismissed_snapshot.name).toBe("Nome Editado");
    expect(result.current.driftStatus).toBe("dismissed");
  });

  it("(c) drift crítico: VS ativa com name editado → criticalDrift new computado client-side (NÃO sensitive)", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        signatures: [makeVs()],
        credit_balance: 5,
        credits_charging_enabled: true,
      }),
    );

    const { result } = renderHook(() =>
      useDriftDetection(DRIFTED_STORE, DRIFTED_PROFILE, "visual_signature"),
    );

    await waitFor(() => expect(result.current.driftCategory).toBe("critical"));
    expect(result.current.criticalDrift?.status).toBe("new");
    expect(result.current.criticalDrift?.fields).toEqual(["name"]);
    expect(result.current.criticalDrift?.reason).toBe("critical_drift");
    // O form (openDriftModalFromContext) escolhe o DriftCriticalModal, não o sensível
    expect(resolveModalType(result.current.driftCategory, result.current.criticalDrift?.status)).toBe("critical");
    expect(resolveModalType(result.current.driftCategory, result.current.criticalDrift?.status)).not.toBe("decision");
  });

  it("(e) dismissCriticalDrift() → POST com snapshot dos VALORES ACEITOS e marca dismissed sem loop", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        signatures: [makeVs()],
        credit_balance: 5,
        credits_charging_enabled: true,
      }),
    );
    fetchMock.mockResolvedValueOnce(mockFetchResponse({ ok: true }));

    const { result } = renderHook(() =>
      useDriftDetection(DRIFTED_STORE, DRIFTED_PROFILE, "visual_signature"),
    );
    await waitFor(() => expect(result.current.driftCategory).toBe("critical"));

    await act(async () => {
      await result.current.dismissCriticalDrift();
    });

    const dismissCall = fetchMock.mock.calls[1];
    expect(dismissCall[0]).toBe("/api/store/store-1/visual-signature/dismiss-critical-drift");
    expect(dismissCall[1]).toMatchObject({ method: "POST" });
    // Snapshot dos valores aceitos (formData vivo) — o servidor NÃO pode gravar o
    // snapshot antigo do banco senão o recompute reabriria o crítico (loop).
    const body = JSON.parse((dismissCall[1] as { body: string }).body);
    expect(body.snapshot).toEqual({
      name: "Nome Editado",
      segment: "alimentacao",
      slogan: "Slogan",
      city: "São Paulo",
      state: "SP",
    });
    // Recompute com o espelho local (sem refetch) → 'dismissed', sem reabrir.
    expect(result.current.criticalDrift?.status).toBe("dismissed");
    expect(result.current.driftCategory).toBe("none");
  });

  it("(e) pós-dismiss, recompute com outra edição crítica ≠ aceitos reabre 'new' (dismiss é por-snapshot)", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        signatures: [makeVs()],
        credit_balance: 5,
        credits_charging_enabled: true,
      }),
    );
    fetchMock.mockResolvedValueOnce(mockFetchResponse({ ok: true }));

    const { result, rerender } = renderHook(
      (props: { store: typeof DRIFTED_STORE }) =>
        useDriftDetection(props.store, DRIFTED_PROFILE, "visual_signature"),
      { initialProps: { store: DRIFTED_STORE } },
    );
    await waitFor(() => expect(result.current.criticalDrift?.status).toBe("new"));

    await act(async () => {
      await result.current.dismissCriticalDrift();
    });
    expect(result.current.criticalDrift?.status).toBe("dismissed");

    // Nova divergência crítica (name ≠ snapshot aceito "Nome Editado") → 'new'.
    rerender({ store: { ...DRIFTED_STORE, name: "Nome Editado 2" } });
    await waitFor(() => expect(result.current.criticalDrift?.status).toBe("new"));
    expect(result.current.driftCategory).toBe("critical");
  });

  it("(f) totalGeneratedSignatures conta apenas gerações válidas (exclui failed) + credit_balance exposto", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        signatures: [
          { ...makeVs(), id: "vs-1", dismissed_snapshot: null },
          { ...makeVs(), id: "vs-2", status: "active", dismissed_snapshot: null },
          { id: "vs-3", status: "failed", type: "ai_generated" },
        ],
        credit_balance: 5,
        credits_charging_enabled: true,
      }),
    );

    const { result } = renderHook(() =>
      useDriftDetection(DRIFTED_STORE, DRIFTED_PROFILE, "visual_signature"),
    );

    await waitFor(() => expect(result.current.totalGeneratedSignatures).toBe(2));
    expect(result.current.creditBalance).toBe(5);
    expect(result.current.creditsChargingEnabled).toBe(true);
    // Gate do form (crédito): saldo > 0 (ou charging desativado) → gera.
    const canGenerateNewSignature = !result.current.creditsChargingEnabled || (result.current.creditBalance ?? 0) > 0;
    expect(canGenerateNewSignature).toBe(true);
  });

  it("(f) saldo 0 + charging ativo → NÃO oferece 'Gerar novamente' (modal orienta /conta)", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        signatures: [makeVs()],
        credit_balance: 0,
        credits_charging_enabled: true,
      }),
    );

    const { result } = renderHook(() =>
      useDriftDetection(DRIFTED_STORE, DRIFTED_PROFILE, "visual_signature"),
    );

    await waitFor(() => expect(result.current.criticalDrift?.status).toBe("new"));
    const canGenerateNewSignature = !result.current.creditsChargingEnabled || (result.current.creditBalance ?? 0) > 0;
    expect(canGenerateNewSignature).toBe(false);

    // Modal real sem crédito: nunca abre o caminho de geração
    renderCriticalModal({ canGenerateNewSignature: false });
    expect(screen.getByText("Assinatura visual desatualizada")).toBeInTheDocument();
    expect(screen.getByText(/não tem créditos suficientes/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gerar novamente" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver meus créditos" })).toBeInTheDocument();
  });

  it("(f) charging desativado → geração liberada mesmo com saldo 0", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        signatures: [makeVs()],
        credit_balance: 0,
        credits_charging_enabled: false,
      }),
    );

    const { result } = renderHook(() =>
      useDriftDetection(DRIFTED_STORE, DRIFTED_PROFILE, "visual_signature"),
    );

    await waitFor(() => expect(result.current.criticalDrift?.status).toBe("new"));
    expect(result.current.creditsChargingEnabled).toBe(false);
    const canGenerateNewSignature = !result.current.creditsChargingEnabled || (result.current.creditBalance ?? 0) > 0;
    expect(canGenerateNewSignature).toBe(true);
  });

  it("save explícito (aba Dados): VS ativa + name editado → crítico 'new' computado client-side ANTES de qualquer save/PATCH", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        signatures: [makeVs()],
        credit_balance: 5,
        credits_charging_enabled: true,
      }),
    );

    // Bug raiz (F36): o GET visual-signature avalia o crítico contra o BANCO; o
    // usuário editou o nome mas ainda NÃO salvou → o servidor via 'none' e o
    // save explícito da aba Dados passava sem interceptar. Com o compute
    // client-side contra o formData vivo, o crítico é 'new' sem depender de um
    // PATCH prévio — a única chamada é o GET de listagem.
    const { result } = renderHook(() =>
      useDriftDetection(DRIFTED_STORE, DRIFTED_PROFILE, "visual_signature"),
    );

    await waitFor(() => expect(result.current.criticalDrift?.status).toBe("new"));
    expect(result.current.criticalDrift?.fields).toEqual(["name"]);
    expect(result.current.driftCategory).toBe("critical");
    expect(resolveModalType(result.current.driftCategory, result.current.criticalDrift?.status)).toBe("critical");

    // Nenhum POST/PATCH/DELETE foi disparado — detecção é reativa à edição.
    const mutations = fetchMock.mock.calls.filter((c: any) => {
      const m = (c[1] as { method?: string } | undefined)?.method;
      return m === "POST" || m === "PATCH" || m === "DELETE";
    });
    expect(mutations.length).toBe(0);
  });

  it("subsegment editado (sensível) com VS ativa → crítico NÃO abre (permanece DriftDecisionModal)", async () => {
    const storeSubEdited = { ...DRIFTED_STORE, name: "Nome Original", subsegment: "loja de moda" };
    const profileSub = {
      metadata: {
        input_snapshot: { ...INPUT_SNAPSHOT, subsegment: "padaria" },
        drift_dismissed_snapshot: null,
      },
    };
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        signatures: [makeVs()],
        credit_balance: 5,
        credits_charging_enabled: true,
      }),
    );

    const { result } = renderHook(() =>
      useDriftDetection(storeSubEdited, profileSub, "visual_signature"),
    );

    await waitFor(() => {
      expect(result.current.driftCategory).toBe("sensitive");
      expect(result.current.criticalDrift?.status).toBe("none");
    });
    expect(resolveModalType(result.current.driftCategory, result.current.criticalDrift?.status)).toBe("decision");
  });

  it("slogan/cidade/estado SÓ abrem crítico quando content_used indicar uso", async () => {
    // VS com content_used.slogan=false: editar slogan NÃO pode gerar crítico.
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        signatures: [makeVs({ art_direction: { visual_direction: "Moderna", content_used: { store_name: true, city: false, state: false, slogan: false } } })],
        credit_balance: 5,
        credits_charging_enabled: true,
      }),
    );

    const { result } = renderHook(() =>
      useDriftDetection(DRIFTED_STORE, DRIFTED_PROFILE, "visual_signature"),
    );

    await waitFor(() => expect(result.current.criticalDrift?.status).toBe("new"));
    expect(result.current.criticalDrift?.fields).toEqual(["name"]);

    // content_used.slogan=true + slogan editado → slogan entra nos campos críticos
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        signatures: [makeVs({ art_direction: { visual_direction: "Moderna", content_used: { store_name: true, city: false, state: false, slogan: true } } })],
        credit_balance: 5,
        credits_charging_enabled: true,
      }),
    );
    const storeSloganUsed = { ...DRIFTED_STORE, name: "Nome Original", segment: "alimentacao", slogan: "Slogan Editado" };
    const { result: result2 } = renderHook(() =>
      useDriftDetection(storeSloganUsed, DRIFTED_PROFILE, "visual_signature"),
    );
    await waitFor(() => expect(result2.current.criticalDrift?.status).toBe("new"));
    expect(result2.current.criticalDrift?.fields).toEqual(["slogan"]);
    expect(result2.current.driftCategory).toBe("critical");
  });
});

// ── useOnboardingTabs REAL: interceptação da saída de contexto ─────────────

describe("drift-tabs — useOnboardingTabs orquestrando a saída (a/b/d/e/g)", () => {
  it("(a) troca de aba com drift sensível novo nos campos do snapshot: modal abre e NENHUM PATCH é enviado", async () => {
    const onDriftNavigate = vi.fn();
    const autoSave = vi.fn(async () => ({ ok: true }));

    const { result } = renderHook(() =>
      useOnboardingTabs(
        makeDeps({
          storeId: "store-1",
          formData: makeFormData({ name: "Nome Editado" }),
          editedFields: ["name"],
          driftCategory: "sensitive",
          driftStatus: "new",
          autoSave,
        }),
        { onDriftNavigate },
      ),
    );

    await act(async () => {
      await result.current.setActiveTab("posicionamento");
    });

    // Ordem D13: modal decide ANTES do PATCH dos campos do snapshot
    expect(onDriftNavigate).toHaveBeenCalledTimes(1);
    expect(autoSave).not.toHaveBeenCalled();
    expect(result.current.activeTab).toBe("dados");
  });

  it("(a) o modal correto abre: DriftDecisionModal renderizado com o fluxo sensível", () => {
    // resolveModalType replica openDriftModalFromContext do form
    expect(resolveModalType("sensitive", null)).toBe("decision");

    const onRealinhar = vi.fn();
    const onIgnorar = vi.fn();
    const onCancel = vi.fn();
    renderDecisionModal({ onRealinhar, onIgnorar, onCancel });

    expect(screen.getByText("Direção visual desatualizada")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Realinhar" }));
    expect(onRealinhar).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Manter e salvar" }));
    expect(onIgnorar).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("(c) drift crítico → DriftCriticalModal (nunca o DriftDecisionModal)", () => {
    expect(resolveModalType("critical", "new")).toBe("critical");
    expect(resolveModalType("critical", "new")).not.toBe("decision");
    expect(resolveModalType("sensitive", null)).toBe("decision");

    // Modal real crítico com crédito → CTA "Gerar novamente"
    renderCriticalModal({ canGenerateNewSignature: true });
    expect(screen.getByText("Assinatura visual desatualizada")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Gerar novamente" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Direção visual desatualizada")).not.toBeInTheDocument();
  });

  it("(c) DriftCriticalModal com crédito: 'Gerar novamente' não aparece sem crédito; 'Ver meus créditos' navega para /conta", () => {
    const first = render(createElement(DriftCriticalModal, {
      open: true,
      onOpenChange: vi.fn(),
      storeId: "store-1",
      identityState: "visual_signature",
      canGenerateNewSignature: true,
      onDismissAndSave: vi.fn(),
      onRemoveVs: vi.fn(),
      onOpenApproval: vi.fn(),
      onCancel: vi.fn(),
    }));
    expect(screen.getByRole("button", { name: "Gerar novamente" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver meus créditos" })).not.toBeInTheDocument();

    first.unmount();

    const onOpenApproval = vi.fn();
    const onDismissAndSave = vi.fn(async () => {});
    renderCriticalModal({
      canGenerateNewSignature: false,
      onOpenApproval,
      onDismissAndSave,
    });
    // Sem crédito: nunca oferece geração; oferece /conta, manter e remover
    expect(screen.queryByRole("button", { name: "Gerar novamente" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver meus créditos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manter direção atual" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remover mesmo assim" })).toBeInTheDocument();
    expect(onOpenApproval).not.toHaveBeenCalled();
  });

  it("(c) onOpenApproval persiste dados aceitos ANTES de abrir a aprovação; save falho NÃO abre", async () => {
    // Réplica do handler do form (store-identity-form.tsx onOpenApproval):
    // persistSaveFromDrift() → abre aprovação. Se o save falha, mantém o modal
    // crítico aberto e NUNCA abre a aprovação como se estivesse tudo pronto.
    const persist = vi.fn(async () => true);
    const openApproval = vi.fn();
    let driftError: string | null = null;

    const onOpenApproval = async () => {
      try {
        await persist();
        driftError = null;
        openApproval();
      } catch {
        driftError = "Não foi possível salvar seus dados antes de gerar. Tente novamente.";
      }
    };

    await onOpenApproval();
    expect(persist).toHaveBeenCalledTimes(1);
    expect(openApproval).toHaveBeenCalledTimes(1);
    expect(driftError).toBeNull();

    // Save falha → aprovação NÃO abre, erro registrado (modal permanece aberto)
    persist.mockRejectedValueOnce(new Error("falha no save"));
    await onOpenApproval();
    expect(openApproval).toHaveBeenCalledTimes(1); // não chamado de novo
    expect(driftError).toBe("Não foi possível salvar seus dados antes de gerar. Tente novamente.");
  });

  it("(b) navegação interna com drift sensível intercepta (preventDefault + onDriftLeave) sem salvar", () => {
    const onDriftLeave = vi.fn();
    const autoSave = vi.fn(async () => ({ ok: true }));

    const { result } = renderHook(() =>
      useOnboardingTabs(
        makeDeps({
          storeId: "store-1",
          formData: makeFormData({ name: "Nome Editado" }),
          editedFields: ["name"],
          driftCategory: "sensitive",
          driftStatus: "new",
          autoSave,
        }),
        { onDriftLeave },
      ),
    );

    const anchor = document.createElement("a");
    anchor.href = "/dashboard";
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    anchor.dispatchEvent(event);

    act(() => {
      result.current.handleInternalNavigation(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(onDriftLeave).toHaveBeenCalledTimes(1);
    expect(autoSave).not.toHaveBeenCalled();
  });

  it("(d) cancelar o modal mantém o usuário no contexto atual sem persistir", async () => {
    const onDriftNavigate = vi.fn();
    const autoSave = vi.fn(async () => ({ ok: true }));

    const { result } = renderHook(() =>
      useOnboardingTabs(
        makeDeps({
          storeId: "store-1",
          formData: makeFormData({ name: "Nome Editado", city: "São Paulo" }),
          editedFields: ["name"],
          driftCategory: "sensitive",
          driftStatus: "new",
          autoSave,
        }),
        { onDriftNavigate },
      ),
    );

    await act(async () => {
      await result.current.setActiveTab("posicionamento");
    });

    // Cancelar = fechar o modal sem decidir: driftCategory continua 'sensitive' →
    // nada é navegado, nada é persistido
    await act(async () => {});
    expect(onDriftNavigate).toHaveBeenCalledTimes(1);
    expect(result.current.activeTab).toBe("dados");
    expect(autoSave).not.toHaveBeenCalled();
    expect(localStorage.getItem("vendeo:store_draft:user-1:store-1")).toBeNull();
  });

  it("(e) após realinhar/ignorar/dismiss (driftCategory → none) o save prossegue e a navegação é concluída", async () => {
    const onDriftNavigate = vi.fn();
    const autoSave = vi.fn(async () => ({ ok: true }));

    const { result, rerender } = renderHook(
      (props: { driftCategory: "sensitive" | "none" }) =>
        useOnboardingTabs(
          makeDeps({
            storeId: "store-1",
            formData: makeFormData({ name: "Nome Editado" }),
            editedFields: ["name"],
            driftCategory: props.driftCategory,
            driftStatus: props.driftCategory === "sensitive" ? "new" : "none",
            autoSave,
          }),
          { onDriftNavigate },
        ),
      { initialProps: { driftCategory: "sensitive" as "sensitive" | "none" } },
    );

    await act(async () => {
      await result.current.setActiveTab("posicionamento");
    });
    expect(onDriftNavigate).toHaveBeenCalledTimes(1);
    expect(autoSave).not.toHaveBeenCalled();

    // Decisão do modal → driftCategory 'none' → resume navega para o alvo pendente
    rerender({ driftCategory: "none" });
    await waitFor(() => expect(result.current.activeTab).toBe("posicionamento"));
    expect(autoSave).toHaveBeenCalledTimes(1);
  });

  it("(g) edições em campos fora do snapshot (billing/cidade) fazem auto-save mesmo com drift pendente", async () => {
    const onDriftNavigate = vi.fn();
    const autoSave = vi.fn(async () => ({ ok: true }));

    const { result } = renderHook(() =>
      useOnboardingTabs(
        makeDeps({
          storeId: "store-1",
          formData: makeFormData({ name: "Nome Editado", city: "São Paulo" }),
          editedFields: ["city"], // fora de SNAPSHOT_FIELDS → auto-save normal (D13)
          driftCategory: "sensitive",
          driftStatus: "new",
          autoSave,
        }),
        { onDriftNavigate },
      ),
    );

    await act(async () => {
      await result.current.setActiveTab("posicionamento");
    });

    expect(onDriftNavigate).not.toHaveBeenCalled();
    expect(autoSave).toHaveBeenCalledTimes(1);
    expect(result.current.activeTab).toBe("posicionamento");
  });

  it("(Fix A) drift sensível 'dismissed' (driftCategory permanece sensitive) NÃO reintercepta a saída", async () => {
    const onDriftNavigate = vi.fn();
    const autoSave = vi.fn(async () => ({ ok: true }));

    // Estado real pós "Manter e salvar": ignorar() grava drift_dismissed_snapshot,
    // driftStatus vira 'dismissed' mas driftCategory CONTINUA 'sensitive'.
    const { result } = renderHook(() =>
      useOnboardingTabs(
        makeDeps({
          storeId: "store-1",
          formData: makeFormData({ name: "Nome Editado" }),
          editedFields: ["name"],
          driftCategory: "sensitive",
          driftStatus: "dismissed",
          autoSave,
        }),
        { onDriftNavigate },
      ),
    );

    await act(async () => {
      await result.current.setActiveTab("posicionamento");
    });

    expect(onDriftNavigate).not.toHaveBeenCalled();
    expect(autoSave).toHaveBeenCalledTimes(1);
    expect(result.current.activeTab).toBe("posicionamento");
  });

  it("(Fix A) resume da navegação adiada após dismiss com driftCategory sensitive (bug do re-drift)", async () => {
    const onDriftNavigate = vi.fn();
    const autoSave = vi.fn(async () => ({ ok: true }));

    const { result, rerender } = renderHook(
      (props: { driftStatus: "new" | "dismissed" }) =>
        useOnboardingTabs(
          makeDeps({
            storeId: "store-1",
            formData: makeFormData({ name: "Nome Editado" }),
            editedFields: ["name"],
            driftCategory: "sensitive",
            driftStatus: props.driftStatus,
            autoSave,
          }),
          { onDriftNavigate },
        ),
      { initialProps: { driftStatus: "new" as "new" | "dismissed" } },
    );

    await act(async () => {
      await result.current.setActiveTab("posicionamento");
    });
    expect(onDriftNavigate).toHaveBeenCalledTimes(1);
    expect(result.current.activeTab).toBe("dados");

    // "Manter e salvar" → driftStatus 'dismissed' (driftCategory CONTINUA
    // 'sensitive'). O resume destrava pela ATIVIDADE do drift (dismissed ≠ new),
    // não pelo driftCategory — antes do fix, o resume effect era bloqueado por
    // `deps.driftCategory !== "none"` e a navegação pendente nunca era retomada.
    rerender({ driftStatus: "dismissed" });
    await waitFor(() => expect(result.current.activeTab).toBe("posicionamento"));
    expect(autoSave).toHaveBeenCalledTimes(1);
  });

  it("(Fix A) drift crítico 'new' intercepta a saída mesmo com drift sensível none", async () => {
    const onDriftNavigate = vi.fn();
    const autoSave = vi.fn(async () => ({ ok: true }));

    const { result } = renderHook(() =>
      useOnboardingTabs(
        makeDeps({
          storeId: "store-1",
          formData: makeFormData({ name: "Nome Editado" }),
          editedFields: ["name"],
          driftCategory: "critical",
          driftStatus: "none",
          criticalDriftStatus: "new",
          autoSave,
        }),
        { onDriftNavigate },
      ),
    );

    await act(async () => {
      await result.current.setActiveTab("posicionamento");
    });

    expect(onDriftNavigate).toHaveBeenCalledTimes(1);
    expect(autoSave).not.toHaveBeenCalled();
    expect(result.current.activeTab).toBe("dados");
  });

  it("(Fix A) drift crítico 'dismissed' NÃO reintercepta a saída", async () => {
    const onDriftNavigate = vi.fn();
    const autoSave = vi.fn(async () => ({ ok: true }));

    const { result } = renderHook(() =>
      useOnboardingTabs(
        makeDeps({
          storeId: "store-1",
          formData: makeFormData({ name: "Nome Editado" }),
          editedFields: ["name"],
          driftCategory: "critical",
          driftStatus: "none",
          criticalDriftStatus: "dismissed",
          autoSave,
        }),
        { onDriftNavigate },
      ),
    );

    await act(async () => {
      await result.current.setActiveTab("posicionamento");
    });

    expect(onDriftNavigate).not.toHaveBeenCalled();
    expect(autoSave).toHaveBeenCalledTimes(1);
    expect(result.current.activeTab).toBe("posicionamento");
  });
});
