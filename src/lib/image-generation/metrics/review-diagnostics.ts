import fs from 'node:fs';
import path from 'node:path';

const DIAGNOSTICS_DIR = 'logs';

export interface ReviewDiagnosticEntry {
  timestamp: string;
  runId: string;
  attempt: number;
  reviewPassed: boolean;
  reviewAction: 'initial' | 'correct' | 'regenerate' | 'error' | 'complete' | 'skip_minor';
  severity: 'critical' | 'minor' | 'none';
  failureType: string | null;
  issues: Array<{ type: string; severity: string; description: string }>;
  correctionInstructions: string | null;
  elapsedMs: number;
  provider: string;
  model: string;
  hadLogoAsset: boolean;
  hadBrandProfile: boolean;
  hadProductImage: boolean;
}

export function logReviewDiagnostic(entry: ReviewDiagnosticEntry): void {
  const line = JSON.stringify(entry);

  console.log(`[ReviewDiagnostic] ${line}`);

  if (process.env.NODE_ENV === 'development') {
    try {
      const dir = DIAGNOSTICS_DIR;
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const filePath = path.join(dir, 'image-generation-reviews.jsonl');
      fs.appendFileSync(filePath, line + '\n', 'utf-8');
    } catch (err) {
      console.error(`[ReviewDiagnostic] write error — ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
