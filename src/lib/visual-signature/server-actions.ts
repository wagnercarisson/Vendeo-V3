"use server";

import { requireUser } from "@/lib/auth/require-user";
import { requireOwnership } from "@/lib/auth/store-ownership";
import { supabaseAdmin as supabase } from "@/lib/supabase/server";
import type { Store } from "@/lib/store";
import { AiImageGenerator } from "./ai-image-generator";
import { getActiveVisualSignature } from "./persistence";
import type {
  VisualSignatureRecord,
  VisualSignatureMetadata,
  GenerateVariationsResult,
  CascadeAttempt,
  CascadeAttemptStatus,
} from "./types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeErrorMessage(raw: string): string {
  return raw
    .replace(/(sk-[a-zA-Z0-9]{20,})/g, "sk-***")
    .replace(/(Bearer\s+)[a-zA-Z0-9._-]+/g, "$1***")
    .replace(/https:\/\/[^\s]+/g, "[url]")
    .slice(0, 500);
}

function classifyError(
  err: unknown,
  tier: "image_direct" | "image_retry",
  startMs: number
): CascadeAttempt {
  const elapsedMs = Date.now() - startMs;
  const message = err instanceof Error ? err.message : String(err || "Unknown error");
  const sanitized = sanitizeErrorMessage(message);

  let status: CascadeAttemptStatus = "failed";
  let errorCode = "UNKNOWN";

  if (err instanceof DOMException && err.name === "AbortError") {
    status = "timeout";
    errorCode = "TIMEOUT";
  } else if (
    sanitized.toLowerCase().includes("content_filter") ||
    sanitized.toLowerCase().includes("safety") ||
    sanitized.toLowerCase().includes("content_policy")
  ) {
    status = "rejected";
    errorCode = "CONTENT_FILTER";
  } else if (sanitized.startsWith("ai_image_generation_failed")) {
    const inner = sanitized.replace("ai_image_generation_failed:", "").trim();
    if (inner.toLowerCase().includes("timeout") || inner.toLowerCase().includes("timed out") || inner.toLowerCase().includes("abort")) {
      status = "timeout";
      errorCode = "TIMEOUT";
    } else if (inner.toLowerCase().includes("validat")) {
      status = "rejected";
      errorCode = "VALIDATION_FAILED";
    } else {
      errorCode = "AI_GENERATION_FAILED";
    }
  }

  return {
    tier,
    provider: "openai",
    model: process.env.IMAGE_GENERATION_RESPONSES_MODEL || "gpt-5.5",
    elapsedMs,
    status,
    errorCode,
    errorMessageSanitized: sanitized,
  };
}

async function getStore(storeId: string): Promise<Store> {
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("id", storeId)
    .single();

  if (error) {
    throw new Error(`Store not found: ${error.message}`);
  }

  return data;
}

async function archiveExistingActive(storeId: string): Promise<void> {
  const { error } = await supabase
    .from("store_visual_signatures")
    .update({
      status: "archived",
      updated_at: new Date().toISOString(),
    })
    .eq("store_id", storeId)
    .eq("status", "active");

  if (error) {
    throw new Error(`Failed to archive active signature: ${error.message}`);
  }
}

export async function generateVariations(
  storeId: string
): Promise<GenerateVariationsResult> {
  const user = await requireUser();
  await requireOwnership(storeId, user.userId);
  if (!UUID_REGEX.test(storeId)) {
    return {
      success: false,
      error: "ID da loja inválido",
    };
  }

  let store: Store;
  try {
    store = await getStore(storeId);
  } catch {
    return {
      success: false,
      error: "Loja não encontrada",
    };
  }

  const aiGenerator = new AiImageGenerator();
  const tonalities = ["profissional", "moderno", "elegante"];

  const variations: Array<{ tier: string; assetUrl: string; storagePath: string; mimeType: string }> = [];

  for (const tone of tonalities) {
    let result:
      | { tier: string; assetUrl: string; storagePath: string; mimeType: string }
      | null = null;
    const attempt1Start = Date.now();

    try {
      result = await aiGenerator.generate({
        storeId: store.id,
        storeName: store.name,
        segment: store.segment,
        brandColor: store.brand_color ?? "",
        tone,
        signal: AbortSignal.timeout(120000),
        attempt: 0,
      });
    } catch (err) {
      const a1 = classifyError(err, "image_direct", attempt1Start);
      console.log(`[visual-signature] generateVariations tone=${tone} attempt1 ${a1.status}`);

      if (a1.status !== "timeout") {
        const attempt2Start = Date.now();
        try {
          result = await aiGenerator.generate({
            storeId: store.id,
            storeName: store.name,
            segment: store.segment,
            brandColor: store.brand_color ?? "",
            tone,
            signal: AbortSignal.timeout(120000),
            attempt: 1,
            simplifiedPrompt: true,
          });
        } catch (err2) {
          const a2 = classifyError(err2, "image_retry", attempt2Start);
          console.log(`[visual-signature] generateVariations tone=${tone} retry ${a2.status}`);
        }
      }
    }

    if (!result) {
      return {
        success: false,
        error:
          "Não foi possível gerar 3 opções. Tente novamente.",
      };
    }

    variations.push(result);
  }

  return {
    success: true,
    variations: variations as GenerateVariationsResult extends {
      success: true;
    }
      ? Array<{
          tier: "image_direct" | "image_retry" | "typographic";
          assetUrl: string;
          storagePath: string;
          mimeType: "image/png" | "image/svg+xml";
        }>
      : never,
  };
}

