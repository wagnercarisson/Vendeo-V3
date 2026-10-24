/**
 * F47.1 — validação READ-ONLY da linha dedicada usando o registry/tuple puro
 * do runtime. Não importa server-only, não conecta no banco e não chama
 * provider. A linha é passada pelo precheck via JSON sanitizado.
 */
import {
  VISUAL_SIGNATURE_ENVIRONMENT_SCOPE,
  VISUAL_SIGNATURE_IMAGE_PRESETS,
  VISUAL_SIGNATURE_ORCHESTRATORS,
  VisualSignatureConfigError,
  assertVisualSignatureConfigTuple,
} from "../../src/lib/ai/visual-signature-model-config";

type Row = {
  environment_scope?: string;
  instance_identity?: string;
  orchestrator_model?: string;
  image_preset?: string;
  image_model?: string;
  image_quality?: string;
  reasoning_effort?: string;
  config_version_id?: string;
};

function readRow(): Row | null {
  const raw = process.env.VS_ROW_JSON ?? "";
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw) as Row;
  } catch {
    return null;
  }
}

const row = readRow();
const apiIdentity = process.env.VS_API_IDENTITY ?? "";
const expectedOrchestrator = process.env.VS_EXPECTED_ORCHESTRATOR ?? "";
const expectedPreset = process.env.VS_EXPECTED_PRESET ?? "";

const expectedOrchestratorValid =
  expectedOrchestrator === "" ||
  (VISUAL_SIGNATURE_ORCHESTRATORS as readonly string[]).includes(expectedOrchestrator);
const expectedPresetValid =
  expectedPreset === "" ||
  Object.prototype.hasOwnProperty.call(VISUAL_SIGNATURE_IMAGE_PRESETS, expectedPreset);

function emit(value: Record<string, unknown>): never {
  console.log(JSON.stringify(value));
  process.exit(0);
}

if (!expectedOrchestratorValid || !expectedPresetValid) {
  emit({ status: "blocked", reason: "invalid_expected", code: "invalid_expected_tuple" });
}
if (!row) {
  emit({ status: "inherited", reason: "absent" });
}
if (row.environment_scope !== VISUAL_SIGNATURE_ENVIRONMENT_SCOPE) {
  emit({ status: "blocked", reason: "identity", code: "invalid_environment_scope" });
}
if (!apiIdentity || row.instance_identity !== apiIdentity) {
  emit({ status: "blocked", reason: "identity", code: "instance_identity_mismatch" });
}

try {
  assertVisualSignatureConfigTuple({
    orchestratorModel: row.orchestrator_model ?? "",
    imagePreset: row.image_preset ?? "",
    imageModel: row.image_model ?? "",
    imageQuality: row.image_quality ?? "",
    reasoningEffort: row.reasoning_effort ?? "",
  });
} catch (error) {
  emit({
    status: "blocked",
    reason: "tuple",
    code: error instanceof VisualSignatureConfigError ? error.code : "invalid_tuple",
  });
}

if (
  (expectedOrchestrator && row.orchestrator_model !== expectedOrchestrator) ||
  (expectedPreset && row.image_preset !== expectedPreset)
) {
  emit({
    status: "blocked",
    reason: "expected_mismatch",
    actual_orchestrator: row.orchestrator_model,
    actual_preset: row.image_preset,
    expected_orchestrator: expectedOrchestrator || null,
    expected_preset: expectedPreset || null,
  });
}

emit({
  status: "dedicated",
  orchestrator_model: row.orchestrator_model,
  image_preset: row.image_preset,
  image_model: row.image_model,
  image_quality: row.image_quality,
  reasoning_effort: row.reasoning_effort,
  config_version_id: row.config_version_id,
  instance_identity: row.instance_identity,
});
