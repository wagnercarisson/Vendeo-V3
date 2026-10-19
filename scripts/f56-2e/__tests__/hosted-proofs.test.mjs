import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  artifactStoragePath,
  classifyExecutionError,
  classifyObjectResponse,
} from "../hosted-proofs.mjs";

const SOURCE = readFileSync(
  path.resolve(process.cwd(), "scripts/f56-2e/hosted-proofs.mjs"),
  "utf8",
);

test("5.3/5.7 usam o caminho deterministico do novo fluxo", () => {
  assert.equal(
    artifactStoragePath(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
    ),
    "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/product-1-1/33333333-3333-4333-8333-333333333333/art-1024.jpg",
  );
});

test("Storage: 200 e integral", () => {
  assert.deepEqual(classifyObjectResponse(200, null), { kind: "integral" });
});

test("Storage: 404 de OBJETO e absent", () => {
  assert.deepEqual(
    classifyObjectResponse(404, { statusCode: "404", message: "Object not found" }),
    { kind: "absent" },
  );
  assert.deepEqual(
    classifyObjectResponse(400, { statusCode: "404", message: "Object does not exist" }),
    { kind: "absent" },
  );
});

test("Storage: bucket ausente/erro/auth sao indeterminate", () => {
  assert.equal(
    classifyObjectResponse(404, { statusCode: "404", message: "Bucket not found" }).kind,
    "indeterminate",
  );
  assert.equal(classifyObjectResponse(401, null).kind, "indeterminate");
  assert.equal(classifyObjectResponse(500, null).kind, "indeterminate");
});

test("classificacao de erro nao expoe stack", () => {
  assert.equal(classifyExecutionError(new Error("boom")), "boom");
  assert.equal(classifyExecutionError("boom"), "boom");
});

test("harness 5.3 sonda Storage, PF, epoch, replay e estorno unico", () => {
  assert.match(SOURCE, /storageObject\(storagePath\)/);
  assert.match(SOURCE, /observedEpoch/);
  assert.match(SOURCE, /in_progress/);
  assert.match(SOURCE, /outcome = 'failed'/);
  assert.match(SOURCE, /replay/);
  assert.match(SOURCE, /refundAfterReplay/);
});

test("harness 5.7 exige delivered antes do redeploy, hash e duas repeticoes", () => {
  assert.match(SOURCE, /--redeploy-at/);
  assert.match(SOURCE, /delivered ANTES do redeploy/);
  assert.match(SOURCE, /sha256/);
  assert.match(SOURCE, /generation_events/);
  assert.match(SOURCE, /credit_transactions/);
  assert.match(SOURCE, /segundo replay/);
});
