import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  getAllEntries,
  getLatestAnnouncement,
  getEntryById,
} from "../get-changelog";

const tmpDirs: string[] = [];

async function makeFixtureDir(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "changelog-test-"));
  tmpDirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    await writeFile(path.join(dir, name), content, "utf-8");
  }
  return dir;
}

function makeEntryContent(frontmatter: Record<string, string>, body: string): string {
  const lines = ["---"];
  for (const [key, value] of Object.entries(frontmatter)) {
    lines.push(`${key}: "${value}"`);
  }
  lines.push("---", "", body);
  return lines.join("\n");
}

afterEach(async () => {
  await Promise.all(tmpDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("get-changelog", () => {
  it("getAllEntries lê o diretório real e retorna 3 entries ordenadas por data DESC (F34 → F32 → F30)", async () => {
    const entries = await getAllEntries();

    expect(entries).toHaveLength(3);
    expect(entries[0].frontmatter.id).toBe("fase-34-store-readiness");
    expect(entries[0].frontmatter.date).toBe("2026-08-01");
    expect(entries[1].frontmatter.id).toBe("fase-32-freemium-cnpj");
    expect(entries[1].frontmatter.date).toBe("2026-07-31");
    expect(entries[2].frontmatter.id).toBe("fase-30-legal-foundation");
    expect(entries[2].frontmatter.date).toBe("2026-07-30");

    for (const entry of entries) {
      expect(entry.frontmatter.id).not.toBe("");
      expect(entry.frontmatter.title).not.toBe("");
      expect(entry.slug).toBeTruthy();
      expect(entry.slug.endsWith(".md")).toBe(false);
      expect(entry.body.length).toBeGreaterThan(0);
    }
  });

  it("getLatestAnnouncement retorna a entry com announcement card em fixture", async () => {
    const dir = await makeFixtureDir({
      "2026-07-30-a.md": makeEntryContent(
        { id: "a", title: "A", date: "2026-07-30", category: "fix", importance: "minor", announcement: "none" },
        "## O que mudou\n\n- body a",
      ),
      "2026-07-31-b.md": makeEntryContent(
        { id: "b", title: "B", date: "2026-07-31", category: "feature", importance: "major", announcement: "card" },
        "## O que mudou\n\n- body b",
      ),
    });

    const result = await getLatestAnnouncement(dir);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.id).toBe("b");
  });

  it("getLatestAnnouncement retorna null quando nenhuma entry tem announcement ≠ none", async () => {
    const dir = await makeFixtureDir({
      "2026-07-30-a.md": makeEntryContent(
        { id: "a", title: "A", date: "2026-07-30", category: "fix", importance: "minor", announcement: "none" },
        "## O que mudou\n\n- body a",
      ),
      "2026-07-31-b.md": makeEntryContent(
        { id: "b", title: "B", date: "2026-07-31", category: "feature", importance: "major", announcement: "none" },
        "## O que mudou\n\n- body b",
      ),
    });

    const result = await getLatestAnnouncement(dir);
    expect(result).toBeNull();
  });

  it("getEntryById retorna entry parseada do diretório real", async () => {
    const entry = await getEntryById("fase-30-legal-foundation");

    expect(entry).not.toBeNull();
    expect(entry!.frontmatter.id).toBe("fase-30-legal-foundation");
    expect(entry!.frontmatter.title).toBe("Fundação Legal");
    expect(entry!.frontmatter.date).toBe("2026-07-30");
    expect(entry!.body).toContain("## O que mudou");
    expect(entry!.body.length).toBeGreaterThan(0);
  });

  it("getEntryById retorna null para id inexistente", async () => {
    const entry = await getEntryById("id-inexistente");
    expect(entry).toBeNull();
  });

  it("diretório vazio retorna [] e null sem quebrar", async () => {
    const emptyDir = await mkdtemp(path.join(os.tmpdir(), "changelog-empty-"));
    tmpDirs.push(emptyDir);

    const entries = await getAllEntries(emptyDir);
    expect(entries).toEqual([]);

    const announcement = await getLatestAnnouncement(emptyDir);
    expect(announcement).toBeNull();
  });

  it("frontmatter inválido lança erro (fail fast)", async () => {
    const dir = await makeFixtureDir({
      "2026-07-30-oops.md": makeEntryContent(
        { id: "oops", title: "Oops", date: "2026-07-30", category: "oops", importance: "minor", announcement: "none" },
        "## O que mudou\n\n- body",
      ),
    });

    await expect(getAllEntries(dir)).rejects.toThrow();
  });
});
