import sharp from "sharp";

/**
 * Validação técnica objetiva de artefatos do Laboratório de IA (F48.1, D9).
 *
 * Verifica **apenas fatos objetivos** sobre o buffer gravado: decodificação,
 * MIME real (derivado do formato do arquivo, não do que o provider declarou),
 * dimensões, proporção, bytes, imagem vazia/corrompida e imagem uniforme
 * (branca/preta/vazia).
 *
 * Limite explícito do escopo: **nenhuma nota de qualidade** é produzida — nem de
 * estética, composição, apelo comercial, profissionalismo ou publicabilidade.
 * Nenhum modelo textual é consultado: a decisão de qualidade é humana (D13).
 *
 * Todos os caminhos de falha são convertidos em **alerta** e devolvidos como
 * dado; este módulo não interrompe a execução por buffer ruim (o run segue e
 * registra a evidência). Por isso o módulo é puro, sem `server-only`, e pode ser
 * reutilizado por serviços e testes.
 */

/**
 * Limiar de desvio-padrão (por canal) abaixo do qual a imagem é considerada
 * uniforme. Critério: quando **todos** os canais têm desvio-padrão menor que
 * este valor, não há variação de pixel relevante — a imagem é branca, preta ou
 * vazia (achatada).
 */
export const LAB_UNIFORM_STDDEV_THRESHOLD = 1 as const;

/** Códigos de alerta técnico emitidos por `validateArtifactTechnically`. */
export const LAB_TECHNICAL_ALERTS = [
  "empty_buffer",
  "decode_failed",
  "unexpected_mime_type",
  "mime_mismatch",
  "aspect_ratio_mismatch",
  "uniform_image",
  "stats_unavailable",
] as const;

export type LabTechnicalAlert = (typeof LAB_TECHNICAL_ALERTS)[number];

/**
 * Resultado da validação técnica. `structuredOutputValid` e `ocrAlert` são
 * **campos reservados** e sempre `null` nesta fase: não há capacidade textual no
 * run e o OCR de texto obrigatório está adiado (ponto de extensão).
 */
export interface LabTechnicalValidation {
  decodable: boolean;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  bytes: number;
  aspectRatio: number | null;
  uniform: boolean | null;
  emptyOrCorrupt: boolean;
  alerts: LabTechnicalAlert[];
  structuredOutputValid: null;
  ocrAlert: null;
}

/** Formato real do arquivo → MIME canônico (apenas os aceitos pelo laboratório). */
const FORMAT_TO_MIME_TYPE: Record<string, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/** Tolerância da comparação de proporção (arredondamentos do encoder). */
const ASPECT_RATIO_TOLERANCE = 0.01;

/** Resultado de buffer vazio ou não decodificável — nunca interrompe o fluxo. */
function corruptResult(bytes: number, alert: LabTechnicalAlert): LabTechnicalValidation {
  return {
    decodable: false,
    mimeType: null,
    width: null,
    height: null,
    bytes,
    aspectRatio: null,
    uniform: null,
    emptyOrCorrupt: true,
    alerts: [alert],
    structuredOutputValid: null,
    ocrAlert: null,
  };
}

/**
 * Valida o buffer do artefato de forma objetiva.
 *
 * `declaredMimeType` é o MIME informado pelo provider (comparado ao real, que
 * prevalece) e `expectedAspectRatio` é a proporção esperada da modalidade do
 * cenário (nesta fase, `1` para o formato `1:1`).
 */
export async function validateArtifactTechnically(params: {
  buffer: Buffer;
  declaredMimeType?: string | null;
  expectedAspectRatio?: number;
}): Promise<LabTechnicalValidation> {
  const buffer = params.buffer;
  const bytes = buffer?.byteLength ?? 0;

  if (!buffer || bytes === 0) {
    return corruptResult(0, "empty_buffer");
  }

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    return corruptResult(bytes, "decode_failed");
  }

  const alerts: LabTechnicalAlert[] = [];

  const realMimeType = metadata.format ? FORMAT_TO_MIME_TYPE[metadata.format] ?? null : null;
  if (!realMimeType) {
    alerts.push("unexpected_mime_type");
  } else if (params.declaredMimeType && params.declaredMimeType !== realMimeType) {
    alerts.push("mime_mismatch");
  }

  const width = typeof metadata.width === "number" ? metadata.width : null;
  const height = typeof metadata.height === "number" ? metadata.height : null;
  const aspectRatio = width !== null && height !== null && height > 0 ? width / height : null;

  if (
    aspectRatio !== null &&
    typeof params.expectedAspectRatio === "number" &&
    Math.abs(aspectRatio - params.expectedAspectRatio) > ASPECT_RATIO_TOLERANCE
  ) {
    alerts.push("aspect_ratio_mismatch");
  }

  let uniform: boolean | null = null;
  try {
    const stats = await sharp(buffer).stats();
    uniform =
      stats.channels.length > 0 &&
      stats.channels.every((channel) => channel.stdev < LAB_UNIFORM_STDDEV_THRESHOLD);
    if (uniform) {
      alerts.push("uniform_image");
    }
  } catch {
    uniform = null;
    alerts.push("stats_unavailable");
  }

  const decodable = width !== null && height !== null;

  return {
    decodable,
    mimeType: realMimeType,
    width,
    height,
    bytes,
    aspectRatio,
    uniform,
    emptyOrCorrupt: !decodable,
    alerts,
    structuredOutputValid: null,
    ocrAlert: null,
  };
}
