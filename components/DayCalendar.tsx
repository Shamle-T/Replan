"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  bufferMinutesAfterTask,
  findScheduleGaps,
  travelMinutesAfterTask,
  travelMinutesForTask,
  type ScheduleDiffEntry,
  type ScheduledTask,
  type PostTaskBreak,
  type Task,
} from "../scheduler";
import { formatDurationCompact, formatTime, formatTimeRange } from "../lib/time";
import { categoryForTask, categoryLabel } from "../lib/taskCategories";
import { priorityLabel } from "../lib/taskPriorities";
import type { WeatherTaskStatus } from "../lib/weather";

interface DayCalendarProps {
  tasks: Task[];
  schedule: ScheduledTask[];
  dayStart: Date;
  dayEnd: Date;
  currentTime?: Date;
  compact?: boolean;
  showOpenTime?: boolean;
  onTaskClick?: (taskId: string) => void;
  weatherStatusByTaskId?: Record<string, WeatherTaskStatus>;
  highlightDiff?: ScheduleDiffEntry[];
  postTaskBreak?: PostTaskBreak | null;
}

const HOUR_HEIGHT = 58;
const DISPLAY_LEAD_MINUTES = 30;

export default function DayCalendar({
  tasks,
  schedule,
  dayStart,
  dayEnd,
  currentTime,
  compact = false,
  showOpenTime = false,
  onTaskClick,
  weatherStatusByTaskId = {},
  highlightDiff = [],
  postTaskBreak = null,
}: DayCalendarProps) {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [hoveredOpenGapKey, setHoveredOpenGapKey] = useState<string | null>(null);
  const diffMap = useMemo(
    () => new Map(highlightDiff.map((entry) => [entry.taskId, entry])),
    [highlightDiff],
  );
  // The scheduler still starts at 06:00. The canvas begins at 05:30 only so
  // the 06:00 label and any travel leading into a 06:00 event are fully visible.
  const displayStart = new Date(dayStart.getTime() - DISPLAY_LEAD_MINUTES * 60_000);
  const totalMinutes = Math.max(60, (dayEnd.getTime() - displayStart.getTime()) / 60_000);
  const calendarHeight = (totalMinutes / 60) * HOUR_HEIGHT;
  const hourCount = Math.round((dayEnd.getTime() - dayStart.getTime()) / 3_600_000);
  const hours = Array.from({ length: hourCount + 1 }, (_, index) =>
    new Date(dayStart.getTime() + index * 60 * 60_000),
  );

  const currentOffset = currentTime
    ? (currentTime.getTime() - displayStart.getTime()) / 60_000
    : -1;
  const currentVisible = currentOffset >= 0 && currentOffset <= totalMinutes;
  const openGaps = showOpenTime
    ? findScheduleGaps(schedule, tasks, dayStart, dayEnd)
        .flatMap((gap) => subtractBreakFromGap(gap, postTaskBreak))
        .filter((gap) => gap.minutes > 0)
    : [];
  const visibleBreak = postTaskBreak && postTaskBreak.end.getTime() > displayStart.getTime() && postTaskBreak.start.getTime() < dayEnd.getTime()
    ? {
        start: new Date(Math.max(postTaskBreak.start.getTime(), displayStart.getTime())),
        end: new Date(Math.min(postTaskBreak.end.getTime(), dayEnd.getTime())),
      }
    : null;

  const topFor = (date: Date) =>
    (((date.getTime() - displayStart.getTime()) / 60_000) / 60) * HOUR_HEIGHT;

  return (
    <div className={`day-calendar ${compact ? "day-calendar-compact" : ""}`}>
      <div className="calendar-header-row">
        <span className="calendar-eyebrow">Today</span>
        <span className="calendar-count">
          {schedule.length} {schedule.length === 1 ? "task" : "tasks"} scheduled
        </span>
      </div>

      <div className="calendar-scroll">
        <div className="calendar-canvas" style={{ height: `${calendarHeight}px` }}>
          {hours.map((hour) => (
            <div
              className="calendar-hour"
              key={hour.toISOString()}
              style={{ top: `${topFor(hour)}px` }}
            >
              <span>{formatTime(hour)}</span>
              <i aria-hidden="true" />
            </div>
          ))}

          <div className="calendar-events-layer">
            {visibleBreak ? (
              <div
                className="calendar-post-task-break"
                style={{
                  top: `${topFor(visibleBreak.start)}px`,
                  height: `${Math.max(5, ((visibleBreak.end.getTime() - visibleBreak.start.getTime()) / 60_000 / 60) * HOUR_HEIGHT - 1)}px`,
                }}
                aria-label={`Relax break, ${formatTimeRange(visibleBreak.start, visibleBreak.end)}`}
                title={`Relax break: ${formatTimeRange(visibleBreak.start, visibleBreak.end)}`}
              >
                {postTaskBreak?.minutes && postTaskBreak.minutes >= 10 ? <span>{postTaskBreak.minutes}m relax</span> : null}
              </div>
            ) : null}

            {openGaps.map((gap) => {
              const top = topFor(gap.start);
              const height = Math.max(3, (gap.minutes / 60) * HOUR_HEIGHT - 1);
              const gapKey = `open-${gap.start.toISOString()}-${gap.end.toISOString()}`;
              const showDuration = height >= 28;

              return (
                <article
                  className={`calendar-open-time ${showDuration ? "open-time-readable" : "open-time-micro"}`}
                  key={gapKey}
                  style={{ top: `${top}px`, height: `${height}px` }}
                  tabIndex={0}
                  aria-label={`Available ${formatTimeRange(gap.start, gap.end)}, ${formatDuration(gap.minutes)}`}
                  onMouseEnter={() => setHoveredOpenGapKey(gapKey)}
                  onMouseLeave={() => setHoveredOpenGapKey((current) => current === gapKey ? null : current)}
                  onFocus={() => setHoveredOpenGapKey(gapKey)}
                  onBlur={() => setHoveredOpenGapKey((current) => current === gapKey ? null : current)}
                >
                  {showDuration ? <strong className="open-time-duration">{formatDuration(gap.minutes)} available</strong> : null}
                </article>
              );
            })}

            {schedule.flatMap((placement) => {
              const task = taskMap.get(placement.taskId);
              if (!task) return [];

              const category = categoryForTask(task);
              const shiftEntry = diffMap.get(task.id);
              const categoryClass = `category-${category}`;
              const travelClass = task.fixedStart ? "travel-fixed" : categoryClass;
              const duration = (placement.end.getTime() - placement.start.getTime()) / 60_000;
              const top = topFor(placement.start);
              const naturalHeight = (duration / 60) * HOUR_HEIGHT;
              // Never inflate short tasks into fake 30-minute cards. Tiny events keep
              // their real vertical position and reveal a full detail card on hover/focus.
              const height = Math.max(4, naturalHeight);
              const micro = duration < 30;
              const isCurrent = Boolean(
                currentTime &&
                  placement.start.getTime() <= currentTime.getTime() &&
                  currentTime.getTime() < placement.end.getTime(),
              );
              const isPast = Boolean(currentTime && placement.end.getTime() <= currentTime.getTime());
              const variant = task.fixedStart ? "fixed" : task.optional ? "optional" : "flexible";
              const travelBefore = travelMinutesForTask(task);
              const travelAfter = travelMinutesAfterTask(task);
              const bufferAfter = bufferMinutesAfterTask(task);
              const weather = weatherStatusByTaskId[task.id];
              const elements: ReactNode[] = [];

              if (travelBefore > 0) {
                const travelStart = new Date(placement.start.getTime() - travelBefore * 60_000);
                const travelTop = topFor(travelStart);
                const travelHeight = Math.max(5, (travelBefore / 60) * HOUR_HEIGHT - 1);
                if (travelStart.getTime() >= displayStart.getTime()) {
                  elements.push(
                    <div
                      className={`calendar-travel travel-before ${travelClass}`}
                      key={`travel-before-${placement.taskId}-${placement.start.toISOString()}`}
                      style={{ top: `${travelTop}px`, height: `${travelHeight}px` }}
                      title={`Leave ${travelBefore} minutes before ${task.title}`}
                    >
                      {travelHeight >= 10 ? <span>→ To event · {travelBefore} min</span> : null}
                    </div>,
                  );
                }
              }

              elements.push(
                <button
                  type="button"
                  className={`calendar-event ${variant} ${categoryClass} ${micro ? "micro-event" : ""} ${isCurrent ? "current" : ""} ${isPast ? "past" : ""} ${onTaskClick ? "editable" : ""}`}
                  key={`${placement.taskId}-${placement.start.toISOString()}`}
                  style={{ top: `${top}px`, height: `${height}px` }}
                  onClick={() => onTaskClick?.(task.id)}
                  aria-label={`${task.title}, ${formatTime(placement.start)} to ${formatTime(placement.end)}${onTaskClick ? ", edit task" : ""}`}
                  onMouseEnter={() => setHoveredTaskId(task.id)}
                  onMouseLeave={() => setHoveredTaskId((current) => current === task.id ? null : current)}
                  onFocus={() => setHoveredTaskId(task.id)}
                  onBlur={() => setHoveredTaskId((current) => current === task.id ? null : current)}
                >
                  {!micro ? (
                    <>
                      <div className="calendar-event-title-row">
                        <strong>{task.title}</strong>
                        <div className="calendar-event-time-actions">
                          <span className="calendar-event-time">{formatTimeRange(placement.start, placement.end)}</span>
                          {shiftEntry && shiftEntry.type !== "unchanged" ? (
                            <span className={`calendar-shift-chip ${shiftTone(shiftEntry)}`}>
                              {shiftLabel(shiftEntry)}
                            </span>
                          ) : (
                            <span className="calendar-shift-slot" aria-hidden="true" />
                          )}
                        </div>
                      </div>
                      <div className="calendar-meta-row">
                        <small>{categoryLabel(category)}</small>
                        {task.fixedStart ? <small>◆ Fixed</small> : null}
                        {weather?.current ? (
                          <small>{weather.current.icon} {weather.current.label}</small>
                        ) : weather?.state === "ready" ? <small>Weather checked</small> : null}
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="micro-event-mark" aria-hidden="true" />
                      {shiftEntry && shiftEntry.type !== "unchanged" ? (
                        <span className={`calendar-shift-chip micro-shift-chip ${shiftTone(shiftEntry)}`}>
                          {shiftLabel(shiftEntry)}
                        </span>
                      ) : null}
                    </>
                  )}

                </button>,
              );

              if (travelAfter > 0) {
                const travelTop = topFor(placement.end);
                const travelHeight = Math.max(5, (travelAfter / 60) * HOUR_HEIGHT - 1);
                if (placement.end.getTime() < dayEnd.getTime()) {
                  elements.push(
                    <div
                      className={`calendar-travel travel-after ${travelClass}`}
                      key={`travel-after-${placement.taskId}-${placement.end.toISOString()}`}
                      style={{ top: `${travelTop}px`, height: `${travelHeight}px` }}
                      title={`${travelAfter} minutes reserved after ${task.title}`}
                    >
                      {travelHeight >= 10 ? <span>← From event · {travelAfter} min</span> : null}
                    </div>,
                  );
                }
              }

              if (bufferAfter > 0) {
                const bufferStart = new Date(placement.end.getTime() + travelAfter * 60_000);
                const bufferTop = topFor(bufferStart);
                const bufferHeight = Math.max(3, (bufferAfter / 60) * HOUR_HEIGHT - 1);
                if (bufferStart.getTime() < dayEnd.getTime()) {
                  elements.push(
                    <div
                      className="calendar-task-buffer"
                      key={`buffer-after-${placement.taskId}-${placement.end.toISOString()}`}
                      style={{ top: `${bufferTop}px`, height: `${bufferHeight}px` }}
                      title={`${bufferAfter} minute interval after ${task.title}`}
                    >
                      {bufferHeight >= 12 ? <span>{bufferAfter}m interval</span> : null}
                    </div>,
                  );
                }
              }

              return elements;
            })}

            {hoveredTaskId ? (
              <FloatingEventPopover
                task={taskMap.get(hoveredTaskId)}
                placement={schedule.find((item) => item.taskId === hoveredTaskId)}
                weather={weatherStatusByTaskId[hoveredTaskId]}
                topFor={topFor}
                calendarHeight={calendarHeight}
              />
            ) : null}

            {hoveredOpenGapKey ? (
              <FloatingOpenTimePopover
                gap={openGaps.find((gap) => `open-${gap.start.toISOString()}-${gap.end.toISOString()}` === hoveredOpenGapKey)}
                topFor={topFor}
                calendarHeight={calendarHeight}
              />
            ) : null}

            {currentTime && currentVisible ? (
              <div
                className="current-time-line"
                style={{ top: `${(currentOffset / 60) * HOUR_HEIGHT}px` }}
                aria-label={`Current time ${formatTime(currentTime)}`}
              >
                <span className="current-time-chip">{formatTime(currentTime)}</span>
                <b aria-hidden="true" />
                <i aria-hidden="true" />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function shiftLabel(entry: ScheduleDiffEntry): string {
  if (entry.type === "moved" && entry.deltaMinutes) {
    const minutes = Math.abs(entry.deltaMinutes);
    return `${entry.deltaMinutes < 0 ? "−" : "+"}${formatShiftMinutes(minutes)}`;
  }
  if (entry.type === "resized" && entry.deltaMinutes) {
    return `${entry.deltaMinutes < 0 ? "−" : "+"}${formatShiftMinutes(Math.abs(entry.deltaMinutes))}`;
  }
  if (entry.type === "added") return "Added";
  if (entry.type === "removed") return "Removed";
  return "Updated";
}

function shiftTone(entry: ScheduleDiffEntry): string {
  if (entry.type === "moved") return "shifted";
  if (entry.type === "resized") return "resized";
  return "neutral";
}

function formatShiftMinutes(minutes: number): string {
  return formatDurationCompact(minutes);
}

function FloatingEventPopover({
  task,
  placement,
  weather,
  topFor,
  calendarHeight,
}: {
  task?: Task;
  placement?: ScheduledTask;
  weather?: WeatherTaskStatus;
  topFor: (date: Date) => number;
  calendarHeight: number;
}) {
  if (!task || !placement) return null;
  const duration = (placement.end.getTime() - placement.start.getTime()) / 60_000;
  const travelBefore = travelMinutesForTask(task);
  const travelAfter = travelMinutesAfterTask(task);
  const bufferAfter = bufferMinutesAfterTask(task);
  const category = categoryForTask(task);
  const eventTop = topFor(placement.start);
  const popoverTop = Math.max(8, Math.min(eventTop - 18, calendarHeight - 150));

  return (
    <div className="calendar-floating-popover" style={{ top: `${popoverTop}px` }} role="tooltip">
      <strong>{task.title}</strong>
      <span>{formatTimeRange(placement.start, placement.end)} · {Math.round(duration)} min</span>
      <span>{categoryLabel(category)} · {priorityLabel(task.priority)}</span>
      {task.description ? <span>{task.description}</span> : null}
      {travelBefore || travelAfter ? (
        <span>Travel: {travelBefore} min before · {travelAfter} min after</span>
      ) : null}
      {bufferAfter ? <span>Preferred interval after: {bufferAfter} min</span> : null}
      {weather?.current ? (
        <span>{weather.current.icon} {weather.current.label}{weather.current.temperatureC !== undefined ? ` · ${Math.round(weather.current.temperatureC)}°C` : ""}</span>
      ) : null}
    </div>
  );
}

function FloatingOpenTimePopover({
  gap,
  topFor,
  calendarHeight,
}: {
  gap?: { start: Date; end: Date; minutes: number };
  topFor: (date: Date) => number;
  calendarHeight: number;
}) {
  if (!gap) return null;
  const gapTop = topFor(gap.start);
  const popoverTop = Math.max(8, Math.min(gapTop - 18, calendarHeight - 112));

  return (
    <div className="calendar-floating-popover calendar-open-popover" style={{ top: `${popoverTop}px` }} role="tooltip">
      <strong>Available time</strong>
      <span>{formatTimeRange(gap.start, gap.end)}</span>
      <span>{formatDuration(gap.minutes)} available</span>
    </div>
  );
}

function formatDuration(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  if (hours === 0) return `${remainder} min`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

function subtractBreakFromGap(
  gap: { start: Date; end: Date; minutes: number },
  postTaskBreak: PostTaskBreak | null,
): Array<{ start: Date; end: Date; minutes: number }> {
  if (!postTaskBreak) return [gap];

  const breakStart = Math.max(gap.start.getTime(), postTaskBreak.start.getTime());
  const breakEnd = Math.min(gap.end.getTime(), postTaskBreak.end.getTime());
  if (breakStart >= breakEnd) return [gap];

  const pieces: Array<{ start: Date; end: Date; minutes: number }> = [];
  if (gap.start.getTime() < breakStart) {
    const end = new Date(breakStart);
    pieces.push({
      start: new Date(gap.start.getTime()),
      end,
      minutes: (end.getTime() - gap.start.getTime()) / 60_000,
    });
  }
  if (breakEnd < gap.end.getTime()) {
    const start = new Date(breakEnd);
    pieces.push({
      start,
      end: new Date(gap.end.getTime()),
      minutes: (gap.end.getTime() - breakEnd) / 60_000,
    });
  }
  return pieces;
}
