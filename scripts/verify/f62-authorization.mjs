#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * F62/62-08 — validador offline das autorizações estruturadas.
 *
 * Não acessa banco, Storage, provider, flags ou segredos. Lê somente arquivos
 * locais e valida valores de um bloco JSON único.
 */

const HEX64 = /^[0-9a-f]{64}$/i;
const HEX_HEAD = /^[0-9a-f]{7,64}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(message) {
  throw new Error(`authorization_invalid:${message}`);
}

function nonEmpty(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`empty_${field}`);
  }
  return value.trim();
}

function positiveInt(value, field) {
  if (!Number.isInteger(value) || value <= 0) fail(`invalid_${field}`);
  return value;
}

function positiveNumber(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    fail(`invalid_${field}`);
  }
  return value;
}

function integer(value, field) {
  if (!Number.isInteger(value) || value < 0) fail(`invalid_${field}`);
  return value;
}

function date(value, field) {
  if (typeof value !== "string") fail(`invalid_${field}`);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) fail(`invalid_${field}`);
  return parsed;
}

function validateDates(payload, nowMs, prefix = "") {
  const approved = date(payload.approved_at, `${prefix}approved_at`);
  const expires = date(payload.expires_at, `${prefix}expires_at`);
  if (approved > nowMs + 5 * 60 * 1000) fail(`${prefix}approved_at_future`);
  if (expires <= nowMs) fail(`${prefix}authorization_expired`);
  if (expires <= approved) fail(`${prefix}expires_before_approval`);
}

function validateEnvironment(environment, prefix = "") {
  if (!environment || typeof environment !== "object") {
    fail(`${prefix}environment_missing`);
  }
  nonEmpty(environment.host, `${prefix}environment.host`);
  const port = positiveInt(environment.port, `${prefix}environment.port`);
  if (port > 65535) fail(`${prefix}environment.port`);
  nonEmpty(environment.database, `${prefix}environment.database`);
  nonEmpty(environment.container, `${prefix}environment.container`);
  return environment;
}

function validateMigrationShape(payload, nowMs) {
  if (!payload || typeof payload !== "object") fail("payload_missing");
  if (payload.kind !== "migration") fail("kind_not_migration");
  if (payload.status !== "authorized") fail("status_not_authorized");
  validateEnvironment(payload.environment);
  nonEmpty(payload.branch, "branch");
  if (!HEX_HEAD.test(payload.head ?? "")) fail("invalid_head");
  if (!payload.migration || typeof payload.migration !== "object") {
    fail("migration_missing");
  }
  nonEmpty(payload.migration.file, "migration.file");
  if (!/^\d{14}$/.test(payload.migration.version ?? "")) {
    fail("invalid_migration_version");
  }
  if (!HEX64.test(payload.migration.sha256 ?? "")) {
    fail("invalid_migration_sha256");
  }
  if (!payload.ledger || typeof payload.ledger !== "object") {
    fail("ledger_missing");
  }
  const before = integer(payload.ledger.before, "ledger.before");
  const after = integer(payload.ledger.expected_after, "ledger.expected_after");
  if (after !== before + 1) fail("ledger_expected_after");
  if (!payload.backup || typeof payload.backup !== "object") {
    fail("backup_missing");
  }
  nonEmpty(payload.backup.file, "backup.file");
  if (!HEX64.test(payload.backup.sha256 ?? "")) fail("invalid_backup_sha256");
  if (
    !Array.isArray(payload.backup.restore_list) ||
    payload.backup.restore_list.length === 0 ||
    payload.backup.restore_list.some(
      (item) => typeof item !== "string" || item.trim().length === 0,
    )
  ) {
    fail("invalid_restore_list");
  }
  nonEmpty(payload.scope, "scope");
  if (!payload.window || typeof payload.window !== "object") {
    fail("window_missing");
  }
  const start = date(payload.window.start, "window.start");
  const end = date(payload.window.end, "window.end");
  if (end <= start) fail("window_order");
  if (nowMs < start || nowMs >= end) fail("window_not_current");
  nonEmpty(payload.approver, "approver");
  validateDates(payload, nowMs);
  nonEmpty(payload.rollback_plan, "rollback_plan");
  return payload;
}

