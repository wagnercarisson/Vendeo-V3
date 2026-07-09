import { describe, it, expect } from "vitest";
import { config } from "@/middleware";

describe("middleware matcher", () => {
  it("includes /campanha/:path* for session renewal", () => {
    expect(config.matcher).toContain("/campanha/:path*");
  });
});
