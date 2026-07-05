import { describe, expect, test } from "bun:test";
import { timeAgo } from "./time";

describe("timeAgo", () => {
  const now = Date.now();

  test("formats seconds, minutes, hours, and days", () => {
    expect(timeAgo(now - 5_000)).toBe("5s ago");
    expect(timeAgo(now - 90_000)).toBe("2m ago"); // 1.5m rounds up
    expect(timeAgo(now - 5 * 3_600_000)).toBe("5h ago");
    expect(timeAgo(now - 47 * 3_600_000)).toBe("47h ago"); // hours until 48h
    expect(timeAgo(now - 72 * 3_600_000)).toBe("3d ago");
  });

  test("clamps future timestamps to zero", () => {
    expect(timeAgo(now + 60_000)).toBe("0s ago");
  });

  test("uses the caller's fallback for missing values", () => {
    expect(timeAgo(null)).toBe("unknown");
    expect(timeAgo(undefined, "never")).toBe("never");
    expect(timeAgo(0, "never")).toBe("never");
  });
});
