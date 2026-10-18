// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PendingOperationsList,
  PendingReadOnlyNotice,
  PendingResolutionPanel,
  ResolutionForm,
  type PendingOperationItem,
} from "../resolution-form";

// ---------------------------------------------------------------------------
// F56.2b1b — Plano 07, Superfície 4: lista/resolução administrativa (UI-SPEC).
// Gate de evidência fail-closed no cliente; o servidor é a autoridade (F5).
// ---------------------------------------------------------------------------

const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";

function item(overrides: Partial<PendingOperationItem> = {}): PendingOperationItem {
  return {
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    storeId: "11111111-1111-4111-8111-111111111111",
    status: "reserved",
    amount: 1,
    artifactKind: "integral",
    processing: false,
    unknown: false,
    terminal: false,
    supportReference: null,
    createdAt: "2026-10-12T00:00:00.000Z",
    latestAttemptAt: null,
    ...overrides,
  };
}

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
  vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValue("ui-resolution-id") });
});

afterEach(() => vi.unstubAllGlobals());

describe("ProductOneToOne pending — Superfície 4 (lista/resolução)", () => {
  it("exibe o aviso de somente-leitura SEMPRE visível", () => {
    render(
      <>
        <PendingReadOnlyNotice />
        <ResolutionForm item={item()} />
      </>,
    );
    expect(
      screen.getByText(/somente para consulta e resolução por evidência/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Nenhuma geração é reiniciada, reenfileirada ou enviada automaticamente/i),
    ).toBeInTheDocument();
  });

  it("lista as pendências com estado, crédito e referência de suporte", () => {
    render(
      <PendingOperationsList
        operations={[item({ supportReference: "IMG-001-abc", unknown: true, status: "reserved" })]}
      />,
    );
    expect(screen.getByText(CAMPAIGN_ID)).toBeInTheDocument();
    expect(screen.getByText(/IMG-001-abc/)).toBeInTheDocument();
  });

  it("estado vazio quando não há pendências", () => {
    render(<PendingOperationsList operations={[]} />);
    expect(screen.getByText(/Nenhuma pendência de geração/i)).toBeInTheDocument();
  });

  it("F5: evidência INDETERMINADA bloqueia a ação sem feedback enganoso", () => {
    render(<ResolutionForm item={item({ artifactKind: "indeterminate" })} />);
    expect(screen.getByRole("button", { name: "Resolver pendência" })).toBeDisabled();
    expect(screen.getByText(/Não foi possível confirmar o estado/i)).toBeInTheDocument();
  });

  it("F5: sem arte íntegra o `Entregar arte existente` fica desabilitado; sem `absent` o estorno não habilita", () => {
    render(<ResolutionForm item={item({ artifactKind: "integral" })} />);
    const deliver = screen.getByRole("option", { name: "Entregar arte existente" });
    expect(deliver).not.toBeDisabled();
    const refund = screen.getByRole("option", { name: "Estornar uma vez" });
    expect(refund).toBeDisabled();
  });

  it("E1/D13: claim `in_progress` residual (Processando) BLOQUEIA e não promete continuidade/retomada", () => {
    render(
      <PendingOperationsList operations={[item({ processing: true, status: "reserved" })]} />,
    );
    expect(screen.getByText(/Processando/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/continuaremos|retomaremos|Gerar novamente|pode fechar a página/i),
    ).not.toBeInTheDocument();
  });

  it("C1-iii/D4: `processing` COM ausência confirmada ⇒ a ação EXISTENTE (estornar) é habilitada COM CONFIRMAÇÃO", () => {
    render(
      <ResolutionForm
        item={item({ processing: true, status: "reserved", artifactKind: "absent" })}
      />,
    );
    expect(
      screen.getByText(/Processando — resolução autorizada disponível/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Estornar uma vez" })).not.toBeDisabled();
  });

  it("C1-iii: `processing` SEM ausência confirmada permanece BLOQUEADO (nenhuma ação habilitada)", () => {
    render(<ResolutionForm item={item({ processing: true, artifactKind: "integral" })} />);
    expect(screen.getByText("Processando")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Estornar uma vez" })).toBeDisabled();
    expect(screen.getByRole("option", { name: "Entregar arte existente" })).toBeDisabled();
  });

  it("envio somente com `motivo`: sem motivo exibe `Motivo obrigatório` e NÃO chama a API", () => {
    render(<ResolutionForm item={item({ artifactKind: "integral" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Resolver pendência" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Motivo obrigatório");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("deliver: envia POST com operationId estável e exibe sucesso auditado", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ resolution: { status: "delivered" } }),
    });
    render(<ResolutionForm item={item({ artifactKind: "integral" })} />);
    fireEvent.change(screen.getByLabelText("Motivo da resolução"), {
      target: { value: "entregar arte existente" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Resolver pendência" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/product-1-1-pending");
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body));
    expect(body.action).toBe("deliver_existing_art");
    expect(body.resolutionOperationId).toBe("ui-resolution-id");
    expect(body.reason).toBe("entregar arte existente");

    expect(await screen.findByText("Resolução registrada com auditoria.")).toBeInTheDocument();
  });

  it("estorno exige confirmação destrutiva (Estornar esta operação?)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ resolution: { status: "refunded" } }),
    });
    render(<ResolutionForm item={item({ artifactKind: "absent" })} />);
    fireEvent.change(screen.getByLabelText("Motivo da resolução"), {
      target: { value: "ausência confirmada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Resolver pendência" }));

    expect(screen.getByText("Estornar esta operação?")).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Estornar" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(mockFetch.mock.calls[0][1].body)).action).toBe("refund_once");
  });

  it("a página/formulário NÃO renderiza nenhum controle de re-queue/reset", () => {
    render(<ResolutionForm item={item({ artifactKind: "integral" })} />);
    expect(
      screen.queryByRole("button", { name: /re-?queue|reprocessar|reset|excluir|apagar/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Gerar novamente/i)).not.toBeInTheDocument();
  });

  // ── WR-01 — qualquer pendência deve ser resolvível (não só a primeira) ─────

  it("WR-01: o painel permite SELECIONAR e resolver a SEGUNDA pendência", async () => {
    const first = item({
      campaignId: "22222222-2222-4222-8222-222222222222",
      operationId: "33333333-3333-4333-8333-333333333333",
      artifactKind: "integral",
    });
    const second = item({
      campaignId: "99999999-9999-4999-8999-999999999999",
      operationId: "88888888-8888-4888-8888-888888888888",
      artifactKind: "integral",
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ resolution: { status: "delivered" } }),
    });

    render(<PendingResolutionPanel operations={[first, second]} />);

    // AMBAS as pendências são visíveis (antes só a primeira era acionável).
    expect(screen.getByText(first.campaignId)).toBeInTheDocument();
    expect(screen.getByText(second.campaignId)).toBeInTheDocument();

    // Seleciona a SEGUNDA pendência.
    const selectButtons = screen.getAllByRole("button", { name: /Selecionar para resolver/ });
    expect(selectButtons).toHaveLength(1);
    fireEvent.click(selectButtons[0]);

    fireEvent.change(screen.getByLabelText("Motivo da resolução"), {
      target: { value: "resolver a segunda" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Resolver pendência" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const body = JSON.parse(String(mockFetch.mock.calls[0][1].body));
    // A resolução é da SEGUNDA pendência (identidade correta).
    expect(body.campaignId).toBe(second.campaignId);
    expect(body.operationId).toBe(second.operationId);
  });

  // ── IN-08 — o rótulo do crédito deriva do estado (não é sempre "reserva") ──

  it("IN-08: linha NÃO-terminal ⇒ 'Reserva temporária'", () => {
    render(
      <PendingOperationsList operations={[item({ status: "reserved", terminal: false })]} />,
    );
    expect(screen.getByText(/Reserva temporária · 1/)).toBeInTheDocument();
  });

  it("IN-08: linha terminal 'delivered' NÃO é rotulada como reserva temporária", () => {
    render(
      <PendingOperationsList operations={[item({ status: "delivered", terminal: true })]} />,
    );
    expect(screen.getByText(/Crédito consumido · 1/)).toBeInTheDocument();
    expect(screen.queryByText(/Reserva temporária/)).not.toBeInTheDocument();
  });

  it("IN-08: linha terminal 'refunded' ⇒ 'Crédito estornado'", () => {
    render(
      <PendingOperationsList operations={[item({ status: "refunded", terminal: true })]} />,
    );
    expect(screen.getByText(/Crédito estornado · 1/)).toBeInTheDocument();
    expect(screen.queryByText(/Reserva temporária/)).not.toBeInTheDocument();
  });
});

describe("ProductOneToOne pending — navegação aditiva (layout)", () => {
  it("adiciona UM link `Pendências Produto 1:1` sem reordenar os existentes", () => {
    const layoutSource = readFileSync(
      path.resolve(process.cwd(), "src/app/(app)/admin/layout.tsx"),
      "utf8",
    );
    expect(layoutSource).toMatch(/href="\/admin\/product-1-1-pending"/);
    expect(layoutSource).toMatch(/Pendências Produto 1:1/);
    // Links existentes preservados; a entrada única de modelos aponta para a página unificada
    // (a rota legada /admin/image-model-pair permanece como redirecionamento).
    expect(layoutSource).toMatch(/href="\/admin\/ai-model-selection"/);
    expect(layoutSource).not.toMatch(/href="\/admin\/image-model-pair"/);
    expect(layoutSource).toMatch(/href="\/admin\/laboratorio"/);
  });
});
