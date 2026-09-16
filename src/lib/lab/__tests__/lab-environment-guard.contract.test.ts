// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  LAB_ENVIRONMENT_REASONS,
  LabEnvironmentError,
  assertLabEnvironment,
  getLabEnvironment,
  labEnvironmentDeniedBody,
} from "../environment-guard";
import type { LabEnvironmentReason, LabEnvironmentState } from "../environment-guard";
import {
  DEFAULT_MAX_RUNS_PER_EXPERIMENT,
  LAB_ARTIFACT_RETENTION_DAYS,
  LAB_RUN_STALE_MS,
  MAX_CONCURRENT_LAB_RUNS,
  MAX_REPETITIONS,
  MAX_RUNS_PER_EXPERIMENT,
  MAX_SCENARIOS_PER_EXPERIMENT,
} from "../limits";

/**
 * Suíte de contrato nº 1 (48-1-11, task 11.1) — **guarda de ambiente exaustiva**.
 *
 * Complementa (não repete) `environment-guard.test.ts`/`limits.test.ts` do 48-1-02:
 * aqui a matriz cobre **todos** os 5 `reason` de `getLabEnvironment()` de uma vez,
 * a precedência do bloqueio de produção sobre a allowlist, o fail-closed em
 * configuração ausente/inválida/ambígua, a superfície mínima exposta (só hostname),
 * a higiene da mensagem de erro e a decisão **sem** `NODE_ENV`/`VERCEL_ENV`.
 *
 * Somente leitura dos fontes do 48-1-02 — nenhuma alteração em
 * `environment-guard.ts` nem em `limits.ts`.
 */

// ─── Ambiente controlado ─────────────────────────────────────────────────────

const MANAGED_KEYS = [
  "VENDEO_LAB_ENABLED",
  "NEXT_PUBLIC_SUPABASE_URL",
  "VENDEO_LAB_ALLOWED_SUPABASE_HOSTS",
] as const;

type ManagedKey = (typeof MANAGED_KEYS)[number];
type EnvOverrides = Partial<Record<ManagedKey, string>>;

let saved: Record<ManagedKey, string | undefined>;

