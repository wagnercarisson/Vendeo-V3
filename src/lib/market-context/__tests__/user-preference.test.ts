import { describe, expect, it } from "vitest";
import { resolveUiLocale } from "../user-preference";
import type { UserLocaleResolution } from "../types";

function expectFailure(result: UserLocaleResolution) {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected failure");
  return result.error;
}

describe("resolveUiLocale", () => {
  it("resolves an explicit locale with provenance", () => {
    const result = resolveUiLocale({ kind: "explicit", uiLocale: "pt-BR" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.uiLocale).toBe("pt-BR");
    expect(result.provenance).toBe("explicit");
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("resolves es-PY explicitly", () => {
    const result = resolveUiLocale({ kind: "explicit", uiLocale: "es-PY" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.uiLocale).toBe("es-PY");
  });

  it("only resolves pt-BR for explicitly declared legacy", () => {
    const result = resolveUiLocale({ kind: "legacy" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.uiLocale).toBe("pt-BR");
    expect(result.provenance).toBe("legacy_br");
  });

  it("rejects mixed legacy input instead of discarding explicit preferences", () => {
    const withLocale = expectFailure(
      resolveUiLocale({ kind: "legacy", uiLocale: "es-PY" }),
    );
    expect(withLocale.code).toBe("invalid_input");
    expect(withLocale.field).toBe("uiLocale");
    expect(withLocale.reason).toBe("invalid_field");
    expect(withLocale.received).toBe("es-PY");

    const withCountry = expectFailure(
      resolveUiLocale({ kind: "legacy", country: "PY" }),
    );
    expect(withCountry.code).toBe("invalid_input");
    expect(withCountry.field).toBe("country");
  });

  it("never derives the app locale from market or country", () => {
    // Extra keys are ignored: there is no market/country input by design.
    const result = resolveUiLocale({
      kind: "explicit",
      uiLocale: "pt-BR",
      market: "PY",
      country: "PY",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.uiLocale).toBe("pt-BR");
  });

  it("rejects an explicit preference without locale", () => {
    const error = expectFailure(resolveUiLocale({ kind: "explicit" }));
    expect(error.code).toBe("invalid_input");
    expect(error.field).toBe("uiLocale");
    expect(error.reason).toBe("incomplete");
  });

  it("rejects unsupported locales with a typed error", () => {
    const error = expectFailure(
      resolveUiLocale({ kind: "explicit", uiLocale: "es-AR" }),
    );
    expect(error.code).toBe("unsupported_locale");
    expect(error.field).toBe("uiLocale");
    expect(error.received).toBe("es-AR");
  });

  it("rejects unknown kinds and non-object input without throwing", () => {
    expect(expectFailure(resolveUiLocale({ kind: "auto" })).field).toBe("kind");
    expect(expectFailure(resolveUiLocale(null)).reason).toBe("not_an_object");
  });
});
