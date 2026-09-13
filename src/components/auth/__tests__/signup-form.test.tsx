// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSignUp = vi.fn();
const mockReplace = vi.fn();

const captchaMock = vi.hoisted(() => ({
  onVerify: null as null | ((token: string | null) => void),
}));

const privacyModalMock = vi.hoisted(() => ({
  open: false,
  mode: undefined as string | undefined,
  label: undefined as string | undefined,
  hasOnConfirm: false,
}));

vi.mock("@/components/auth/captcha-field", () => ({
  CaptchaField: ({
    onVerify,
  }: {
    onVerify: (token: string | null) => void;
  }) => {
    captchaMock.onVerify = onVerify;
    return null;
  },
  CAPTCHA_HINT_TEXT: "Aguarde validação Cloudflare.",
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: vi.fn(() => ({
    auth: {
      signUp: mockSignUp,
    },
  })),
}));

vi.mock("@/lib/supabase/site-url", () => ({
  getSiteUrl: () => "https://vendeo.test",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

// Modal informativo mockado: captura props para observarmos a abertura.
vi.mock("@/components/legal/privacy-acknowledge-modal", () => ({
  PrivacyAcknowledgeModal: (props: {
    open: boolean;
    mode?: string;
    policyDocument?: { label?: string };
    onConfirm?: () => Promise<boolean>;
  }) => {
    privacyModalMock.open = props.open;
    privacyModalMock.mode = props.mode;
    privacyModalMock.label = props.policyDocument?.label;
    privacyModalMock.hasOnConfirm = props.onConfirm !== undefined;
    return null;
  },
}));
vi.mock("@/components/legal/communications-consent-modal", () => ({
  CommunicationsConsentModal: () => null,
}));

import { SignupForm } from "../signup-form";

function setCaptchaToken(token: string | null = "captcha-token") {
  act(() => {
    captchaMock.onVerify?.(token);
  });
}

function fillAndSubmit(
  email = "test@test.com",
  password = "password123",
  confirm = password,
) {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("Senha"), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText("Confirmar senha"), {
    target: { value: confirm },
  });
  fireEvent.click(screen.getByRole("button", { name: /Criar conta/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  captchaMock.onVerify = null;
  window.sessionStorage.clear();
  window.localStorage.clear();
  privacyModalMock.open = false;
  privacyModalMock.mode = undefined;
  privacyModalMock.label = undefined;
  privacyModalMock.hasOnConfirm = false;
});

describe("SignupForm (Testes 2-8, tasks.md §13)", () => {
  it("Teste 2a: valida senha < 8 caracteres — mensagem PT-BR", async () => {
    render(<SignupForm captchaEnabled={true} />);
    setCaptchaToken();
    fillAndSubmit("test@test.com", "1234567");

    await waitFor(() => {
      expect(
        screen.getByText("A senha deve ter pelo menos 8 caracteres."),
      ).toBeInTheDocument();
    });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("Teste 2b: valida senha !== confirmar senha — mensagem PT-BR", async () => {
    render(<SignupForm captchaEnabled={true} />);
    setCaptchaToken();
    fillAndSubmit("test@test.com", "password123", "password456");

    await waitFor(() => {
      expect(screen.getByText("As senhas não coincidem.")).toBeInTheDocument();
    });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("Teste 3a: cria conta sem tocar em nenhum checkbox de privacidade", async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    render(<SignupForm captchaEnabled={true} />);
    setCaptchaToken();
    fillAndSubmit();

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalled();
    });
    expect(mockReplace).toHaveBeenCalledWith("/check-email?type=signup");
  });

  it("Teste 3b: consentimento de comunicações é opcional (submete sem ele)", async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    render(<SignupForm captchaEnabled={true} />);
    setCaptchaToken();
    fillAndSubmit();

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalled();
    });
  });

  it("Teste 4: chama signUp com emailRedirectTo /auth/confirm + captchaToken", async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    render(<SignupForm captchaEnabled={true} />);
    setCaptchaToken();
    fillAndSubmit();

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "test@test.com",
        password: "password123",
        options: {
          emailRedirectTo: "https://vendeo.test/auth/confirm",
          captchaToken: "captcha-token",
        },
      });
    });
    expect(mockReplace).toHaveBeenCalledWith("/check-email?type=signup");
  });

  it("Teste 5: anti-enumeração — email já registrado → mesma resposta /check-email", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null },
      error: new Error("User already registered"),
    });

    render(<SignupForm captchaEnabled={true} />);
    setCaptchaToken();
    fillAndSubmit();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/check-email?type=signup");
    });
    expect(
      screen.queryByText("Email já cadastrado"),
    ).not.toBeInTheDocument();
  });

  it("Teste 6: erro operacional/captcha → mensagem genérica (não revela conta)", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null },
      error: new Error("captcha verification failed"),
    });

    render(<SignupForm captchaEnabled={true} />);
    setCaptchaToken();
    fillAndSubmit();

    await waitFor(() => {
      expect(
        screen.getByText("Não foi possível concluir. Tente novamente."),
      ).toBeInTheDocument();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("Teste 6b: signup_disabled (kill switch D13) → mensagem genérica, não redireciona", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null },
      error: new Error("Signups not allowed for this instance"),
    });

    render(<SignupForm captchaEnabled={true} />);
    setCaptchaToken();
    fillAndSubmit();

    await waitFor(() => {
      expect(
        screen.getByText("Não foi possível concluir. Tente novamente."),
      ).toBeInTheDocument();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("Teste 7: captcha token ausente → bloqueio de cadastro (signUp não chamado)", async () => {
    render(<SignupForm captchaEnabled={true} />);
    fillAndSubmit();

    await new Promise((r) => setTimeout(r, 50));
    expect(mockSignUp).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("Teste 8: token inválido/expirado (erro Supabase) → mensagem genérica", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null },
      error: new Error("token expired"),
    });

    render(<SignupForm captchaEnabled={true} />);
    setCaptchaToken();
    fillAndSubmit();

    await waitFor(() => {
      expect(
        screen.getByText("Não foi possível concluir. Tente novamente."),
      ).toBeInTheDocument();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("inclui links legais de Privacidade e Termos", () => {
    render(<SignupForm captchaEnabled={true} />);
    const privacyLinks = screen.getAllByRole("link", { name: /Política de Privacidade/i });
    for (const link of privacyLinks) {
      expect(link).toHaveAttribute("href", "/privacidade");
    }
    expect(screen.getByRole("link", { name: /Termos de Uso/i })).toHaveAttribute(
      "href",
      "/termos",
    );
  });

  it("captchaEnabled=false: submit sem token chama signUp com emailRedirectTo SEM captchaToken", async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    render(<SignupForm captchaEnabled={false} />);
    fillAndSubmit();

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "test@test.com",
        password: "password123",
        options: {
          emailRedirectTo: "https://vendeo.test/auth/confirm",
        },
      });
    });
    expect(mockReplace).toHaveBeenCalledWith("/check-email?type=signup");
  });

  it("captchaEnabled=false: CaptchaField NÃO é montado (onVerify permanece null)", () => {
    render(<SignupForm captchaEnabled={false} />);

    expect(captchaMock.onVerify).toBeNull();
  });
});

