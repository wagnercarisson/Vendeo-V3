import { sanitizeRedirectPath } from "@/lib/auth/redirect";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const params = await searchParams;
  const redirectParam = typeof params.redirect === "string" ? params.redirect : "";
  const safeRedirect = sanitizeRedirectPath(redirectParam);

  return <LoginForm redirect={safeRedirect} />;
}
