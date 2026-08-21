import { isCaptchaEnabled } from "@/lib/feature-flags/feature-flag-service";
import { ForgotPasswordForm } from "./forgot-password-form";

export default async function ForgotPasswordPage() {
  const captchaEnabled = await isCaptchaEnabled();
  return <ForgotPasswordForm captchaEnabled={captchaEnabled} />;
}