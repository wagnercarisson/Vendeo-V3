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
      "blockedNotice",
      "cancelPendingNavigation",
      "handleInternalNavigation",
      "handlePageHide",
      "handleVisibilityChange",
      "saveStatus",
      "setActiveTab",
      "tabStates",
    ]);
  });

  it("cancelPendingNavigation limpa navegação adiada por drift (HR-02)", async () => {
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

    // Intercepta troca de aba com drift → pendingTab fica pendente
    await act(async () => {
      await result.current.setActiveTab("posicionamento");
    });
    expect(onDriftNavigate).toHaveBeenCalledTimes(1);
    expect(result.current.activeTab).toBe("dados");

    // Usuário CANCELA o modal → navegação pendente é limpa
    act(() => {
      result.current.cancelPendingNavigation();
    });

    // Decisão de drift de outro caminho (driftCategory → none) NÃO navega espúrio
    const { rerender } = renderHook(
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
    rerender({ driftCategory: "none" });
    expect(result.current.activeTab).toBe("dados");
    expect(autoSave).not.toHaveBeenCalled();
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

  it("popstate para aba bloqueada NÃO sincroniza activeTab — redireciona à primeira aba anterior válida (D16)", () => {
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

    // D16 (hard-block): a aba bloqueada nunca fica ativa — roteia para a
    // primeira aba anterior válida (posicionamento, com storeId criado).
    expect(result.current.activeTab).toBe("posicionamento");
    expect(result.current.blockedNotice).toEqual({
      tab: "direcao-visual",
      reason: "needs_tone_of_voice",
    });
    // Bloqueada → sem autoSave (não há saída a persistir)
    expect(autoSave).not.toHaveBeenCalled();
    // URL corrigida para a aba anterior válida (replaceState)
    expect(window.location.search).toContain("tab=posicionamento");
  });

  it("popstate para aba bloqueada no passo 1 roteia para dados (sem storeId)", () => {
    const autoSave = vi.fn(async () => ({ ok: true }));
    const { result } = renderHook(() =>
      useOnboardingTabs(makeDeps({ storeId: null, autoSave })),
    );

    act(() => {
      window.history.pushState(null, "", "/loja?tab=posicionamento");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    // Sem loja criada (needs_store_created), a primeira aba anterior válida é dados.
    expect(result.current.activeTab).toBe("dados");
    expect(result.current.blockedNotice).toEqual({
      tab: "posicionamento",
      reason: "needs_store_created",
    });
    expect(autoSave).not.toHaveBeenCalled();
  });
});

describe("useOnboardingTabs — deep-link destravamento: data-load vs edição (D16 fix)", () => {
  it("deep-link para direcao-visual bloqueada redireciona à primeira aba anterior válida + aviso", () => {
    const autoSave = vi.fn(async () => ({ ok: true }));
    const { result } = renderHook(() =>
      useOnboardingTabs(
        makeDeps({
          initialTab: "direcao-visual",
          storeId: "store-1",
          formData: makeFormData({ tone_of_voice: "" }),
          hasVisualDirection: false,
          autoSave,
        }),
      ),
    );

    expect(result.current.activeTab).toBe("posicionamento");
    expect(result.current.blockedNotice).toEqual({
      tab: "direcao-visual",
      reason: "needs_tone_of_voice",
    });
    expect(window.location.search).toContain("tab=posicionamento");
  });

  it("preencher tom de voz NÃO auto-avança para Direção Visual — permanece em Posicionamento e o aviso é limpo", async () => {
    const autoSave = vi.fn(async () => ({ ok: true }));
    const { result, rerender } = renderHook(
      (props: { tone: string }) =>
        useOnboardingTabs(
          makeDeps({
            initialTab: "direcao-visual",
            storeId: "store-1",
            formData: makeFormData({ tone_of_voice: props.tone }),
            hasVisualDirection: false,
            autoSave,
          }),
        ),
      { initialProps: { tone: "" } },
    );

    expect(result.current.activeTab).toBe("posicionamento");

    await act(async () => {
      rerender({ tone: "moderno" });
    });

    expect(result.current.activeTab).toBe("posicionamento");
    expect(result.current.blockedNotice).toBeNull();
    expect(autoSave).not.toHaveBeenCalled();
  });

  it("tom de voz (edição) consome o deep-link — um hasVisualDirection posterior NÃO auto-avança (sem armadilha)", async () => {
    const autoSave = vi.fn(async () => ({ ok: true }));
    const { result, rerender } = renderHook(
      (props: { tone: string; hasVisualDirection: boolean }) =>
        useOnboardingTabs(
          makeDeps({
            initialTab: "direcao-visual",
            storeId: "store-1",
            formData: makeFormData({ tone_of_voice: props.tone }),
            hasVisualDirection: props.hasVisualDirection,
            autoSave,
          }),
        ),
      { initialProps: { tone: "", hasVisualDirection: false } },
    );

    await act(async () => {
      rerender({ tone: "moderno", hasVisualDirection: false });
    });
    expect(result.current.activeTab).toBe("posicionamento");

    await act(async () => {
      rerender({ tone: "moderno", hasVisualDirection: true });
    });

    expect(result.current.activeTab).toBe("posicionamento");
    expect(autoSave).not.toHaveBeenCalled();
  });

  it("data-load de loja existente (hasVisualDirection) ainda auto-abre Direção Visual", async () => {
    const autoSave = vi.fn(async () => ({ ok: true }));
    const { result, rerender } = renderHook(
      (props: { hasVisualDirection: boolean }) =>
        useOnboardingTabs(
          makeDeps({
            initialTab: "direcao-visual",
            storeId: "store-1",
            formData: makeFormData({ tone_of_voice: "" }),
            hasVisualDirection: props.hasVisualDirection,
            autoSave,
          }),
        ),
      { initialProps: { hasVisualDirection: false } },
    );

    expect(result.current.activeTab).toBe("posicionamento");

    await act(async () => {
      rerender({ hasVisualDirection: true });
    });

    await waitFor(() => expect(result.current.activeTab).toBe("direcao-visual"));
    expect(autoSave).toHaveBeenCalledTimes(1);
  });
});

describe("useOnboardingTabs — back/forward popstate com drift (D13/F36-TABS-04)", () => {
  it("popstate com ?tab= válido + drift novo em campos do snapshot → modal intercepta ANTES do save", async () => {
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

    act(() => {
      window.history.pushState(null, "", "/loja?tab=posicionamento");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    // D13: a ordem do fluxo de saída exige a decisão do modal ANTES do PATCH
    expect(onDriftNavigate).toHaveBeenCalledTimes(1);
    expect(result.current.activeTab).toBe("dados");
    expect(autoSave).not.toHaveBeenCalled();
  });

  it("após a decisão (driftCategory → none) o alvo pendente do popstate é navegado com autoSave", async () => {
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

    act(() => {
      window.history.pushState(null, "", "/loja?tab=posicionamento");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(onDriftNavigate).toHaveBeenCalledTimes(1);
    expect(result.current.activeTab).toBe("dados");
    expect(autoSave).not.toHaveBeenCalled();

    // Decisão do modal (realinhar/ignorar/dismiss) → driftCategory volta a 'none' →
    // o resume do hook navega para o alvo pendente rodando o autoSave (D13/e)
    rerender({ driftCategory: "none" });
    await waitFor(() => expect(result.current.activeTab).toBe("posicionamento"));
    expect(autoSave).toHaveBeenCalledTimes(1);
  });

  it("popstate com drift + alvo bloqueado: drift intercepta primeiro (modal antes do painel D6)", async () => {
    const onDriftNavigate = vi.fn();
    const autoSave = vi.fn(async () => ({ ok: true }));

    const { result } = renderHook(() =>
      useOnboardingTabs(
        makeDeps({
          storeId: "store-1",
          formData: makeFormData({ name: "Nome Editado", tone_of_voice: "" }),
          editedFields: ["name"],
          driftCategory: "sensitive",
          driftStatus: "new",
          autoSave,
        }),
        { onDriftNavigate },
      ),
    );

    act(() => {
      // direcao-visual está bloqueada (sem tom de voz) MAS há drift → intercepta
      window.history.pushState(null, "", "/loja?tab=direcao-visual");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(onDriftNavigate).toHaveBeenCalledTimes(1);
    expect(result.current.activeTab).toBe("dados");
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

  it("editar o tom de voz desbloqueia Direção Visual NA HORA, mesmo com hasLocalEdits já true (memo stale)", () => {
    const autoSave = vi.fn(async () => ({ ok: true }));
    const { result, rerender } = renderHook(
      (props: { tone: string }) =>
        useOnboardingTabs(
          makeDeps({
            storeId: "store-1",
            formData: makeFormData({ tone_of_voice: props.tone }),
            hasLocalEdits: true,
            isPersisted: true,
            readiness: { ready: true, missing: [] },
            autoSave,
          }),
        ),
      { initialProps: { tone: "" } },
    );

    // Antes do tom de voz: bloqueada (storeId existe, mas sem tone)
    expect(result.current.tabStates["direcao-visual"].state).toBe("blocked");
    expect(result.current.tabStates["direcao-visual"].reason).toBe("needs_tone_of_voice");

    // Usuário seleciona o tom de voz — formData muda, mas hasLocalEdits continua true
    rerender({ tone: "moderno" });

    expect(result.current.tabStates["direcao-visual"].state).not.toBe("blocked");
    expect(result.current.tabStates["direcao-visual"].unlockReason).toBeUndefined();
  });

  it("aceitar o legal desbloqueia Posicionamento mesmo sem edição de campo (memo stale)", () => {
    const autoSave = vi.fn(async () => ({ ok: true }));
    const { result, rerender } = renderHook(
      (props: { legalAccepted: boolean }) =>
        useOnboardingTabs(
          makeDeps({
            storeId: "store-1",
            formData: makeFormData({ name: "Minha Loja", segment: "outros" }),
            legalAccepted: props.legalAccepted,
            hasLocalEdits: false,
            isPersisted: true,
            readiness: { ready: true, missing: [] },
            autoSave,
          }),
        ),
      { initialProps: { legalAccepted: false } },
    );

    expect(result.current.tabStates.posicionamento.state).toBe("blocked");
    expect(result.current.tabStates.posicionamento.reason).toBe("needs_legal_acceptance");

    rerender({ legalAccepted: true });

    expect(result.current.tabStates.posicionamento.state).not.toBe("blocked");
    expect(result.current.tabStates.posicionamento.unlockReason).toBeUndefined();
  });
});

describe("useOnboardingTabs — persistência fiscal ANTES da navegação (fix 260806-fsl)", () => {
  it("troca de aba aguarda o autoSave (que persiste o fiscal) resolver antes de navegar", async () => {
    let resolveAutoSave: ((v: { ok: boolean; storeId?: string }) => void) | null = null;
    const autoSave = vi.fn(
      () =>
        new Promise<{ ok: boolean; storeId?: string }>((resolve) => {
          resolveAutoSave = resolve;
        }),
    );
    const { result } = renderHook(() =>
      useOnboardingTabs(makeDeps({ storeId: "store-1", autoSave })),
    );

    let pending: Promise<void> | undefined;
    await act(async () => {
      pending = result.current.setActiveTab("posicionamento");
    });

    // autoSave (draft→fiscal) ainda pendente → NÃO navegou
    expect(autoSave).toHaveBeenCalledTimes(1);
    expect(result.current.activeTab).toBe("dados");

    resolveAutoSave!({ ok: true });
    await act(async () => {
      await pending;
    });

    expect(result.current.activeTab).toBe("posicionamento");
  });

  it("navegação interna (ex.: gerar campanha) só navega DEPOIS do autoSave resolver", async () => {
    let resolveAutoSave: ((v: { ok: boolean }) => void) | null = null;
    const autoSave = vi.fn(
      () =>
        new Promise<{ ok: boolean }>((resolve) => {
          resolveAutoSave = resolve;
        }),
    );
    const { result } = renderHook(() =>
      useOnboardingTabs(makeDeps({ storeId: "store-1", autoSave })),
    );

    // jsdom não implementa navegação real — substitui window.location por um
    // objeto com href gravável para capturar a TENTATIVA de redirect.
    const locationMock = {
      href: window.location.href,
      origin: window.location.origin,
      search: window.location.search,
      pathname: window.location.pathname,
      hash: window.location.hash,
    };
    Object.defineProperty(window, "location", {
      value: locationMock,
      writable: true,
      configurable: true,
    });

    const anchor = document.createElement("a");
    const target = `${locationMock.origin}/campanhas/nova`;
    anchor.href = target;
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "target", { value: anchor });

    await act(async () => {
      result.current.handleInternalNavigation(event);
    });

    // autoSave pendente → nenhuma tentativa de navegação ainda
    expect(autoSave).toHaveBeenCalledTimes(1);
    expect(locationMock.href).not.toBe(target);

    resolveAutoSave!({ ok: true });
    await act(async () => {});

    // só após o autoSave resolver o redirect é tentado
    expect(locationMock.href).toBe(target);
  });
});
