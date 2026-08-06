// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStoreForm } from "../use-store-form";
import type { Store } from "@/lib/store";

/**
 * Fix fiscal (F36): ramo de cadastro fiscal do autoSave — persistência
 * draft → fiscal via POST /api/store/update-cnpj ANTES de navegação/troca de
 * aba, sem exigir o clique em "Salvar e continuar".
 *
 * Regras de disparo (aprovadas):
 * - storeId existente + loja SEM CNPJ + CNPJ válido (14 dígitos + check) +
 *   razão social mínima → POST /api/store/update-cnpj
 * - CNPJ inválido/incompleto ou sem razão social → NÃO chama update-cnpj
 * - Falha do update-cnpj → { ok: false } + erro, nunca finge sucesso fiscal
 * - Loja COM CNPJ → razaoSocial/nomeFantasia vão no PATCH (paridade com save())
 */

// CNPJ válido de teste (check digits conferem): 11.222.333/0001-81
const VALID_CNPJ = "11222333000181";
const VALID_CNPJ_MASKED = "11.222.333/0001-81";
const RAZAO = "LOJA TESTE LTDA";
const FANTASIA = "Loja Teste";

function draftStore(overrides: Record<string, unknown> = {}): Store {
  return {
    id: "store-1",
    name: "Loja X",
    segment: "outros",
    brand_color: "",
    city: null,
    state: null,
    ...overrides,
  } as unknown as Store;
}

function storeWithCnpj(): Store {
  return draftStore({ cnpj_normalized: VALID_CNPJ });
}

function jsonResponse(data: unknown, ok = true, status = ok ? 200 : 400) {
  return {
    ok,
    status,
    json: async () => data,
  } as Response;
}

interface FetchScenario {
  updateCnpj?: { ok: boolean; data?: unknown; status?: number };
  patch?: { ok: boolean; data?: unknown; status?: number };
}

