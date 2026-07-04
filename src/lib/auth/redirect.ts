const ALLOWLIST_PATTERNS = [
  { test: (path: string) => path === "/" },
  { test: (path: string) => path === "/store" },
  { test: (path: string) => path.startsWith("/campaign/") },
];

const REJECTED_PATTERNS = [
  /^https?:\/\//i,
  /^\/\//,
  /\\/,
  /^\/login/,
  /^\/signup/,
  /^\/auth\//,
];

export function sanitizeRedirectPath(path: string): string {
  if (!path || path.trim() === "") {
    return "/";
  }

  try {
    const url = new URL(path, "http://localhost");
    const pathname = url.pathname;

    for (const reject of REJECTED_PATTERNS) {
      if (reject.test(path) || reject.test(pathname)) {
        return "/";
      }
    }

    const isAllowed = ALLOWLIST_PATTERNS.some((pattern) =>
      pattern.test(pathname),
    );

    if (!isAllowed) {
      return "/";
    }

    const queryString = url.search || "";
    const hasFragment = path.includes("#");

    if (hasFragment) {
      return pathname + queryString;
    }

    return pathname + queryString;
  } catch {
    return "/";
  }
}
