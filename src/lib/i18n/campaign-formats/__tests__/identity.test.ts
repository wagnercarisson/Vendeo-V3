import { describe, expect, it } from "vitest";

import { es419CampaignDetailMessages } from "@/lib/i18n/campaign-detail/catalogs/es-419";
import { ptBRCampaignDetailMessages } from "@/lib/i18n/campaign-detail/catalogs/pt-BR";
import { es419CampaignListMessages } from "@/lib/i18n/campaign-list/catalogs/es-419";
import { ptBRCampaignListMessages } from "@/lib/i18n/campaign-list/catalogs/pt-BR";
import { es419DashboardMessages } from "@/lib/i18n/dashboard/catalogs/es-419";
import { ptBRDashboardMessages } from "@/lib/i18n/dashboard/catalogs/pt-BR";

import { es419CampaignFormatMessages } from "../catalogs/es-419";
import { ptBRCampaignFormatMessages } from "../catalogs/pt-BR";
import { getCampaignFormatMessages } from "../get-messages";

describe("F61 — identidade do catálogo compartilhado nos três namespaces", () => {
  it("pt-BR: listagem, dashboard e detalhe expõem a MESMA referência", () => {
    expect(ptBRCampaignListMessages.formats).toBe(
      ptBRCampaignFormatMessages,
    );
    expect(ptBRDashboardMessages.campaigns.formats).toBe(
      ptBRCampaignFormatMessages,
    );
    expect(ptBRCampaignDetailMessages.formats).toBe(
      ptBRCampaignFormatMessages,
    );
  });

  it("es-419: listagem, dashboard e detalhe expõem a MESMA referência", () => {
    expect(es419CampaignListMessages.formats).toBe(
      es419CampaignFormatMessages,
    );
    expect(es419DashboardMessages.campaigns.formats).toBe(
      es419CampaignFormatMessages,
    );
    expect(es419CampaignDetailMessages.formats).toBe(
      es419CampaignFormatMessages,
    );
  });

  it("as referências por locale são distintas entre si", () => {
    expect(ptBRCampaignFormatMessages).not.toBe(es419CampaignFormatMessages);
  });

  it("o resolvedor devolve exatamente o catálogo do locale", () => {
    expect(getCampaignFormatMessages("pt-BR")).toBe(
      ptBRCampaignFormatMessages,
    );
    expect(getCampaignFormatMessages("es-419")).toBe(
      es419CampaignFormatMessages,
    );
  });
});
