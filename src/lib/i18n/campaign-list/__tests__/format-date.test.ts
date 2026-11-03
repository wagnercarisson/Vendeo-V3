import { describe, expect, it } from "vitest";

import { formatCampaignListDate } from "../format-date";

/**
 * Compara com os componentes locais do mesmo `Date` — a semântica que a
 * listagem já usava. Assim o teste independe do fuso da máquina e de UTC.
 */
function expectedLocalDate(isoString: string): string {
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

const SAMPLES = [
  "2026-07-10T12:00:00Z",
  "2026-01-01T00:00:00Z",
  "2026-12-31T23:59:59Z",
];

describe("formatCampaignListDate", () => {
  it("pt-BR preserva os componentes locais da data", () => {
    for (const iso of SAMPLES) {
      expect(formatCampaignListDate(iso, "pt-BR")).toBe(expectedLocalDate(iso));
    }
  });

  it("es-419 preserva os componentes locais da data", () => {
    for (const iso of SAMPLES) {
      expect(formatCampaignListDate(iso, "es-419")).toBe(
        expectedLocalDate(iso),
      );
    }
  });

  it("formata o mesmo instante de forma idêntica nos dois idiomas", () => {
    for (const iso of SAMPLES) {
      expect(formatCampaignListDate(iso, "es-419")).toBe(
        formatCampaignListDate(iso, "pt-BR"),
      );
    }
  });
});