beforeEach(() => {
  saved = {
    VENDEO_LAB_ENABLED: process.env.VENDEO_LAB_ENABLED,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    VENDEO_LAB_ALLOWED_SUPABASE_HOSTS: process.env.VENDEO_LAB_ALLOWED_SUPABASE_HOSTS,
  };
  for (const key of MANAGED_KEYS) delete process.env[key];
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

/** Aplica `overrides` isoladamente e **sempre** restaura o ambiente (try/finally). */
function withEnv<T>(overrides: EnvOverrides, fn: () => T): T {
  const previous: Record<ManagedKey, string | undefined> = {
    VENDEO_LAB_ENABLED: process.env.VENDEO_LAB_ENABLED,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    VENDEO_LAB_ALLOWED_SUPABASE_HOSTS: process.env.VENDEO_LAB_ALLOWED_SUPABASE_HOSTS,
  };
  try {
    for (const key of MANAGED_KEYS) delete process.env[key];
    for (const [key, value] of Object.entries(overrides) as Array<[ManagedKey, string]>) {
      process.env[key] = value;
    }
    return fn();
  } finally {
    for (const key of MANAGED_KEYS) {
      const value = previous[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function state(overrides: Partial<LabEnvironmentState> & { reason: LabEnvironmentReason }): LabEnvironmentState {
  return { enabled: false, supabaseHost: null, local: false, ...overrides };
}

// ─── Matriz exaustiva dos 5 motivos ─────────────────────────────────────────

interface EnvMatrixCase {
  label: string;
  env: EnvOverrides;
  expected: LabEnvironmentState;
}

const ENABLED_LOCAL_URL: EnvOverrides = {
  VENDEO_LAB_ENABLED: "true",
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
};

const MATRIX: EnvMatrixCase[] = [
  // (1) disabled_flag — a flag precisa ser exatamente a string "true".
  {
    label: "flag ausente → disabled_flag (default fail-closed)",
    env: {},
    expected: state({ reason: "disabled_flag" }),
  },
  {
    label: "flag 'false' → disabled_flag",
    env: { ...ENABLED_LOCAL_URL, VENDEO_LAB_ENABLED: "false" },
    expected: state({ reason: "disabled_flag" }),
  },
  {
    label: "flag '1' → disabled_flag (comparação estrita)",
    env: { ...ENABLED_LOCAL_URL, VENDEO_LAB_ENABLED: "1" },
    expected: state({ reason: "disabled_flag" }),
  },
  {
    label: "flag 'TRUE' → disabled_flag (case-sensitive)",
    env: { ...ENABLED_LOCAL_URL, VENDEO_LAB_ENABLED: "TRUE" },
    expected: state({ reason: "disabled_flag" }),
  },
  {
    label: "flag ' true ' com espaços → disabled_flag (nenhum trim)",
    env: { ...ENABLED_LOCAL_URL, VENDEO_LAB_ENABLED: " true " },
    expected: state({ reason: "disabled_flag" }),
  },

  // (2) missing_url — URL ausente, vazia, não parseável ou relativa.
  {
    label: "flag ligada e URL ausente → missing_url",
    env: { VENDEO_LAB_ENABLED: "true" },
    expected: state({ reason: "missing_url" }),
  },
  {
    label: "flag ligada e URL vazia → missing_url",
    env: { VENDEO_LAB_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "" },
    expected: state({ reason: "missing_url" }),
  },
  {
    label: "flag ligada e URL não parseável ('nao-e-url') → missing_url",
    env: { VENDEO_LAB_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "nao-e-url" },
    expected: state({ reason: "missing_url" }),
  },
  {
    label: "flag ligada e URL relativa ('/rest/v1') → missing_url",
    env: { VENDEO_LAB_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "/rest/v1" },
    expected: state({ reason: "missing_url" }),
  },

  // (3) ok — hosts locais conhecidos.
  {
    label: "localhost → ok (local)",
    env: { VENDEO_LAB_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321" },
    expected: state({ reason: "ok", enabled: true, local: true, supabaseHost: "localhost" }),
  },
  {
    label: "127.0.0.1 → ok (local)",
    env: { VENDEO_LAB_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" },
    expected: state({ reason: "ok", enabled: true, local: true, supabaseHost: "127.0.0.1" }),
  },
  {
    label: "IPv6 [::1] → ok e supabaseHost sem colchetes",
    env: { VENDEO_LAB_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "http://[::1]:54321" },
    expected: state({ reason: "ok", enabled: true, local: true, supabaseHost: "::1" }),
  },
  {
    label: "0.0.0.0 → ok (local)",
    env: { VENDEO_LAB_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "http://0.0.0.0:54321" },
    expected: state({ reason: "ok", enabled: true, local: true, supabaseHost: "0.0.0.0" }),
  },
  {
    label: "host uppercase é canonicalizado para lowercase",
    env: { VENDEO_LAB_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "http://LOCALHOST:54321" },
    expected: state({ reason: "ok", enabled: true, local: true, supabaseHost: "localhost" }),
  },

  // (4) remote_blocked — produção conhecida, sempre bloqueada.
  {
    label: "*.supabase.co → remote_blocked",
    env: { VENDEO_LAB_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "https://abcd.supabase.co" },
    expected: state({ reason: "remote_blocked", supabaseHost: "abcd.supabase.co" }),
  },
  {
    label: "*.supabase.in → remote_blocked",
    env: { VENDEO_LAB_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "https://abcd.supabase.in" },
    expected: state({ reason: "remote_blocked", supabaseHost: "abcd.supabase.in" }),
  },
  {
    label: "supabase.com (raiz) → remote_blocked",
    env: { VENDEO_LAB_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "https://supabase.com" },
    expected: state({ reason: "remote_blocked", supabaseHost: "supabase.com" }),
  },
  {
    label: "produção + allowlist com o próprio host → remote_blocked (bloqueio vence)",
    env: {
      VENDEO_LAB_ENABLED: "true",
      NEXT_PUBLIC_SUPABASE_URL: "https://abcd.supabase.co",
      VENDEO_LAB_ALLOWED_SUPABASE_HOSTS: "abcd.supabase.co",
    },
    expected: state({ reason: "remote_blocked", supabaseHost: "abcd.supabase.co" }),
  },

  // (5) non_local_supabase vs allowlist.
  {
    label: "host remoto sem allowlist → non_local_supabase",
    env: { VENDEO_LAB_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "https://db.exemplo.com" },
    expected: state({ reason: "non_local_supabase", supabaseHost: "db.exemplo.com" }),
  },
  {
    label: "host remoto com allowlist exata → ok (local: false)",
    env: {
      VENDEO_LAB_ENABLED: "true",
      NEXT_PUBLIC_SUPABASE_URL: "https://db.exemplo.com",
      VENDEO_LAB_ALLOWED_SUPABASE_HOSTS: "db.exemplo.com",
    },
    expected: state({ reason: "ok", enabled: true, local: false, supabaseHost: "db.exemplo.com" }),
  },
  {
    label: "allowlist CSV com espaços e entradas vazias → ok (local: false)",
    env: {
      VENDEO_LAB_ENABLED: "true",
      NEXT_PUBLIC_SUPABASE_URL: "https://db.exemplo.com",
      VENDEO_LAB_ALLOWED_SUPABASE_HOSTS: " db.exemplo.com , ,outro.local",
    },
    expected: state({ reason: "ok", enabled: true, local: false, supabaseHost: "db.exemplo.com" }),
  },
];

describe("getLabEnvironment — matriz exaustiva dos 5 motivos (D2)", () => {
  it("declara exatamente os 5 motivos, com 'ok' primeiro", () => {
    expect([...LAB_ENVIRONMENT_REASONS]).toEqual([
      "ok",
      "disabled_flag",
      "missing_url",
      "non_local_supabase",
      "remote_blocked",
    ]);
  });

  for (const testCase of MATRIX) {
    it(testCase.label, () => {
      withEnv(testCase.env, () => {
        expect(getLabEnvironment()).toEqual(testCase.expected);
      });
    });
  }

  it("a matriz cobre os 5 motivos (nenhum reason fica sem caso)", () => {
    const covered = new Set(MATRIX.map((testCase) => testCase.expected.reason));
    for (const reason of LAB_ENVIRONMENT_REASONS) {
      expect(covered.has(reason)).toBe(true);
    }
  });

  it("allowlist vazia não habilita host remoto (fail-closed)", () => {
    withEnv(
      {
        VENDEO_LAB_ENABLED: "true",
        NEXT_PUBLIC_SUPABASE_URL: "https://db.exemplo.com",
        VENDEO_LAB_ALLOWED_SUPABASE_HOSTS: "",
      },
      () => {
        expect(getLabEnvironment().reason).toBe("non_local_supabase");
        expect(getLabEnvironment().enabled).toBe(false);
      },
    );
  });
});

// ─── Superfície mínima: apenas hostname, lowercase, sem colchetes ────────────

describe("getLabEnvironment — superfície exposta é apenas o hostname (T-48-1-12)", () => {
  it("não vaza path, query, fragmento nem chave na URL", () => {
    withEnv(
      {
        VENDEO_LAB_ENABLED: "true",
        NEXT_PUBLIC_SUPABASE_URL:
          "https://db.exemplo.com/rest/v1?apikey=sk-abcdefgh12345678#frag",
      },
      () => {
        const current = getLabEnvironment();
        expect(current.supabaseHost).toBe("db.exemplo.com");
        const serialized = JSON.stringify(current);
        expect(serialized).not.toContain("/rest");
        expect(serialized).not.toContain("v1");
        expect(serialized).not.toContain("apikey");
        expect(serialized).not.toContain("sk-");
        expect(serialized).not.toContain("AIza");
        expect(serialized).not.toContain("#frag");
      },
    );
  });

  it("supabaseHost é lowercase e sem colchetes de IPv6", () => {
    withEnv(
      { VENDEO_LAB_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "http://[::1]:54321" },
      () => {
        expect(getLabEnvironment().supabaseHost).toBe("::1");
      },
    );
    withEnv(
      { VENDEO_LAB_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "https://DB.Exemplo.COM" },
      () => {
        const current = getLabEnvironment();
        expect(current.supabaseHost).toBe("db.exemplo.com");
        expect(current.supabaseHost).toBe(current.supabaseHost?.toLowerCase());
      },
    );
  });
});

// ─── assertLabEnvironment: lança com reason exato, mensagem sanitizada ───────

/** Marcador textual distintivo de cada motivo na mensagem determinística. */
const REASON_MARKERS: Record<Exclude<LabEnvironmentReason, "ok">, string> = {
  disabled_flag: "VENDEO_LAB_ENABLED",
  missing_url: "NEXT_PUBLIC_SUPABASE_URL",
  non_local_supabase: "não é local nem permitido",
  remote_blocked: "produção",
};

/** A mensagem nunca pode carregar chave, `apikey`, query ou fragmento. */
const SENSITIVE_MESSAGE_RE = /sk-|AIza|api[_-]?key|\?|#/;

function captureLabError(): LabEnvironmentError {
  try {
    assertLabEnvironment();
  } catch (error) {
    return error as LabEnvironmentError;
  }
  throw new Error("esperava que assertLabEnvironment() lançasse LabEnvironmentError");
}

describe("assertLabEnvironment — recusa exata e mensagem sanitizada", () => {
  const rejections = MATRIX.filter((testCase) => testCase.expected.reason !== "ok");

  for (const testCase of rejections) {
    it(`${testCase.expected.reason} — lança LabEnvironmentError com o reason exato`, () => {
      withEnv(testCase.env, () => {
        const error = captureLabError();
        const reason = testCase.expected.reason as Exclude<LabEnvironmentReason, "ok">;

        expect(error).toBeInstanceOf(LabEnvironmentError);
        expect(error.name).toBe("LabEnvironmentError");
        expect(error.reason).toBe(reason);
        expect(error.message).toContain(REASON_MARKERS[reason]);
        expect(error.message).not.toMatch(SENSITIVE_MESSAGE_RE);

        const host = testCase.expected.supabaseHost;
        if (host) {
          expect(error.message).toContain(host);
        }
      });
    });
  }

  it("não lança e devolve o estado quando o ambiente é local", () => {
    withEnv(
      { VENDEO_LAB_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" },
      () => {
        expect(() => assertLabEnvironment()).not.toThrow();
        expect(assertLabEnvironment()).toEqual({
          enabled: true,
          supabaseHost: "127.0.0.1",
          local: true,
          reason: "ok",
        });
      },
    );
  });

  it("nenhuma mensagem de recusa casa /sk-|AIza|api[_-]?key|\\?|#/", () => {
    for (const testCase of rejections) {
      withEnv(testCase.env, () => {
        expect(captureLabError().message).not.toMatch(SENSITIVE_MESSAGE_RE);
      });
    }
  });
});

// ─── Corpo 403 padronizado ───────────────────────────────────────────────────

describe("labEnvironmentDeniedBody — 403 padronizado dos 4 motivos de recusa", () => {
  const denyReasons = LAB_ENVIRONMENT_REASONS.filter(
    (reason): reason is Exclude<LabEnvironmentReason, "ok"> => reason !== "ok",
  );

  it("cobre os 4 motivos de recusa", () => {
    expect(denyReasons).toHaveLength(4);
  });

  for (const reason of denyReasons) {
    it(`${reason} → { error: "environment_blocked", reason }`, () => {
      expect(labEnvironmentDeniedBody(reason)).toEqual({
        error: "environment_blocked",
        reason,
      });
    });
  }
});

// ─── Invariantes das constantes de limite (LOCKED) ──────────────────────────

describe("limits — invariantes travados do contrato (D14)", () => {
  const constants: Array<[string, number]> = [
    ["MAX_SCENARIOS_PER_EXPERIMENT", MAX_SCENARIOS_PER_EXPERIMENT],
    ["MAX_REPETITIONS", MAX_REPETITIONS],
    ["MAX_RUNS_PER_EXPERIMENT", MAX_RUNS_PER_EXPERIMENT],
    ["DEFAULT_MAX_RUNS_PER_EXPERIMENT", DEFAULT_MAX_RUNS_PER_EXPERIMENT],
    ["MAX_CONCURRENT_LAB_RUNS", MAX_CONCURRENT_LAB_RUNS],
    ["LAB_RUN_STALE_MS", LAB_RUN_STALE_MS],
    ["LAB_ARTIFACT_RETENTION_DAYS", LAB_ARTIFACT_RETENTION_DAYS],
  ];

  it("os 7 valores exatos da fase", () => {
    expect(MAX_SCENARIOS_PER_EXPERIMENT).toBe(3);
    expect(MAX_REPETITIONS).toBe(3);
    expect(MAX_RUNS_PER_EXPERIMENT).toBe(12);
    expect(DEFAULT_MAX_RUNS_PER_EXPERIMENT).toBe(6);
    expect(MAX_CONCURRENT_LAB_RUNS).toBe(1);
    expect(LAB_RUN_STALE_MS).toBe(900000);
    expect(LAB_ARTIFACT_RETENTION_DAYS).toBe(30);
  });

  it("MAX_CONCURRENT_LAB_RUNS === 1 (exclusão mútua global)", () => {
    expect(MAX_CONCURRENT_LAB_RUNS).toBe(1);
  });

  it("LAB_RUN_STALE_MS === 15 min", () => {
    expect(LAB_RUN_STALE_MS).toBe(15 * 60 * 1000);
  });

  it("relações entre os limites permanecem válidas", () => {
    expect(DEFAULT_MAX_RUNS_PER_EXPERIMENT).toBeLessThan(MAX_RUNS_PER_EXPERIMENT);
    expect(MAX_REPETITIONS).toBeLessThanOrEqual(MAX_RUNS_PER_EXPERIMENT);
    expect(LAB_ARTIFACT_RETENTION_DAYS).toBe(30);
  });

  it("todas as constantes são números finitos e positivos", () => {
    for (const [name, value] of constants) {
      expect(Number.isFinite(value), `${name} deve ser finito`).toBe(true);
      expect(value, `${name} deve ser positivo`).toBeGreaterThan(0);
    }
  });
});

// ─── A decisão nunca usa o modo de build (NODE_ENV/VERCEL_ENV) ───────────────

describe("environment-guard — a decisão é por flag + host, nunca por build", () => {
  it("o fonte da guarda não referencia NODE_ENV nem VERCEL_ENV", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/lib/lab/environment-guard.ts"),
      "utf8",
    );

    expect(source).not.toContain("NODE_ENV");
    expect(source).not.toContain("VERCEL_ENV");
  });
});
