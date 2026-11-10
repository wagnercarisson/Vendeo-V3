// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  applyReconciliation,
  createFixtureManifest,
  markStatus,
  planIdentity,
  writeManifest,
  type FixtureManifest,
} from "./support/fixture-manifest";

const IDENTITY = {
  storeId: "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f",
  campaignId: "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a",
  operationId: "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b",
  role: "square_original",
};
const BUCKET = "campaign-internal-artifacts";
const STORAGE_PATH = `${IDENTITY.storeId}/${IDENTITY.campaignId}/${IDENTITY.operationId}/${IDENTITY.role}.jpg`;

const tempDirs: string[] = [];

function manifestFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "f601-manifest-"));
  tempDirs.push(dir);
  return path.join(dir, "60.1-04-fixtures-test.json");
}

function read(file: string): FixtureManifest {
  return JSON.parse(fs.readFileSync(file, "utf8")) as FixtureManifest;
}

function newManifest(): FixtureManifest {
  return createFixtureManifest({
    runId: "run-test",
    startedAt: "2026-11-10T00:00:00.000Z",
    target: {
      kind: "disposable-local",
      dbPort: "54322",
      apiPort: "54321",
    },
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("fixture manifest", () => {
  it("preserva a identidade planejada quando a escrita cria objeto e falha antes da linha", () => {
    const manifest = newManifest();
    const file = manifestFile();

    planIdentity(manifest, BUCKET, IDENTITY, STORAGE_PATH);
    writeManifest(file, manifest);

    // Simula a chamada que gravou o objeto e falhou antes de inserir a linha.
    applyReconciliation(manifest, BUCKET, IDENTITY, STORAGE_PATH, {
      rowExists: false,
      objectExists: true,
    });
    writeManifest(file, manifest);

    const persisted = read(file);
    expect(persisted.artifacts).toHaveLength(1);
    expect(persisted.artifacts[0]).toMatchObject({
      ...IDENTITY,
      storagePath: STORAGE_PATH,
      status: "planned",
    });
    expect(persisted.objects).toHaveLength(1);
    expect(persisted.objects[0]).toMatchObject({
      bucket: BUCKET,
      path: STORAGE_PATH,
      status: "confirmed",
    });
  });

  it("confirma linha e objeto quando a observação prova existência", () => {
    const manifest = newManifest();
    planIdentity(manifest, BUCKET, IDENTITY, STORAGE_PATH);

    applyReconciliation(manifest, BUCKET, IDENTITY, STORAGE_PATH, {
      rowExists: true,
      objectExists: true,
    });

    expect(manifest.artifacts[0]?.status).toBe("confirmed");
    expect(manifest.objects[0]?.status).toBe("confirmed");
  });

  it("marca indeterminado quando não consegue observar", () => {
    const manifest = newManifest();
    planIdentity(manifest, BUCKET, IDENTITY, STORAGE_PATH);

    applyReconciliation(manifest, BUCKET, IDENTITY, STORAGE_PATH, {
      rowExists: null,
      objectExists: null,
    });

    expect(manifest.artifacts[0]?.status).toBe("indeterminate");
    expect(manifest.objects[0]?.status).toBe("indeterminate");
  });

  it("mantém planejado quando a observação prova ausência", () => {
    const manifest = newManifest();
    planIdentity(manifest, BUCKET, IDENTITY, STORAGE_PATH);

    applyReconciliation(manifest, BUCKET, IDENTITY, STORAGE_PATH, {
      rowExists: false,
      objectExists: false,
    });

    expect(manifest.artifacts[0]?.status).toBe("planned");
    expect(manifest.objects[0]?.status).toBe("planned");
  });

  it("sobrevive à falha da suíte preservando os recursos já registrados", () => {
    const manifest = newManifest();
    const file = manifestFile();
    planIdentity(manifest, BUCKET, IDENTITY, STORAGE_PATH);
    writeManifest(file, manifest);

    markStatus(manifest, "failed", "injected_failure_after_write");
    writeManifest(file, manifest);

    const persisted = read(file);
    expect(persisted.status).toBe("failed");
    expect(persisted.error).toBe("injected_failure_after_write");
    expect(persisted.artifacts[0]).toMatchObject({
      ...IDENTITY,
      status: "planned",
    });
  });
});
