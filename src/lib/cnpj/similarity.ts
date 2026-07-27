import type { CnpjValidationScore } from "./types";

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return dp[m][n];
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

export function compareBusinessName(
  name: string,
  razaoSocial: string,
  nomeFantasia?: string
): CnpjValidationScore {
  const normalizedName = name.toLowerCase();
  const normalizedRazao = razaoSocial.toLowerCase();

  const nameToLegal = similarity(normalizedName, normalizedRazao);
  let nameToFantasy: number | null = null;

  if (nomeFantasia) {
    nameToFantasy = similarity(normalizedName, nomeFantasia.toLowerCase());
  }

  const scores = [nameToLegal];
  if (nameToFantasy !== null) scores.push(nameToFantasy);
  const bestScore = Math.max(...scores);

  let label: "match" | "mismatch" | "partial";
  if (bestScore >= 0.8) {
    label = "match";
  } else if (bestScore >= 0.4) {
    label = "partial";
  } else {
    label = "mismatch";
  }

  return { nameToLegal, nameToFantasy, bestScore, label };
}
