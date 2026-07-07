import { ForbiddenError } from "./errors";

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (!origin) {
    throw new ForbiddenError("Origin header required");
  }

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    throw new ForbiddenError("Invalid origin");
  }

  const effectiveHost = forwardedHost || host;

  if (!effectiveHost || originUrl.host !== effectiveHost) {
    throw new ForbiddenError("Cross-origin request denied");
  }
}
