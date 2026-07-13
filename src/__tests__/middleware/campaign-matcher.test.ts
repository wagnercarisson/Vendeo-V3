import { describe, it, expect } from "vitest";
import { config } from "@/middleware";

describe("middleware matcher", () => {
  it("includes /campanhas/:path* for session renewal", () => {
    expect(config.matcher).toContain("/campanhas/:path*");
  });
});
