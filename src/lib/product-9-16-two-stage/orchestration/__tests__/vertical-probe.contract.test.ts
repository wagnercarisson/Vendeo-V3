// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { CompositionVerticalProbe } from "../vertical-probe";
import {
  buildNonImageBuffer,
  CAMPAIGN_ID,
  OPERATION_ID,
  STORE_ID,
  createVerticalBackend,
} from "./support/fake-artifact-backend";

const input = {
  storeId: STORE_ID,
  campaignId: CAMPAIGN_ID,
  operationId: OPERATION_ID,
};

describe("CompositionVerticalProbe", () => {
  it("returns integral only with row, integral bytes and verified evidence", async () => {
    const backend = await createVerticalBackend();
    const probe = new CompositionVerticalProbe({ client: backend.client });

    const result = await probe.probeVerticalArtifact(input);
    expect(result).toMatchObject({
      kind: "integral",
      format: "9:16",
      width: 1080,
      height: 1920,
      mimeType: "image/jpeg",
    });
    expect(result.kind === "integral" ? result.evidenceRef : null).toBeTruthy();

    const pending = await probe.probeArtifact(input);
    expect(pending).toMatchObject({
      kind: "integral",
      width: 1080,
      height: 1920,
      mimeType: "image/jpeg",
    });
    expect(backend.handles.signed).toBe(0);
    expect(backend.handles.uploads).toBe(0);
    expect(backend.handles.downloads).toBeGreaterThanOrEqual(1);
  });

  it("queries the row before the object and only the vertical path", async () => {
    const backend = await createVerticalBackend();
    const probe = new CompositionVerticalProbe({ client: backend.client });
    await probe.probeVerticalArtifact(input);

    expect(backend.handles.tables[0]).toBe("campaigns");
    expect(backend.handles.tables).toContain("campaign_composition_artifacts");
    expect(backend.handles.tables).not.toContain("product_1_1_campaign_artifacts");
  });

  it("returns absent when the row is absent", async () => {
    const backend = await createVerticalBackend({ row: false });
    const probe = new CompositionVerticalProbe({ client: backend.client });
    await expect(probe.probeVerticalArtifact(input)).resolves.toEqual({
      kind: "absent",
    });
    await expect(probe.probeArtifact(input)).resolves.toEqual({ kind: "absent" });
  });

  it("returns absent when the row exists but the object is absent", async () => {
    const backend = await createVerticalBackend({ object: "absent" });
    const probe = new CompositionVerticalProbe({ client: backend.client });
    await expect(probe.probeVerticalArtifact(input)).resolves.toEqual({
      kind: "absent",
    });
  });

  it("returns indeterminate on row or storage read failures", async () => {
    const rowFailure = await createVerticalBackend({ readError: true });
    await expect(
      new CompositionVerticalProbe({ client: rowFailure.client }).probeVerticalArtifact(
        input,
      ),
    ).resolves.toEqual({ kind: "indeterminate" });

    const downloadFailure = await createVerticalBackend({ downloadError: true });
    await expect(
      new CompositionVerticalProbe({
        client: downloadFailure.client,
      }).probeVerticalArtifact(input),
    ).resolves.toEqual({ kind: "indeterminate" });

    const infoFailure = await createVerticalBackend({ infoError: true });
    await expect(
      new CompositionVerticalProbe({ client: infoFailure.client }).probeVerticalArtifact(
        input,
      ),
    ).resolves.toEqual({ kind: "indeterminate" });
  });

  it("returns invalid for non-image bytes", async () => {
    const backend = await createVerticalBackend({
      bytes: buildNonImageBuffer(),
    });
    const probe = new CompositionVerticalProbe({ client: backend.client });
    await expect(probe.probeVerticalArtifact(input)).resolves.toEqual({
      kind: "invalid",
    });
  });

  it("returns invalid for divergent row dimensions", async () => {
    const backend = await createVerticalBackend({
      rowOverrides: { width: 1024, height: 1024 },
    });
    const probe = new CompositionVerticalProbe({ client: backend.client });
    await expect(probe.probeVerticalArtifact(input)).resolves.toEqual({
      kind: "invalid",
    });
  });

  it("returns invalid when bytes are integral but the object evidence diverges", async () => {
    const backend = await createVerticalBackend({ metadata: "divergent" });
    const probe = new CompositionVerticalProbe({ client: backend.client });
    await expect(probe.probeVerticalArtifact(input)).resolves.toEqual({
      kind: "invalid",
    });
  });

  it("returns invalid when the object evidence is missing", async () => {
    const backend = await createVerticalBackend({ metadata: "missing" });
    const probe = new CompositionVerticalProbe({ client: backend.client });
    await expect(probe.probeVerticalArtifact(input)).resolves.toEqual({
      kind: "invalid",
    });
  });

  it("never returns integral for a campaign bound to another store", async () => {
    const backend = await createVerticalBackend({
      campaignStoreId: "9a8b7c6d-9a8b-4c6d-8e7f-9a8b7c6d5e4f",
    });
    const probe = new CompositionVerticalProbe({ client: backend.client });
    await expect(probe.probeVerticalArtifact(input)).resolves.toEqual({
      kind: "indeterminate",
    });
    expect(backend.handles.signed).toBe(0);
  });
});
