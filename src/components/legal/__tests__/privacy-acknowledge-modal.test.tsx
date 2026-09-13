// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const viewerMock = vi.hoisted(() => ({ loaded: true }));

vi.mock("../legal-document-viewer", () => ({
  LegalDocumentViewer: ({
    onLoad,
  }: {
    onLoad?: (success: boolean) => void;
  }) => {
    useEffect(() => {
      onLoad?.(viewerMock.loaded);
    }, [onLoad]);
    return <div data-testid="viewer" />;
  },
}));

import { PrivacyAcknowledgeModal } from "../privacy-acknowledge-modal";

const privacyDoc = {
  label: "Política de Privacidade",
  version: "v1.3",
  url: "/docs/legal/privacy-policy-v1-3.md",
};

const termsDoc = {
  label: "Termos de Uso",
  version: "v1.4",
  url: "/docs/legal/terms-of-service-v1-4.md",
};

beforeEach(() => {
  viewerMock.loaded = true;
});

describe("PrivacyAcknowledgeModal — modo acknowledge (default preservado)", () => {
  it("exige checkbox + Confirmar ciência gated pelo documento carregado", async () => {
    const onConfirm = vi.fn().mockResolvedValue(true);
    const onOpenChange = vi.fn();

    render(
      <PrivacyAcknowledgeModal
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        policyDocument={privacyDoc}
      />,
    );

    const checkbox = screen.getByLabelText(
      /Li e declaro ciência integral da Política de Privacidade v1.3/,
    );
    const confirm = screen.getByRole("button", { name: /Confirmar ciência/i });

    expect(checkbox).toBeInTheDocument();
    expect(confirm).toBeDisabled();

    fireEvent.click(checkbox);
    await waitFor(() => expect(confirm).toBeEnabled());

    fireEvent.click(confirm);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));

    // Após sucesso, o checkbox volta a desmarcar.
    expect(checkbox).not.toBeChecked();
  });

  it("onConfirm resolvendo false mantém aberto e exibe erro", async () => {
    const onConfirm = vi.fn().mockResolvedValue(false);
    const onOpenChange = vi.fn();

    render(
      <PrivacyAcknowledgeModal
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        policyDocument={privacyDoc}
      />,
    );

    fireEvent.click(screen.getByLabelText(/Li e declaro ciência integral/));
    const confirm = screen.getByRole("button", { name: /Confirmar ciência/i });
    await waitFor(() => expect(confirm).toBeEnabled());

    fireEvent.click(confirm);
    await waitFor(() =>
      expect(
        screen.getByText(
          "Não foi possível registrar sua ciência. Tente novamente.",
        ),
      ).toBeInTheDocument(),
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe("PrivacyAcknowledgeModal — modo informativo (read-only)", () => {
  it("não tem checkbox nem Confirmar; tem viewer, link nova aba e Fechar", () => {
    const onOpenChange = vi.fn();

    render(
      <PrivacyAcknowledgeModal
        mode="informative"
        open={true}
        onOpenChange={onOpenChange}
        policyDocument={privacyDoc}
      />,
    );

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Confirmar ciência/i }),
    ).toBeNull();
    expect(screen.getByTestId("viewer")).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /Abrir Política de Privacidade em nova aba/i,
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Fechar$/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Fechar funciona mesmo com o viewer reportando falha", () => {
    viewerMock.loaded = false;
    const onOpenChange = vi.fn();

    render(
      <PrivacyAcknowledgeModal
        mode="informative"
        open={true}
        onOpenChange={onOpenChange}
        policyDocument={privacyDoc}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Fechar$/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("é agnóstico de documento — header mostra Termos de Uso", () => {
    render(
      <PrivacyAcknowledgeModal
        mode="informative"
        open={true}
        onOpenChange={() => {}}
        policyDocument={termsDoc}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Termos de Uso" }),
    ).toBeInTheDocument();
  });
});

describe("PrivacyAcknowledgeModal — open=false", () => {
  it("retorna null em ambos os modos", () => {
    const { container: ack } = render(
      <PrivacyAcknowledgeModal
        open={false}
        onOpenChange={() => {}}
        onConfirm={async () => true}
        policyDocument={privacyDoc}
      />,
    );
    expect(ack).toBeEmptyDOMElement();

    const { container: info } = render(
      <PrivacyAcknowledgeModal
        mode="informative"
        open={false}
        onOpenChange={() => {}}
        policyDocument={privacyDoc}
      />,
    );
    expect(info).toBeEmptyDOMElement();
  });
});
