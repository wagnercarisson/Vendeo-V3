// @vitest-environment node
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { AccountMenu } from "@/components/shell/account-menu";

describe("AccountMenu", () => {
  it("shows user email", () => {
    const html = renderToString(
      <AccountMenu user={{ claims: { email: "user@vendeo.tech" } }} />,
    );
    expect(html).toContain("user@vendeo.tech");
  });

  it("shows fallback when email unavailable", () => {
    const html = renderToString(
      <AccountMenu user={{ claims: { sub: "abc-123-def" } }} />,
    );
    expect(html).toContain("abc-123-");
  });
});
