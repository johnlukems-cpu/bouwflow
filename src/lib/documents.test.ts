import { describe, expect, it } from "vitest";
import { safeFileName } from "./documents";

describe("safeFileName", () => {
  it("verwijdert paden en gevaarlijke tekens", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("C:\\temp\\tekening blok A.pdf")).toBe("tekening-blok-A.pdf");
    expect(safeFileName("<script>.pdf")).toBe("script.pdf");
    expect(safeFileName("...")).toBe("bestand");
  });
});
