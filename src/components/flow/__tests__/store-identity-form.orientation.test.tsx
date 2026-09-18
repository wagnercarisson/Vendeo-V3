// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
/**
 * F49 (D3/D4/D5/D6/D7/D13/D14) — testes de orientação contextual, acessibilidade
 * e descrição por opção dos campos da loja.
 *
 * As asserções importam as strings do módulo puro
 * `@/lib/store-onboarding/field-guidance` (fonte única — T-49-02) em vez de
 * repetir literais, de modo que uma divergência entre componente e conteúdo
 * falha o teste.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Store } from "@/lib/store";
import {
  STORE_NAME_HINT,
  FISCAL_SECTION_LABEL,
  TONE_OF_VOICE_HINT,
  TONE_OF_VOICE_DESCRIPTIONS,
  POSITIONING_LABEL,
  POSITIONING_PLACEHOLDER,
  POSITIONING_HELP_TITLE,
  POSITIONING_EXAMPLE,
  POSITIONING_HINT,
  POSITIONING_IDENTITY_HINT,
  SHORT_DESCRIPTION_HINT,
  SLOGAN_HINT,
  RECOMMENDED_LABEL,
  OPTIONAL_LABEL,
} from "@/lib/store-onboarding/field-guidance";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import { StoreIdentityForm } from "../store-identity-form";

// ── Helpers ────────────────────────────────────────────────────────────────

const LEGAL_VERSIONS = {
  versions: {
    terms_of_service: { label: "Termos de Uso", version: "v1", url: "/termos" },
    acceptable_use: { label: "Política de Uso Aceitável", version: "v1", url: "/aup" },
  },
};

function okJson(data: unknown) {
  return { ok: true, json: async () => data } as Response;
}

function installMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

function installFetch(routes: Record<string, unknown>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const keys = Object.keys(routes).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      if (url.startsWith(key)) return okJson(routes[key]);
    }
    return okJson({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const STORE: Store = {
  id: "store-1",
  user_id: "user-1",
  name: "Minha Loja",
  segment: "outros",
  city: null,
  state: null,
  brand_color: null,
  logo_url: null,
  subsegment: null,
  tone_of_voice: null,
  positioning: null,
  short_description: null,
  slogan: null,
  logo_status: null,
  identity_state: null,
  text_only_origin: null,
  manual_color_override: false,
  previous_identity_snapshot: null,
  visual_signature_attempts: 0,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  cnpj_normalized: null,
  cnpj_root_hash: "",
  razao_social: null,
  nome_fantasia: null,
  cnpj_validation_score: null,
  verification_status: "not_verified",
  verification_data: null,
  cnpj_official_data: null,
  cnpj_lookup_hash: null,
  verification_requested_at: null,
  verification_decided_at: null,
  verification_reasons: null,
  is_test_store: false,
};

function renderForm(tab: "dados" | "posicionamento") {
  return render(
    <StoreIdentityForm initialStore={STORE} userId="user-1" initialTab={tab} />,
  );
}

/** `aria-describedby` não vazio cujos ids resolvem para elementos existentes. */
function describedByIds(el: HTMLElement): string[] {
  const describedBy = el.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  const ids = describedBy!.split(" ").filter(Boolean);
  expect(ids.length).toBeGreaterThan(0);
  for (const id of ids) {
    expect(document.getElementById(id)).not.toBeNull();
  }
  return ids;
}

