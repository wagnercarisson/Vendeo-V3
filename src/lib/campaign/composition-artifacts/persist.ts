import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase/server";

import { COMPOSITION_ARTIFACT_BUCKET, compositionArtifactStoragePath } from "./artifact-path";
import {
  decidePersistOutcome,
  type ObjectState,
  type PresentedProvenance,
} from "./conflict-decision";
import {
  buildEvidenceMetadata,
  buildObjectEvidence,
  normalizeProvenance,
  verifyObjectEvidence,
} from "./evidence";
import { checkCampaignStoreBinding, validateArtifactIdentity, validateAuthorizationContext } from "./identity";
import { computeChecksumSha256, verifyCompositionArtifactBytes } from "./integrity";
import {
  getArtifactByIdentity,
  getArtifactByStoragePath,
  insertArtifactRow,
  type InsertArtifactRowInput,
} from "./repository";
import { ROLE_POLICY } from "./role-policy";
import { CompositionArtifactStorage } from "./storage";
import type {
  ArtifactIdentity,
  ArtifactRecord,
  ObjectEvidence,
  PersistArtifactInput,
  PersistArtifactResult,
  SourceOrigin,
} from "./types";

export interface PersistDeps {
  readonly client?: SupabaseClient;
}

interface ComputedArtifact {
  readonly width: number;
  readonly height: number;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly checksumSha256: string;
  readonly provenanceDigest: string;
}

function provenanceSourceOrigin(
  provenance: Record<string, unknown>,
): SourceOrigin | undefined {
  const value = provenance.sourceOrigin;
  return typeof value === "string" ? (value as SourceOrigin) : undefined;
}

function provenanceSourceChecksum(
  provenance: Record<string, unknown>,
): string | undefined {
  const value = provenance.sourceChecksumSha256;
  return typeof value === "string" ? value : undefined;
}

function presentedProvenance(
  input: PersistArtifactInput,
  provenance: Record<string, unknown>,
  evidence: ObjectEvidence,
): PresentedProvenance {
  const sourceArtifactId =
    input.source.kind === "internal_artifact" ? input.source.artifactId : undefined;
  const sourceCampaignId =
    input.source.kind === "delivered_campaign_source"
      ? input.source.descriptor.campaignId
      : undefined;

  return {
    origin: input.origin,
    sourceKind: input.source.kind,
    sourceArtifactId,
    sourceCampaignId,
    sourceOrigin: provenanceSourceOrigin(provenance),
    sourceChecksumSha256: provenanceSourceChecksum(provenance),
    provenance,
    provenanceDigest: evidence.provenanceDigest,
  };
}

async function loadObjectState(
  storage: CompositionArtifactStorage,
  path: string,
  expectedEvidence: ObjectEvidence,
): Promise<ObjectState> {
  const info = await storage.readObjectInfo(path);
  if (info.kind === "absent") return { kind: "absent" };
  if (info.kind === "indeterminate") return { kind: "indeterminate" };

  const download = await storage.downloadBytes(path);
  if (download.kind === "absent") return { kind: "absent" };
  if (download.kind === "indeterminate") return { kind: "indeterminate" };

  return {
    kind: "present",
    checksumSha256: computeChecksumSha256(download.bytes),
    evidence: verifyObjectEvidence(info.metadata, expectedEvidence),
  };
}

function isSameIdentity(
  record: ArtifactRecord,
  identity: ArtifactIdentity,
): boolean {
  return (
    record.storeId === identity.storeId &&
    record.campaignId === identity.campaignId &&
    record.operationId === identity.operationId &&
    record.role === identity.role
  );
}

function invalidInput(reason: string): PersistArtifactResult {
  return Object.freeze({ kind: "invalid_input" as const, reason });
}

function identityConflict(
  reason: "path_bound_to_other_identity" | "store_mismatch" | "not_owner" | "invalid_identity",
  existing: ArtifactRecord | null = null,
): PersistArtifactResult {
  return Object.freeze({
    kind: "identity_conflict" as const,
    existing,
    reason,
  });
}

function persistenceFailure(
  storagePath: string,
  reason: string,
): PersistArtifactResult {
  return Object.freeze({
    kind: "persistence_failure" as const,
    storagePath,
    reason,
  });
}

function toInsertInput(
  input: PersistArtifactInput,
  identity: ArtifactIdentity,
  computed: ComputedArtifact,
  provenance: Record<string, unknown>,
  path: string,
): InsertArtifactRowInput {
  return {
    storeId: identity.storeId,
    campaignId: identity.campaignId,
    operationId: identity.operationId,
    role: identity.role,
    format: ROLE_POLICY[identity.role].format,
    origin: input.origin,
    derivedFromArtifactId:
      input.source.kind === "internal_artifact" ? input.source.artifactId : null,
    sourceCampaignId:
      input.source.kind === "delivered_campaign_source"
        ? input.source.descriptor.campaignId
        : null,
    storageBucket: COMPOSITION_ARTIFACT_BUCKET,
    storagePath: path,
    width: computed.width,
    height: computed.height,
    mimeType: computed.mimeType,
    byteSize: computed.byteSize,
    checksumSha256: computed.checksumSha256,
    provenance,
  };
}

