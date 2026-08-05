// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { StoreTabs } from "../store-tabs";
import { ONBOARDING_TABS } from "@/lib/store-onboarding/tabs";
import type { OnboardingTab, TabBlockReason } from "@/lib/store-onboarding/tabs";
import type { TabState } from "@/lib/store-onboarding/tab-state";

type TabStates = Record<
  OnboardingTab,
  { state: TabState; reason?: TabBlockReason }
>;

function makeStates(overrides: Partial<TabStates> = {}): TabStates {
  return {
    dados: { state: "saved" },
    posicionamento: { state: "blocked", reason: "needs_legal_acceptance" },
    "direcao-visual": { state: "blocked", reason: "needs_tone_of_voice" },
    ...overrides,
  };
}

interface RenderTabsOptions {
  activeTab?: OnboardingTab;
  variant?: "desktop" | "mobile-compact";
  states?: TabStates;
  panelContent?: string;
}

function renderTabs({
  activeTab = "dados",
  variant = "desktop",
  states = makeStates(),
  panelContent = "conteudo do painel dados",
}: RenderTabsOptions = {}) {
  const onTabChange = vi.fn();
  const utils = render(
    <StoreTabs
      tabs={ONBOARDING_TABS}
      activeTab={activeTab}
      states={states}
      onTabChange={onTabChange}
      variant={variant}
    >
      <div>{panelContent}</div>
    </StoreTabs>,
  );
  return { onTabChange, ...utils };
}

describe("StoreTabs — ARIA tabs (F36-TABS-03/04)", () => {
  it("expõe roles tablist/tab/tabpanel com aria-selected apenas na aba ativa", () => {
    renderTabs();

    const tablist = screen.getByRole("tablist");
    expect(tablist).toBeInTheDocument();
    expect(tablist).toHaveAttribute("aria-label", "Abas da loja");

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);

    const dadosTab = screen.getByRole("tab", { name: /Dados/ });
    const posicionamentoTab = screen.getByRole("tab", { name: /Posicionamento/ });

    expect(dadosTab).toHaveAttribute("aria-selected", "true");
    expect(posicionamentoTab).toHaveAttribute("aria-selected", "false");

    // aria-controls aponta para o painel correspondente
    expect(dadosTab).toHaveAttribute("aria-controls", "panel-dados");

    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("aria-labelledby", "tab-dados");
    expect(panel).toHaveTextContent("conteudo do painel dados");
  });

  it("roving tabindex: apenas a aba ativa é tabulável (tabIndex 0), demais -1", () => {
    renderTabs();

    const dadosTab = screen.getByRole("tab", { name: /Dados/ });
    const posicionamentoTab = screen.getByRole("tab", { name: /Posicionamento/ });
    const direcaoVisualTab = screen.getByRole("tab", { name: /Direção Visual/ });

    expect(dadosTab).toHaveAttribute("tabindex", "0");
    expect(posicionamentoTab).toHaveAttribute("tabindex", "-1");
    expect(direcaoVisualTab).toHaveAttribute("tabindex", "-1");
  });

  it("setas ArrowRight/ArrowLeft (circular) + Home/End movem o foco sem selecionar", () => {
    renderTabs({ activeTab: "dados" });
    const tablist = screen.getByRole("tablist");

    // ArrowRight → próxima aba (posicionamento)
    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Posicionamento/ })).toHaveFocus();

    // ArrowRight de novo → direcao-visual (última)
    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Direção Visual/ })).toHaveFocus();

    // ArrowRight circular → volta para dados
    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Dados/ })).toHaveFocus();

    // ArrowLeft (circular) → direcao-visual
    fireEvent.keyDown(tablist, { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: /Direção Visual/ })).toHaveFocus();

    // Home → primeira aba
    fireEvent.keyDown(tablist, { key: "Home" });
    expect(screen.getByRole("tab", { name: /Dados/ })).toHaveFocus();

    // End → última aba
    fireEvent.keyDown(tablist, { key: "End" });
    expect(screen.getByRole("tab", { name: /Direção Visual/ })).toHaveFocus();

    // Teclas de navegação NÃO selecionam (roving tabindex — seleção só via Enter/Space/clique)
    expect(screen.getByRole("tab", { name: /Direção Visual/ })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("Enter e Space selecionam a aba; clique chama onTabChange com o id", () => {
    const { onTabChange } = renderTabs();

    fireEvent.keyDown(screen.getByRole("tab", { name: /Posicionamento/ }), {
      key: "Enter",
    });
    expect(onTabChange).toHaveBeenCalledWith("posicionamento");

    fireEvent.keyDown(screen.getByRole("tab", { name: /Direção Visual/ }), {
      key: " ",
    });
    expect(onTabChange).toHaveBeenCalledWith("direcao-visual");

    fireEvent.click(screen.getByRole("tab", { name: /Dados/ }));
    expect(onTabChange).toHaveBeenCalledWith("dados");
  });

  it("deep-link em aba bloqueada: aria-describedby aponta para o motivo e o painel renderiza o bloqueio", () => {
    renderTabs({
      activeTab: "posicionamento",
      states: makeStates({
        dados: { state: "saved" },
        posicionamento: { state: "blocked", reason: "needs_legal_acceptance" },
      }),
    });

    // O botão da aba bloqueada E ativa ganha aria-describedby → painel de motivo
    const blockedTab = screen.getByRole("tab", { name: /Posicionamento/ });
    expect(blockedTab).toHaveAttribute("aria-describedby", "reason-posicionamento");

    // Painel de bloqueio renderizado (nunca tela em branco — D6)
    expect(screen.getByText("Etapa bloqueada")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Esta etapa exige o aceite legal dos Termos de Uso e da Política de Uso Aceitável/,
      ),
    ).toBeInTheDocument();

    // Aba bloqueada NÃO ativa → sem aria-describedby (motivo apenas no painel ativo, D10)
    const inactiveBlockedTab = screen.getByRole("tab", { name: /Direção Visual/ });
    expect(inactiveBlockedTab).not.toHaveAttribute("aria-describedby");
  });

  it("região aria-live polite presente para anúncio de troca de aba/estado (D11)", () => {
    renderTabs();
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion).toHaveAttribute("class", "sr-only");
    expect(liveRegion).toHaveTextContent(/Aba Dados/);
  });
});

