import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { ChangelogEntry } from "./types";
import { parseFrontmatter } from "./parse-frontmatter";
import { ChangelogFrontmatterSchema } from "./schema";

export const CHANGELOG_DIR = path.join(process.cwd(), "content", "changelog");

async function readAllEntries(dir: string = CHANGELOG_DIR): Promise<ChangelogEntry[]> {
  let filenames: string[];
  try {
    filenames = await readdir(dir);
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") {
      return [];
    }
    throw err;
  }

  const mdFiles = filenames
    .filter((name) => name.endsWith(".md"))
    .sort();

  const entries: ChangelogEntry[] = [];
  for (const filename of mdFiles) {
    const raw = await readFile(path.join(dir, filename), "utf-8");
    const { frontmatter, body } = parseFrontmatter(raw);
    const validated = ChangelogFrontmatterSchema.parse(frontmatter);
    entries.push({
      frontmatter: validated,
      body,
      slug: filename.replace(/\.md$/, ""),
    });
  }
  return entries;
}

export async function getAllEntries(dir?: string): Promise<ChangelogEntry[]> {
  const entries = await readAllEntries(dir);
  return entries.sort((a, b) =>
    b.frontmatter.date.localeCompare(a.frontmatter.date),
  );
}

export async function getLatestAnnouncement(
  dir?: string,
): Promise<ChangelogEntry | null> {
  const entries = await getAllEntries(dir);
  return entries.find((e) => e.frontmatter.announcement !== "none") ?? null;
}

export async function getEntryById(
  id: string,
  dir?: string,
): Promise<ChangelogEntry | null> {
  const entries = await getAllEntries(dir);
  return entries.find((e) => e.frontmatter.id === id) ?? null;
}
