// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  LAB_ENVIRONMENT_REASONS,
  LabEnvironmentError,
  assertLabEnvironment,
  getLabEnvironment,
  labEnvironmentDeniedBody,
} from "../environment-guard";

/**
 * Guarda de ambiente fail-closed (F48.1, D2).
 *
 * Cobre os 5 motivos possíveis, a allowlist CSV, o bloqueio incondicional de
 * hosts de produção e a ausência de vazamento de URL/path/query/chave nas
 * mensagens de erro.
 */

const MANAGED_KEYS = [
  "VENDEO_LAB_ENABLED",
  "NEXT_PUBLIC_SUPABASE_URL",
  "VENDEO_LAB_ALLOWED_SUPABASE_HOSTS",
] as const;

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = {};
  for (const key of MANAGED_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of MANAGED_KEYS) {
    const value = saved[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

function enableLab(): void {
  process.env.VENDEO_LAB_ENABLED = "true";
}

/** Executa a guarda lançadora e devolve o erro (falhando se nada for lançado). */
function captureLabError(): LabEnvironmentError {
  try {
    assertLabEnvironment();
  } catch (error) {
    return error as LabEnvironmentError;
  }
  throw new Error("esperava que assertLabEnvironment() lançasse LabEnvironmentError");
}

describe("environment-guard — flag VENDEO_LAB_ENABLED (fail-closed)", () => {
  it("flag ausente recusa com disabled_flag", () => {
    const state = getLabEnvironment();
    expect(state).toEqual({
      enabled: false,
      supabaseHost: null,
      local: false,
      reason: "disabled_flag",
    });
  });

  it("flag 'false' recusa com disabled_flag", () => {
    process.env.VENDEO_LAB_ENABLED = "false";
    expect(getLabEnvironment().reason).toBe("disabled_flag");
    expect(getLabEnvironment().enabled).toBe(false);
  });

  it("flag '1' recusa com disabled_flag (comparação estrita)", () => {
    process.env.VENDEO_LAB_ENABLED = "1";
    expect(getLabEnvironment().reason).toBe("disabled_flag");
  });

  it("flag 'TRUE' recusa com disabled_flag (case-sensitive)", () => {
    process.env.VENDEO_LAB_ENABLED = "TRUE";
    expect(getLabEnvironment().reason).toBe("disabled_flag");
  });

  it("flag 'true' com URL local permite (ok)", () => {
    enableLab();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    expect(getLabEnvironment().reason).toBe("ok");
  });
});

describe("environment-guard — NEXT_PUBLIC_SUPABASE_URL", () => {
  it("flag ligada e URL ausente recusa com missing_url", () => {
    enableLab();
    const state = getLabEnvironment();
    expect(state.reason).toBe("missing_url");
    expect(state.enabled).toBe(false);
    expect(state.supabaseHost).toBeNull();
  });

  it("flag ligada e URL vazia recusa com missing_url", () => {
    enableLab();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    expect(getLabEnvironment().reason).toBe("missing_url");
  });

  it("flag ligada e URL não parseável recusa com missing_url", () => {
    enableLab();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "nao-e-url";
    const state = getLabEnvironment();
    expect(state.reason).toBe("missing_url");
    expect(state.supabaseHost).toBeNull();
  });
});

describe("environment-guard — hosts locais permitidos", () => {
  const localCases: Array<{ url: string; host: string }> = [
    { url: "http://localhost:54321", host: "localhost" },
    { url: "http://127.0.0.1:54321", host: "127.0.0.1" },
    { url: "http://[::1]:54321", host: "::1" },
    { url: "http://0.0.0.0:54321", host: "0.0.0.0" },
  ];

  for (const { url, host } of localCases) {
    it(`${url} permite com local=true e supabaseHost='${host}'`, () => {
      enableLab();
      process.env.NEXT_PUBLIC_SUPABASE_URL = url;
      const state = getLabEnvironment();
      expect(state).toEqual({
        enabled: true,
        supabaseHost: host,
        local: true,
        reason: "ok",
      });
    });
  }

  it("normaliza o hostname para lowercase", () => {
    enableLab();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://LOCALHOST:54321";
    expect(getLabEnvironment().supabaseHost).toBe("localhost");
    expect(getLabEnvironment().reason).toBe("ok");
  });
});

describe("environment-guard — bloqueio incondicional de produção", () => {
  const blockedHosts = [
    "https://abcd.supabase.co",
    "https://abcd.supabase.in",
    "https://supabase.com",
    "https://supabase.co",
    "https://projeto.supabase.com",
  ];

  for (const url of blockedHosts) {
    it(`${url} recusa com remote_blocked`, () => {
      enableLab();
      process.env.NEXT_PUBLIC_SUPABASE_URL = url;
      const state = getLabEnvironment();
      expect(state.reason).toBe("remote_blocked");
      expect(state.enabled).toBe(false);
      expect(state.local).toBe(false);
    });
  }

  it("allowlist NÃO vence o bloqueio de produção", () => {
    enableLab();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcd.supabase.co";
    process.env.VENDEO_LAB_ALLOWED_SUPABASE_HOSTS = "abcd.supabase.co";
    const state = getLabEnvironment();
    expect(state.reason).toBe("remote_blocked");
    expect(state.enabled).toBe(false);
  });

  it("allowlist com múltiplos hosts de produção não habilita nenhum", () => {
    enableLab();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://xyz.supabase.in";
    process.env.VENDEO_LAB_ALLOWED_SUPABASE_HOSTS = "xyz.supabase.in, abc.supabase.co, db.exemplo.com";
    expect(getLabEnvironment().reason).toBe("remote_blocked");
  });
});

describe("environment-guard — canonicalização de FQDN (ponto final)", () => {
  it("host de produção com ponto final recusa com remote_blocked", () => {
    enableLab();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcd.supabase.co.";
    const state = getLabEnvironment();
    expect(state.reason).toBe("remote_blocked");
    expect(state.enabled).toBe(false);
    expect(state.local).toBe(false);
    expect(state.supabaseHost).toBe("abcd.supabase.co");
  });

  it("supabase.com. recusa com remote_blocked", () => {
    enableLab();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.com.";
    expect(getLabEnvironment().reason).toBe("remote_blocked");
  });

  it("host de produção com ponto final NÃO é habilitado por allowlist idêntica (com ponto)", () => {
    enableLab();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcd.supabase.co.";
    process.env.VENDEO_LAB_ALLOWED_SUPABASE_HOSTS = "abcd.supabase.co.";
    expect(getLabEnvironment().reason).toBe("remote_blocked");
  });

  it("host de produção com ponto final NÃO é habilitado por allowlist canônica (sem ponto)", () => {
    enableLab();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcd.supabase.co.";
    process.env.VENDEO_LAB_ALLOWED_SUPABASE_HOSTS = "abcd.supabase.co";
    expect(getLabEnvironment().reason).toBe("remote_blocked");
  });

  it("host de produção canônico NÃO é habilitado por allowlist com ponto final", () => {
    enableLab();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcd.supabase.co";
    process.env.VENDEO_LAB_ALLOWED_SUPABASE_HOSTS = "abcd.supabase.co.";
    expect(getLabEnvironment().reason).toBe("remote_blocked");
  });

  it("host remoto não-produção com ponto final casa a allowlist canônica", () => {
    enableLab();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://db.exemplo.com.";
    process.env.VENDEO_LAB_ALLOWED_SUPABASE_HOSTS = "db.exemplo.com";
    const state = getLabEnvironment();
    expect(state).toEqual({
      enabled: true,
      supabaseHost: "db.exemplo.com",
      local: false,
      reason: "ok",
    });
  });

  it("localhost com ponto final é canonicalizado e permitido", () => {
    enableLab();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost.:54321";
    const state = getLabEnvironment();
    expect(state).toEqual({
      enabled: true,
      supabaseHost: "localhost",
      local: true,
      reason: "ok",
    });
  });
});

describe("environment-guard — allowlist CSV", () => {
  it("host remoto arbitrário sem allowlist recusa com non_local_supabase", () => {
    enableLab();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://db.exemplo.com";
    const state = getLabEnvironment();
    expect(state).toEqual({
      enabled: false,
      supabaseHost: "db.exemplo.com",
      local: false,
      reason: "non_local_supabase",
    });
  });

  it("host remoto arbitrário com allowlist permite (local=false)", () => {
    enableLab();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://db.exemplo.com";
    process.env.VENDEO_LAB_ALLOWED_SUPABASE_HOSTS = "db.exemplo.com";
    const state = getLabEnvironment();
    expect(state).toEqual({
      enabled: true,
      supabaseHost: "db.exemplo.com",
      local: false,
      reason: "ok",
    });
  });

  it("allowlist aceita CSV com espaços e case divergente", () => {
    enableLab();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://host.docker.internal";
    process.env.VENDEO_LAB_ALLOWED_SUPABASE_HOSTS = "  Host.Docker.Internal , ,outro.exemplo.com ";
    const state = getLabEnvironment();
    expect(state.enabled).toBe(true);
    expect(state.reason).toBe("ok");
    expect(state.supabaseHost).toBe("host.docker.internal");
  });

  it("allowlist vazia não habilita host remoto", () => {
    enableLab();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://db.exemplo.com";
    process.env.VENDEO_LAB_ALLOWED_SUPABASE_HOSTS = "";
    expect(getLabEnvironment().reason).toBe("non_local_supabase");
  });
});

describe("environment-guard — assertLabEnvironment", () => {
  it("não lança e devolve o estado quando o ambiente é local", () => {
    enableLab();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    expect(() => assertLabEnvironment()).not.toThrow();
    expect(assertLabEnvironment()).toEqual({
      enabled: true,
      supabaseHost: "127.0.0.1",
      local: true,
      reason: "ok",
    });
  });

  it("lança LabEnvironmentError com reason disabled_flag", () => {
    const error = captureLabError();
    expect(error).toBeInstanceOf(LabEnvironmentError);
    expect(error.reason).toBe("disabled_flag");
    expect(error.name).toBe("LabEnvironmentError");
    expect(error.message).toContain("VENDEO_LAB_ENABLED");
  });

  it("lança com reason missing_url", () => {
    enableLab();
    const error = captureLabError();
    expect(error).toBeInstanceOf(LabEnvironmentError);
    expect(error.reason).toBe("missing_url");
    expect(error.message).toContain("ausente ou inválida");
  });

  it("lança com reason non_local_supabase", () => {
    enableLab();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://db.exemplo.com";
    const error = captureLabError();
    expect(error).toBeInstanceOf(LabEnvironmentError);
    expect(error.reason).toBe("non_local_supabase");
    expect(error.message).toContain("db.exemplo.com");
  });

  it("lança com reason remote_blocked", () => {
    enableLab();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcd.supabase.co";
    const error = captureLabError();
    expect(error).toBeInstanceOf(LabEnvironmentError);
    expect(error.reason).toBe("remote_blocked");
    expect(error.message).toContain("produção");
  });

  it("cobre todos os 5 motivos declarados", () => {
    expect([...LAB_ENVIRONMENT_REASONS]).toEqual([
      "ok",
      "disabled_flag",
      "missing_url",
      "non_local_supabase",
      "remote_blocked",
    ]);
  });
});

describe("environment-guard — não vaza URL, path, query ou chave", () => {
  it("a mensagem contém apenas o hostname (nunca path/query/chave)", () => {
    enableLab();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://db.exemplo.com/rest/v1?apikey=sk-abcdefgh12345678";

    const state = getLabEnvironment();
    expect(state.supabaseHost).toBe("db.exemplo.com");
    expect(JSON.stringify(state)).not.toContain("/rest");
    expect(JSON.stringify(state)).not.toContain("apikey");

    const message = captureLabError().message;

    expect(message).toContain("db.exemplo.com");
    expect(message).not.toContain("/rest");
    expect(message).not.toContain("v1");
    expect(message).not.toContain("apikey");
    expect(message).not.toContain("sk-");
    expect(message).not.toContain("AIza");
  });

  it("nenhuma mensagem de recusa contém '/', 'sk-' ou 'AIza'", () => {
    const cases: Array<{ flag?: string; url?: string }> = [
      {},
      { flag: "false", url: "http://localhost:54321" },
      { flag: "true" },
      { flag: "true", url: "nao-e-url" },
      { flag: "true", url: "https://db.exemplo.com/rest/v1?token=sk-abcdefgh12345678" },
      { flag: "true", url: "https://abcd.supabase.co/rest/v1?apikey=AIzaSyABCDEFGH1234" },
    ];

    for (const { flag, url } of cases) {
      if (flag !== undefined) process.env.VENDEO_LAB_ENABLED = flag;
      if (url !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = url;

      const state = getLabEnvironment();
      expect(state.reason).not.toBe("ok");
      const error = new LabEnvironmentError(state.reason, state.supabaseHost);
      expect(error.message).not.toContain("/");
      expect(error.message).not.toContain("sk-");
      expect(error.message).not.toContain("AIza");
      delete process.env.VENDEO_LAB_ENABLED;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    }
  });
});

describe("environment-guard — corpo 403 padronizado", () => {
  it("labEnvironmentDeniedBody devolve o corpo de environment_blocked", () => {
    expect(labEnvironmentDeniedBody("disabled_flag")).toEqual({
      error: "environment_blocked",
      reason: "disabled_flag",
    });
  });

  it("preserva o reason recebido", () => {
    expect(labEnvironmentDeniedBody("remote_blocked").reason).toBe("remote_blocked");
    expect(labEnvironmentDeniedBody("non_local_supabase").error).toBe("environment_blocked");
  });
});