async function classifyAfterConflict(
  input: PersistArtifactInput,
  identity: ArtifactIdentity,
  storage: CompositionArtifactStorage,
  client: SupabaseClient,
  path: string,
  computed: ComputedArtifact,
  presented: PresentedProvenance,
  expectedEvidence: ObjectEvidence,
): Promise<PersistArtifactResult> {
  const row = await getArtifactByIdentity(identity, client);
  if (row.kind === "read_failed") {
    return persistenceFailure(path, row.message);
  }
  const existingRow = row.kind === "found" ? row.record : null;
  if (existingRow !== null && !isSameIdentity(existingRow, identity)) {
    return identityConflict("path_bound_to_other_identity", existingRow);
  }
  const objectState = await loadObjectState(storage, path, expectedEvidence);
  return decidePersistOutcome({
    existingRow,
    objectState,
    computed,
    presented,
  });
}

async function adoptOrReclassify(
  decision: Extract<PersistArtifactResult, { kind: "reused" }>,
  input: PersistArtifactInput,
  identity: ArtifactIdentity,
  storage: CompositionArtifactStorage,
  client: SupabaseClient,
  path: string,
  computed: ComputedArtifact,
  presented: PresentedProvenance,
  expectedEvidence: ObjectEvidence,
): Promise<PersistArtifactResult> {
  const insert = await insertArtifactRow(
    toInsertInput(input, identity, computed, presented.provenance, path),
    client,
  );
  if (insert.kind === "insert_failed") {
    return persistenceFailure(path, insert.message);
  }
  if (insert.kind === "unique_violation") {
    const reclassified = await classifyAfterConflict(
      input,
      identity,
      storage,
      client,
      path,
      computed,
      presented,
      expectedEvidence,
    );
    if (reclassified.kind === "reused" && reclassified.adoption) {
      return persistenceFailure(path, "adoption_row_missing_after_unique_violation");
    }
    return reclassified;
  }
  return decision;
}

/**
 * Persiste um artefato de composição de forma idempotente. Não sobrescreve,
 * não apaga, não cria URL e não toca crédito/campanha.
 */
