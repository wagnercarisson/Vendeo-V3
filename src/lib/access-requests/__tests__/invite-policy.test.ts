import { describe, it, expect } from "vitest";
import {
  classifyInviteUser,
  isAlreadyRegisteredError,
  isPendingInvite,
} from "../invite-policy";

describe("invite-policy — cadastro incompleto × conta ativa", () => {
  const invitedUser = {
    id: "u1",
    email: "loja@example.com",
    invited_at: "2026-10-20T12:00:00Z",
    email_confirmed_at: null,
    confirmed_at: null,
    last_sign_in_at: null,
  };

  it("convite não aberto → pending", () => {
    expect(isPendingInvite(invitedUser, null)).toBe(true);
    expect(classifyInviteUser(invitedUser, null)).toBe("pending");
  });

  it("convite ACEITO mas senha não definida → pending (retomável)", () => {
    const accepted = {
      ...invitedUser,
      email_confirmed_at: "2026-10-20T12:05:00Z",
      confirmed_at: "2026-10-20T12:05:00Z",
      last_sign_in_at: "2026-10-20T12:05:00Z",
    };

    expect(isPendingInvite(accepted, null)).toBe(true);
    expect(classifyInviteUser(accepted, null)).toBe("pending");
  });

  it("senha definida e registrada → active (não forçar troca)", () => {
    const accepted = {
      ...invitedUser,
      email_confirmed_at: "2026-10-20T12:05:00Z",
      last_sign_in_at: "2026-10-20T12:05:00Z",
    };

    expect(isPendingInvite(accepted, "2026-10-20T12:06:00Z")).toBe(false);
    expect(classifyInviteUser(accepted, "2026-10-20T12:06:00Z")).toBe("active");
  });

  it("conta não criada por convite (sem invited_at) → active", () => {
    const user = {
      id: "u4",
      email: "loja@example.com",
      invited_at: null,
      email_confirmed_at: null,
      last_sign_in_at: null,
    };

    expect(classifyInviteUser(user, null)).toBe("active");
  });

  it("só trata 'already registered' como usuário existente", () => {
    expect(isAlreadyRegisteredError({ message: "User already registered" })).toBe(true);
    expect(isAlreadyRegisteredError({ code: "email_exists" })).toBe(true);
    expect(
      isAlreadyRegisteredError({
        message: "A user with this email address has already been registered",
      }),
    ).toBe(true);
  });

  it("outros erros do Supabase NÃO são classificados como usuário existente", () => {
    expect(isAlreadyRegisteredError({ message: "Database error saving new user" })).toBe(false);
    expect(isAlreadyRegisteredError({ message: "invalid JWT" })).toBe(false);
    expect(isAlreadyRegisteredError({ message: "rate limit exceeded" })).toBe(false);
    expect(isAlreadyRegisteredError(null)).toBe(false);
  });
});
