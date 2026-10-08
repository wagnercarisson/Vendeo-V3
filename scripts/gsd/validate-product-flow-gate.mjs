#!/usr/bin/env node
// F56.2b1a — Plano 01: validador offline do documento de gate.
//
// Regras:
//  - Nao abre conexao de rede nem de banco. Le apenas o arquivo de gate.
//  - Exige um unico GATE_STATUS e o conjunto completo de criterios CRITERION.
//  - APPROVED so e aceito quando TODOS os criterios obrigatorios sao PASS com fonte e timestamp.
//  - Qualquer caso incompleto, invalido ou contraditorio e rejeitado (exit 1).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const REQUIRED_CRITERIA = [
  "identity",
  "isolation",
  "service_postgres_db",
  "service_gateway_api",
  "service_rest_postgrest",
  "service_auth",
  "intentional_exclusions",
  "execution_outside_sandbox",
  "schema_migrations_f56_2a",
  "flags_off",
  "fixture_baseline_absent",
  "f56_2a_502_anomaly_preserved",
];

const VALID_CRITERION_STATUS = new Set(["PASS", "FAIL", "INCONCLUSIVE"]);
const VALID_GATE_STATUS = new Set(["APPROVED", "NOT_APPROVED"]);

/**
 * Parse the gate document into structured lines.
 * @param {string} text
 */
export function parseGate(text) {
  const lineErrors = [];
  const gateStatuses = [];
  const criteria = new Map();
  const lines = String(text).split(/\r?\n/);

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (line.startsWith("GATE_STATUS|")) {
      const parts = line.split("|");
      gateStatuses.push({ status: (parts[1] || "").trim(), ts: (parts[2] || "").trim(), line: idx + 1 });
    } else if (line.startsWith("CRITERION|")) {
      const parts = line.split("|");
      const key = (parts[1] || "").trim();
      const status = (parts[2] || "").trim();
      const source = (parts[3] || "").trim();
      const ts = (parts[4] || "").trim();
      const note = parts.slice(5).join("|").trim();
      if (!key) {
        lineErrors.push(`linha ${idx + 1}: criterio sem chave`);
        return;
      }
      if (criteria.has(key)) {
        lineErrors.push(`linha ${idx + 1}: criterio duplicado '${key}'`);
        return;
      }
      criteria.set(key, { status, source, ts, note, line: idx + 1 });
    }
  });

  return { gateStatuses, criteria, lineErrors };
}

/**
 * Evaluate a gate document.
 * @param {string} text
 */
export function evaluateGate(text) {
  const errors = [];
  const { gateStatuses, criteria, lineErrors } = parseGate(text);
  errors.push(...lineErrors);

  if (gateStatuses.length !== 1) {
    errors.push(`esperado exatamente um GATE_STATUS, encontrado ${gateStatuses.length}`);
  }
  const gate = gateStatuses[0];
  if (gate) {
    if (!VALID_GATE_STATUS.has(gate.status)) {
      errors.push(`GATE_STATUS invalido '${gate.status}'`);
    }
    if (!gate.ts) {
      errors.push("GATE_STATUS sem timestamp");
    }
  }

  for (const key of REQUIRED_CRITERIA) {
    if (!criteria.has(key)) {
      errors.push(`criterio obrigatorio ausente '${key}'`);
    }
  }

  for (const [key, c] of criteria) {
    if (!VALID_CRITERION_STATUS.has(c.status)) {
      errors.push(`criterio '${key}' com status invalido '${c.status}'`);
    }
    if (!c.source) {
      errors.push(`criterio '${key}' sem fonte`);
    }
    if (!c.ts) {
      errors.push(`criterio '${key}' sem timestamp`);
    }
  }

  const allPass = REQUIRED_CRITERIA.every((key) => criteria.get(key)?.status === "PASS");

  if (gate && gate.status === "APPROVED" && !allPass) {
    errors.push("GATE_STATUS APPROVED exige todos os criterios obrigatorios PASS");
  }
  if (gate && gate.status === "NOT_APPROVED" && allPass) {
    errors.push("GATE_STATUS NOT_APPROVED contradiz criterios todos PASS");
  }

  const ok = errors.length === 0 && gate?.status === "APPROVED";
  return { ok, approved: gate?.status === "APPROVED", allPass, gateStatus: gate?.status ?? null, errors };
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("uso: node scripts/gsd/validate-product-flow-gate.mjs <GATE.md>");
    process.exit(2);
  }
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch (err) {
    console.error(`ERRO: nao foi possivel ler ${file}: ${err.message}`);
    process.exit(2);
  }
  const result = evaluateGate(text);
  if (result.ok) {
    console.log(`GATE ${result.gateStatus}: ${REQUIRED_CRITERIA.length}/${REQUIRED_CRITERIA.length} criterios PASS`);
    console.log("FAIL-STOP: liberado apenas mediante aprovacao humana explicita do checkpoint.");
    process.exit(0);
  }
  console.error(`GATE ${result.gateStatus ?? "AUSENTE"}: NAO APROVADO`);
  for (const e of result.errors) {
    console.error(` - ${e}`);
  }
  process.exit(1);
}

const thisFile = fileURLToPath(import.meta.url);
const invoked = process.argv[1] ? path.resolve(process.argv[1]) === path.resolve(thisFile) : false;
if (invoked) {
  main();
}
