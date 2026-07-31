import { z } from "zod";

export const ChangelogFrontmatterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  milestone: z.string().optional(),
  category: z.enum(["feature", "improvement", "fix"]),
  importance: z.enum(["major", "minor"]),
  announcement: z.enum(["none", "card", "modal"]),
});

export type ChangelogFrontmatter = z.infer<typeof ChangelogFrontmatterSchema>;
