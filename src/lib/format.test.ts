import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatDDMMYYYY } from "./format";

describe("datumnotatie DD-MM-JJJJ", () => {
  it("toont kalenderdatums zonder tijdzoneverschuiving", () => {
    expect(formatDate("2026-01-05")).toBe("05-01-2026");
    expect(formatDate(null)).toBe("—");
  });
  it("gebruikt de tijdzone America/Paramaribo voor tijdstippen", () => {
    // 02:30 UTC = 23:30 de vorige dag in Paramaribo (UTC−3)
    expect(formatDDMMYYYY(new Date("2026-03-01T02:30:00Z"))).toBe("28-02-2026");
    expect(formatDateTime("2026-03-01T02:30:00Z", "nl-SR", "America/Paramaribo")).toMatch(/^28-02-2026 23:30$/);
  });
});
