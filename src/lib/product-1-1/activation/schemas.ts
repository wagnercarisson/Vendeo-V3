import { z } from "zod";

export const PRODUCT_ACTIVATION_MODES = ["off", "test_stores", "all_stores"] as const;
export type ProductActivationMode = (typeof PRODUCT_ACTIVATION_MODES)[number];

/**
 * Corpo da acao administrativa de ativacao do Produto 1:1.
 *
 * `.strict()` rejeita campos desconhecidos. `confirm` e um campo DECLARADO e
 * obrigatorio apenas para `all_stores`; a UI envia exatamente `ALL_STORES`.
 */
export const ProductActivationRequestSchema = z
  .object({
    mode: z.enum(PRODUCT_ACTIVATION_MODES),
    reason: z.string().trim().min(1).max(500),
    operationId: z.string().uuid(),
    confirm: z.literal("ALL_STORES").optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.mode === "all_stores" && value.confirm !== "ALL_STORES") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirm"],
        message: 'confirm deve ser "ALL_STORES" para o modo all_stores',
      });
    }
    if (value.mode !== "all_stores" && value.confirm !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirm"],
        message: 'confirm so e aceito no modo all_stores',
      });
    }
  });

export type ProductActivationRequest = z.infer<typeof ProductActivationRequestSchema>;
