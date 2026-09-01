// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Flag controlável: default false (comportamento F41 — recuperação sem captcha).
const captchaFlagMock = vi.hoisted(() => ({
  captchaEnabled: false,
}));

// captchaEnabled agora vem da flag operacional (QCW) — serviço mockado.
vi.mock("@/lib/feature-flags/feature-flag-service", () => ({
  isCaptchaEnabled: vi.fn(() => Promise.resolve(captchaFlagMock.captchaEnabled)),
}));

vi.mock("../forgot-password-form", () => ({
  ForgotPasswordForm: ({ captchaEnabled }: { captchaEnabled: boolean }) => (
    <form
      data-testid="forgot-password-form"
      data-captcha-enabled={String(captchaEnabled)}
    />
  ),
}));

import ForgotPasswordPage from "@/app/(auth)/forgot-password/page";

describe("ForgotPasswordPage (prop captchaEnabled)", () => {
  beforeEach(() => {
    captchaFlagMock.captchaEnabled = false;
  });

  afterEach(() => {
    captchaFlagMock.captchaEnabled = false;
  });

  it("captchaEnabled=false: ForgotPasswordForm recebe data-captcha-enabled=false", async () => {
    render(await ForgotPasswordPage());
    expect(screen.getByTestId("forgot-password-form")).toHaveAttribute(
      "data-captcha-enabled",
      "false",
    );
  });

  it("captchaEnabled=true: ForgotPasswordForm recebe data-captcha-enabled=true", async () => {
    captchaFlagMock.captchaEnabled = true;
    render(await ForgotPasswordPage());
    expect(screen.getByTestId("forgot-password-form")).toHaveAttribute(
      "data-captcha-enabled",
      "true",
    );
  });
});