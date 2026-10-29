import { afterEach, describe, expect, it, vi } from "vitest";

import { es419Messages } from "../catalogs/es-419";
import { ptBRMessages } from "../catalogs/pt-BR";
import { getCatalog } from "../get-catalog";
import type { Messages } from "../messages";
import { formatMessage, translate } from "../translate";

const EMPTY = {} as Messages;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("formatMessage", () => {
  it("substitui placeholders fornecidos", () => {
    expect(
      formatMessage("Notificações não lidas: {count}", { count: 3 }),
    ).toBe("Notificações não lidas: 3");
    expect(
      formatMessage("Notificações não lidas: {count}", { count: 3 }),
    ).not.toContain("{count}");
  });

  it("não interpreta HTML e mantém placeholders desconhecidos literais", () => {
    expect(formatMessage("<b>{x}</b>", { x: "<i>y</i>" })).toBe(
      "<b><i>y</i></b>",
    );
    expect(formatMessage("Olá {name}", {})).toBe("Olá {name}");
    expect(formatMessage("Sem params", { other: 1 })).toBe("Sem params");
  });
});

describe("translate", () => {
  it("usa o catálogo do locale quando a chave existe", () => {
    expect(
      translate(es419Messages, ptBRMessages, "shell.nav.dashboard"),
    ).toBe("Panel");
    expect(
      translate(ptBRMessages, es419Messages, "shell.nav.dashboard"),
    ).toBe("Dashboard");
  });

  it("cai para pt-BR quando a chave falta no catálogo do locale", () => {
    expect(translate(EMPTY, ptBRMessages, "shell.nav.dashboard")).toBe(
      "Dashboard",
    );
  });

  it("devolve a própria chave quando falta nos dois catálogos", () => {
    expect(translate(EMPTY, EMPTY, "shell.missing.key")).toBe(
      "shell.missing.key",
    );
  });

  it("avisa em desenvolvimento e não avisa em produção", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    vi.stubEnv("NODE_ENV", "development");
    expect(translate(EMPTY, EMPTY, "shell.missing.key")).toBe(
      "shell.missing.key",
    );
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockClear();
    vi.stubEnv("NODE_ENV", "production");
    expect(translate(EMPTY, EMPTY, "shell.missing.key")).toBe(
      "shell.missing.key",
    );
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("getCatalog", () => {
  it("devolve o catálogo do locale pedido", () => {
    expect(getCatalog("es-419").settings.title).toBe("Configuración");
    expect(getCatalog("pt-BR").settings.title).toBe("Configurações");
    expect(getCatalog("pt-BR")).toBe(ptBRMessages);
  });
});
