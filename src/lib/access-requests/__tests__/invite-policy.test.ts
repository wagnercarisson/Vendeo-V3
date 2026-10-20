import { describe, it, expect } from "vitest";
import {
  classifyInviteUser,
  isAlreadyRegisteredError,
  isPendingInvite,
} from "../invite-policy";

describe("invite-policy — convite pendente × conta ativa", () => {
  it("usuário criado por convite, sem confirmação e sem login → pending", () => {
    const user = {
      id: "u1",
      email: "loja@example.com",
      invited_at: "2026-10-20T12:00:00Z",
      email_confirmed_at: null,
      confirmed_at: null,
      last_sign_in_at: null,
    };

    expect(isPendingInvite(user)).toBe(true);
    expect(classifyInviteUser(user)).toBe("pending");
  });

  it("conta confirmada → active (não forçar troca de senha)", () => {
    const user = {
      id: "u2",
      email: "loja@example.com",
      invited_at: "2026-10-20T12:00:00Z",
      email_confirmed_at: "2026-10-20T12:05:00Z",
      last_sign_in_at: null,
    };

    expect(isPendingInvite(user)).toBe(false);
    expect(classifyInviteUser(user)).toBe("active");
  });

  it("conta que já fez login → active", () => {
    const user = {
      id: "u3",
      email: "loja@example.com",
      invited_at: "2026-10-20T12:00:00Z",
      email_confirmed_at: null,
      last_sign_in_at: "2026-10-20T12:10:00Z",
    };

    expect(classifyInviteUser(user)).toBe("active");
  });

  it("usuário criado por signup comum (sem invited_at) → active", () => {
    const user = {
      id: "u4",
      email: "loja@example.com",
      invited_at: null,
      email_confirmed_at: null,
      last_sign_in_at: null,
    };

    expect(classifyInviteUser(user)).toBe("active");
  });

  it("só trata 'already registered' como usuário existente", () => {
    expect(isAlreadyRegisteredError({ message: "User already registered" })).toBe(true);
    expect(isAlreadyRegisteredError({ code: "email_exists" })).toBe(true);
    expect(isAlreadyRegisteredError({ message: "A user with this email address has already been registered" })).toBe(true);
  });

  it("outros erros do Supabase NÃO são classificados como usuário existente", () => {
    expect(isAlreadyRegisteredError({ message: "Database error saving new user" })).toBe(false);
    expect(isAlreadyRegisteredError({ message: "invalid JWT" })).toBe(false);
    expect(isAlreadyRegisteredError({ message: "rate limit exceeded" })).toBe(false);
    expect(isAlreadyRegisteredError(null)).toBe(false);
  });
});
