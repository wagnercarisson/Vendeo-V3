import { getLaunchConfig } from "@/lib/launch-config/config";
import { ForgotPasswordForm } from "./forgot-password-form";

export default async function ForgotPasswordPage() {
  const { captchaEnabled } = await getLaunchConfig();
  return <ForgotPasswordForm captchaEnabled={captchaEnabled} />;
}