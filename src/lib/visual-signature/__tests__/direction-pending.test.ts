import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockSupabaseFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { from: mockSupabaseFrom },
}));

const {
  loadVisualDirectionState,
  markSyncedProfilesOutdatedExceptActive,
  recordVisualDirectionFailure,
  clearVisualDirectionFailure,
  isVisualSignatureActive,
  sanitizeDirectionDiagnostic,
} = await import("@/lib/visual-signature/direction-pending");

interface ChainOptions {
  result: any;
  updates?: any[];
  updateResult?: any;
}

function makeChain({ result, updates, updateResult }: ChainOptions) {
  const resolvable = Promise.resolve(result);
  const chain: any = Object.assign(() => resolvable, {
    then: resolvable.then.bind(resolvable),
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    update: vi.fn((data: any) => {
      updates?.push(data);
      const updateResolvable = Promise.resolve(updateResult ?? { data: [{ id: "x" }], error: null });
      const updateChain: any = Object.assign(() => updateResolvable, {
        then: updateResolvable.then.bind(updateResolvable),
        select: vi.fn(() => updateChain),
        eq: vi.fn(() => updateChain),
        is: vi.fn(() => updateChain),
        neq: vi.fn(() => updateChain),
        order: vi.fn(() => updateChain),
        limit: vi.fn(() => updateChain),
        maybeSingle: vi.fn(() => Promise.resolve(updateResult ?? { data: [{ id: "x" }], error: null })),
      });
      return updateChain;
    }),
  });
  return chain;
}

const STORE_ID = "store-1";
const SIG_ID = "sig-active";

describe("loadVisualDirectionState", () => {
  it("sem assinatura ativa → pending=false, active=null, reference=null", async () => {
    mockSupabaseFrom.mockReturnValue(makeChain({ result: { data: null, error: null } }));

    const state = await loadVisualDirectionState(STORE_ID);

    expect(state).toEqual({
      pending: false,
      active_signature_id: null,
      synced_profile_id: null,
      reference: null,
      failure_at: null,
    });
  });

  it("ativa + nenhum perfil synced → pending=true (reference fallback = active.id)", async () => {
    mockSupabaseFrom.mockImplementation((table: string) =>
      table === "store_visual_signatures"
        ? makeChain({ result: { data: { id: SIG_ID, metadata: {} }, error: null } })
        : makeChain({ result: { data: null, error: null } }),
    );

    const state = await loadVisualDirectionState(STORE_ID);

    expect(state.pending).toBe(true);
    expect(state.active_signature_id).toBe(SIG_ID);
    expect(state.reference).toBe(SIG_ID);
  });

  it("ativa + synced com visual_signature_id diferente → pending=true", async () => {
    mockSupabaseFrom.mockImplementation((table: string) =>
      table === "store_visual_signatures"
        ? makeChain({ result: { data: { id: SIG_ID, metadata: {} }, error: null } })
        : makeChain({ result: { data: { id: "profile-1", visual_signature_id: "outra" }, error: null } }),
    );

    const state = await loadVisualDirectionState(STORE_ID);

    expect(state.pending).toBe(true);
    expect(state.synced_profile_id).toBe("profile-1");
  });

  it("ativa + synced com visual_signature_id igual → pending=false", async () => {
    mockSupabaseFrom.mockImplementation((table: string) =>
      table === "store_visual_signatures"
        ? makeChain({ result: { data: { id: SIG_ID, metadata: {} }, error: null } })
        : makeChain({ result: { data: { id: "profile-1", visual_signature_id: SIG_ID }, error: null } }),
    );

    const state = await loadVisualDirectionState(STORE_ID);

    expect(state.pending).toBe(false);
  });

  it("reference/failure_at vêm de metadata quando presentes", async () => {
    mockSupabaseFrom.mockImplementation((table: string) =>
      table === "store_visual_signatures"
        ? makeChain({
            result: {
              data: {
                id: SIG_ID,
                metadata: {
                  brand_profile_failure_reference: "run-abc",
                  brand_profile_failure_at: "2026-10-25T00:00:00.000Z",
                },
              },
              error: null,
            },
          })
        : makeChain({ result: { data: null, error: null } }),
    );

    const state = await loadVisualDirectionState(STORE_ID);

    expect(state.reference).toBe("run-abc");
    expect(state.failure_at).toBe("2026-10-25T00:00:00.000Z");
  });

  it("erro de leitura lança (não vira ausência)", async () => {
    mockSupabaseFrom.mockReturnValue(makeChain({ result: { data: null, error: { message: "boom" } } }));

    await expect(loadVisualDirectionState(STORE_ID)).rejects.toThrow("direction_state_read_failed");
  });
});

describe("markSyncedProfilesOutdatedExceptActive", () => {
  it("com assinatura ativa exclui o perfil dela e inclui legado/outros ids", async () => {
    const updates: any[] = [];
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "store_visual_signatures") {
        return makeChain({ result: { data: [{ id: SIG_ID }], error: null } });
      }
      return makeChain({ result: { data: null, error: null }, updates });
    });

    const result = await markSyncedProfilesOutdatedExceptActive(STORE_ID);

    expect(result).toEqual({ ok: true });
    expect(updates).toHaveLength(2);
    for (const update of updates) {
      expect(update.status).toBe("outdated");
      expect(update.status).not.toBe("synced");
    }
  });

  it("sem assinatura ativa invalida todos os synced", async () => {
    const updates: any[] = [];
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "store_visual_signatures") {
        return makeChain({ result: { data: [], error: null } });
      }
      return makeChain({ result: { data: null, error: null }, updates });
    });

    const result = await markSyncedProfilesOutdatedExceptActive(STORE_ID);

    expect(result).toEqual({ ok: true });
    expect(updates).toHaveLength(1);
    expect(updates[0].status).toBe("outdated");
  });

  it("erro propaga {ok:false,error}", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "store_visual_signatures") {
        return makeChain({ result: { data: [{ id: SIG_ID }], error: null } });
      }
      return makeChain({
        result: { data: null, error: null },
        updateResult: { data: null, error: { message: "db down" } },
      });
    });

    const result = await markSyncedProfilesOutdatedExceptActive(STORE_ID);
    expect(result).toEqual({ ok: false, error: "cleanup_failed" });
  });
});