function setupFetch(scenario: FetchScenario) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.endsWith("/api/store/update-cnpj") && method === "POST") {
      const cfg = scenario.updateCnpj;
      if (cfg) return jsonResponse(cfg.data ?? {}, cfg.ok, cfg.status);
    }
    if (url.includes("/api/store/") && url.endsWith("/store-1") && method === "PATCH") {
      const cfg = scenario.patch;
      if (cfg) return jsonResponse(cfg.data ?? {}, cfg.ok, cfg.status);
    }
    if (url.endsWith("/api/store") && method === "POST") {
      return jsonResponse({ id: "store-created-1" });
    }
    return jsonResponse({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function callBodies(fetchMock: ReturnType<typeof vi.fn>, urlEndsWith: string) {
  return fetchMock.mock.calls
    .filter(([input, init]) => String(input).endsWith(urlEndsWith))
    .map(([, init]) => JSON.parse(String((init as RequestInit)?.body)) as Record<string, unknown>);
}

const updateCnpjBodies = (fetchMock: ReturnType<typeof vi.fn>) =>
  callBodies(fetchMock, "/api/store/update-cnpj");
const patchBodies = (fetchMock: ReturnType<typeof vi.fn>) =>
  callBodies(fetchMock, "/store-1");

function countCalls(fetchMock: ReturnType<typeof vi.fn>, urlEndsWith: string) {
  return fetchMock.mock.calls.filter(([input]) => String(input).endsWith(urlEndsWith)).length;
}

function fillFiscal(result: { current: ReturnType<typeof useStoreForm> }) {
  act(() => {
    result.current.setField("cnpj", VALID_CNPJ_MASKED);
    result.current.setField("razaoSocial", RAZAO);
    result.current.setField("nomeFantasia", FANTASIA);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useStoreForm.autoSave — ramo fiscal (draft → fiscal)", () => {
  it("CNPJ válido + loja sem CNPJ → POST update-cnpj com payload correto + fiscalPersisted", async () => {
    const fetchMock = setupFetch({
      updateCnpj: { ok: true, data: { success: true } },
      patch: { ok: true, data: { id: "store-1" } },
    });

    const { result } = renderHook(() => useStoreForm({ initialStore: draftStore() }));
    fillFiscal(result);

    let out: Awaited<ReturnType<ReturnType<typeof useStoreForm>["autoSave"]>> | undefined;
    await act(async () => {
      out = await result.current.autoSave({});
    });

    expect(out).toEqual({ ok: true, fiscalPersisted: true, storeId: "store-1" });

    // update-cnpj chamado com CNPJ normalizado + razão/nome fantasia
    const cnpjBodies = updateCnpjBodies(fetchMock);
    expect(cnpjBodies).toHaveLength(1);
    expect(cnpjBodies[0]).toEqual({
      storeId: "store-1",
      cnpjNormalized: VALID_CNPJ,
      razaoSocial: RAZAO,
      nomeFantasia: FANTASIA,
    });

    // PATCH também rodou (campos não-fiscais), SEM razao/nome (guard de
    // atomicidade: loja sem CNPJ rejeita razaoSocial/nomeFantasia no PATCH).
    const patches = patchBodies(fetchMock);
    expect(patches).toHaveLength(1);
    expect(patches[0].razaoSocial).toBeUndefined();
    expect(patches[0].nomeFantasia).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it("nomeFantasia vazio → fallback para razaoSocial (paridade com save())", async () => {
    const fetchMock = setupFetch({
      updateCnpj: { ok: true, data: { success: true } },
      patch: { ok: true, data: { id: "store-1" } },
    });
    const { result } = renderHook(() => useStoreForm({ initialStore: draftStore() }));
    act(() => {
      result.current.setField("cnpj", VALID_CNPJ);
      result.current.setField("razaoSocial", RAZAO);
    });

    await act(async () => {
      await result.current.autoSave({});
    });

    const cnpjBodies = updateCnpjBodies(fetchMock);
    expect(cnpjBodies[0].nomeFantasia).toBe(RAZAO);
  });

  it("CNPJ inválido (check digits errados) → NÃO chama update-cnpj; PATCH só", async () => {
    const fetchMock = setupFetch({ patch: { ok: true, data: { id: "store-1" } } });
    const { result } = renderHook(() => useStoreForm({ initialStore: draftStore() }));
    act(() => {
      result.current.setField("cnpj", "11222333000182"); // check digit errado
      result.current.setField("razaoSocial", RAZAO);
    });

    let out: Awaited<ReturnType<ReturnType<typeof useStoreForm>["autoSave"]>> | undefined;
    await act(async () => {
      out = await result.current.autoSave({});
    });

    expect(updateCnpjBodies(fetchMock)).toHaveLength(0);
    expect(patchBodies(fetchMock)).toHaveLength(1);
    expect(out?.fiscalPersisted).toBeUndefined();
    expect(out?.ok).toBe(true);
  });

  it("CNPJ incompleto (11 dígitos) → NÃO chama update-cnpj", async () => {
    const fetchMock = setupFetch({ patch: { ok: true, data: { id: "store-1" } } });
    const { result } = renderHook(() => useStoreForm({ initialStore: draftStore() }));
    act(() => {
      result.current.setField("cnpj", "112223330001");
      result.current.setField("razaoSocial", RAZAO);
    });

    await act(async () => {
      await result.current.autoSave({});
    });

    expect(updateCnpjBodies(fetchMock)).toHaveLength(0);
  });

  it("CNPJ válido SEM razão social → NÃO chama update-cnpj (mínimo da rota)", async () => {
    const fetchMock = setupFetch({ patch: { ok: true, data: { id: "store-1" } } });
    const { result } = renderHook(() => useStoreForm({ initialStore: draftStore() }));
    act(() => {
      result.current.setField("cnpj", VALID_CNPJ);
    });

    await act(async () => {
      await result.current.autoSave({});
    });

    expect(updateCnpjBodies(fetchMock)).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  it.each([
    [409, { error: "Este CNPJ já está registrado em outra conta." }],
    [400, { error: "O CNPJ informado não foi encontrado na Receita Federal. Verifique o número e tente novamente." }],
    [503, { error: "Serviço de consulta CNPJ temporariamente indisponível. Tente novamente mais tarde." }],
  ])("update-cnpj falha (%i) → { ok: false }, erro visível, NÃO marca fiscal salvo", async (status, data) => {
    const fetchMock = setupFetch({
      updateCnpj: { ok: false, data, status },
      patch: { ok: true, data: { id: "store-1" } },
    });
    const { result } = renderHook(() => useStoreForm({ initialStore: draftStore() }));
    fillFiscal(result);

    let out: Awaited<ReturnType<ReturnType<typeof useStoreForm>["autoSave"]>> | undefined;
    await act(async () => {
      out = await result.current.autoSave({});
    });

    expect(out?.ok).toBe(false);
    expect(out?.fiscalPersisted).toBeUndefined();
    expect(result.current.error).toBe((data as { error: string }).error);
    // Não finge sucesso — saveStatus vira "error" (badge "Não salvo")
    expect(result.current.saveStatus).toBe("error");
  });

  it("loja COM CNPJ → razaoSocial/nomeFantasia no PATCH; update-cnpj NÃO chamado", async () => {
    const fetchMock = setupFetch({ patch: { ok: true, data: { id: "store-1" } } });
    const { result } = renderHook(() => useStoreForm({ initialStore: storeWithCnpj() }));
    fillFiscal(result);

    let out: Awaited<ReturnType<ReturnType<typeof useStoreForm>["autoSave"]>> | undefined;
    await act(async () => {
      out = await result.current.autoSave({});
    });

    expect(updateCnpjBodies(fetchMock)).toHaveLength(0);
    const patches = patchBodies(fetchMock);
    expect(patches).toHaveLength(1);
    expect(patches[0].razaoSocial).toBe(RAZAO);
    expect(patches[0].nomeFantasia).toBe(FANTASIA);
    expect(out?.ok).toBe(true);
    expect(out?.fiscalPersisted).toBeUndefined();
  });

  it("após fiscalPersisted, segunda chamada NÃO repete update-cnpj (hasExistingCnpj) e PATCH inclui razao/nome", async () => {
    const fetchMock = setupFetch({
      updateCnpj: { ok: true, data: { success: true } },
      patch: { ok: true, data: { id: "store-1" } },
    });
    const { result } = renderHook(() => useStoreForm({ initialStore: draftStore() }));
    fillFiscal(result);

    await act(async () => {
      await result.current.autoSave({});
    });
    expect(updateCnpjBodies(fetchMock)).toHaveLength(1);

    // Segunda navegação: a loja JÁ tem CNPJ (hasExistingCnpj=true) → PATCH com
    // razao/nome, SEM novo update-cnpj (evita cnpj_already_set 409).
    await act(async () => {
      await result.current.autoSave({ name: "Loja Y" });
    });

    expect(updateCnpjBodies(fetchMock)).toHaveLength(1);
    const patches = patchBodies(fetchMock);
    expect(patches).toHaveLength(2);
    expect(patches[1].razaoSocial).toBe(RAZAO);
    expect(patches[1].nomeFantasia).toBe(FANTASIA);
  });

  it("sem storeId + mínimo válido → POST /api/store em modo draft SEM CNPJ (D8/D15 preservado)", async () => {
    const fetchMock = setupFetch({});
    const { result } = renderHook(() =>
      useStoreForm({
        initialStore: draftStore({ id: undefined }),
      }),
    );
    act(() => {
      result.current.setAcceptedTerms(true);
      result.current.setField("cnpj", VALID_CNPJ);
      result.current.setField("razaoSocial", RAZAO);
    });

    let out: Awaited<ReturnType<ReturnType<typeof useStoreForm>["autoSave"]>> | undefined;
    await act(async () => {
      out = await result.current.autoSave({});
    });

    const creates = callBodies(fetchMock, "/api/store");
    expect(creates).toHaveLength(1);
    expect(creates[0].cnpj).toBeUndefined();
    expect(creates[0].razaoSocial).toBeUndefined();
    expect(out?.ok).toBe(true);
    expect(out?.storeId).toBe("store-created-1");
  });
});
