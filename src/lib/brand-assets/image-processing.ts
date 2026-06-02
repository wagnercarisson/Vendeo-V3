import sharp from 'sharp';
import crypto from 'node:crypto';
import type { VariantGenerationResult, BrandAssetVariantType } from './types';

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 200;

const ON_DARK_BACKGROUND = '#1A1A2E';
const ON_LIGHT_BACKGROUND = '#FFFFFF';
const NORMALIZED_CANVAS_SIZE = 500;
const HORIZONTAL_CANVAS_WIDTH = 800;
const HORIZONTAL_CANVAS_HEIGHT = 300;

export async function validateImage(buffer: Buffer): Promise<{ valid: boolean; error?: string; mimeType?: string }> {
  try {
    const metadata = await sharp(buffer).metadata();
    const format = metadata.format;

    if (!format) {
      return { valid: false, error: 'Não foi possível identificar o formato da imagem.' };
    }

    const mimeMap: Record<string, string> = {
      png: 'image/png',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
    };

    const mimeType = mimeMap[format];

    if (!mimeType) {
      return { valid: false, error: 'Formatos aceitos: PNG, JPG ou WEBP.' };
    }

    if (buffer.length > MAX_FILE_SIZE) {
      return { valid: false, error: 'Arquivo muito grande. Máximo 5MB.' };
    }

    return { valid: true, mimeType };
  } catch {
    return { valid: false, error: 'Arquivo de imagem inválido ou corrompido.' };
  }
}

export async function getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
  const metadata = await sharp(buffer).metadata();
  return { width: metadata.width ?? 0, height: metadata.height ?? 0 };
}

export function checkMinimumDimensions(width: number, height: number): { valid: boolean; error?: string } {
  if (width < MIN_WIDTH || height < MIN_HEIGHT) {
    return { valid: false, error: `A imagem deve ter no mínimo ${MIN_WIDTH}x${MIN_HEIGHT} pixels.` };
  }
  return { valid: true };
}

export function computeChecksum(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function generateVariant(
  variantType: BrandAssetVariantType,
  buffer: Buffer
): Promise<VariantGenerationResult> {
  try {
    const normalized = await sharp(buffer)
      .resize(NORMALIZED_CANVAS_SIZE, NORMALIZED_CANVAS_SIZE, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();

    let result: Buffer;
    let width: number;
    let height: number;

    switch (variantType) {
      case 'normalized': {
        result = normalized;
        const meta = await sharp(normalized).metadata();
        width = meta.width ?? NORMALIZED_CANVAS_SIZE;
        height = meta.height ?? NORMALIZED_CANVAS_SIZE;
        break;
      }
      case 'on_light': {
        result = await sharp(normalized)
          .flatten({ background: ON_LIGHT_BACKGROUND })
          .png()
          .toBuffer();
        const meta = await sharp(result).metadata();
        width = meta.width ?? NORMALIZED_CANVAS_SIZE;
        height = meta.height ?? NORMALIZED_CANVAS_SIZE;
        break;
      }
      case 'on_dark': {
        result = await sharp(normalized)
          .flatten({ background: ON_DARK_BACKGROUND })
          .png()
          .toBuffer();
        const meta = await sharp(result).metadata();
        width = meta.width ?? NORMALIZED_CANVAS_SIZE;
        height = meta.height ?? NORMALIZED_CANVAS_SIZE;
        break;
      }
      case 'square_safe': {
        result = await sharp(normalized)
          .resize(NORMALIZED_CANVAS_SIZE, NORMALIZED_CANVAS_SIZE, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toBuffer();
        const meta = await sharp(result).metadata();
        width = meta.width ?? NORMALIZED_CANVAS_SIZE;
        height = meta.height ?? NORMALIZED_CANVAS_SIZE;
        break;
      }
      case 'horizontal_safe': {
        result = await sharp(normalized)
          .resize(HORIZONTAL_CANVAS_WIDTH, HORIZONTAL_CANVAS_HEIGHT, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toBuffer();
        const meta = await sharp(result).metadata();
        width = meta.width ?? HORIZONTAL_CANVAS_WIDTH;
        height = meta.height ?? HORIZONTAL_CANVAS_HEIGHT;
        break;
      }
      default:
        throw new Error(`Unknown variant type: ${variantType}`);
    }

    return {
      variant_type: variantType,
      buffer: result,
      width,
      height,
      size_bytes: result.length,
      success: true,
    };
  } catch (err) {
    return {
      variant_type: variantType,
      buffer: Buffer.alloc(0),
      width: 0,
      height: 0,
      size_bytes: 0,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function generateNormalized(buffer: Buffer): Promise<{ buffer: Buffer; width: number; height: number; size_bytes: number }> {
  const result = await generateVariant('normalized', buffer);
  return { buffer: result.buffer, width: result.width, height: result.height, size_bytes: result.size_bytes };
}

export async function generateOnLight(buffer: Buffer): Promise<{ buffer: Buffer; width: number; height: number; size_bytes: number }> {
  const result = await generateVariant('on_light', buffer);
  return { buffer: result.buffer, width: result.width, height: result.height, size_bytes: result.size_bytes };
}

export async function generateOnDark(buffer: Buffer): Promise<{ buffer: Buffer; width: number; height: number; size_bytes: number }> {
  const result = await generateVariant('on_dark', buffer);
  return { buffer: result.buffer, width: result.width, height: result.height, size_bytes: result.size_bytes };
}

export async function generateSquareSafe(buffer: Buffer): Promise<{ buffer: Buffer; width: number; height: number; size_bytes: number }> {
  const result = await generateVariant('square_safe', buffer);
  return { buffer: result.buffer, width: result.width, height: result.height, size_bytes: result.size_bytes };
}

export async function generateHorizontalSafe(buffer: Buffer): Promise<{ buffer: Buffer; width: number; height: number; size_bytes: number }> {
  const result = await generateVariant('horizontal_safe', buffer);
  return { buffer: result.buffer, width: result.width, height: result.height, size_bytes: result.size_bytes };
}

export async function generateAllVariants(buffer: Buffer): Promise<VariantGenerationResult[]> {
  const variantTypes: BrandAssetVariantType[] = ['normalized', 'on_light', 'on_dark', 'square_safe', 'horizontal_safe'];
  const results = await Promise.allSettled(
    variantTypes.map(vt => generateVariant(vt, buffer))
  );
  return results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : {
      variant_type: variantTypes[i],
      buffer: Buffer.alloc(0),
      width: 0,
      height: 0,
      size_bytes: 0,
      success: false,
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    }
  );
}
