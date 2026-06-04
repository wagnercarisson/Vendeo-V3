import { supabaseAdmin as supabase } from "@/lib/supabase/server";
import type { CreateVisualSignatureInput, VisualSignatureRecord } from "./types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface UploadToStorageParams {
  storeId: string;
  buffer: Buffer;
  mimeType: "image/png" | "image/svg+xml";
  fileName?: string;
}

async function generateUUID(): Promise<string> {
  const { randomUUID } = await import("crypto");
  return randomUUID();
}

export async function uploadToStorage(
  params: UploadToStorageParams
): Promise<{ storagePath: string; assetUrl: string }> {
  if (!UUID_REGEX.test(params.storeId)) {
    throw new Error(`Invalid storeId: "${params.storeId}" is not a valid UUID`);
  }

  const ext = params.mimeType === "image/png" ? "png" : "svg";
  const fileName = params.fileName ?? (await generateUUID());
  const storagePath = `${params.storeId}/${fileName}.${ext}`;

  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 1500;
  let lastError: any = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[persistence] uploadToStorage attempt ${attempt}/${MAX_RETRIES} for ${storagePath}...`);
      const { error: uploadError } = await supabase.storage
        .from("visual-signatures")
        .upload(storagePath, params.buffer, {
          contentType: params.mimeType,
          upsert: true,
        });

      if (uploadError) {
        lastError = uploadError;
        console.warn(`[persistence] uploadToStorage attempt ${attempt} failed:`, uploadError.message);
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
          continue;
        }
      } else {
        console.log(`[persistence] uploadToStorage success on attempt ${attempt}`);
        const { data: publicUrlData } = supabase.storage
          .from("visual-signatures")
          .getPublicUrl(storagePath);

        return { storagePath, assetUrl: publicUrlData.publicUrl };
      }
    } catch (err) {
      lastError = err;
      console.warn(`[persistence] uploadToStorage attempt ${attempt} unexpected error:`, err);
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        continue;
      }
    }
  }

  throw new Error(`Failed to upload to Storage after ${MAX_RETRIES} retries: ${lastError?.message || String(lastError)}`);
}

export async function persistSignature(
  input: CreateVisualSignatureInput
): Promise<VisualSignatureRecord> {
  const { data, error } = await supabase
    .from("store_visual_signatures")
    .insert(input)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to persist signature: ${error.message}`);
  }

  return data;
}

export async function getActiveVisualSignature(
  storeId: string
): Promise<VisualSignatureRecord | null> {
  const { data, error } = await supabase
    .from("store_visual_signatures")
    .select("*")
    .eq("store_id", storeId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to get active signature: ${error.message}`);
  }

  return data;
}
