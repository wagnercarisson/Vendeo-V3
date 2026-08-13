import { z } from "zod";
import {
  CampaignBriefSchemaVersion,
  type CampaignImageRole,
  type CampaignImageSource,
} from "./brief";

// ─── Campaign Brief Domain Schemas (F39) ────────────────────────────────────
// Zod por domínio, `.strict()` como typoguard (rejeita chaves extras), unions via
// `z.enum`, uuid via `z.string().uuid()`. SEM `server-only` (D4 — contrato
// compartilhado cliente/servidor). Invariante: exatamente 1 imagem `primary` (F39-08).

const ProductSourceEnum = z.enum(["manual", "catalog"]);
const CampaignBriefSourceEnum = z.enum(["web_form", "api"]);
const CampaignImageRoleEnum = z.enum(["primary", "variation", "combo_item", "reference"]);
const CampaignImageSourceEnum = z.enum(["upload", "camera"]);
const CampaignIntentEnum = z.enum(["offer", "spotlight", "exclusive"]);

export const productSchema = z
  .object({
    source: ProductSourceEnum.default("manual"),
    catalogProductId: z.string().uuid().optional(),
    name: z.string().min(1),
    brand: z.string().optional(),
    sizeOrVariant: z.string().optional(),
    description: z.string().optional(),
  })
  .strict();

export const commercialSchema = z
  .object({
    intent: CampaignIntentEnum.optional().default("offer"),
    originalPriceCents: z.number().int().nonnegative().optional(),
    discountedPriceCents: z.number().int().positive().optional(),
    badgeText: z.string().optional(),
    validity: z
      .object({
        enabled: z.boolean(),
        displayText: z.string().optional(),
        endDate: z.string().optional(),
      })
      .optional(),
    legalNotice: z
      .object({
        enabled: z.boolean(),
        text: z.string().optional(),
      })
      .optional(),
    availabilityNotes: z.string().optional(),
    campaignDetails: z.string().optional(),
    additionalDetails: z.string().optional(),
    hook: z.string().optional(),
    cta: z.string().optional(),
    objective: z.string().optional(),
    targetChannel: z.string().optional(),
    format: z.string().optional(),
  })
  .strict();

const imageSchema = z
  .object({
    id: z.string().uuid(),
    role: CampaignImageRoleEnum,
    source: CampaignImageSourceEnum,
    mimeType: z.string(),
    dataUrl: z.string().optional(),
  })
  .strict();

export const mediaSchema = z
  .object({
    images: z
      .array(imageSchema)
      .min(1, "Imagem do produto é obrigatória")
      .superRefine((images, ctx) => {
        const primaryCount = images.filter((i) => i.role === "primary").length;
        if (primaryCount !== 1) {
          ctx.addIssue({
            code: "custom",
            path: ["images"],
            message: `Deve existir exatamente 1 imagem com role "primary" (recebido: ${primaryCount})`,
          });
        }
      }),
  })
  .strict();

export const creativeContextSchema = z
  .object({
    preserveImageContext: z.boolean().optional(),
    themeId: z.string().nullable().optional(),
    sensitiveConstraints: z.string().optional(),
  })
  .strict();

export const metadataSchema = z
  .object({
    schemaVersion: z.literal(CampaignBriefSchemaVersion),
    source: CampaignBriefSourceEnum.default("web_form"),
  })
  .strict();

export const campaignBriefSchema = z
  .object({
    product: productSchema,
    commercial: commercialSchema,
    media: mediaSchema,
    creativeContext: creativeContextSchema,
    metadata: metadataSchema,
  })
  .strict();

export type CampaignBrief = z.infer<typeof campaignBriefSchema>;
