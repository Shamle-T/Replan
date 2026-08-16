/**
 * Converts Replan's internal non-negative penalty score into a bounded,
 * user-facing percentage. The raw score remains the source of truth for
 * optimization; this helper is display-only.
 *
 * 0 penalty points = 100% quality. Higher penalty costs approach 0% but can
 * never exceed 100%. This keeps the UI comparable without changing scheduler
 * behavior.
 */
export function planQualityPercent(rawPenaltyScore: number): number {
  if (!Number.isFinite(rawPenaltyScore) || rawPenaltyScore < 0) return 0;
  const quality = 100 / (1 + rawPenaltyScore / 100);
  return Math.max(0, Math.min(100, Math.round(quality)));
}