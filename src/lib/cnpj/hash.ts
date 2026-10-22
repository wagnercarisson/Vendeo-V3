import { createHmac } from "crypto";

/**
 * HMAC-SHA256 of the CNPJ root (the first 8 canonical characters, which may
 * contain uppercase letters) using the server-side pepper.
 */
export function hashCnpjRoot(root: string): string {
  const pepper = process.env.CNPJ_PEPPER;
  if (!pepper) {
    throw new Error(
      "CNPJ_PEPPER environment variable is required. " +
        "Generate a random 64-char hex string and set it in your Vercel/Supabase environment."
    );
  }
  return createHmac("sha256", pepper).update(root).digest("hex");
}
