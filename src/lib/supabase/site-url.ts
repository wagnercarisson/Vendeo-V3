const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;
if (!SITE_URL) throw new Error("NEXT_PUBLIC_SITE_URL is not defined");

export function getSiteUrl(): string {
  return SITE_URL;
}
