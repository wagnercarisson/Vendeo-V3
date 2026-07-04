const rawUrl = process.env.NEXT_PUBLIC_SITE_URL;
if (!rawUrl) throw new Error("NEXT_PUBLIC_SITE_URL is not defined");

export function getSiteUrl(): string {
  return rawUrl as string;
}
