/**
 * Provas do guard de dependências produtivas (quick 261121-k4g).
 *
 * Prova POSITIVA: dois snapshots do lockfile real comparam iguais.
 * Provas NEGATIVAS: uma mudança em dependência transitiva, em peer resolvido,
 * em entrada adicionada ou removida faz a comparação falhar (exit 1).
 *
 * Arquivos temporários ficam apenas em `os.tmpdir()`; o teste não escreve no
 * repositório, não instala nada e não acessa rede.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const GUARD = path.join(REPO_ROOT, "scripts/lint/prod-deps-guard.mjs");
const LOCK = path.join(REPO_ROOT, "package-lock.json");

function runGuard(args) {
  return spawnSync(process.execPath, [GUARD, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
}

function makeTempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "k4g-prod-deps-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function snapshotTo(dir, name) {
  const out = path.join(dir, name);
  const result = runGuard(["snapshot", "--lock", LOCK, "--out", out]);
  assert.equal(result.status, 0, `snapshot falhou (${name}): ${result.stderr}${result.stdout}`);
  return out;
}

function readSnapshot(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeSnapshot(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function directDependencyKeys() {
  const lock = JSON.parse(fs.readFileSync(LOCK, "utf8"));
  const rootDependencies = lock.packages[""].dependencies ?? {};
  return new Set(Object.keys(rootDependencies).map((name) => `node_modules/${name}`));
}

function compare(before, after) {
  return runGuard(["compare", "--before", before, "--after", after]);
}

test("positivo: dois snapshots do lockfile real são idênticos", (t) => {
  const dir = makeTempDir(t);
  const first = snapshotTo(dir, "a.json");
  const second = snapshotTo(dir, "b.json");

  const result = compare(first, second);
  assert.equal(result.status, 0, `comparação deveria passar: ${result.stdout}${result.stderr}`);
  assert.match(result.stdout, /árvore produtiva idêntica/);
});

test("universo inclui transitivas e peers resolvidos", (t) => {
  const dir = makeTempDir(t);
  const data = readSnapshot(snapshotTo(dir, "universe.json"));
  const direct = directDependencyKeys();

  assert.ok(
    data.counts.production > direct.size,
    `produção (${data.counts.production}) deveria exceder dependências diretas (${direct.size})`,
  );
  assert.ok(data.counts.peerResolved > 0, "o universo deve incluir peers resolvidos");
  assert.ok(
    Object.keys(data.packages).length === data.counts.production,
    "o snapshot deve conter exatamente as entradas produtivas",
  );
});

test("negativo: alteração em dependência transitiva falha a comparação", (t) => {
  const dir = makeTempDir(t);
  const before = snapshotTo(dir, "before.json");
  const mutated = readSnapshot(before);
  const direct = directDependencyKeys();

  const transitiveKey = Object.keys(mutated.packages)
    .filter((key) => !direct.has(key))
    .sort()
    .find((key) => mutated.packages[key].version !== null);

  assert.ok(transitiveKey, "deveria existir ao menos uma dependência transitiva de produção");

  mutated.packages[transitiveKey].version = "0.0.0-mutated";
  const after = path.join(dir, "after-transitive.json");
  writeSnapshot(after, mutated);

  const result = compare(before, after);
  assert.equal(result.status, 1, "diferença em transitiva deveria falhar");
  assert.ok(result.stdout.includes(transitiveKey), "saída deveria nomear a entrada alterada");
  assert.match(result.stdout, /version/);
});

test("negativo: alteração em peer resolvido (peer: true) falha a comparação", (t) => {
  const dir = makeTempDir(t);
  const before = snapshotTo(dir, "before.json");
  const mutated = readSnapshot(before);

  const peerKey = Object.keys(mutated.packages)
    .sort()
    .find((key) => mutated.packages[key].peer === true);

  assert.ok(peerKey, "deveria existir ao menos um peer resolvido no universo produtivo");

  mutated.packages[peerKey].integrity = "sha512-mutated";
  const after = path.join(dir, "after-peer.json");
  writeSnapshot(after, mutated);

  const result = compare(before, after);
  assert.equal(result.status, 1, "diferença em peer resolvido deveria falhar");
  assert.ok(result.stdout.includes(peerKey), "saída deveria nomear o peer alterado");
  assert.match(result.stdout, /integrity/);
});

test("negativo: entrada produtiva adicionada falha a comparação", (t) => {
  const dir = makeTempDir(t);
  const before = snapshotTo(dir, "before.json");
  const mutated = readSnapshot(before);

  mutated.packages["node_modules/pacote-sintetico"] = {
    version: "0.0.0",
    resolved: "https://example.invalid/pacote-sintetico-0.0.0.tgz",
    integrity: "sha512-synthetic",
    optional: false,
    peer: false,
  };

  const after = path.join(dir, "after-added.json");
  writeSnapshot(after, mutated);

  const result = compare(before, after);
  assert.equal(result.status, 1, "entrada adicionada deveria falhar");
  assert.match(result.stdout, /adicionada/);
  assert.match(result.stdout, /pacote-sintetico/);
});

test("negativo: entrada produtiva removida falha a comparação", (t) => {
  const dir = makeTempDir(t);
  const before = snapshotTo(dir, "before.json");
  const mutated = readSnapshot(before);

  const removableKey = Object.keys(mutated.packages).sort()[0];
  assert.ok(removableKey, "deveria existir ao menos uma entrada para remover");
  delete mutated.packages[removableKey];

  const after = path.join(dir, "after-removed.json");
  writeSnapshot(after, mutated);

  const result = compare(before, after);
  assert.equal(result.status, 1, "entrada removida deveria falhar");
  assert.match(result.stdout, /removida/);
  assert.ok(result.stdout.includes(removableKey), "saída deveria nomear a entrada removida");
});