describe("recordVisualDirectionFailure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("grava metadata preservando demais chaves e condicionado a active", async () => {
    const updates: any[] = [];
    mockSupabaseFrom.mockImplementation((table: string) =>
      makeChain({
        result: {
          data: { metadata: { generation_tier: "image_direct", keep: "me" } },
          error: null,
        },
        updates,
        updateResult: { data: [{ id: SIG_ID }], error: null },
      }),
    );

    const result = await recordVisualDirectionFailure({
      storeId: STORE_ID,
      signatureId: SIG_ID,
      reference: "run-1",
      failureCode: "api_error",
    });

    expect(result).toEqual({ status: "ok" });
    expect(updates).toHaveLength(1);
    expect(updates[0].metadata).toMatchObject({
      generation_tier: "image_direct",
      keep: "me",
      brand_profile_status: "failed",
      brand_profile_failure_reference: "run-1",
      brand_profile_failure_code: "api_error",
    });
    expect(typeof updates[0].metadata.brand_profile_failure_at).toBe("string");
  });

  it("sem linha ativa → superseded", async () => {
    mockSupabaseFrom.mockReturnValue(makeChain({ result: { data: null, error: null } }));

    const result = await recordVisualDirectionFailure({
      storeId: STORE_ID,
      signatureId: SIG_ID,
      reference: "run-1",
      failureCode: "api_error",
    });

    expect(result).toEqual({ status: "superseded" });
  });

  it("update sem linhas → superseded", async () => {
    mockSupabaseFrom.mockReturnValue(
      makeChain({
        result: { data: { metadata: {} }, error: null },
        updateResult: { data: [], error: null },
      }),
    );

    const result = await recordVisualDirectionFailure({
      storeId: STORE_ID,
      signatureId: SIG_ID,
      reference: "run-1",
      failureCode: "api_error",
    });

    expect(result).toEqual({ status: "superseded" });
  });

  it("erro → status error", async () => {
    mockSupabaseFrom.mockReturnValue(
      makeChain({ result: { data: null, error: { message: "boom" } } }),
    );

    const result = await recordVisualDirectionFailure({
      storeId: STORE_ID,
      signatureId: SIG_ID,
      reference: "run-1",
      failureCode: "api_error",
    });

    expect(result).toEqual({ status: "error", error: "reference_failed" });
  });
});

describe("clearVisualDirectionFailure", () => {
  it("grava brand_profile_status synced e zera os três campos", async () => {
    const updates: any[] = [];
    mockSupabaseFrom.mockReturnValue(
      makeChain({
        result: { data: { metadata: { brand_profile_status: "failed" } }, error: null },
        updates,
        updateResult: { data: [{ id: SIG_ID }], error: null },
      }),
    );

    const result = await clearVisualDirectionFailure({ storeId: STORE_ID, signatureId: SIG_ID });

    expect(result).toEqual({ status: "ok" });
    expect(updates[0].metadata).toMatchObject({
      brand_profile_status: "synced",
      brand_profile_failure_reference: null,
      brand_profile_failure_at: null,
      brand_profile_failure_code: null,
    });
  });

  it("sem linha → superseded", async () => {
    mockSupabaseFrom.mockReturnValue(makeChain({ result: { data: null, error: null } }));

    const result = await clearVisualDirectionFailure({ storeId: STORE_ID, signatureId: SIG_ID });
    expect(result).toEqual({ status: "superseded" });
  });
});

describe("isVisualSignatureActive", () => {
  it("true quando existe assinatura active com o id", async () => {
    mockSupabaseFrom.mockReturnValue(makeChain({ result: { data: { id: SIG_ID }, error: null } }));
    await expect(isVisualSignatureActive(STORE_ID, SIG_ID)).resolves.toBe(true);
  });

  it("false quando não existe", async () => {
    mockSupabaseFrom.mockReturnValue(makeChain({ result: { data: null, error: null } }));
    await expect(isVisualSignatureActive(STORE_ID, SIG_ID)).resolves.toBe(false);
  });

  it("erro de leitura → false (fail-closed)", async () => {
    mockSupabaseFrom.mockReturnValue(makeChain({ result: { data: null, error: { message: "boom" } } }));
    await expect(isVisualSignatureActive(STORE_ID, SIG_ID)).resolves.toBe(false);
  });
});

describe("sanitizeDirectionDiagnostic", () => {
  it("remove chaves, Bearer, URLs, colapsa espaços e trunca", () => {
    const input =
      "sk-abc123 Bearer token-xyz https://api.example.com/v1   erro   interno  " + "x".repeat(200);
    const output = sanitizeDirectionDiagnostic(input);

    expect(output).not.toContain("sk-abc123");
    expect(output).not.toContain("token-xyz");
    expect(output).not.toContain("https://api.example.com");
    expect(output).toContain("[redacted]");
    expect(output).toContain("[url]");
    expect(output.length).toBeLessThanOrEqual(160);
    expect(output).not.toMatch(/\s{2,}/);
  });
});
