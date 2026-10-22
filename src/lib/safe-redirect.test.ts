import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("staat interne paden toe", () => {
    expect(safeRedirectPath("/projecten/123")).toBe("/projecten/123");
  });
  it("weigert externe en protocol-relatieve URL's", () => {
    expect(safeRedirectPath("https://evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("//evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("/\\evil.example")).toBe("/dashboard");
    expect(safeRedirectPath(undefined)).toBe("/dashboard");
    expect(safeRedirectPath("/a\nSet-Cookie: x")).toBe("/dashboard");
  });
});
