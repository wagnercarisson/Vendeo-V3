// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// useSearchParams precisa variar por teste → mock dinâmico via vi.hoisted.
// StoreIdentityForm (2581 linhas) é mockado para capturar as props repassadas.
const { searchParamsMock, formProps } = vi.hoisted(() => ({
  searchParamsMock: { current: new URLSearchParams() },
  formProps: [] as Array<Record<string, unknown>>,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsMock.current,
}));

vi.mock("../store-identity-form", () => ({
  StoreIdentityForm: (props: Record<string, unknown>) => {
    formProps.push(props);
    return <div data-testid="store-identity-form" />;
  },
}));

import { StorePageClient } from "../store-page-client";

function renderWithParams(search: string) {
  formProps.length = 0;
  searchParamsMock.current = new URLSearchParams(search);
  render(<StorePageClient initialStore={null} userId="user-1" />);
  expect(screen.getByTestId("store-identity-form")).toBeInTheDocument();
  return formProps[0];
}

beforeEach(() => {
  formProps.length = 0;
  localStorage.clear();
});

describe("StorePageClient — parsing de ?tab= (F36-TABS-04/D6)", () => {
  it("?tab= válido → aba correspondente (deep-link)", () => {
    const props = renderWithParams("?tab=posicionamento");
    expect(props.initialTab).toBe("posicionamento");
  });

  it("?tab= válido direcao-visual → direcao-visual", () => {
    const props = renderWithParams("?tab=direcao-visual");
    expect(props.initialTab).toBe("direcao-visual");
  });

  it("?tab= inválido → fallback 'dados'", () => {
    const props = renderWithParams("?tab=nao-existe");
    expect(props.initialTab).toBe("dados");
  });

  it("sem ?tab= → 'dados'", () => {
    const props = renderWithParams("");
    expect(props.initialTab).toBe("dados");
  });
});

describe("StorePageClient — resolução de ordem (D6/D12)", () => {
  it("?tab= tem precedência sobre o compat required=visual-direction", () => {
    const props = renderWithParams("?tab=dados&required=visual-direction");
    expect(props.initialTab).toBe("dados");
  });

  it("compat required=visual-direction (sem ?tab=) → direcao-visual", () => {
    const props = renderWithParams("?required=visual-direction");
    expect(props.initialTab).toBe("direcao-visual");
  });

  it("compat required=cadastro-fiscal (sem ?tab=) → dados", () => {
    const props = renderWithParams("?required=cadastro-fiscal");
    expect(props.initialTab).toBe("dados");
  });
});

describe("StorePageClient — fiscal / message / props (F36-TABS-04/D12)", () => {
  it("fiscal=pending → fiscalPending true", () => {
    const props = renderWithParams("?tab=dados&fiscal=pending");
    expect(props.fiscalPending).toBe(true);
  });

  it("sem fiscal → fiscalPending false", () => {
    const props = renderWithParams("?tab=dados");
    expect(props.fiscalPending).toBe(false);
  });

  it("message= é repassado como redirectMessage", () => {
    const props = renderWithParams("?tab=direcao-visual&message=needs-visual-direction");
    expect(props.redirectMessage).toBe("needs-visual-direction");
  });

  it("sem message → redirectMessage undefined", () => {
    const props = renderWithParams("?tab=dados");
    expect(props.redirectMessage).toBeUndefined();
  });

  it("repassa initialStore e userId ao form", () => {
    const store = { id: "s1", name: "Loja" } as never;
    formProps.length = 0;
    searchParamsMock.current = new URLSearchParams("");
    render(<StorePageClient initialStore={store} userId="user-9" />);
    expect(formProps[0].initialStore).toBe(store);
    expect(formProps[0].userId).toBe("user-9");
  });

  it("NUNCA lê localStorage('store_id') (F36-IDENTITY-UI-05)", () => {
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem");
    renderWithParams("?tab=dados");
    const storeIdReads = getItemSpy.mock.calls.filter(([key]) => key === "store_id");
    expect(storeIdReads).toHaveLength(0);
  });
});