function validateProviderShape(payload, preflight, nowMs) {
  if (!payload || typeof payload !== "object") fail("payload_missing");
  if (payload.kind !== "provider_paid_proof") fail("kind_not_provider");
  if (payload.status !== "authorized") fail("status_not_authorized");
  validateEnvironment(payload.environment);
  nonEmpty(payload.branch, "branch");
  if (!HEX_HEAD.test(payload.head ?? "")) fail("invalid_head");
  if (!payload.migration || typeof payload.migration !== "object") {
    fail("migration_missing");
  }
  if (!HEX64.test(payload.migration.sha256 ?? "")) {
    fail("invalid_migration_sha256");
  }
  positiveInt(payload.max_calls, "max_calls");
  positiveNumber(payload.max_cost_usd, "max_cost_usd");
  if (!UUID.test(payload.campaign_id ?? "")) fail("invalid_campaign_id");
  if (!UUID.test(payload.operation_id ?? "")) fail("invalid_operation_id");
  if (payload.no_retry !== true) fail("no_retry_not_true");
  if (payload.no_fallback !== true) fail("no_fallback_not_true");
  nonEmpty(payload.approver, "approver");
  validateDates(payload, nowMs);
  if (
    !Array.isArray(payload.stop_criteria) ||
    payload.stop_criteria.length === 0 ||
    payload.stop_criteria.some(
      (item) => typeof item !== "string" || item.trim().length === 0,
    )
  ) {
    fail("invalid_stop_criteria");
  }

  if (JSON.stringify(payload.environment) !== JSON.stringify(preflight.environment)) {
    fail("environment_mismatch");
  }
  if (payload.branch !== preflight.branch) fail("branch_mismatch");
  if (payload.head.toLowerCase() !== preflight.head.toLowerCase()) {
    fail("head_mismatch");
  }
  if (
    payload.migration.sha256.toLowerCase() !==
    preflight.migration.sha256.toLowerCase()
  ) {
    fail("migration_sha256_mismatch");
  }
  return payload;
}

export function extractSingleJsonBlock(text) {
  const blocks = [...text.matchAll(/```json\s*([\s\S]*?)```/gi)].map(
    (match) => match[1],
  );
  if (blocks.length !== 1) fail(`json_blocks_${blocks.length}`);
  let parsed;
  try {
    parsed = JSON.parse(blocks[0]);
  } catch {
    fail("json_parse");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail("json_not_object");
  }
  return parsed;
}

export function validateMigrationAuthorization(
  payload,
  expected,
  nowMs = Date.now(),
) {
  validateMigrationShape(payload, nowMs);
  if (!expected || typeof expected !== "object") fail("expected_missing");
  if (payload.branch !== expected.branch) fail("expected_branch_mismatch");
  if (payload.head.toLowerCase() !== String(expected.head ?? "").toLowerCase()) {
    fail("expected_head_mismatch");
  }
  if (
    payload.migration.sha256.toLowerCase() !==
    String(expected.sha256 ?? "").toLowerCase()
  ) {
    fail("expected_sha256_mismatch");
  }
  if (!expected.environment || typeof expected.environment !== "object") {
    fail("expected_environment_missing");
  }
  validateEnvironment(expected.environment, "expected.");
  for (const field of ["host", "port", "database", "container"]) {
    if (payload.environment[field] !== expected.environment[field]) {
      fail(`expected_environment_${field}_mismatch`);
    }
  }
  return payload;
}

export function validateProviderAuthorization(
  payload,
  preflight,
  nowMs = Date.now(),
) {
  validateMigrationShape(preflight, nowMs);
  validateProviderShape(payload, preflight, nowMs);
  return payload;
}

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function requiredArg(name) {
  const value = arg(name);
  if (value === undefined || value.trim() === "") {
    fail(`missing_arg_${name}`);
  }
  return value;
}

function readAuthorization(file) {
  return extractSingleJsonBlock(readFileSync(path.resolve(file), "utf8"));
}

function main() {
  const kind = requiredArg("kind");
  const file = requiredArg("file");
  const payload = readAuthorization(file);
  const now = Date.now();

  if (kind === "migration") {
    const port = Number(requiredArg("expected-port"));
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      fail("invalid_expected_port");
    }
    validateMigrationAuthorization(
      payload,
      {
        branch: requiredArg("expected-branch"),
        head: requiredArg("expected-head"),
        sha256: requiredArg("expected-sha256"),
        environment: {
          host: requiredArg("expected-host"),
          port,
          database: requiredArg("expected-database"),
          container: requiredArg("expected-container"),
        },
      },
      now,
    );
  } else if (kind === "provider") {
    const preflight = readAuthorization(requiredArg("preflight"));
    validateProviderAuthorization(payload, preflight, now);
  } else {
    fail("unknown_kind");
  }

  process.stdout.write(`authorization_ok:${kind}\n`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
