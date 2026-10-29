import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/require-user", () => ({
  requireApiUser: vi.fn(),
}));
vi.mock("@/lib/market-preferences/user-preferences-service", () => ({
  getUserLocalePreference: vi.fn(),
  updateUserLocalePreference: vi.fn(),
}));

import { UnauthorizedError } from "@/lib/auth/errors";
import { requireApiUser } from "@/lib/auth/require-user";
import {
  PreferencesUnavailableError,
  PreferencesVersionConflictError,
  StoredPreferencesInvalidError,
} from "@/lib/market-preferences/errors";
import {
  getUserLocalePreference,
  updateUserLocalePreference,
} from "@/lib/market-preferences/user-preferences-service";

const requireApiUserMock = vi.mocked(requireApiUser);
const getMock = vi.mocked(getUserLocalePreference);
const updateMock = vi.mocked(updateUserLocalePreference);

async function handlers() {
  return import("../route");
}

function patchRequest(body: unknown, origin: string | null = "http://localhost:3000") {
  const headers = new Headers({ host: "localhost:3000", "content-type": "application/json" });
  if (origin) headers.set("origin", origin);
  return new NextRequest("http://localhost:3000/api/preferences", {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireApiUserMock.mockResolvedValue({ userId: "user-1", claims: {} as never });
});

describe("GET /api/preferences", () => {
  it("200 com DTO allowlisted", async () => {
    getMock.mockResolvedValue({ uiLocale: "es-419", source: "explicit", version: 2 });
    const { GET } = await handlers();
    const response = await GET();
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ uiLocale: "es-419", source: "explicit", version: 2 });
    expect(Object.keys(json)).toEqual(["uiLocale", "source", "version"]);
    expect(getMock).toHaveBeenCalledWith("user-1");
  });

  it("401 sem sessão", async () => {
    requireApiUserMock.mockRejectedValueOnce(new UnauthorizedError());
    const { GET } = await handlers();
    const response = await GET();
    expect(response.status).toBe(401);
  });
});

describe("PATCH /api/preferences", () => {
  it("200 com atualização", async () => {
    updateMock.mockResolvedValue({ uiLocale: "es-419", source: "explicit", version: 1 });
    const { PATCH } = await handlers();
    const response = await PATCH(patchRequest({ uiLocale: "es-419", expectedVersion: 0 }));
    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith("user-1", {
      uiLocale: "es-419",
      expectedVersion: 0,
    });
  });

  it("200 com null (limpeza)", async () => {
    updateMock.mockResolvedValue({ uiLocale: "pt-BR", source: "legacy_br", version: 2 });
    const { PATCH } = await handlers();
    const response = await PATCH(patchRequest({ uiLocale: null, expectedVersion: 1 }));
    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith("user-1", {
      uiLocale: null,
      expectedVersion: 1,
    });
  });

  it("403 sem Origin", async () => {
    const { PATCH } = await handlers();
    const response = await PATCH(patchRequest({ expectedVersion: 0 }, null));
    expect(response.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("400 para locale inválido", async () => {
    const { PATCH } = await handlers();
    const response = await PATCH(
      patchRequest({ uiLocale: "es-AR", expectedVersion: 0 }),
    );
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.fieldErrors.uiLocale).toBeDefined();
  });

  it("400 para es-PY na interface", async () => {
    const { PATCH } = await handlers();
    const response = await PATCH(
      patchRequest({ uiLocale: "es-PY", expectedVersion: 0 }),
    );
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.fieldErrors.uiLocale).toBeDefined();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("400 sem expectedVersion", async () => {
    const { PATCH } = await handlers();
    const response = await PATCH(patchRequest({ uiLocale: "pt-BR" }));
    expect(response.status).toBe(400);
    expect((await response.json()).fieldErrors.expectedVersion).toBeDefined();
  });

  it("400 com chave extra/userId no corpo", async () => {
    const { PATCH } = await handlers();
    const response = await PATCH(
      patchRequest({ uiLocale: "pt-BR", expectedVersion: 0, userId: "outro" }),
    );
    expect(response.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("409 com currentVersion", async () => {
    updateMock.mockRejectedValue(new PreferencesVersionConflictError(3));
    const { PATCH } = await handlers();
    const response = await PATCH(patchRequest({ uiLocale: "pt-BR", expectedVersion: 2 }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "preferences_version_conflict",
      currentVersion: 3,
    });
  });

  it("503 para banco indisponível", async () => {
    updateMock.mockRejectedValue(new PreferencesUnavailableError());
    const { PATCH } = await handlers();
    const response = await PATCH(patchRequest({ uiLocale: "pt-BR", expectedVersion: 0 }));
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("preferences_unavailable");
  });

  it("500 para linha persistida inválida", async () => {
    updateMock.mockRejectedValue(new StoredPreferencesInvalidError());
    const { PATCH } = await handlers();
    const response = await PATCH(patchRequest({ uiLocale: "pt-BR", expectedVersion: 0 }));
    expect(response.status).toBe(500);
    expect((await response.json()).code).toBe("stored_preferences_invalid");
  });

  it("PATCH sem uiLocale valida versão e não envia campo", async () => {
    updateMock.mockResolvedValue({ uiLocale: "pt-BR", source: "legacy_br", version: 1 });
    const { PATCH } = await handlers();
    const response = await PATCH(patchRequest({ expectedVersion: 1 }));
    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith("user-1", {
      uiLocale: undefined,
      expectedVersion: 1,
    });
  });
});
