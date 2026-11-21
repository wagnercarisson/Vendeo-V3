/**
 * Catálogo es-419 do namespace da campanha pronta — espanhol neutro LATAM.
 *
 * `satisfies CampaignDetailMessages` garante paridade estrutural no typecheck.
 * Chaves e placeholders são idênticos ao pt-BR.
 */

import type { CampaignDetailMessages } from "../messages";
import { es419CampaignFormatMessages } from "@/lib/i18n/campaign-formats/catalogs/es-419";

export const es419CampaignDetailMessages = Object.freeze({
  breadcrumbCampaigns: "Campañas",
  fallbackTitle: "Campaña",
  createdAtLabel: "Creada el",
  publicationKit: "Kit de Publicación",
  editedBadge: "Editado",
  downloadOriginal: "Descargar original",
  disclaimer:
    "Usa solo materiales que tengas autorización para divulgar. Revisa textos, precios e imágenes antes de publicar: la IA puede cometer errores.",
  copy: Object.freeze({
    copy: "Copiar",
    copied: "¡Copiado!",
    ariaPrefix: "Copiar",
    targets: Object.freeze({
      caption: "texto de la publicación",
      hashtags: "hashtags",
      cta: "Llamada",
      title: "título",
    }),
  }),
  formats: es419CampaignFormatMessages,
  jointNotes: Object.freeze({
    invalidRequest:
      "Formato solicitado no válido. Elige uno de los formatos entregados.",
    partialRefunded: "Entrega parcial: se reembolsó un formato.",
    partialUnconfirmed:
      "Entrega parcial: el otro formato aún no se confirmó.",
    partialProcessing:
      "Entrega parcial: el otro formato se está procesando.",
    finalizationPending:
      "Finalización pendiente: se reembolsó un formato y el otro aún se está procesando.",
    refunded: "Operación reembolsada.",
    processing: "Procesando formatos...",
  }),
}) satisfies CampaignDetailMessages;
