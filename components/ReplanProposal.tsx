"use client";

import { useEffect, useState } from "react";
import type {
  PostTaskBreakMinutes,
  ScheduleDiffEntry,
  ScheduleResult,
  Task,
} from "../scheduler";
import { formatDurationCompact, formatTime } from "../lib/time";
import { friendlyValidationMessage } from "../lib/validationMessages";
import { planQualityPercent } from "../lib/planQuality";

interface ReplanProposalProps {
  title: string;
  result: ScheduleResult;
  tasks: Task[];
  currentTime: Date;
  relaxMinutes?: PostTaskBreakMinutes;
  kind?: "optimize" | "find-time" | "replan";
  previousScore?: number;
  proposedScore?: number;
  previousOpenMinutes?: number;
  proposedOpenMinutes?: number;
  onRelaxChange?: (minutes: PostTaskBreakMinutes) => void;
  onApply: () => void;
  onKeep: () => void;
  inline?: boolean;
}

export default function ReplanProposal({
  title,
  result,
  tasks,
  currentTime,
  relaxMinutes,
  kind,
  previousScore,
  proposedScore,
  previousOpenMinutes,
  proposedOpenMinutes,
  onRelaxChange,
  onApply,
  onKeep,
  inline = false,
}: ReplanProposalProps) {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const changed = result.diff?.filter((entry) => entry.type !== "unchanged") ?? [];
  const relevantChanges = changed
    .filter((entry) => !(result.postTaskBreak && entry.type === "resized"))
    .filter((entry) => !taskMap.get(entry.taskId)?.fixedStart);
  const visibleChanges = relevantChanges.slice(0, 6);
  const fixedCommitments = tasks
    .filter((task) => task.fixedStart && task.fixedEnd)
    .map((task) => ({
      task,
      placement: result.schedule.find((item) => item.taskId === task.id),
    }))
    .filter((item): item is { task: Task; placement: NonNullable<typeof item.placement> } => Boolean(item.placement))
    .sort((a, b) => a.placement.start.getTime() - b.placement.start.getTime());
  const [customMinutes, setCustomMinutes] = useState(
    relaxMinutes && ![5, 10, 15].includes(relaxMinutes) ? String(relaxMinutes) : "",
  );

  useEffect(() => {
    if (relaxMinutes !== undefined && ![0, 5, 10, 15].includes(relaxMinutes)) {
      setCustomMinutes(String(relaxMinutes));
      return;
    }
    setCustomMinutes("");
  }, [relaxMinutes]);

  const nextAfterBreak = [...result.schedule]
    .filter((item) => item.start.getTime() >= currentTime.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0];
  const nextTask = nextAfterBreak ? taskMap.get(nextAfterBreak.taskId) : undefined;
  const actualRelax = result.postTaskBreak?.minutes ?? 0;
  const earlyFinishProposal = relaxMinutes !== undefined && onRelaxChange;
  const optimizeProposal = kind === "optimize";
  const displayChangeCount = optimizeProposal ? changed.length : relevantChanges.length;
  const equalScore =
    previousScore !== undefined &&
    proposedScore !== undefined &&
    Math.abs(previousScore - proposedScore) < 0.001;
  const friendlyIssue = result.status === "infeasible"
    ? friendlyValidationMessage(result.issues[0], tasks)
    : null;
  const canApply = result.status === "feasible" && (changed.length > 0 || kind === "replan");

  const applyCustom = () => {
    if (!onRelaxChange) return;
    const parsed = Number(customMinutes);
    if (!Number.isInteger(parsed) || parsed < 5 || parsed > 60) return;
    onRelaxChange(parsed as PostTaskBreakMinutes);
  };

  const selectPreset = (minutes: PostTaskBreakMinutes) => {
    setCustomMinutes("");
    onRelaxChange?.(minutes);
  };

  return (
    <aside className={`proposal-panel ${inline ? "proposal-panel-inline" : ""}`} role="dialog" aria-modal={inline ? undefined : true} aria-label={title}>
      <div className="proposal-topbar">
        <div>
          <span className="proposal-kicker">Replan suggestion</span>
          <h2>{title}</h2>
          {earlyFinishProposal ? <p className="proposal-subtitle">Time opened up. Here’s the tighter plan.</p> : null}
        </div>
        <div className="proposal-time-wrap">
          <span>Current time</span>
          <strong>{formatTime(currentTime)}</strong>
        </div>
        <button className="proposal-close" type="button" onClick={onKeep} aria-label="Close proposal">
          ×
        </button>
      </div>

      {result.status === "feasible" ? (
        <div className="proposal-body">
          {earlyFinishProposal ? (
            <section className="relax-choice-panel">
              <div className="relax-choice-copy">
                <span>Take a moment before the next task</span>
                <strong>
                  {actualRelax > 0 ? `${actualRelax} min to relax` : "Start immediately"}
                </strong>
                {nextTask && nextAfterBreak ? (
                  <small>
                    {nextTask.title} starts at {formatTime(nextAfterBreak.start)}
                  </small>
                ) : null}
              </div>

              <div className="relax-options" aria-label="Relax time before next task">
                <button
                  type="button"
                  className={relaxMinutes === 0 ? "active" : ""}
                  onClick={() => selectPreset(0)}
                >
                  Now
                </button>
                {([5, 10, 15] as PostTaskBreakMinutes[]).map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                  className={relaxMinutes === minutes && customMinutes === "" ? "active" : ""}
                    onClick={() => selectPreset(minutes)}
                  >
                    {minutes} min
                  </button>
                ))}
              </div>

              <div className="custom-relax-row">
                <label htmlFor="custom-relax">Custom</label>
                <input
                  id="custom-relax"
                  inputMode="numeric"
                  type="number"
                  min={5}
                  max={60}
                  step={1}
                  placeholder="5–15"
                  value={customMinutes}
                  onChange={(event) => {
                    const value = event.target.value;
                    setCustomMinutes(value);
                    const parsed = Number(value);
                    if (onRelaxChange && Number.isInteger(parsed) && parsed >= 5 && parsed <= 60) {
                      onRelaxChange(parsed as PostTaskBreakMinutes);
                    }
                  }}
                  onBlur={applyCustom}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      applyCustom();
                    }
                  }}
                />
                <span>min</span>
              </div>
            </section>
          ) : optimizeProposal ? (
            <section className="optimization-summary">
              <div className="score-card">
                <span>Plan quality</span>
                <strong>{planQualityPercent(proposedScore ?? result.score.total)}%</strong>
                <small>100% is best</small>
              </div>
              <div className="optimization-state">
                <span>{changed.length === 0 ? "Best plan found" : `${changed.length} updates`}</span>
                <strong>{formatOpenMinutes(proposedOpenMinutes ?? 0)} open time</strong>
                {equalScore ? <em>Same score · stable tie-break</em> : null}
              </div>
            </section>
          ) : (
            <div className="proposal-outcome standard-outcome">
              <div className="outcome-number">{displayChangeCount === 0 ? "✓" : displayChangeCount}</div>
              <div className="outcome-copy">
                <span>{displayChangeCount === 1 ? "timing update" : "timing updates"}</span>
                <strong>{displayChangeCount === 0 ? "The remaining timing still works" : "A cleaner remaining plan is ready"}</strong>
              </div>
            </div>
          )}

          {optimizeProposal && previousScore !== undefined && proposedScore !== undefined ? (
            <div className="score-comparison-row">
              <span>Before {planQualityPercent(previousScore)}%</span>
              <b>→</b>
              <span>After {planQualityPercent(proposedScore)}%</span>
              {previousOpenMinutes !== undefined && proposedOpenMinutes !== undefined ? (
                <span className="score-open-delta">
                  Open {formatOpenMinutes(previousOpenMinutes)} → {formatOpenMinutes(proposedOpenMinutes)}
                </span>
              ) : null}
            </div>
          ) : null}

          {visibleChanges.length > 0 ? (
            <div className="change-stack">
              {visibleChanges.map((entry) => (
                <ChangeRow
                  key={`${entry.taskId}-${entry.type}`}
                  entry={entry}
                  title={taskMap.get(entry.taskId)?.title ?? entry.taskId}
                />
              ))}
              {relevantChanges.length > visibleChanges.length ? (
                <span className="more-changes">+{relevantChanges.length - visibleChanges.length} more</span>
              ) : null}
            </div>
          ) : null}

          {optimizeProposal && fixedCommitments.length > 0 ? (
            <section className="optimization-result-section optimization-fixed-section proposal-fixed-section">
              <div className="optimization-result-section-head">
                <strong>Fixed commitments</strong>
                <span>Stayed anchored</span>
              </div>
              <div className="optimization-result-list">
                {fixedCommitments.map(({ task, placement }) => (
                  <div className="optimization-result-row optimization-fixed-row" key={task.id}>
                    <strong>{task.title}</strong>
                    <span>{formatTime(placement.start)} → {formatTime(placement.end)} · Fixed</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {result.reasons.length > 0 ? (
            <details className="proposal-details">
              <summary>Details</summary>
              <ul>
                {result.reasons.slice(0, 2).map((reason, index) => (
                  <li key={`${reason.code}-${reason.taskId ?? "global"}-${index}`}>
                    {reason.summary}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : (
        <div className="proposal-body">
          <div className="conflict-outcome">
            <strong>{friendlyIssue?.title ?? "This update cannot be applied"}</strong>
            <p>{friendlyIssue?.detail ?? "A scheduling rule blocks this change."}</p>
          </div>
        </div>
      )}

      <div className="proposal-actions">
        <button className="button secondary" type="button" onClick={onKeep}>
          Keep current
        </button>
        <button
          className="button primary"
          type="button"
          onClick={onApply}
          disabled={!canApply}
        >
          {result.status !== "feasible" ? "Timing change blocked" : canApply ? "Apply replan" : "No changes needed"}
        </button>
      </div>
    </aside>
  );
}

function ChangeRow({ entry, title }: { entry: ScheduleDiffEntry; title: string }) {
  const badge = describeBadge(entry);
  return (
    <div className="change-row">
      <div className="change-row-copy">
        <strong>{title}</strong>
        <span>{describeChange(entry)}</span>
      </div>
      <em className={`change-badge ${badge.tone}`}>{badge.label}</em>
    </div>
  );
}

function describeBadge(entry: ScheduleDiffEntry): { label: string; tone: string } {
  if (entry.type === "moved" && entry.deltaMinutes) {
    const minutes = Math.abs(entry.deltaMinutes);
    return {
      label: `Shifted ${entry.deltaMinutes < 0 ? "−" : "+"}${formatDurationCompact(minutes)}`,
      tone: "positive",
    };
  }
  if (entry.type === "resized" && entry.deltaMinutes) return { label: entry.deltaMinutes > 0 ? `Extended +${formatDurationCompact(entry.deltaMinutes)}` : `Shortened −${formatDurationCompact(Math.abs(entry.deltaMinutes))}`, tone: entry.deltaMinutes > 0 ? "warning" : "positive" };
  if (entry.type === "added") return { label: "Added", tone: "neutral" };
  if (entry.type === "removed") return { label: "Removed", tone: "neutral" };
  return { label: "Updated", tone: "neutral" };
}

function describeChange(entry: ScheduleDiffEntry): string {
  if (entry.type === "moved" && entry.before && entry.after) {
    return `${formatTime(entry.before.start)} → ${formatTime(entry.after.start)}`;
  }
  if (entry.type === "removed") return "Removed from the plan";
  if (entry.type === "added" && entry.after) return `Starts at ${formatTime(entry.after.start)}`;
  if (entry.type === "resized" && entry.after && entry.before) return `${formatTime(entry.before.end)} → ${formatTime(entry.after.end)}`;
  if (entry.type === "resized" && entry.after) return `Ends ${formatTime(entry.after.end)}`;
  return "Updated";
}

function formatOpenMinutes(minutes: number): string {
  if (minutes <= 0) return "0 min";
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  if (hours === 0) return `${remainder} min`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}
