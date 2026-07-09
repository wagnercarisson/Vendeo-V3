import "server-only";
import sharp from "sharp";

const SUPPORTED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * Transcodes an image buffer to JPEG sRGB, quality 90, 1080×1080.
 *
 * Accepts PNG, JPEG, and WEBP inputs. Uses sharp with `fit=contain` and
 * white background to ensure a consistent 1080×1080 canvas without distortion.
 *
 * Rejects any MIME type not in the supported set with a descriptive error.
 */
export async function transcodeToJpeg(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: "image/jpeg" }> {
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    throw new Error(
      `Unsupported image format: ${mimeType}. Expected PNG, JPEG, or WEBP.`
    );
  }

  const jpegBuffer = await sharp(buffer)
    .resize(1080, 1080, { fit: "contain", background: "#FFFFFF" })
    .jpeg({ quality: 90 })
    .toBuffer();

  return { buffer: jpegBuffer, mimeType: "image/jpeg" };
}

/**
 * Type-safe builder for the publication copy snapshot.
 *
 * Returns the input shape as-is. This is a deterministic builder for the
 * content assembled in the route handler — no transformation logic.
 */
export function buildPublicationCopySnapshot(data: {
  caption: string;
  hashtags: string[];
  cta_post: string;
}): { caption: string; hashtags: string[]; cta_post: string } {
  return {
    caption: data.caption,
    hashtags: data.hashtags,
    cta_post: data.cta_post,
  };
}
