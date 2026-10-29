// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePageUser: vi.fn(),
  getCurrentStore: vi.fn(),
  getAllEntries: vi.fn(),
  hasValidPrivacyAcknowledgement: vi.fn(),
  getCurrentVersion: vi.fn(),
  buildDocumentInfo: vi.fn(),
  getUiRenderContext: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({
  requirePageUser: mocks.requirePageUser,
}));

vi.mock("@/lib/auth/store-ownership", () => ({
  getCurrentStore: mocks.getCurrentStore,
}));

vi.mock("@/lib/changelog/get-changelog", () => ({
  getAllEntries: mocks.getAllEntries,
}));

vi.mock("@/lib/legal/privacy", () => ({
  hasValidPrivacyAcknowledgement: mocks.hasValidPrivacyAcknowledgement,
}));

vi.mock("@/lib/legal/document-versions", () => ({
  getCurrentVersion: mocks.getCurrentVersion,
}));

vi.mock("@/lib/legal/document-content", () => ({
  buildDocumentInfo: mocks.buildDocumentInfo,
}));

vi.mock("@/components/legal/privacy-recovery", () => ({
  PrivacyRecovery: () => null,
}));

vi.mock("@/components/legal/privacy-gate", () => ({
  PrivacyGate: () => null,
}));

vi.mock("@/components/shell/app-shell", () => ({
  AppShell: (props: Record<string, unknown>) => <div {...props} />,
}));

vi.mock("@/lib/i18n/server", () => ({
  getUiRenderContext: mocks.getUiRenderContext,
}));

import AppLayout from "@/app/(app)/layout";
import { es419Messages, ptBRMessages } from "@/lib/i18n";

const PT_PREFERENCE = { uiLocale: "pt-BR", source: "legacy_br", version: 0 };
const ES_PREFERENCE = { uiLocale: "es-419", source: "explicit", version: 2 };

async function getShellProps(): Promise<Record<string, unknown>> {
  const element = await AppLayout({ children: null });
  return element.props as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePageUser.mockResolvedValue({
    userId: "user-1",
    claims: { sub: "user-1" },
  });
  mocks.getCurrentStore.mockResolvedValue(null);
  mocks.getAllEntries.mockResolvedValue([]);
  mocks.hasValidPrivacyAcknowledgement.mockResolvedValue(true);
  mocks.getCurrentVersion.mockResolvedValue(null);
  mocks.buildDocumentInfo.mockReturnValue({});
});

describe("AppLayout i18n payload", () => {
  it("delivers es-419 shell and common catalogs for an es-419 user", async () => {
    mocks.getUiRenderContext.mockResolvedValue({
      ok: true,
      locale: "es-419",
      preference: ES_PREFERENCE,
    });

    const props = await getShellProps();

    expect(props.locale).toBe("es-419");
    expect(props.shellMessagesEs).toBe(es419Messages.shell);
    expect(props.commonMessagesEs).toBe(es419Messages.common);
  });

  it("delivers only pt-BR catalogs for a pt-BR user", async () => {
    mocks.getUiRenderContext.mockResolvedValue({
      ok: true,
      locale: "pt-BR",
      preference: PT_PREFERENCE,
    });

    const props = await getShellProps();

    expect(props.locale).toBe("pt-BR");
    expect(props.shellMessagesEs).toBeUndefined();
    expect(props.commonMessagesEs).toBeUndefined();
  });

  it("falls back to pt-BR without Spanish catalogs when context fails", async () => {
    mocks.getUiRenderContext.mockResolvedValue({
      ok: false,
      locale: "pt-BR",
      errorCode: "preferences_read_timeout",
    });

    const props = await getShellProps();

    expect(props.locale).toBe("pt-BR");
    expect(props.shellMessagesEs).toBeUndefined();
    expect(props.commonMessagesEs).toBeUndefined();
  });

  it("always sends pt-BR catalogs and never the settings namespace", async () => {
    mocks.getUiRenderContext.mockResolvedValue({
      ok: true,
      locale: "es-419",
      preference: ES_PREFERENCE,
    });

    const props = await getShellProps();

    expect(props.shellMessages).toBe(ptBRMessages.shell);
    expect(props.commonMessages).toBe(ptBRMessages.common);
    expect(props).not.toHaveProperty("settings");
    expect(props.shellMessages).not.toHaveProperty("settings");
    expect(props).toHaveProperty("locale");
  });
});
