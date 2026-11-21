/**
 * Catálogo es-419 COMPARTILHADO da apresentação dos formatos — espanhol neutro
 * LATAM.
 *
 * `satisfies CampaignFormatPresentationMessages` garante paridade estrutural no
 * typecheck. Chaves e placeholders são idênticos ao pt-BR.
 */

import type { CampaignFormatPresentationMessages } from "../messages";

export const es419CampaignFormatMessages = Object.freeze({
  groupLabel: "Formatos de la campaña",
  activeLabel: "Seleccionado",
  infoAria: "Ver explicación del formato",
  formats: Object.freeze({
    "1:1": Object.freeze({ name: "Cuadrado 1:1" }),
    "9:16": Object.freeze({ name: "Vertical 9:16" }),
  }),
  labels: Object.freeze({
    delivered: "Disponible",
    processing: "Procesando",
    notRequested: "No incluido",
    notDelivered: "No entregado",
    refunded: "Crédito devuelto",
    unknown: "No fue posible confirmar",
    unavailable: "No disponible",
  }),
  explanations: Object.freeze({
    delivered: "Este formato está disponible en esta campaña.",
    deliveredActive: "Este es el formato que se muestra ahora.",
    processing: "Este formato se está procesando.",
    notRequested: "Esta campaña se creó solo en este formato.",
    notDelivered: "Este formato se solicitó, pero no se entregó.",
    refunded:
      "Este formato no está disponible y el crédito fue devuelto.",
    unknown: "No fue posible confirmar el estado de este formato.",
    unavailable: "La información de este formato no está disponible.",
  }),
}) satisfies CampaignFormatPresentationMessages;