export async function persistCompositionArtifact(
  input: PersistArtifactInput,
  deps: PersistDeps = {},
): Promise<PersistArtifactResult> {
  const client = deps.client ?? supabaseAdmin;
  const storage = new CompositionArtifactStorage(client);

  // (1) Identidade e autorização antes de qualquer I/O.
  const identityResult = validateArtifactIdentity(input.identity);
  if (!identityResult.ok) {
    return invalidInput(identityResult.reason);
  }
  const authorizationResult = validateAuthorizationContext(input.authorization);
  if (!authorizationResult.ok) {
    return invalidInput(authorizationResult.reason);
  }

  const identity = identityResult.identity;
  const authorization = authorizationResult.authorization;

  // (2) Vínculo loja↔campanha e propriedade para owner.
  const campaignResult = await client
    .from("campaigns")
    .select("store_id")
    .eq("id", identity.campaignId)
    .maybeSingle();
  if (campaignResult.error || !campaignResult.data) {
    return identityConflict("invalid_identity");
  }
  const campaignStoreId = (campaignResult.data as { store_id?: unknown }).store_id;
  const binding = checkCampaignStoreBinding(campaignStoreId, identity.storeId);
  if (!binding.ok) {
    return identityConflict("store_mismatch");
  }

  if (authorization.kind === "owner") {
    const storeResult = await client
      .from("stores")
      .select("user_id")
      .eq("id", identity.storeId)
      .maybeSingle();
    if (storeResult.error || !storeResult.data) {
      return identityConflict("not_owner");
    }
    const ownerId = (storeResult.data as { user_id?: unknown }).user_id;
    if (ownerId !== authorization.userId) {
      return identityConflict("not_owner");
    }
  }

  // (3) Conteúdo e metadados reais.
  const integrity = await verifyCompositionArtifactBytes(input.bytes, identity.role);
  if (!integrity.ok) {
    return Object.freeze({
      kind: "integrity_failure" as const,
      reason: integrity.reason,
    });
  }

  // (4) Evidência/proveniência. Fonte não-none é habilitada no plano 03.
  if (input.source.kind !== "none") {
    return invalidInput("source_required");
  }
  const normalized = normalizeProvenance(input.provenance ?? {});
  if (!normalized.ok) {
    return invalidInput(normalized.reason);
  }
  const provenance = normalized.provenance as Record<string, unknown>;

  const evidenceResult = buildObjectEvidence({
    storeId: identity.storeId,
    campaignId: identity.campaignId,
    operationId: identity.operationId,
    role: identity.role,
    origin: input.origin,
    sourceKind: input.source.kind,
    width: integrity.width,
    height: integrity.height,
    mimeType: integrity.mimeType,
    byteSize: integrity.byteSize,
    checksumSha256: integrity.checksumSha256,
    provenance,
  });
  if (!evidenceResult.ok) {
    return invalidInput(evidenceResult.reason);
  }
  const evidence = evidenceResult.evidence;

  const computed: ComputedArtifact = {
    width: integrity.width,
    height: integrity.height,
    mimeType: integrity.mimeType,
    byteSize: integrity.byteSize,
    checksumSha256: integrity.checksumSha256,
    provenanceDigest: evidence.provenanceDigest,
  };
  const presented = presentedProvenance(input, provenance, evidence);
  const path = compositionArtifactStoragePath(identity);

  // (5) Estado atual da linha e do objeto.
  const rowResult = await getArtifactByIdentity(identity, client);
  if (rowResult.kind === "read_failed") {
    return persistenceFailure(path, rowResult.message);
  }
  const existingRow = rowResult.kind === "found" ? rowResult.record : null;
  if (existingRow !== null) {
    if (
      existingRow.storagePath !== path ||
      existingRow.storageBucket !== COMPOSITION_ARTIFACT_BUCKET
    ) {
      return identityConflict("path_bound_to_other_identity", existingRow);
    }
  }

  const objectState = await loadObjectState(storage, path, evidence);
  let decision = decidePersistOutcome({
    existingRow,
    objectState,
    computed,
    presented,
  });

  if (decision.kind === "reused" && !decision.adoption) {
    return decision;
  }
  if (decision.kind !== "created" && !(decision.kind === "reused" && decision.adoption)) {
    return decision;
  }

  // (6) Um path já vinculado a outra identidade nunca é sobrescrito.
  const byPath = await getArtifactByStoragePath(path, client);
  if (byPath.kind === "read_failed") {
    return persistenceFailure(path, byPath.message);
  }
  if (byPath.kind === "found" && !isSameIdentity(byPath.record, identity)) {
    return identityConflict("path_bound_to_other_identity", byPath.record);
  }

  // (6b) Adoção de órfão íntegro: a linha precisa ser criada agora.
  if (decision.kind === "reused" && decision.adoption) {
    return adoptOrReclassify(
      decision,
      input,
      identity,
      storage,
      client,
      path,
      computed,
      presented,
      evidence,
    );
  }

  // (7) Upload imutável com evidência.
  const upload = await storage.uploadImmutable(
    path,
    input.bytes,
    buildEvidenceMetadata(evidence),
  );
  if (upload.kind === "upload_failed") {
    return persistenceFailure(path, upload.message);
  }
  if (upload.kind === "path_conflict") {
    const conflictDecision = await classifyAfterConflict(
      input,
      identity,
      storage,
      client,
      path,
      computed,
      presented,
      evidence,
    );
    if (conflictDecision.kind === "reused" && conflictDecision.adoption) {
      return adoptOrReclassify(
        conflictDecision,
        input,
        identity,
        storage,
        client,
        path,
        computed,
        presented,
        evidence,
      );
    }
    return conflictDecision;
  }

  // (8) A evidência precisa sobreviver ao upload antes do insert.
  const info = await storage.readObjectInfo(path);
  if (info.kind !== "found") {
    return persistenceFailure(path, "evidence_info_unavailable");
  }
  const evidenceCheck = verifyObjectEvidence(info.metadata, evidence);
  if (!evidenceCheck.ok) {
    return persistenceFailure(path, evidenceCheck.reason);
  }

  // (9) Insert imutável da linha.
  const insert = await insertArtifactRow(
    toInsertInput(input, identity, computed, provenance, path),
    client,
  );

  if (insert.kind === "insert_failed") {
    return persistenceFailure(path, insert.message);
  }
  if (insert.kind === "unique_violation") {
    const reclassified = await classifyAfterConflict(
      input,
      identity,
      storage,
      client,
      path,
      computed,
      presented,
      evidence,
    );
    if (reclassified.kind === "reused" && reclassified.adoption) {
      return adoptOrReclassify(
        reclassified,
        input,
        identity,
        storage,
        client,
        path,
        computed,
        presented,
        evidence,
      );
    }
    return reclassified;
  }

  return Object.freeze({ kind: "created" as const });
}
