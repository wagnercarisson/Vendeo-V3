// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useOnboardingTabs } from "@/hooks/use-onboarding-tabs";
import type { UseOnboardingTabsDeps } from "@/hooks/use-onboarding-tabs";
import type { FormData, SaveStatus } from "@/components/flow/use-store-form";

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

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/loja");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useOnboardingTabs module shape", () => {
  it("exports useOnboardingTabs as a function", async () => {
    const mod = await import("@/hooks/use-onboarding-tabs");
    expect(typeof mod.useOnboardingTabs).toBe("function");
  });

  it("retorna APENAS as chaves públicas do contrato (sem onNavigate/onLeave no retorno)", () => {
    const { result } = renderHook(() => useOnboardingTabs(makeDeps()));
    const keys = Object.keys(result.current).sort();
    expect(keys).toEqual([
      "activeTab",
      "handleInternalNavigation",
      "handlePageHide",
      "handleVisibilityChange",
      "saveStatus",
      "setActiveTab",
      "tabStates",
    ]);
  });
});

describe("useOnboardingTabs — troca de aba (D4)", () => {
  it("troca de aba com mínimo válido chama autoSave e atualiza activeTab + limpa chave :new", async () => {
    const autoSave = vi.fn(async () => ({ ok: true, storeId: "new-store-1" }));
    localStorage.setItem(
      "vendeo:store_draft:user-1:new",
      JSON.stringify({ userId: "user-1", storeId: null, fields: {}, updatedAt: Date.now() }),
    );

    const { result } = renderHook(() =>
      useOnboardingTabs(makeDeps({ storeId: null, legalAccepted: true, autoSave })),
    );

    await act(async () => {
      await result.current.setActiveTab("posicionamento");
    });

    expect(autoSave).toHaveBeenCalled();
    expect(result.current.activeTab).toBe("posicionamento");
    expect(localStorage.getItem("vendeo:store_draft:user-1:new")).toBeNull();
  });

  it("sem mínimo válido → autoSave NÃO é chamado e a aba não muda", async () => {
    const autoSave = vi.fn(async () => ({ ok: true }));
    const { result } = renderHook(() =>
      useOnboardingTabs(
        makeDeps({ storeId: null, legalAccepted: true, formData: makeFormData({ name: "", segment: "" }), autoSave }),
      ),
    );

    await act(async () => {
      await result.current.setActiveTab("posicionamento");
    });

    expect(autoSave).not.toHaveBeenCalled();
    expect(result.current.activeTab).toBe("dados");
  });

  it("PATCH falho → saveStatus error mas a aba muda (D4 — PATCH não bloqueia)", async () => {
    const autoSave = vi.fn(async () => ({ ok: false }));
    const { result } = renderHook(() =>
      useOnboardingTabs(
        makeDeps({ storeId: "store-1", formData: makeFormData(), autoSave, saveStatus: "error" as SaveStatus }),
      ),
    );

    await act(async () => {
      await result.current.setActiveTab("posicionamento");
    });

    expect(autoSave).toHaveBeenCalled();
    expect(result.current.activeTab).toBe("posicionamento");
    expect(result.current.saveStatus).toBe("error");
  });

  it("POST (criação) falho → aba NÃO muda (D4 — criação falha bloqueia avanço)", async () => {
    const autoSave = vi.fn(async () => ({ ok: false }));
    const { result } = renderHook(() =>
      useOnboardingTabs(
        makeDeps({ storeId: null, legalAccepted: true, formData: makeFormData(), autoSave }),
      ),
    );

    await act(async () => {
      await result.current.setActiveTab("posicionamento");
    });

    expect(autoSave).toHaveBeenCalled();
    expect(result.current.activeTab).toBe("dados");
  });
});

describe("useOnboardingTabs — serialização de saves (ref/seq guard)", () => {
  it("respostas resolvidas fora de ordem não sobrescrevem o estado atual", async () => {
    const resolvers: ((v: { ok: boolean }) => void)[] = [];
    const autoSave = vi.fn(
      () => new Promise<{ ok: boolean }>((resolve) => resolvers.push(resolve)),
    );
    const { result } = renderHook(() =>
      useOnboardingTabs(
        makeDeps({
          storeId: "store-1",
          formData: makeFormData({ tone_of_voice: "moderno" }),
          autoSave,
        }),
      ),
    );

    let p1!: Promise<void>;
    let p2!: Promise<void>;
    act(() => {
      p1 = result.current.setActiveTab("posicionamento");
      p2 = result.current.setActiveTab("direcao-visual");
    });

    // O primeiro save da fila inicia (autoSave 1 chamado)
    await vi.waitFor(() => expect(resolvers).toHaveLength(1));

    // Resolve o primeiro save → a fila prossegue e dispara o segundo autoSave
    await act(async () => {
      resolvers[0]({ ok: true });
    });
    await vi.waitFor(() => expect(resolvers).toHaveLength(2));

    // Resolve o segundo save — o resultado do primeiro é defasado (stale)
    await act(async () => {
      resolvers[1]({ ok: true });
    });
    await act(async () => {
      await p1;
      await p2;
    });

    // O estado final reflete a ÚLTIMA chamada, não a resolução fora de ordem
    expect(result.current.activeTab).toBe("direcao-visual");
  });
});

