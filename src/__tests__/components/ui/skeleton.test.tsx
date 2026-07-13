// @vitest-environment node
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Skeleton } from "@/components/ui/skeleton";

describe("Skeleton", () => {
  it("renders with custom dimensions and animate-pulse", () => {
    const html = renderToString(
      <Skeleton width="200px" height="300px" rounded="xl" />,
    );
    expect(html).toContain("animate-pulse");
    expect(html).toContain("bg-bg-elevated");
    expect(html).toContain('style="width:200px;height:300px"');
  });
});
