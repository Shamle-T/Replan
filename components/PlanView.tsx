"use client";

import { useState } from "react";
import type { OptimizationChangeExplanation, ScheduleDiffEntry, ScheduledTask, Task } from "../scheduler";
import type { PendingProposal } from "./ReplanApp";
import { formatDurationCompact, formatTime } from "../lib/time";
import { categoryForTask, categoryLabel } from "../lib/taskCategories";
import { priorityLabel } from "../lib/taskPriorities";
import type { WeatherTaskStatus } from "../lib/weather";
import { planQualityPercent } from "../lib/planQuality";
import DayCalendar from "./DayCalendar";
import TaskForm from "./TaskForm";

interface PlanViewProps {
  tasks: Task[];
  schedule: ScheduledTask[];
  dayStart: Date;
  dayEnd: Date;
  currentTime: Date;
  onSaveTask: (task: Task, placement?: ScheduledTask) => string | void;
  onRemoveTask: (taskId: string) => void;
  onFindTime: (taskId: string) => void;
  onOptimize: () => void;
  planScore: number;
  openMinutes: number;
  canOptimize: boolean;
  optimizeLabel: string;
  weatherLoading: boolean;
  weatherStatusByTaskId: Record<string, WeatherTaskStatus>;
  onRetryWeather: () => void;
  liveSuggestion: PendingProposal | null;
  recentAppliedDiff: ScheduleDiffEntry[];
  optimizationNotice: ScheduleDiffEntry[];
  optimizationExplanations: OptimizationChangeExplanation[];
  onDismissOptimizationNotice: () => void;
  onDismissLiveSuggestion: () => void;
}

