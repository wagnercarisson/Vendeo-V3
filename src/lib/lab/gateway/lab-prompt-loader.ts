import { PromptLoader } from "@/lib/image-generation/prompt-loader";

/**
 * Loader de prompt do Laboratório de IA (F48.1, D6).
 *
 * Estende o `PromptLoader` real e serve o **prompt do snapshot da variante**
 * quando o nome está sob teste; caso contrário delega ao loader de filesystem —
 * mesmo comportamento da produção.
 *
 * Garantia central (T-48-1-34): o override vive **apenas em memória**. Este
 * módulo não escreve nada em disco, portanto `prompts/**` permanece intocado
 * byte a byte.
 */

/** Prompt sob teste vindo do snapshot imutável da variante. */
export interface LabPromptOverride {
  name: string;
  content: string;
}

/** Mesma interpolação de `{{chave}}` do loader real. */
function interpolate(content: string, variables?: Record<string, string>): string {
  if (!variables) return content;
  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

export class LabPromptLoader extends PromptLoader {
  constructor(
    private readonly overrides: LabPromptOverride[],
    promptsDir?: string,
  ) {
    super(promptsDir);
  }

  load(name: string, variables?: Record<string, string>): string {
    const override = this.overrides.find((candidate) => candidate.name === name);
    if (!override) {
      return super.load(name, variables);
    }
    return interpolate(override.content, variables);
  }
}
