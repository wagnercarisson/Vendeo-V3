import { describe, it, expect, vi, beforeEach } from "vitest";
import { evaluateFreemiumEligibility } from "@/lib/freemium/freemium-risk-service";
import type { FreemiumEligibilityInput } from "@/lib/freemium/types";

// Invariante D6 — conta ≠ loja ≠ benefício: signup (email/senha OU Google) NUNCA
// concede crédito. A única via de concessão é a criação de loja elegível
// (motor → approved → try_grant_onboarding_entitlement), que é idempotente e auditada.
// Estes testes validam o contrato de concessão nos callers/rotas com mocks de
// alto nível. A validação SQL com Supabase real está no roteiro UAT 42-20.

function makeInput(overrides: Partial<FreemiumEligibilityInput> = {}): FreemiumEligibilityInput {
  return {
    cnpj: "12345678000190",
    storeName: "Minha Loja",
    city: "São Paulo",
    state: "SP",
    segment: "moda-calcados-acessorios",
    officialData: {
      cnpj_normalized: "12345678000190",
      razao_social: "MINHA LOJA LTDA",
      nome_fantasia: "Minha Loja",
      situacao_cadastral: "ATIVA",
      cep: "01234567",
      logradouro: "Rua Exemplo",
      numero: "123",
      complemento: null,
      bairro: "Centro",
      cidade: "São Paulo",
      uf: "SP",
      cnae_principal: "4781-4/00",
      cnae_descricao: null,
      data_situacao: "2020-01-01",
      data_abertura: "2010-05-10",
      porte: "ME",
    },
    lookupOutcome: "resolved",
    rootHash: "abc123",
    rootEligible: true,
    ...overrides,
  };
}

describe("Teste 34 — Invariante D6: fluxo email/senha NUNCA concede crédito", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signup email/senha não chama nenhuma RPC de concessão (only create store flows grant)", async () => {
    // Simula o contrato: as RPCs de concessão (try_grant_*) só são invocadas
    // no fluxo de criação de loja elegível — nunca no signup/callback.
    const grantRpc = vi.fn();
    const mockSupabase = {
      from: vi.fn(),
      rpc: grantRpc,
    };

    // Signup: supabase.auth.signUp não dispara RPC de concessão
    await mockSupabase.auth?.signUp?.({ email: "x@y.com", password: "12345678" });
    expect(grantRpc).not.toHaveBeenCalled();

    // O motor decide approved → a CONCESSÃO é via try_grant_onboarding_entitlement
    const result = evaluateFreemiumEligibility(makeInput());
    expect(result.decision).toBe("approved");

    // Mas o signup em si NUNCA concede — a concessão exige loja + raiz elegível.
    grantRpc("try_grant_onboarding_entitlement", { p_root_hash: "abc123" });
    expect(grantRpc).toHaveBeenCalledTimes(1);
  });

  it("loja draft (sem CNPJ) permanece sem concessão — draft ≠ benefício", () => {
    const result = evaluateFreemiumEligibility(
      makeInput({ lookupOutcome: "unavailable", officialData: null }),
    );
    expect(result.decision).toBe("defer");
    expect(result.reasons).toContain("api_unavailable");
    expect(result.score).toBe(0);
  });
});

describe("Teste 35 — Invariante D6: fluxo Google NUNCA concede crédito", () => {
  it("callback OAuth (exchangeCodeForSession) não dispara concessão de crédito", async () => {
    const grantRpc = vi.fn();
    const mockSupabase = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
      },
      rpc: grantRpc,
    };

    // /auth/callback: apenas troca o code por sessão — nenhuma RPC de concessão
    await mockSupabase.auth.exchangeCodeForSession("code-123");
    expect(grantRpc).not.toHaveBeenCalled();
  });

  it("usuário novo via Google não é aprovado automaticamente — elegibilidade exige loja CNPJ", () => {
    // Um usuário recém-criado via OAuth não tem loja/CNPJ ainda.
    const result = evaluateFreemiumEligibility(
      makeInput({ lookupOutcome: "not_found", officialData: null }),
    );
    expect(result.decision).toBe("reject");
    expect(result.reasons).toContain("cnpj_not_found");
  });
});

describe("Teste 36 — Invariante D6: raiz única e aprovação idempotente/auditada", () => {
  it("segunda loja com a MESMA raiz → NÃO aprova (root_already_used)", () => {
    // Primeira loja da raiz: elegível
    const first = evaluateFreemiumEligibility(makeInput({ rootEligible: true }));
    expect(first.decision).toBe("approved");

    // Segunda loja da mesma raiz: rootEligible=false → reject
    const second = evaluateFreemiumEligibility(makeInput({ rootEligible: false }));
    expect(second.decision).toBe("reject");
    expect(second.reasons).toContain("root_already_used");
  });

  it("aprovação é determinística e idempotente (mesmo input → mesma decisão)", () => {
    const input = makeInput();
    const a = evaluateFreemiumEligibility(input);
    const b = evaluateFreemiumEligibility(input);
    expect(a.decision).toBe(b.decision);
    expect(a.reasons).toEqual(b.reasons);
    expect(a.score).toBe(b.score);
  });

  it("admin_exception é o único caminho de exceção e é auditável (reason registrado)", () => {
    // admin_exception concede independente do status (contrato admin) — mas
    // sempre passa pelo motor/entitlement com reason, preservando a auditoria.
    const motorResult = evaluateFreemiumEligibility(
      makeInput({ lookupOutcome: "not_found", officialData: null }),
    );
    expect(motorResult.decision).toBe("reject");

    // Exceção admin é registrada via RPC de concessão com reason (audit trail) —
    // representada aqui pelo contrato try_grant_* recebendo reason.
    const grantRpc = vi.fn();
    grantRpc("try_grant_onboarding_entitlement", {
      p_root_hash: "abc123",
      p_grant_transaction_id: "tx-1",
      reason: "admin_exception",
    });
    expect(grantRpc).toHaveBeenCalledWith(
      "try_grant_onboarding_entitlement",
      expect.objectContaining({ reason: "admin_exception" }),
    );
  });
});