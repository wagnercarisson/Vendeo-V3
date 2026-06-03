const TEMPLATE_VAR_REGEX = /\{\{[^}]*\}\}/g;

export interface PromptValidationResult {
  valid: boolean;
  unresolvedVariables: string[];
}

export function validatePrompt(prompt: string): PromptValidationResult {
  const matches = prompt.match(TEMPLATE_VAR_REGEX);
  if (!matches) return { valid: true, unresolvedVariables: [] };

  const resolved: string[] = [];

  const unresolved = matches.filter((match) => {
    const inner = match.slice(2, -2).trim();
    if (!inner || inner.length === 0) return false;
    return true;
  });

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const v of unresolved) {
    if (!seen.has(v)) {
      seen.add(v);
      unique.push(v);
    }
  }

  return unique.length > 0
    ? { valid: false, unresolvedVariables: unique }
    : { valid: true, unresolvedVariables: [] };
}
