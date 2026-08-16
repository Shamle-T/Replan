"use client";

import type { PostTaskBreakMinutes, ScheduleResult, Task } from "../scheduler";
import { formatDurationCompact, formatTime } from "../lib/time";
import { friendlyValidationMessage } from "../lib/validationMessages";

interface ReplanProposalProps { result: ScheduleResult; tasks: Task[]; currentTime: Date; relaxMinutes?: PostTaskBreakMinutes; onRelaxChange?: (minutes: PostTaskBreakMinutes) => void; onApply: () => void; onKeep: () => void; }
export default function ReplanProposal(props: ReplanProposalProps) {
  const taskMap = new Map(props.tasks.map((task) => [task.id, task]));
  const changes = props.result.diff?.filter((entry) => entry.type !== "unchanged") ?? [];
  const issue = props.result.status === "infeasible" ? friendlyValidationMessage(props.result.issues[0], props.tasks) : null;
  return <div className="proposal-backdrop"><aside className="proposal-panel" role="dialog" aria-modal="true" aria-label="Replan proposal"><header><div><p className="eyebrow">Replan suggestion</p><h2>Review the remaining day</h2><p>Current time: {formatTime(props.currentTime)}</p></div><button type="button" onClick={props.onKeep}>Close</button></header>{props.result.status === "feasible" ? <><section className="proposal-outcome"><strong>{changes.length} schedule update{changes.length === 1 ? "" : "s"}</strong><span>Fixed commitments remain anchored.</span></section>{props.onRelaxChange ? <section className="relax-choice"><strong>Pause before the next task</strong><div>{([0, 5, 10, 15] as PostTaskBreakMinutes[]).map((minutes) => <button key={minutes} type="button" className={props.relaxMinutes === minutes ? "active" : ""} onClick={() => props.onRelaxChange?.(minutes)}>{minutes === 0 ? "Start now" : `${minutes} min`}</button>)}</div>{props.result.postTaskBreak ? <small>Replan can keep {props.result.postTaskBreak.minutes} minutes free.</small> : null}</section> : null}<div className="proposal-changes">{changes.length === 0 ? <p className="muted">The remaining schedule already fits.</p> : changes.map((entry) => <article key={`${entry.taskId}-${entry.type}`}><strong>{taskMap.get(entry.taskId)?.title ?? entry.taskId}</strong><span>{describeChange(entry)}</span></article>)}</div><details><summary>Why these changes?</summary><ul>{props.result.reasons.slice(0, 4).map((reason, index) => <li key={`${reason.code}-${index}`}>{reason.summary}</li>)}</ul></details></> : <section className="proposal-error"><strong>{issue?.title ?? "This update cannot be applied"}</strong><p>{issue?.detail ?? "A hard scheduling constraint blocks this change."}</p></section>}<footer><button type="button" onClick={props.onKeep}>Keep current</button><button className="primary-action" type="button" disabled={props.result.status !== "feasible"} onClick={props.onApply}>Apply replan</button></footer></aside></div>;
}

function describeChange(entry: NonNullable<ScheduleResult["diff"]>[number]): string {
  if (entry.type === "moved" && entry.before && entry.after) return `${formatTime(entry.before.start)} to ${formatTime(entry.after.start)}${entry.deltaMinutes ? ` (${entry.deltaMinutes < 0 ? "earlier" : "later"} ${formatDurationCompact(entry.deltaMinutes)})` : ""}`;
  if (entry.type === "resized" && entry.after) return `Ends at ${formatTime(entry.after.end)}`;
  if (entry.type === "removed") return "Removed from the remaining day";
  if (entry.type === "added" && entry.after) return `Starts at ${formatTime(entry.after.start)}`;
  return "Updated";
}
