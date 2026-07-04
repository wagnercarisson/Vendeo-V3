import { requireUser, UnauthorizedError } from "@/lib/auth/require-user";
import { LogoutButton } from "./logout-button";

export async function AuthHeader() {
  try {
    await requireUser();
    return <LogoutButton />;
  } catch (error) {
    if (error instanceof UnauthorizedError) return null;
    throw error;
  }
}
