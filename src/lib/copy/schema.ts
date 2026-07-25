import { z } from "zod";

export const CopyDirectorInputSchema = z.object({
  productName: z.string().min(1, "productName é obrigatório"),
  description: z.string().optional(),
  commercialFrame: z.string().min(1, "commercialFrame é obrigatório"),
  campaignIntent: z
    .enum(["offer", "spotlight", "exclusive"])
    .optional()
    .default("offer"),
  storeName: z.string().min(1, "storeName é obrigatório"),
  segment: z.string().min(1, "segment é obrigatório"),
  toneOfVoice: z.string().optional(),
  positioning: z.string().optional(),
  shortDescription: z.string().optional(),
  slogan: z.string().optional(),
  brandPersonality: z.string().optional(),
  campaignGuidelines: z.string().optional(),
});

export type CopyDirectorInput = z.infer<typeof CopyDirectorInputSchema>;

export const CopyDirectorResultSchema = z.object({
  title: z.string().min(1, "title é obrigatório"),
  caption: z.string().min(1, "caption é obrigatório"),
  hashtags: z.array(z.string()),
  cta_post: z.string().min(1, "cta_post é obrigatório"),
  toneDescription: z.string().optional(),
});

export type CopyDirectorResult = z.infer<typeof CopyDirectorResultSchema>;
