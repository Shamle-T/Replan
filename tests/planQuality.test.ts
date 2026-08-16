import { describe, expect, it } from "vitest";
import { planQualityPercent } from "../lib/planQuality";

describe("plan quality display", () => {
  it("is capped at 100 percent and uses whole numbers", () => {
    expect(planQualityPercent(0)).toBe(100);
    expect(Number.isInteger(planQualityPercent(100.4))).toBe(true);
    expect(planQualityPercent(100.4)).toBeLessThanOrEqual(100);
  });

  it("decreases as penalty cost increases", () => {
    expect(planQualityPercent(25)).toBeGreaterThan(planQualityPercent(100));
  });
});