export async function generateAutomatic(storeId: string): Promise<
  | { success: true; signature: VisualSignatureRecord; isFallback: boolean }
  | { success: false; error: string }
> {
  const user = await requireUser();
  await requireOwnership(storeId, user.userId);
  if (!UUID_REGEX.test(storeId)) {
    return { success: false, error: "ID da loja inválido" };
  }

  let store: Store;
  try {
    store = await getStore(storeId);
  } catch {
    return { success: false, error: "Loja não encontrada" };
  }

  try {
    const existing = await getActiveVisualSignature(storeId);
    if (existing) {
      await archiveExistingActive(storeId);
    }
  } catch {
    // Continue even if archive fails — the partial unique index will
    // catch the conflict and the caller can retry
  }

  const totalStart = Date.now();
  const aiGenerator = new AiImageGenerator();
  const previousAttempts: CascadeAttempt[] = [];

  const tones = ["profissional", "moderno", "elegante"];
  const tone = tones[Math.floor(Math.random() * tones.length)];

  // Attempt 1: image_direct
  console.log(`[visual-signature] tier=image_direct started`);
  const attempt1Start = Date.now();
  try {
    const result = await aiGenerator.generate({
      storeId: store.id,
      storeName: store.name,
      segment: store.segment,
      brandColor: store.brand_color ?? "",
      tone,
      signal: AbortSignal.timeout(120000),
      attempt: 0,
    });

    const { data: signature, error } = await supabase
      .from("store_visual_signatures")
      .update({
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("storage_path", result.storagePath)
      .select()
      .single();

    if (error || !signature) {
      return {
        success: false,
        error: `Erro ao ativar assinatura: ${error?.message || "Registro não encontrado"}`,
      };
    }

    console.log(`[visual-signature] tier=image_direct success`);
    return { success: true, signature, isFallback: false };
  } catch (err) {
    const attempt = classifyError(err, "image_direct", attempt1Start);
    previousAttempts.push(attempt);
    console.log(`[visual-signature] tier=image_direct ${attempt.status}`);

    if (attempt.status === "timeout") {
      const totalElapsedMs = Date.now() - totalStart;
      console.log(`[visual-signature] metadata`, JSON.stringify({
        generation_tier: "failed",
        previousAttempts,
        totalElapsedMs,
      }));
      return {
        success: false,
        error: "Não conseguimos criar sua assinatura visual agora. Tente novamente ou envie seu logotipo.",
      };
    }
  }

  // Attempt 2: image_retry (only on non-timeout failures)
  console.log(`[visual-signature] tier=image_retry started (simplified prompt)`);
  const attempt2Start = Date.now();
  try {
    const retryResult = await aiGenerator.generate({
      storeId: store.id,
      storeName: store.name,
      segment: store.segment,
      brandColor: store.brand_color ?? "",
      tone,
      signal: AbortSignal.timeout(120000),
      attempt: 1,
      simplifiedPrompt: true,
    });

    const { data: signature, error } = await supabase
      .from("store_visual_signatures")
      .update({
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("storage_path", retryResult.storagePath)
      .select()
      .single();

    if (error || !signature) {
      return {
        success: false,
        error: `Erro ao ativar assinatura: ${error?.message || "Registro não encontrado"}`,
      };
    }

    console.log(`[visual-signature] tier=image_retry success`);
    return { success: true, signature, isFallback: false };
  } catch (err) {
    const attempt = classifyError(err, "image_retry", attempt2Start);
    previousAttempts.push(attempt);
    console.log(`[visual-signature] tier=image_retry ${attempt.status}`);
  }

  // Both attempts failed — return controlled error, no typographic fallback
  const totalElapsedMs = Date.now() - totalStart;
  console.log(`[visual-signature] all attempts failed, returning error`);
  console.log(`[visual-signature] metadata`, JSON.stringify({
    generation_tier: "failed",
    previousAttempts,
    totalElapsedMs,
  }));

  return {
    success: false,
    error: "Não conseguimos criar sua assinatura visual agora. Tente novamente ou envie seu logotipo.",
  };
}

export async function activateSignature(
  storeId: string,
  signatureId: string
): Promise<
  | { success: true; signature: VisualSignatureRecord }
  | { success: false; error: string }
> {
  const user = await requireUser();
  await requireOwnership(storeId, user.userId);
  if (!UUID_REGEX.test(storeId) || !UUID_REGEX.test(signatureId)) {
    return { success: false, error: "ID inválido" };
  }

  const { data: signature, error: findError } = await supabase
    .from("store_visual_signatures")
    .select("*")
    .eq("id", signatureId)
    .eq("store_id", storeId)
    .single();

  if (findError || !signature) {
    return {
      success: false,
      error: "Assinatura não encontrada",
    };
  }

  if (signature.status === "active") {
    return { success: true, signature };
  }

  try {
    await archiveExistingActive(storeId);
  } catch (error) {
    return {
      success: false,
      error: `Erro ao arquivar assinatura anterior: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
    };
  }

  const { data: activated, error: activateError } = await supabase
    .from("store_visual_signatures")
    .update({
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", signatureId)
    .select()
    .single();

  if (activateError || !activated) {
    return {
      success: false,
      error: `Erro ao ativar assinatura: ${activateError?.message || "Erro desconhecido"}`,
    };
  }

  return { success: true, signature: activated };
}

export async function listSignatures(
  storeId: string
): Promise<VisualSignatureRecord[]> {
  const user = await requireUser();
  await requireOwnership(storeId, user.userId);
  const { data, error } = await supabase
    .from("store_visual_signatures")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list signatures: ${error.message}`);
  }

  return data ?? [];
}
