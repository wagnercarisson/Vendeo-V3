// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { CaptchaField } from "../captcha-field";

const ORIGINAL_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

let turnstileMock: {
  render: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
};

function mockTurnstile() {
  turnstileMock = {
    render: vi.fn(() => "widget-1"),
    remove: vi.fn(),
    reset: vi.fn(),
  };
  window.turnstile = turnstileMock;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-site-key";
  mockTurnstile();
});

afterEach(() => {
  cleanup();
  if (ORIGINAL_SITE_KEY === undefined) {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  } else {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = ORIGINAL_SITE_KEY;
  }
  delete window.turnstile;
});

describe("CaptchaField — widget Turnstile reutilizável (D3)", () => {
  it("renderiza o container .cf-turnstile com data attributes quando site key presente", () => {
    render(<CaptchaField onVerify={vi.fn()} />);

    const widget = document.querySelector(".cf-turnstile");
    expect(widget).toBeInTheDocument();
    expect(widget).toHaveAttribute("data-sitekey", "test-site-key");
    expect(widget).toHaveAttribute("data-theme", "dark");
    expect(widget).toHaveAttribute("data-size", "flexible");
    expect(widget).toHaveAttribute(
      "aria-label",
      "Verificação de segurança (não é robô)",
    );
    expect(widget!.id).toMatch(/^captcha-/);
  });

  it("chama window.turnstile.render com sitekey, theme dark, size flexible e callbacks", () => {
    render(<CaptchaField onVerify={vi.fn()} />);

    expect(turnstileMock.render).toHaveBeenCalledTimes(1);
    const [container, options] = turnstileMock.render.mock.calls[0];
    expect(container).toBe(document.querySelector(".cf-turnstile"));
    expect(options).toMatchObject({
      sitekey: "test-site-key",
      theme: "dark",
      size: "flexible",
    });
    expect(typeof options.callback).toBe("function");
    expect(typeof options["expired-callback"]).toBe("function");
    expect(typeof options["error-callback"]).toBe("function");
  });

  it("não renderiza nada quando NEXT_PUBLIC_TURNSTILE_SITE_KEY está ausente", () => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    const { container } = render(<CaptchaField onVerify={vi.fn()} />);

    expect(container.innerHTML).toBe("");
    expect(document.querySelector(".cf-turnstile")).not.toBeInTheDocument();
    expect(turnstileMock.render).not.toHaveBeenCalled();
    expect(
      document.querySelector("script[data-vendeo-turnstile]"),
    ).not.toBeInTheDocument();
  });

  it("invoca onVerify com o token no callback do turnstile", () => {
    const onVerify = vi.fn();
    render(<CaptchaField onVerify={onVerify} />);

    const options = turnstileMock.render.mock.calls[0][1];
    act(() => options.callback("tok_123"));

    expect(onVerify).toHaveBeenCalledWith("tok_123");
  });

  it("invoca onVerify(null) nos callbacks expired e error", () => {
    const onVerify = vi.fn();
    render(<CaptchaField onVerify={onVerify} />);

    const options = turnstileMock.render.mock.calls[0][1];
    act(() => options["expired-callback"]());
    act(() => options["error-callback"]());

    // 1 chamada do mount (token vazio) + 2 dos callbacks
    expect(onVerify).toHaveBeenCalledTimes(3);
    expect(onVerify.mock.calls.every(([arg]) => arg === null)).toBe(true);
  });

  it("chama onVerify(null) no mount (token vazio até resolução)", () => {
    const onVerify = vi.fn();
    render(<CaptchaField onVerify={onVerify} />);

    expect(onVerify).toHaveBeenCalledWith(null);
  });

  it("injeta o script do turnstile uma única vez (dedupe por data-attribute)", () => {
    render(<CaptchaField onVerify={vi.fn()} />);
    render(<CaptchaField onVerify={vi.fn()} />);

    const scripts = document.querySelectorAll("script[data-vendeo-turnstile]");
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toHaveAttribute(
      "src",
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    );
  });

  it("chama turnstile.remove no cleanup e remove o script na última instância", () => {
    const { unmount } = render(<CaptchaField onVerify={vi.fn()} />);
    expect(turnstileMock.render).toHaveBeenCalledTimes(1);

    unmount();

    expect(turnstileMock.remove).toHaveBeenCalledWith("widget-1");
    expect(
      document.querySelector("script[data-vendeo-turnstile]"),
    ).not.toBeInTheDocument();
  });

  it("renderiza label sr-only e hint opcional", () => {
    render(
      <CaptchaField
        onVerify={vi.fn()}
        label="Verificação de segurança"
        hint="Proteja sua conta contra robôs."
      />,
    );

    const label = screen.getByText("Verificação de segurança");
    expect(label).toHaveClass("sr-only");
    expect(
      screen.getByText("Proteja sua conta contra robôs."),
    ).toBeInTheDocument();
  });

  it("re-renderiza o widget quando resetKey muda (T-42-08b — token single-use)", () => {
    const { rerender } = render(<CaptchaField onVerify={vi.fn()} resetKey={0} />);
    expect(turnstileMock.render).toHaveBeenCalledTimes(1);

    act(() => {
      rerender(<CaptchaField onVerify={vi.fn()} resetKey={1} />);
    });

    expect(turnstileMock.render).toHaveBeenCalledTimes(2);
    expect(turnstileMock.remove).toHaveBeenCalledWith("widget-1");
  });
});