export default function PlanView({
  tasks,
  schedule,
  dayStart,
  dayEnd,
  currentTime,
  onSaveTask,
  onRemoveTask,
  onFindTime,
  onOptimize,
  planScore,
  openMinutes,
  canOptimize,
  optimizeLabel,
  weatherLoading,
  weatherStatusByTaskId,
  onRetryWeather,
  liveSuggestion,
  recentAppliedDiff,
  optimizationNotice,
  optimizationExplanations,
  onDismissOptimizationNotice,
  onDismissLiveSuggestion,
}: PlanViewProps) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const scheduledIds = new Set(schedule.map((item) => item.taskId));
  const active = tasks.filter(
    (task) => task.status === "planned" || task.status === "in-progress",
  );
  const unscheduled = active.filter((task) => !scheduledIds.has(task.id));
  const editingTask = editingTaskId
    ? tasks.find((task) => task.id === editingTaskId)
    : undefined;
  const editingPlacement = editingTaskId
    ? schedule.find((item) => item.taskId === editingTaskId)
    : undefined;
  const optimizationChanges = optimizationNotice.filter((entry) => {
    const task = tasks.find((item) => item.id === entry.taskId);
    return entry.type !== "unchanged" && Boolean(task) && !task?.fixedStart;
  });
  const optimizationExplanationMap = new Map(
    optimizationExplanations.map((item) => [item.taskId, item]),
  );

  return (
    <div className="page-wrap plan-page calendar-workflow">
      <div className="plan-calendar-layout">
        <aside className="plan-side panel">
          <div className="section-label-row">
            <span>Unscheduled</span>
            <strong>{unscheduled.length}</strong>
          </div>

          <div className="plan-unscheduled-list">
            {unscheduled.length > 0 ? (
              unscheduled.map((task) => {
                const category = categoryForTask(task);
                const weather = weatherStatusByTaskId[task.id];
                const weatherWaiting = Boolean(task.weatherSensitive && weatherLoading && !weather);
                return (
                  <article className={`plan-unscheduled-card category-border-${category}`} key={task.id}>
                    <div className="unscheduled-title-row">
                      <div>
                        <span className={`category-dot category-${category}`} />
                        <strong>{task.title}</strong>
                      </div>
                      <div className="unscheduled-actions">
                        <button className="tiny-edit" type="button" onClick={() => setEditingTaskId(task.id)} aria-label={`Edit ${task.title}`}>Edit</button>
                        <button className="tiny-remove" type="button" onClick={() => onRemoveTask(task.id)} aria-label={`Remove ${task.title}`}>×</button>
                      </div>
                    </div>
                    <div className="task-chip-row">
                      <span>{categoryLabel(category)}</span>
                      <span>◷ {task.durationMinutes} min</span>
                      <span>{priorityLabel(task.priority)}</span>
                      {task.travelMinutesBefore ? <span>→ {task.travelMinutesBefore}m there</span> : null}
                      {task.travelMinutesAfter ? <span>← {task.travelMinutesAfter}m after</span> : null}
                      {task.bufferMinutesAfter ? <span>Pause {task.bufferMinutesAfter}m</span> : null}
                      {task.deadline ? <span>By {formatTime(task.deadline)}</span> : null}
                    </div>
                    {task.weatherSensitive ? (
                      <div className={`weather-task-status ${weather?.state ?? "loading"}`}>
                        <span>{weatherWaiting ? "Checking weather…" : weather?.state === "ready" ? `${weather.current?.icon ?? "☀"} ${weather.current?.label ?? "Weather checked"}` : weather?.state === "blocked" ? "☁ No clear slot today" : "Weather couldn’t load"}</span>
                        {weather ? <small>{weather.location} · Open-Meteo</small> : null}
                        {weather?.state === "error" ? (
                          <button className="weather-retry" type="button" onClick={onRetryWeather}>Retry</button>
                        ) : null}
                      </div>
                    ) : null}
                    <button
                      className={`find-time-button category-action-${category}`}
                      type="button"
                      onClick={() => onFindTime(task.id)}
                      disabled={weatherWaiting || weather?.state === "blocked" || weather?.state === "error"}
                    >
                      <span className="find-time-label">
                        {weatherWaiting
                          ? "Checking weather"
                          : weather?.state === "blocked" || weather?.state === "error"
                            ? "Keep open"
                            : <>Find a time <b aria-hidden="true">→</b></>}
                      </span>
                    </button>
                  </article>
                );
              })
            ) : (
              <div className="mini-empty">Everything has a time.</div>
            )}
          </div>


          <button className="add-task-outline" type="button" onClick={() => setComposerOpen(true)}>
            <span>＋</span> Add task
          </button>

          <details className="manage-tasks">
            <summary>Manage tasks</summary>
            <div>
              {active.map((task) => (
                <div className="manage-task-row" key={task.id}>
                  <button className="manage-task-name" type="button" onClick={() => setEditingTaskId(task.id)}>{task.title}</button>
                  <button type="button" onClick={() => onRemoveTask(task.id)}>Remove</button>
                </div>
              ))}
            </div>
          </details>
        </aside>

        <section className="plan-calendar-panel panel">
          <div className="plan-calendar-title">
            <div>
              <span className="calendar-eyebrow">Today</span>
              <h1>
                {dayStart.toLocaleDateString("en-US", {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                })}
              </h1>
            </div>
            <div className="plan-metrics">
              <span className="plan-score-pill" title="100% is the best theoretical plan quality; the scheduler still optimizes using its internal penalty score.">
                Plan quality <strong>{planQualityPercent(planScore)}%</strong>
              </span>
              <span className="plan-open-pill">{formatOpenMinutes(openMinutes)} open</span>
              <span className="plan-status-dot"><i /> {schedule.length} tasks scheduled</span>
            </div>
          </div>

          <DayCalendar
            tasks={tasks}
            schedule={schedule}
            dayStart={dayStart}
            dayEnd={dayEnd}
            compact
            currentTime={currentTime}
            showOpenTime
            onTaskClick={setEditingTaskId}
            weatherStatusByTaskId={weatherStatusByTaskId}
            highlightDiff={recentAppliedDiff}
          />

          <button
            className={`optimization-bar ${canOptimize ? "needs-optimization" : "optimized"}`}
            type="button"
            onClick={onOptimize}
            disabled={!canOptimize}
          >
            <span className="optimization-bar-icon">{canOptimize ? "✦" : "✓"}</span>
            <span className="optimization-bar-copy">
              <strong>{optimizeLabel}</strong>
              <small>{canOptimize ? "Compact flexible tasks around fixed commitments" : "Flexible tasks are packed as tightly as constraints allow"}</small>
            </span>
            <span className="optimization-bar-score">{planQualityPercent(planScore)}%</span>
          </button>

          {optimizationChanges.length > 0 ? (
            <aside className="optimization-result-card" aria-live="polite">
              <div className="optimization-result-head">
                <div>
                  <span>Day optimized</span>
                  <strong>{optimizationChanges.length} schedule update{optimizationChanges.length === 1 ? "" : "s"}</strong>
                </div>
                <button type="button" onClick={onDismissOptimizationNotice} aria-label="Dismiss optimization summary">×</button>
              </div>
              <div className="optimization-result-list">
                {optimizationChanges.slice(0, 6).map((entry) => {
                  const task = tasks.find((item) => item.id === entry.taskId);
                  if (!task || task.fixedStart || entry.type === "unchanged") return null;
                  return (
                    <div className="optimization-result-row optimization-result-row-explain" key={`${entry.taskId}-${entry.type}`} tabIndex={0}>
                      <strong>{task.title}</strong>
                      <span>{formatOptimizationMove(entry)}</span>
                      {optimizationExplanationMap.get(entry.taskId) ? (
                        <div className="optimization-reason-tooltip" role="tooltip">
                          <strong>Why Replan moved it</strong>
                          <p>{optimizationExplanationMap.get(entry.taskId)?.summary}</p>
                          {optimizationExplanationMap.get(entry.taskId)?.details.slice(0, 2).map((detail, index) => (
                            <small key={`${entry.taskId}-reason-${index}`}>{detail}</small>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </aside>
          ) : null}

          {liveSuggestion ? (
            <aside className="live-suggestion-card plan-live-suggestion" aria-live="polite">
              <div className="live-suggestion-head">
                <span>Recent schedule update</span>
                <button type="button" onClick={onDismissLiveSuggestion} aria-label="Dismiss update">×</button>
              </div>
              <strong>{liveSuggestion.title}</strong>
              <p>{summarizeLiveSuggestion(liveSuggestion)}</p>
              <div className="live-suggestion-tags">
                {liveSuggestion.result.diff?.filter((entry) => entry.type !== "unchanged").slice(0, 3).map((entry) => {
                  const task = tasks.find((item) => item.id === entry.taskId);
                  return (
                    <span key={`${entry.taskId}-${entry.type}`}>
                      {task?.title ?? entry.taskId} · {formatSuggestionChange(entry)}
                    </span>
                  );
                })}
              </div>
            </aside>
          ) : null}
        </section>
      </div>

      {composerOpen ? (
        <div className="task-modal-backdrop" role="presentation" onMouseDown={() => setComposerOpen(false)}>
          <div className="task-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <TaskForm
              baseDate={dayStart}
              onSave={(task, placement) => {
                const error = onSaveTask(task, placement);
                if (!error) setComposerOpen(false);
                return error;
              }}
              onCancel={() => setComposerOpen(false)}
            />
          </div>
        </div>
      ) : null}

      {editingTask ? (
        <div className="task-modal-backdrop" role="presentation" onMouseDown={() => setEditingTaskId(null)}>
          <div className="task-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <TaskForm
              baseDate={dayStart}
              initialTask={editingTask}
              initialPlacement={editingPlacement}
              onSave={(task, placement) => {
                const error = onSaveTask(task, placement);
                if (!error) setEditingTaskId(null);
                return error;
              }}
              onCancel={() => setEditingTaskId(null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
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


function summarizeLiveSuggestion(proposal: PendingProposal): string {
  const changeCount = proposal.result.diff?.filter((entry) => entry.type !== "unchanged").length ?? 0;
  if (proposal.change?.type === "TASK_COMPLETED") {
    return changeCount > 0
      ? `Replan found ${changeCount} timing update${changeCount === 1 ? "" : "s"} after finishing early.`
      : "Replan checked the rest of the day after the task finished.";
  }
  if (proposal.change?.type === "TASK_CANCELLED") {
    return changeCount > 0
      ? `Cancelling this task frees time and lets ${changeCount} part${changeCount === 1 ? "" : "s"} of the day move.`
      : "This task was removed from the day.";
  }
  if (proposal.change?.type === "TASK_SKIPPED") {
    return changeCount > 0
      ? `Skipping this task opens space for ${changeCount} timing change${changeCount === 1 ? "" : "s"}.`
      : "This task was skipped.";
  }
  if (proposal.change?.type === "TASK_OVERRUN") {
    return changeCount > 0
      ? `This overrun shifts ${changeCount} later task${changeCount === 1 ? "" : "s"}.`
      : "The task needs more time.";
  }
  return "Replan found a live scheduling update.";
}

function formatSuggestionChange(entry: ScheduleDiffEntry) {
  if (entry.type === "moved" && entry.deltaMinutes) {
    const abs = Math.abs(entry.deltaMinutes);
    return `${entry.deltaMinutes < 0 ? "earlier" : "later"} ${formatDurationCompact(abs)}`;
  }
  if (entry.type === "resized" && entry.deltaMinutes) return `${entry.deltaMinutes < 0 ? "−" : "+"}${formatDurationCompact(Math.abs(entry.deltaMinutes))}`;
  if (entry.type === "added") return "added";
  if (entry.type === "removed") return "removed";
  return "updated";
}


function formatOptimizationMove(entry: ScheduleDiffEntry): string {
  if (entry.type === "moved" && entry.before && entry.after) {
    const delta = entry.deltaMinutes ?? Math.round((entry.after.start.getTime() - entry.before.start.getTime()) / 60_000);
    const direction = delta < 0 ? "earlier" : "later";
    const amount = Math.abs(delta);
    const duration = formatDurationCompact(amount);
    return `${formatTime(entry.before.start)} → ${formatTime(entry.after.start)} · ${duration} ${direction}`;
  }
  if (entry.type === "resized" && entry.before && entry.after) {
    return `${formatTime(entry.before.end)} → ${formatTime(entry.after.end)}`;
  }
  if (entry.type === "added" && entry.after) return `Added at ${formatTime(entry.after.start)}`;
  if (entry.type === "removed") return "Removed";
  return "Updated";
}