describe("StoreTabs — variante mobile-compact (F36-TABS-03/F22)", () => {
  it("renderiza labels labelMobile (Perfil/Visual) e barra 'Continuar' fixa", () => {
    renderTabs({ variant: "mobile-compact", activeTab: "dados" });

    // Labels curtos do mobile são o TEXTO VISÍVEL; o aria-label mantém o
    // vocabulário estável (Posicionamento/Direção Visual — D10)
    expect(screen.getByText("Perfil")).toBeInTheDocument();
    expect(screen.getByText("Visual")).toBeInTheDocument();
    expect(screen.queryByText("Posicionamento")).not.toBeInTheDocument();
    expect(screen.queryByText("Direção Visual")).not.toBeInTheDocument();

    // Barra "Continuar" fixa (sticky bottom) — próxima aba a partir de dados
    const panel = screen.getByRole("tabpanel");
    const [backButton, continueButton] = within(panel).getAllByRole("button");
    expect(continueButton).toHaveAttribute("aria-label", "Continuar para Perfil");
    expect(continueButton).toHaveTextContent("Continuar: Perfil");

    // Primeira aba → botão voltar desabilitado (sem label quando disabled)
    expect(backButton).toBeDisabled();
  });

  it("na aba do meio, 'Voltar para X' e 'Continuar' navegam pelas abas vizinhas", () => {
    const { onTabChange } = renderTabs({
      variant: "mobile-compact",
      activeTab: "posicionamento",
      panelContent: "conteudo posicionamento",
    });

    const backButton = screen.getByRole("button", { name: "Voltar para Dados" });
    expect(backButton).toBeEnabled();
    fireEvent.click(backButton);
    expect(onTabChange).toHaveBeenCalledWith("dados");

    const continueButton = screen.getByRole("button", { name: "Continuar para Visual" });
    expect(continueButton).toHaveTextContent("Continuar: Visual");
    fireEvent.click(continueButton);
    expect(onTabChange).toHaveBeenCalledWith("direcao-visual");
  });

  it("touch targets ≥ 44px nas abas e na barra Continuar (F22)", () => {
    renderTabs({ variant: "mobile-compact", activeTab: "dados" });

    for (const tab of screen.getAllByRole("tab")) {
      expect(tab).toHaveClass("min-h-[44px]");
      expect(tab).toHaveClass("min-w-[44px]");
    }

    const panel = screen.getByRole("tabpanel");
    const [backButton, continueButton] = within(panel).getAllByRole("button");
    expect(continueButton).toHaveClass("min-h-[44px]");
    expect(backButton).toHaveClass("min-h-[44px]");
    expect(backButton).toHaveClass("min-w-[44px]");
  });

  it("o painel ativo também renderiza o motivo de bloqueio no mobile (comportamento desktop preservado)", () => {
    renderTabs({
      variant: "mobile-compact",
      activeTab: "direcao-visual",
      states: makeStates({
        "direcao-visual": { state: "blocked", reason: "needs_tone_of_voice" },
      }),
    });

    const tab = screen.getByRole("tab", { name: /Visual/ });
    expect(tab).toHaveAttribute("aria-describedby", "reason-direcao-visual");
    expect(screen.getByText("Etapa bloqueada")).toBeInTheDocument();
    expect(
      screen.getByText(/Defina o tom de voz na aba anterior para liberar esta etapa/),
    ).toBeInTheDocument();
  });
});

describe("StoreTabs — painel ativo (D10)", () => {
  it("renderiza apenas o conteúdo do painel ativo dentro do tabpanel", () => {
    renderTabs({ activeTab: "direcao-visual", panelContent: "conteudo visual" });
    const panel = within(screen.getByRole("tabpanel"));
    expect(panel.getByText("conteudo visual")).toBeInTheDocument();
    expect(panel.queryByText("conteudo do painel dados")).not.toBeInTheDocument();
  });
});
