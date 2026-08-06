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
  { state: TabState; reason?: TabBlockReason; unlockReason?: TabBlockReason }
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

  it("Enter e Space selecionam a aba LIBERADA; clique chama onTabChange com o id", () => {
    const { onTabChange } = renderTabs({
      states: makeStates({
        posicionamento: { state: "saved" },
        "direcao-visual": { state: "saved" },
      }),
    });

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

  it("aba bloqueada tem aria-disabled + motivo acessível no botão e NÃO dispara onTabChange (hard-block D16)", () => {
    const { onTabChange } = renderTabs();

    const posicionamentoTab = screen.getByRole("tab", { name: /Posicionamento/ });
    const direcaoVisualTab = screen.getByRole("tab", { name: /Direção Visual/ });

    // aria-disabled + motivo acessível no próprio botão (aria-label/title)
    expect(posicionamentoTab).toHaveAttribute("aria-disabled", "true");
    expect(posicionamentoTab).toHaveAttribute(
      "title",
      "Esta etapa exige o aceite legal dos Termos de Uso e da Política de Uso Aceitável.",
    );
    expect(direcaoVisualTab).toHaveAttribute("aria-disabled", "true");

    // Clique/Enter/Space em aba bloqueada NÃO ativa (D16 — sem onTabChange)
    fireEvent.click(posicionamentoTab);
    expect(onTabChange).not.toHaveBeenCalled();

    fireEvent.keyDown(direcaoVisualTab, { key: "Enter" });
    expect(onTabChange).not.toHaveBeenCalled();

    // Motivo NÃO depende de painel: nada de "Etapa bloqueada" no painel ativo
    expect(screen.queryByText("Etapa bloqueada")).not.toBeInTheDocument();
  });

  it("fiscal pendente dominando o estado NÃO esconde o gate: motivo acessível no botão mesmo com pending_generation (D9/D16)", () => {
    renderTabs({
      activeTab: "posicionamento",
      states: makeStates({
        posicionamento: { state: "saved" },
        "direcao-visual": {
          state: "pending_generation",
          reason: "fiscal_pending",
          unlockReason: "needs_tone_of_voice",
        },
      }),
    });

    // O gate (tom de voz) fica acessível no botão da aba — não no painel ativo
    const tab = screen.getByRole("tab", { name: /Direção Visual/ });
    expect(tab).toHaveAttribute("aria-disabled", "true");
    expect(tab).toHaveAttribute(
      "title",
      "Defina o tom de voz na aba anterior para liberar esta etapa.",
    );
    expect(tab).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Defina o tom de voz na aba anterior para liberar esta etapa"),
    );

    // Badge continua pendente (D7/D8: navegação livre) — não "Bloqueada"
    expect(screen.getByText("Pendente")).toBeInTheDocument();
    expect(screen.queryByText("Bloqueada")).not.toBeInTheDocument();
    // Sem painel de bloqueio — o motivo vive no botão (D16)
    expect(screen.queryByText("Etapa bloqueada")).not.toBeInTheDocument();
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
    renderTabs({
      variant: "mobile-compact",
      activeTab: "dados",
      states: makeStates({
        posicionamento: { state: "saved" },
        "direcao-visual": { state: "saved" },
      }),
    });

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
      states: makeStates({
        posicionamento: { state: "saved" },
        "direcao-visual": { state: "saved" },
      }),
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

  it("o motivo do bloqueio é acessível no botão mobile (não no painel) — D16", () => {
    renderTabs({
      variant: "mobile-compact",
      activeTab: "dados",
      states: makeStates({
        posicionamento: { state: "blocked", reason: "needs_legal_acceptance" },
      }),
    });

    const tab = screen.getByRole("tab", { name: /Posicionamento/ });
    expect(tab).toHaveAttribute("aria-disabled", "true");
    expect(tab).toHaveAttribute(
      "title",
      "Esta etapa exige o aceite legal dos Termos de Uso e da Política de Uso Aceitável.",
    );
    // Nenhum painel de bloqueio ativo (o motivo vive no botão — D16)
    expect(screen.queryByText("Etapa bloqueada")).not.toBeInTheDocument();
  });

  it("'Continuar' mobile fica desabilitado com microcopy quando a próxima aba está bloqueada (D16)", () => {
    renderTabs({ variant: "mobile-compact", activeTab: "dados" });

    const continueButton = screen.getByRole("button", {
      name: /Continuar bloqueado/,
    });
    expect(continueButton).toBeDisabled();
    expect(continueButton).toHaveTextContent(
      /Aceite os Termos de Uso e a Política de Uso Aceitável para liberar Perfil/,
    );

    // Clicar no botão desabilitado NÃO navega
    fireEvent.click(continueButton);
    expect(screen.getByRole("tab", { name: /Dados/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("'Continuar' mobile habilita quando a próxima aba está liberada (D16)", () => {
    renderTabs({
      variant: "mobile-compact",
      activeTab: "dados",
      states: makeStates({
        posicionamento: { state: "saved" },
        "direcao-visual": { state: "saved" },
      }),
    });

    const continueButton = screen.getByRole("button", {
      name: "Continuar para Perfil",
    });
    expect(continueButton).toBeEnabled();
    expect(continueButton).toHaveTextContent("Continuar: Perfil");
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
