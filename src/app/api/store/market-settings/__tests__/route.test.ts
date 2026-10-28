import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/require-user", () => ({ requireApiUser: vi.fn() }));
vi.mock("@/lib/market-preferences/store-market-settings-service", () => ({
  getStoreMarketSettings: vi.fn(),
  updateStoreMarketSettings: vi.fn(),
}));

import { UnauthorizedError } from "@/lib/auth/errors";
import { StoreNotFoundError } from "@/lib/auth/store-ownership";
import { requireApiUser } from "@/lib/auth/require-user";
import {
  PreferencesUnavailableError,
  PreferencesVersionConflictError,
  StoredPreferencesInvalidError,
} from "@/lib/market-preferences/errors";
import {
  getStoreMarketSettings,
  updateStoreMarketSettings,
} from "@/lib/market-preferences/store-market-settings-service";

const requireApiUserMock = vi.mocked(requireApiUser);
const getMock = vi.mocked(getStoreMarketSettings);
const updateMock = vi.mocked(updateStoreMarketSettings);

const DTO = {
  countryCode: "BR",
  countrySource: "legacy_br",
  defaultCampaignMarket: "BR",
  defaultCampaignMarketSource: "legacy_br",
  defaultContentLocale: "pt-BR",
  defaultContentLocaleSource: "legacy_br",
  defaultCurrency: "BRL",
  defaultCurrencySource: "legacy_br",
  timeZone: "America/Sao_Paulo",
  timeZoneSource: "legacy_br",
  contextVersion: 1,
  settingsVersion: 0,
} as const;

async function handlers() {
  return import("../route");
}

function patchRequest(body: unknown, origin: string | null = "http://localhost:3000") {
  const headers = new Headers({ host: "localhost:3000", "content-type": "application/json" });
  if (origin) headers.set("origin", origin);
  return new NextRequest("http://localhost:3000/api/store/market-settings", {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireApiUserMock.mockResolvedValue({ userId: "user-1", claims: {} as never });
});

describe("GET /api/store/market-settings", () => {
  it("200 com DTO", async () => {
    getMock.mockResolvedValue(DTO);
    const { GET } = await handlers();
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(DTO);
    expect(getMock).toHaveBeenCalledWith("user-1");
  });

  it("401 sem sessão", async () => {
    requireApiUserMock.mockRejectedValueOnce(new UnauthorizedError());
    const { GET } = await handlers();
    expect((await GET()).status).toBe(401);
  });

  it("404 para loja ausente/alheia", async () => {
    getMock.mockRejectedValue(new StoreNotFoundError());
    const { GET } = await handlers();
    const response = await GET();
    expect(response.status).toBe(404);
    const json = await response.json();
    expect(JSON.stringify(json)).not.toContain("store_id");
    expect(JSON.stringify(json)).not.toContain("user_id");
  });

  it("503 para falha de banco", async () => {
    getMock.mockRejectedValue(new PreferencesUnavailableError());
    const { GET } = await handlers();
    const response = await GET();
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("preferences_unavailable");
  });
});

describe("PATCH /api/store/market-settings", () => {
  it("200 com atualização", async () => {
    updateMock.mockResolvedValue({ ...DTO, settingsVersion: 1 });
    const { PATCH } = await handlers();
    const response = await PATCH(
      patchRequest({ defaultCurrency: "PYG", expectedVersion: 0 }),
    );
    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith("user-1", {
      defaultCurrency: "PYG",
      expectedVersion: 0,
    });
  });

  it("403 sem Origin", async () => {
    const { PATCH } = await handlers();
    const response = await PATCH(patchRequest({ expectedVersion: 0 }, null));
    expect(response.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it.each([{ country: "PY" }, { country_code: "PY" }])(
    "400 country_not_mutable antes do serviço: %j",
    async (body) => {
      const { PATCH } = await handlers();
      const response = await PATCH(patchRequest({ ...body, expectedVersion: 0 }));
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("country_not_mutable");
      expect(updateMock).not.toHaveBeenCalled();
    },
  );

  it("400 para moeda inválida", async () => {
    const { PATCH } = await handlers();
    const response = await PATCH(
      patchRequest({ defaultCurrency: "USD", expectedVersion: 0 }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).fieldErrors.defaultCurrency).toBeDefined();
  });

  it("400 sem expectedVersion", async () => {
    const { PATCH } = await handlers();
    const response = await PATCH(patchRequest({ defaultCurrency: "PYG" }));
    expect(response.status).toBe(400);
    expect((await response.json()).fieldErrors.expectedVersion).toBeDefined();
  });

  it("400 com storeId no corpo", async () => {
    const { PATCH } = await handlers();
    const response = await PATCH(
      patchRequest({ expectedVersion: 0, storeId: "x" }),
    );
    expect(response.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("409 com currentVersion", async () => {
    updateMock.mockRejectedValue(new PreferencesVersionConflictError(2));
    const { PATCH } = await handlers();
    const response = await PATCH(patchRequest({ expectedVersion: 1 }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "settings_version_conflict",
      currentVersion: 2,
    });
  });

  it("503 para banco indisponível", async () => {
    updateMock.mockRejectedValue(new PreferencesUnavailableError());
    const { PATCH } = await handlers();
    expect(
      (await PATCH(patchRequest({ expectedVersion: 0, timeZone: "America/Asuncion" }))).status,
    ).toBe(503);
  });

  it("500 para linha persistida inválida", async () => {
    updateMock.mockRejectedValue(new StoredPreferencesInvalidError());
    const { PATCH } = await handlers();
    expect(
      (await PATCH(patchRequest({ expectedVersion: 0, timeZone: "America/Asuncion" }))).status,
    ).toBe(500);
  });
});
