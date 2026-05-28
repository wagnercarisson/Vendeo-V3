import fs from "node:fs";
import path from "node:path";

/**
 * PromptLoader reads prompt markdown files from a configured directory,
 * caches them in memory, and interpolates {{variable}} placeholders.
 *
 * Intended for server-side use only (Next.js App Router — available at runtime).
 */
export class PromptLoader {
  private cache: Map<string, string> = new Map();
  private promptsDir: string;

  /**
   * @param promptsDir - Absolute or relative path to the prompts directory.
   *                     Defaults to `<cwd>/prompts`.
   */
  constructor(promptsDir?: string) {
    this.promptsDir = promptsDir ?? path.join(process.cwd(), "prompts");
  }

  /**
   * Load a prompt file by name (without the `.md` extension).
   *
   * @param name      - Prompt file name (e.g. `"campaign-image-director"`).
   * @param variables - Optional key/value map for {{variable}} interpolation.
   * @returns The prompt content as a string.
   */
  load(name: string, variables?: Record<string, string>): string {
    let content = this.cache.get(name);

    if (!content) {
      const filePath = path.join(this.promptsDir, `${name}.md`);
      content = fs.readFileSync(filePath, "utf-8");
      this.cache.set(name, content);
    }

    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
      }
    }

    return content;
  }

  /**
   * Clear the in-memory cache. Useful in tests or when prompt files change at runtime.
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export default PromptLoader;