beforeEach(() => {
  localStorage.clear();
  installMatchMedia(false); // desktop
  installFetch({ "/api/legal/current-versions": LEGAL_VERSIONS });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Testes ─────────────────────────────────────────────────────────────────

describe("StoreIdentityForm — orientação contextual (F49)", () => {
  it("7.1 exibe labels/hints de fonte única e o heading de dados fiscais", () => {
    renderForm("dados");

    expect(screen.getByText(STORE_NAME_HINT)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: FISCAL_SECTION_LABEL }),
    ).toBeInTheDocument();
  });

  it("7.2 associa hint/erro por aria-describedby e usa aria-required sem required nativo (Nome da Loja)", () => {
    renderForm("dados");

    const name = screen.getByLabelText(/Nome da Loja/i) as HTMLInputElement;
    const hintIds = describedByIds(name);
    expect(document.getElementById(hintIds[0])).toHaveTextContent(STORE_NAME_HINT);
    expect(name).toHaveAttribute("aria-required", "true");
    expect(name).not.toHaveAttribute("required");

    // Provoca o erro existente (blur com nome vazio) — o id do erro entra no
    // aria-describedby e o campo expõe aria-invalid.
    fireEvent.change(name, { target: { value: "" } });
    fireEvent.blur(name);

    const idsWithError = describedByIds(name);
    const errorEl = idsWithError
      .map((id) => document.getElementById(id))
      .find((el) => el?.textContent?.includes("Nome deve ter entre 2 e 60 caracteres"));
    expect(errorEl).toBeTruthy();
    expect(errorEl).toHaveAttribute("id");
    expect(name).toHaveAttribute("aria-invalid", "true");
  });

  it("7.2 associa o erro de #segment por aria-describedby e aria-invalid (loja)", () => {
    renderForm("dados");

    const segment = screen.getByLabelText(/^Segmento/i) as HTMLSelectElement;
    expect(segment).toHaveAttribute("aria-required", "true");
    expect(segment).not.toHaveAttribute("required");

    fireEvent.change(segment, { target: { value: "" } });
    fireEvent.blur(segment);

    const ids = describedByIds(segment);
    const errorEl = ids
      .map((id) => document.getElementById(id))
      .find((el) => el?.textContent?.includes("Selecione um segmento válido"));
    expect(errorEl).toBeTruthy();
    expect(segment).toHaveAttribute("aria-invalid", "true");
  });

  it("7.1/7.2/7.3/7.4 orienta Tom de Voz, Posicionamento, Descrição Curta e Slogan com a11y", () => {
    renderForm("posicionamento");

    expect(screen.getByText(TONE_OF_VOICE_HINT)).toBeInTheDocument();
    expect(screen.getByText(POSITIONING_HINT)).toBeInTheDocument();
    expect(screen.getByText(POSITIONING_IDENTITY_HINT)).toBeInTheDocument();
    expect(screen.getByText(SHORT_DESCRIPTION_HINT)).toBeInTheDocument();
    expect(screen.getByText(SLOGAN_HINT)).toBeInTheDocument();

    // Posicionamento: label principal + placeholder canônicos.
    const positioningLabel = document.querySelector('label[for="positioning"]');
    expect(positioningLabel?.textContent).toContain(POSITIONING_LABEL);
    expect(screen.getByLabelText(new RegExp(escapeRegExp(POSITIONING_LABEL)))).toHaveAttribute(
      "placeholder",
      POSITIONING_PLACEHOLDER,
    );

    // 7.2 — aria-describedby de todos os campos com orientação resolve.
    const tone = document.getElementById("tone_of_voice")!;
    const positioning = document.getElementById("positioning")!;
    const shortDescription = document.getElementById("short_description")!;
    const slogan = document.getElementById("slogan")!;
    describedByIds(tone);
    describedByIds(positioning);
    describedByIds(shortDescription);
    describedByIds(slogan);

    // 7.4 — recomendado textual em Posicionamento e Descrição Curta; Slogan é
    // opcional e NÃO exibe "Recomendado".
    const positioningText = document.querySelector('label[for="positioning"]')?.textContent ?? "";
    const shortDescriptionText =
      document.querySelector('label[for="short_description"]')?.textContent ?? "";
    const sloganText = document.querySelector('label[for="slogan"]')?.textContent ?? "";
    expect(positioningText).toContain(RECOMMENDED_LABEL);
    expect(shortDescriptionText).toContain(RECOMMENDED_LABEL);
    expect(sloganText).not.toContain(RECOMMENDED_LABEL);
    expect(sloganText).toContain(OPTIONAL_LABEL);
  });

  it("7.3 sem seleção não renderiza descrição; com seleção renderiza a descrição da opção (8 opções)", () => {
    renderForm("posicionamento");

    const entries = Object.entries(TONE_OF_VOICE_DESCRIPTIONS);
    expect(entries).toHaveLength(8);

    // Sem seleção → nenhuma descrição de opção.
    for (const [, description] of entries) {
      expect(screen.queryByText(description)).toBeNull();
    }

    const select = document.getElementById("tone_of_voice") as HTMLSelectElement;

    // Itera as 8 opções a partir do próprio mapa importado.
    for (const [tone, description] of entries) {
      fireEvent.change(select, { target: { value: tone } });
      const descriptionEl = screen.getByText(description);
      expect(descriptionEl).toBeInTheDocument();

      // O id de descrição contextual passa a integrar o aria-describedby.
      const ids = describedByIds(select);
      expect(ids).toContain(descriptionEl.id);
    }

    // Volta para "sem seleção" → descrição desaparece.
    fireEvent.change(select, { target: { value: "" } });
    for (const [, description] of entries) {
      expect(screen.queryByText(description)).toBeNull();
    }
  });

  it("7.4 ajuda expansível do posicionamento: colapsada por padrão, abre/fecha com aria-expanded e região oculta via hidden", () => {
    renderForm("posicionamento");

    const trigger = screen.getByRole("button", { name: POSITIONING_HELP_TITLE });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    const regionId = trigger.getAttribute("aria-controls");
    expect(regionId).toBeTruthy();
    const region = document.getElementById(regionId!)!;
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute("hidden");
    expect(screen.getByText(POSITIONING_EXAMPLE)).not.toBeVisible();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(regionId!)).not.toBeNull();
    expect(region).not.toHaveAttribute("hidden");
    expect(screen.getByText(POSITIONING_EXAMPLE)).toBeVisible();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById(regionId!)).not.toBeNull();
    expect(region).toHaveAttribute("hidden");
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
