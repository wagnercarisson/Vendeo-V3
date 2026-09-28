import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import {
  LAB_ALLOWED_ARTIFACT_MIME_TYPES,
  type LabArtifactMimeType,
} from "@/lib/lab/persistence/artifact-service";
import { persistBenchArtifact } from "@/lib/lab/bench/persistence/bench-artifact-service";
import {
  BenchRunError,
  finalizeBenchRun,
  reserveBenchRun,
} from "@/lib/lab/bench/persistence/bench-run-service";
import {
  LabEnvironmentError,
  assertLabEnvironment,
  labEnvironmentDeniedBody,
} from "@/lib/lab/environment-guard";
import { validateArtifactTechnically } from "@/lib/lab/technical-validation";
import { supabaseAdmin } from "@/lib/supabase/server";

// F48.2.2 (D5/D10/D14/T-48-2-2-47): upload multipart das imagens de entrada.
//
// O `runId` não existe antes do upload; a ordem é resolvida criando o run em
// **`draft`** (idempotente por `operationId`, **sem** ocupar o slot global) e
// devolvendo o `runId` ao cliente, que monta `references` válidas
// (`bench/{runId}/inputs/...`) para `POST /runs`.
//
// Ordem obrigatória: admin → guarda de ambiente → (reserva) → storage. Nenhum
// acesso ao storage ocorre antes dos guards e **nenhum** objeto é gravado fora do
// bucket `lab-artifacts` sob `bench/{runId}/inputs/...` (o bucket remoto de
// imagens de campanha não é lido nem gravado). Em falha de persistência de
// metadados, o objeto é removido (rollback do serviço) **e** o run (draft) é
// finalizado como `failed` (`artifact_persistence_failed`) — sem draft órfão.

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();
  const client = supabaseAdmin;

  try {
    assertLabEnvironment();
  } catch (error) {
    if (error instanceof LabEnvironmentError) {
      return NextResponse.json(labEnvironmentDeniedBody(error.reason), {
        status: 403,
      });
    }
    throw error;
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "invalid_payload", details: ["form-data"] },
      { status: 400 },
    );
  }

  const operationId = form.get("operationId");
  if (typeof operationId !== "string" || !UUID_REGEX.test(operationId)) {
    return NextResponse.json(
      { error: "invalid_payload", details: ["operationId"] },
      { status: 400 },
    );
  }

  const files = form
    .getAll("files")
    .filter((entry): entry is File => typeof entry !== "string");

  if (files.length === 0) {
    return NextResponse.json(
      { error: "invalid_payload", details: ["files"] },
      { status: 400 },
    );
  }

  let reserved: { runId: string; idempotent: boolean };
  try {
    reserved = await reserveBenchRun({
      client,
      operationId,
      createdBy: admin.userId,
    });
  } catch (error) {
    if (error instanceof BenchRunError) {
      if (error.code === "missing_operation_id") {
        return NextResponse.json(
          { error: "invalid_payload", details: ["operationId"] },
          { status: 400 },
        );
      }
      if (error.code === "idempotency_conflict") {
        return NextResponse.json({ error: "idempotency_conflict" }, { status: 409 });
      }
    }
    throw error;
  }

  const runId = reserved.runId;
  const inputs: Array<{
    path: string;
    mimeType: string;
    width: number | null;
    height: number | null;
    bytes: number;
    checksum: string;
  }> = [];

  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const mimeType = file.type;

      if (!(LAB_ALLOWED_ARTIFACT_MIME_TYPES as readonly string[]).includes(mimeType)) {
        throw new Error("unsupported_artifact_mime_type");
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const validation = await validateArtifactTechnically({
        buffer,
        declaredMimeType: mimeType,
      });

      const persisted = await persistBenchArtifact({
        client,
        runId,
        kind: "input",
        buffer,
        mimeType: mimeType as LabArtifactMimeType,
        index,
        width: validation.width,
        height: validation.height,
        finalizeRun: (args) => finalizeBenchRun({ client, ...args }),
      });

      inputs.push({
        path: persisted.storagePath,
        mimeType,
        width: validation.width,
        height: validation.height,
        bytes: persisted.bytes,
        checksum: persisted.checksum,
      });
    }
  } catch {
    // Nenhum draft órfão permanece: finaliza o run (em `draft`) como falha.
    try {
      await finalizeBenchRun({
        client,
        runId,
        status: "failed",
        errorType: "artifact_persistence_failed",
      });
    } catch {
      // Terminal é imutável (o rollback do serviço pode já ter finalizado).
    }
    return NextResponse.json(
      { error: "artifact_persistence_failed" },
      { status: 400 },
    );
  }

  return NextResponse.json({ runId, inputs }, { status: 201 });
});
