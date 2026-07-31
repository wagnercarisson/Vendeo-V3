export type ChangelogCategory = "feature" | "improvement" | "fix";
export type ChangelogImportance = "major" | "minor";

export interface ChangelogFrontmatter {
  id: string;
  title: string;
  date: string; // ISO YYYY-MM-DD (data civil, fuso brasileiro)
  milestone?: string;
  category: ChangelogCategory;
  importance: ChangelogImportance;
  announcement: "none" | "card" | "modal";
}

export interface ChangelogEntry {
  frontmatter: ChangelogFrontmatter;
  body: string; // markdown sem frontmatter
  slug: string; // derivado do filename
}
