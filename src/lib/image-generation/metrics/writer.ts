/**
 * MetricsWriter — best-effort JSONL metrics recording.
 *
 * Writes generation metrics to a JSONL file in the metrics directory.
 * In production, filesystem writes are skipped by default (stdout only
 * when METRICS_ENABLED=true).
 *
 * NEVER throws or rejects — all errors are caught and logged.
 * DOES NOT block generation — metrics are best-effort.
 */

import fs from "node:fs";
import path from "node:path";
import type { GenerationMetrics } from "@/lib/image-generation/metrics/types";

export class MetricsWriter {
  private readonly metricsDir: string;

  constructor(metricsDir: string = "metrics") {
    this.metricsDir = metricsDir;
  }

  /**
   * Append a GenerationMetrics object as a JSON line to the metrics file.
   * Best-effort: wraps everything in try/catch, never throws.
   */
  async write(metrics: GenerationMetrics): Promise<void> {
    try {
      // In production, skip filesystem by default
      if (process.env.NODE_ENV === "production") {
        if (process.env.METRICS_ENABLED !== "true") {
          return; // silent no-op
        }
        // Write to stdout instead of file
        console.log(JSON.stringify(metrics));
        return;
      }

      // Ensure metrics directory exists
      try {
        await fs.promises.mkdir(this.metricsDir, { recursive: true });
      } catch {
        // directory already exists or cannot be created — continue
      }

      const filename = `generation-${new Date().toISOString().slice(0, 10)}.jsonl`;
      const filePath = path.join(this.metricsDir, filename);
      const line = JSON.stringify(metrics) + "\n";

      await fs.promises.appendFile(filePath, line, "utf-8");
    } catch (err) {
      // Fallback: log structured JSON via console
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[MetricsWriter] erro ao escrever métricas: ${errorMessage}`);
      console.log(JSON.stringify(metrics));
    }
  }
}
