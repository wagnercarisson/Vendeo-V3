// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Inventário global de cobertura de telemetria (F46-06, F46-31, D9).
 *
 * Verifica que todo caller produtivo das capacidades de IA migradas fornece um
 * `AiTelemetryContext`/sink (o sink é o único persistidor) e que nenhum resolve
 * custo manualmente. Cobre explicitamente os callers convertidos na F46 —
 * inclusive os antecipados ao 46-04.
 */

const KNOWN_CALLERS: Array<{ file: string; label: string }> = [
  { file: "src/app/api/campaign/generate-image/route.ts", label: "generate-image" },
  { file: "src/app/api/campaign/generate/route.ts", label: "campaign/generate" },
  { file: "src/app/api/campaign/[id]/problem-report/route.ts", label: "problem-report" },
  { file: "src/app/api/store/[id]/brand-profile/infer/route.ts", label: "brand-profile/infer" },
  { file: "src/app/api/store/[id]/brand-profile/realign/route.ts", label: "brand-profile/realign" },
  {
    file: "src/app/api/store/[id]/brand-profile/generate-without-logo/route.ts",
    label: "brand-profile/generate-without-logo",
  },
  { file: "src/app/api/store/[id]/logo/route.ts", label: "logo" },
  {
    file: "src/app/api/store/[id]/logo/retry-brand-director/route.ts",
    label: "logo/retry-brand-director",
  },
  { file: "src/app/api/store/[id]/visual-signature/approve/route.ts", label: "vs/approve" },
  { file: "src/app/api/store/[id]/visual-signature/restore/route.ts", label: "vs/restore" },
  {
    file: "src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts",
    label: "vs/generate-without-logo",
  },
  { file: "src/lib/visual-signature/server-actions.ts", label: "server-actions" },
  { file: "src/lib/visual-signature/identity-art-director.ts", label: "identity-art-director" },
  { file: "src/lib/campaign/correction-reports.ts", label: "correction-reports" },
];

const TELEMETRY_MARKERS = [
  "AiTelemetryContext",
  "createDefaultTelemetryContext",
  "BufferingAiTelemetrySink",
  "telemetry",
];

/** Serviços de IA migrados — instanciados por rotas produtivas. */
const AI_SERVICE_INSTANTIATIONS = [
  "new CopyDirectorService(",
  "new CorrectionIntentService(",
  "new BrandTextOnlyInferenceService(",
  "new InputValidationService(",
  "new ImageReviewService(",
  "new BrandDirectorService(",
  "new BrandProfilerWithoutLogoService(",
  "new AiImageGenerator(",
  "new ImageGenerationService(",
  "new StoreIdentityArtDirectorService(",
];

function normalize(p: string): string {
  return p.split(path.sep).join("/");
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function readCode(file: string): string {
  return stripComments(readFileSync(path.resolve(process.cwd(), file), "utf8"));
}

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const rel = normalize(path.relative(process.cwd(), full));
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      out.push(...collectFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\./.test(entry)) {
      out.push(rel);
    }
  }
  return out;
}

function hasTelemetryMarker(code: string): boolean {
  return TELEMETRY_MARKERS.some((marker) => code.includes(marker));
}

describe("telemetry-coverage — inventário global (F46-06)", () => {
  it("todo caller conhecido existe e fornece AiTelemetryContext/sink", () => {
    const missing: string[] = [];
    const withoutTelemetry: string[] = [];
    for (const { file, label } of KNOWN_CALLERS) {
      const abs = path.resolve(process.cwd(), file);
      if (!existsSync(abs)) {
        missing.push(`${label} (${file})`);
        continue;
      }
      if (!hasTelemetryMarker(readCode(file))) withoutTelemetry.push(`${label} (${file})`);
    }
    expect(missing).toEqual([]);
    expect(withoutTelemetry).toEqual([]);
  });

  it("nenhum caller conhecido resolve custo manualmente (resolveAiCost)", () => {
    const violations: string[] = [];
    for (const { file, label } of KNOWN_CALLERS) {
      if (/resolveAiCost\s*\(/.test(readCode(file))) violations.push(`${label} (${file})`);
    }
    expect(violations).toEqual([]);
  });

  it("toda rota produtiva (src/app) que instancia serviço de IA fornece telemetria", () => {
    const appFiles = collectFiles(path.resolve(process.cwd(), "src/app"));
    const violations: string[] = [];
    for (const file of appFiles) {
      const code = readCode(file);
      const instantiates = AI_SERVICE_INSTANTIATIONS.some((needle) => code.includes(needle));
      if (instantiates && !hasTelemetryMarker(code)) violations.push(file);
    }
    expect(violations).toEqual([]);
  });
});
