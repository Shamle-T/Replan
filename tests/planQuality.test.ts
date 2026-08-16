import { describe, expect, it } from "vitest";
import { planQualityPercent } from "../lib/planQuality";

describe("plan quality presentation", () => {
  it("maps zero penalty to 100 percent", () => expect(planQualityPercent(0)).toBe(100));
  it("decreases monotonically as scheduling penalties grow", () => expect(planQualityPercent(25)).toBeGreaterThan(planQualityPercent(100)));
});
