// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  parseCliEnvLine,
  parseLocalCliUrl,
  unquoteCliValue,
} from "../pilot/cli-env-parse";

describe("F56.2b2c — parser do CLI (aspas + host/porta)", () => {
  it("remove aspas duplas e simples", () => {
    expect(unquoteCliValue('"http://127.0.0.1:57781"')).toBe("http://127.0.0.1:57781");
    expect(unquoteCliValue("'http://127.0.0.1:57782'")).toBe("http://127.0.0.1:57782");
    expect(unquoteCliValue('  "x"  ')).toBe("x");
  });

  it("extrai API_URL/DB_URL entre aspas (linha do CLI)", () => {
    expect(parseCliEnvLine('API_URL="http://127.0.0.1:57781"', "API_URL")).toBe(
      "http://127.0.0.1:57781",
    );
    expect(parseCliEnvLine('DB_URL="postgresql://postgres:postgres@127.0.0.1:57782/postgres"', "DB_URL")).toBe(
      "postgresql://postgres:postgres@127.0.0.1:57782/postgres",
    );
    expect(parseCliEnvLine('SERVICE_ROLE_KEY="secret"', "API_URL")).toBeNull();
  });

  it("valida host local + porta esperada (com aspas)", () => {
    expect(parseLocalCliUrl('"http://127.0.0.1:57781"', 57781).localPortOk).toBe(true);
    expect(parseLocalCliUrl('"postgresql://postgres:pw@127.0.0.1:57782/postgres"', 57782).localPortOk).toBe(true);
    // porta errada ⇒ recusa
    expect(parseLocalCliUrl('"http://127.0.0.1:9999"', 57781).localPortOk).toBe(false);
    // host não-local ⇒ recusa
    expect(parseLocalCliUrl('"http://db.exemplo.com:57781"', 57781).localPortOk).toBe(false);
  });

  it("valor inválido/vazio ⇒ recusa", () => {
    expect(parseLocalCliUrl("", 57781).localPortOk).toBe(false);
    expect(parseLocalCliUrl("não-é-url", 57781).localPortOk).toBe(false);
  });
});
