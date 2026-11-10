/**
 * F60.1 — manifesto durável de fixtures.
 *
 * Módulo puro (sem Supabase/Storage) para permitir teste offline e para separar
 * "planejado" (intenção) de "confirmado" (existência provada) e
 * "indeterminado" (não foi possível observar).
 */
import fs from "node:fs";
import path from "node:path";

export type ResourceStatus = "planned" | "confirmed" | "indeterminate";
export type ManifestStatus =
  | "in_progress"
  | "completed"
  | "incomplete"
  | "failed";

export interface ManifestIdentity {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly role: string;
}

export interface ManifestArtifact extends ManifestIdentity {
  id?: string;
  storagePath: string;
  status: ResourceStatus;
}

export interface ManifestObject {
  bucket: string;
  path: string;
  status: ResourceStatus;
}

export interface FixtureManifest {
  runId: string;
  startedAt: string;
  target: {
    kind: string;
    dbPort: string;
    apiPort: string;
  };
  status: ManifestStatus;
  error?: string;
  referenceBaselineSha256?: string;
  users: Array<{ id: string; created: boolean }>;
  stores: Array<{ id: string; created: boolean }>;
  campaigns: Array<{
    id: string;
    kind: string;
    storagePath: string;
  }>;
  artifacts: ManifestArtifact[];
  objects: ManifestObject[];
  completedAt?: string;
}

export interface ReconciliationObservation {
  readonly rowExists: boolean | null;
  readonly objectExists: boolean | null;
}

export function createFixtureManifest(input: {
  runId: string;
  startedAt?: string;
  target: { kind: string; dbPort: string; apiPort: string };
}): FixtureManifest {
  return {
    runId: input.runId,
    startedAt: input.startedAt ?? new Date().toISOString(),
    target: input.target,
    status: "in_progress",
    users: [],
    stores: [],
    campaigns: [],
    artifacts: [],
    objects: [],
  };
}

function sameArtifact(
  left: ManifestArtifact,
  right: ManifestIdentity,
): boolean {
  return (
    left.storeId === right.storeId &&
    left.campaignId === right.campaignId &&
    left.operationId === right.operationId &&
    left.role === right.role
  );
}

export function upsertArtifact(
  manifest: FixtureManifest,
  entry: ManifestIdentity & { id?: string; storagePath: string },
  status: ResourceStatus,
): void {
  const existing = manifest.artifacts.find((current) =>
    sameArtifact(current, entry),
  );
  if (existing) {
    existing.status = status;
    existing.storagePath = entry.storagePath;
    if (entry.id !== undefined) existing.id = entry.id;
    return;
  }
  manifest.artifacts.push({ ...entry, status });
}

export function upsertObject(
  manifest: FixtureManifest,
  bucket: string,
  objectPath: string,
  status: ResourceStatus,
): void {
  const existing = manifest.objects.find(
    (current) => current.bucket === bucket && current.path === objectPath,
  );
  if (existing) {
    existing.status = status;
    return;
  }
  manifest.objects.push({ bucket, path: objectPath, status });
}

/** Registra a identidade/path ANTES da chamada que pode escrever. */
export function planIdentity(
  manifest: FixtureManifest,
  bucket: string,
  identity: ManifestIdentity,
  storagePath: string,
): void {
  upsertArtifact(manifest, { ...identity, storagePath }, "planned");
  upsertObject(manifest, bucket, storagePath, "planned");
}

/**
 * Reconcilia a observação real com o planejado. Cada recurso é classificado
 * independentemente: existência provada = confirmed; ausência provada =
 * planned (não criado); observação falhou/ambígua = indeterminate.
 */
export function applyReconciliation(
  manifest: FixtureManifest,
  bucket: string,
  identity: ManifestIdentity,
  storagePath: string,
  observation: ReconciliationObservation,
): void {
  const artifactStatus: ResourceStatus =
    observation.rowExists === true
      ? "confirmed"
      : observation.rowExists === false
        ? "planned"
        : "indeterminate";
  const objectStatus: ResourceStatus =
    observation.objectExists === true
      ? "confirmed"
      : observation.objectExists === false
        ? "planned"
        : "indeterminate";

  upsertArtifact(
    manifest,
    { ...identity, storagePath },
    artifactStatus,
  );
  upsertObject(manifest, bucket, storagePath, objectStatus);
}

export function markStatus(
  manifest: FixtureManifest,
  status: ManifestStatus,
  error?: string,
): void {
  manifest.status = status;
  if (error !== undefined) manifest.error = error;
  if (status === "completed") manifest.completedAt = new Date().toISOString();
}

export function writeManifest(
  filePath: string,
  manifest: FixtureManifest,
): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
}