describe("SignupForm — privacidade declarada no clique (QQ6)", () => {
  it("Teste a: submit sem tocar em checkbox de privacidade chama signUp e redireciona", async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    render(<SignupForm captchaEnabled={false} />);
    fillAndSubmit();

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "test@test.com",
        password: "password123",
        options: {
          emailRedirectTo: "https://vendeo.test/auth/confirm",
        },
      });
    });
    expect(mockReplace).toHaveBeenCalledWith("/check-email?type=signup");
  });

  it("Teste b: grava privacyPending com privacyAcknowledged true e opt-in false", async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    render(<SignupForm captchaEnabled={false} />);
    fillAndSubmit();

    await waitFor(() => expect(mockSignUp).toHaveBeenCalled());
    expect(
      JSON.parse(window.localStorage.getItem("privacyPending")!),
    ).toEqual({
      privacyAcknowledged: true,
      communicationsOptIn: false,
    });
  });

  it("Teste c: opt-in marcado antes do submit é refletido em privacyPending", async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    render(<SignupForm captchaEnabled={false} />);
    fireEvent.click(
      screen.getByLabelText(/Quero receber comunicações comerciais \(opcional\)/),
    );
    fillAndSubmit();

    await waitFor(() => expect(mockSignUp).toHaveBeenCalled());
    expect(
      JSON.parse(window.localStorage.getItem("privacyPending")!),
    ).toEqual({
      privacyAcknowledged: true,
      communicationsOptIn: true,
    });
  });

  it("Teste d: checkbox de comunicações inicia desmarcado", () => {
    render(<SignupForm captchaEnabled={false} />);

    expect(
      screen.getByLabelText(/Quero receber comunicações comerciais \(opcional\)/),
    ).toHaveProperty("checked", false);
  });

  it("Teste e: clique em Termos de Uso abre o modal informativo do documento", () => {
    render(<SignupForm captchaEnabled={false} />);

    const link = screen.getByRole("link", { name: /Termos de Uso/i });
    expect(link).toHaveAttribute("href", "/termos");

    fireEvent.click(link);

    expect(privacyModalMock.open).toBe(true);
    expect(privacyModalMock.mode).toBe("informative");
    expect(privacyModalMock.label).toBe("Termos de Uso");
    expect(privacyModalMock.hasOnConfirm).toBe(false);
  });

  it("Teste f: clique em Política de Privacidade abre o modal informativo do documento", () => {
    render(<SignupForm captchaEnabled={false} />);

    const link = screen.getByRole("link", { name: /Política de Privacidade/i });
    expect(link).toHaveAttribute("href", "/privacidade");

    fireEvent.click(link);

    expect(privacyModalMock.open).toBe(true);
    expect(privacyModalMock.mode).toBe("informative");
    expect(privacyModalMock.label).toBe("Política de Privacidade");
    expect(privacyModalMock.hasOnConfirm).toBe(false);
  });

  it("Teste g: não existe botão separado de leitura nem checkbox de ciência", () => {
    render(<SignupForm captchaEnabled={false} />);

    expect(
      screen.queryByRole("button", { name: /Ler Política de Privacidade/i }),
    ).toBeNull();
    expect(screen.queryByLabelText(/Li e declaro ciência/i)).toBeNull();
  });
});
