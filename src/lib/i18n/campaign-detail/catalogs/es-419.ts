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
  formatAddition: Object.freeze({
    title: "Agregar formato vertical",
    description:
      "Crea una versión vertical de esta campaña sin cambiar el arte cuadrado.",
    action: "Agregar vertical 9:16",
    cost: "Costo: 1 crédito",
    confirm: "Confirmar adición",
    cancel: "Cancelar",
    processing: "Creando el formato vertical...",
    tracking: "Puedes seguir el avance en esta página.",
    retry: "Intentar de nuevo",
    delivered: "Formato vertical listo.",
    refunded: "La adición se deshizo y el crédito se devolvió.",
    unknown:
      "No fue posible confirmar el resultado ahora. Consulta de nuevo en unos instantes.",
    failed:
      "No fue posible crear el formato vertical. El crédito se devolvió.",
    unavailable: "La adición no está disponible en este momento. Inténtalo más tarde.",
    selection: "Elige arriba el formato que quieres ver.",
    incompatible: Object.freeze({
      unsupportedDimensions:
        "El arte original no tiene el tamaño necesario para el formato vertical.",
      unsupportedMime:
        "El archivo original no está en un formato de imagen compatible.",
      artifactInvalid: "No fue posible validar el arte original.",
      pathNotCanonical: "El arte original no corresponde a esta campaña.",
      formatNotSquare:
        "Esta campaña no está disponible para recibir el formato vertical.",
      campaignNotReady:
        "La campaña debe estar lista para recibir el formato vertical.",
      sourceOriginInvalid:
        "El origen de esta campaña no es compatible con el formato vertical.",
    }),
    readUnavailable: Object.freeze({
      artifactAbsent: "No se encontró el arte original.",
      artifactIndeterminate: "No fue posible verificar el arte original.",
      readFailed: "No fue posible consultar la adición ahora.",
      identityConflict: "Los datos de la campaña no coinciden.",
    }),
  }),
}) satisfies CampaignDetailMessages;
