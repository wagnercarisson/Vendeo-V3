import { describe, it, expect } from "vitest";
import { formatChangelogDate } from "../format-date";

describe("formatChangelogDate", () => {
  it("formats 2026-07-31 as 31/07/2026 without timezone shift", () => {
    expect(formatChangelogDate("2026-07-31")).toBe("31/07/2026");
  });

  it("zero-pads day and month", () => {
    expect(formatChangelogDate("2026-08-01")).toBe("01/08/2026");
  });

  it("returns the input unchanged when it does not match YYYY-MM-DD (fail-safe)", () => {
    expect(formatChangelogDate("31/07/2026")).toBe("31/07/2026");
    expect(formatChangelogDate("2026-7-1")).toBe("2026-7-1");
  });
});