describe("useOnboardingTabs — abandono mobile (D4/D5)", () => {
  it("handlePageHide grava draft SÍNCRONO no localStorage + PATCH best-effort com storeId", () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useOnboardingTabs(
        makeDeps({
          userId: "user-1",
          storeId: "store-1",
          formData: makeFormData({ name: "Loja X", segment: "petshop" }),
        }),
      ),
    );

    act(() => {
      result.current.handlePageHide();
    });

    const raw = localStorage.getItem("vendeo:store_draft:user-1:store-1");
    expect(raw).not.toBeNull();
    const draft = JSON.parse(raw as string);
    expect(draft.fields.name).toBe("Loja X");
    expect(draft.storeId).toBe("store-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/store/store-1",
      expect.objectContaining({ method: "PATCH", keepalive: true }),
    );
  });

  it("handleVisibilityChange delega para handlePageHide quando hidden", () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden" as DocumentVisibilityState);

    const { result } = renderHook(() =>
      useOnboardingTabs(makeDeps({ userId: "user-1", storeId: "store-1" })),
    );

    act(() => {
      result.current.handleVisibilityChange();
    });

    expect(localStorage.getItem("vendeo:store_draft:user-1:store-1")).not.toBeNull();
  });
});

describe("useOnboardingTabs — sync de URL / back-forward (D6)", () => {
  it("popstate com ?tab=posicionamento sincroniza activeTab pelo fluxo de saída", async () => {
    const autoSave = vi.fn(async () => ({ ok: true }));
    const { result } = renderHook(() =>
      useOnboardingTabs(makeDeps({ storeId: "store-1", autoSave })),
    );

    act(() => {
      window.history.pushState(null, "", "/loja?tab=posicionamento");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await waitFor(() => expect(autoSave).toHaveBeenCalled());
    expect(result.current.activeTab).toBe("posicionamento");
  });

  it("?tab= inválido no popstate mantém a aba atual", () => {
    const autoSave = vi.fn(async () => ({ ok: true }));
    const { result } = renderHook(() => useOnboardingTabs(makeDeps({ storeId: "store-1", autoSave })));

    act(() => {
      window.history.pushState(null, "", "/loja?tab=nao-existe");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(result.current.activeTab).toBe("dados");
    expect(autoSave).not.toHaveBeenCalled();
  });

  it("popstate para aba bloqueada ainda sincroniza activeTab (D6 — nunca tela em branco)", async () => {
    const autoSave = vi.fn(async () => ({ ok: true }));
    const { result } = renderHook(() =>
      useOnboardingTabs(
        makeDeps({ storeId: "store-1", formData: makeFormData({ tone_of_voice: "" }), autoSave }),
      ),
    );

    act(() => {
      window.history.pushState(null, "", "/loja?tab=direcao-visual");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    // D6: sincroniza mesmo bloqueada (painel de bloqueio + link "Voltar para X")
    expect(result.current.activeTab).toBe("direcao-visual");
    // Bloqueada → sem autoSave (não há saída a persistir)
    expect(autoSave).not.toHaveBeenCalled();
  });
});

describe("useOnboardingTabs — drift (D13, useDriftDetection consumido)", () => {
  it("saída de contexto com drift new nos campos do snapshot invoca onDriftNavigate e NÃO navega", async () => {
    const onDriftNavigate = vi.fn();
    const onDriftLeave = vi.fn();
    const autoSave = vi.fn(async () => ({ ok: true }));

    const { result } = renderHook(() =>
      useOnboardingTabs(
        makeDeps({
          storeId: "store-1",
          formData: makeFormData({ tone_of_voice: "moderno" }),
          editedFields: ["tone_of_voice"],
          driftCategory: "sensitive",
          driftStatus: "new",
          autoSave,
        }),
        { onDriftNavigate, onDriftLeave },
      ),
    );

    await act(async () => {
      await result.current.setActiveTab("direcao-visual");
    });

    expect(onDriftNavigate).toHaveBeenCalledTimes(1);
    expect(result.current.activeTab).toBe("dados");
    expect(autoSave).not.toHaveBeenCalled();
  });

  it("campos FORA do snapshot com drift → autoSave normal (auto-save seletivo D13)", async () => {
    const onDriftNavigate = vi.fn();
    const autoSave = vi.fn(async () => ({ ok: true }));

    const { result } = renderHook(() =>
      useOnboardingTabs(
        makeDeps({
          storeId: "store-1",
          formData: makeFormData({ tone_of_voice: "moderno", city: "São Paulo" }),
          editedFields: ["city"],
          driftCategory: "sensitive",
          driftStatus: "new",
          autoSave,
        }),
        { onDriftNavigate },
      ),
    );

    await act(async () => {
      await result.current.setActiveTab("direcao-visual");
    });

    expect(onDriftNavigate).not.toHaveBeenCalled();
    expect(autoSave).toHaveBeenCalled();
    expect(result.current.activeTab).toBe("direcao-visual");
  });
});

describe("useOnboardingTabs — tabStates / saveStatus", () => {
  it("tabStates calcula estado por aba via computeTabState (draft/ready/blocked)", () => {
    const { result } = renderHook(() =>
      useOnboardingTabs(
        makeDeps({
          storeId: "store-1",
          formData: makeFormData(),
          hasLocalEdits: true,
          isPersisted: false,
          readiness: { ready: true, missing: [] },
        }),
      ),
    );

    expect(result.current.tabStates.dados.state).toBe("draft");
    expect(result.current.tabStates.posicionamento.state).toBe("draft");
    // direcao-visual bloqueada (sem tom de voz) — motivo anexado
    expect(result.current.tabStates["direcao-visual"].state).toBe("blocked");
    expect(result.current.tabStates["direcao-visual"].reason).toBe("needs_tone_of_voice");
  });

  it("saveStatus repassa o estado do useStoreForm", () => {
    const { result } = renderHook(() =>
      useOnboardingTabs(makeDeps({ saveStatus: "saving" as SaveStatus })),
    );
    expect(result.current.saveStatus).toBe("saving");
  });
});
