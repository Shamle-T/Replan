"use client";

import { useState } from "react";
import type {
  PostTaskBreak,
  ScheduledTask,
  ScheduleChange,
  Task,
} from "../scheduler";
import { parseUpdateMessage } from "../interactions/updateParser";
import type { SimulationSpeed } from "../lib/simulation";
import type { PendingProposal } from "./ReplanApp";
import { formatTime, formatTimeRange } from "../lib/time";
import { categoryForTask } from "../lib/taskCategories";
import type { WeatherTaskStatus } from "../lib/weather";
import { findCurrentPlacement, findNextPlacement, isTaskLiveEligible } from "../lib/liveActivity";
import DayCalendar from "./DayCalendar";
import NowCard from "./NowCard";
import SimulationControls from "./SimulationControls";
import TaskForm from "./TaskForm";
import ReplanProposal from "./ReplanProposal";

interface LiveDayViewProps {
  tasks: Task[];
  schedule: ScheduledTask[];
  dayStart: Date;
  dayEnd: Date;
  currentTime: Date;
  mode: "simulation" | "real";
  onModeChange: (mode: "simulation" | "real") => void;
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
  speed: SimulationSpeed;
  onSpeedChange: (speed: SimulationSpeed) => void;
  onNext: () => void;
  onReset: () => void;
  onChange: (change: ScheduleChange) => void;
  onAdjustCurrentTask: (taskId: string, deltaMinutes: number) => void;
  timeAdjustmentByTaskId: Record<string, number>;
  activeBreak: PostTaskBreak | null;
  onSaveTask: (task: Task, placement?: ScheduledTask) => string | void;
  weatherStatusByTaskId: Record<string, WeatherTaskStatus>;
  proposal: PendingProposal | null;
  recentFactChange: ScheduleChange | null;
  onApplyProposal: () => void;
  onDismissProposal: () => void;
  onRelaxChange?: (minutes: 0 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15) => void;
}

export default function LiveDayView({
  tasks,
  schedule,
  dayStart,
  dayEnd,
  currentTime,
  mode,
  onModeChange,
  playing,
  onPlayingChange,
  speed,
  onSpeedChange,
  onNext,
  onReset,
  onChange,
  onAdjustCurrentTask,
  timeAdjustmentByTaskId,
  activeBreak,
  onSaveTask,
  weatherStatusByTaskId,
  proposal,
  recentFactChange,
  onApplyProposal,
  onDismissProposal,
  onRelaxChange,
}: LiveDayViewProps) {
  const [message, setMessage] = useState("");
  const [parseMessage, setParseMessage] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const sorted = [...schedule].sort((a, b) => a.start.getTime() - b.start.getTime());
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const travelContext = findActiveTravelContext(sorted, taskMap, currentTime);

  // Resolve Now/Next from the schedule interval itself. This deliberately
  // tolerates legacy tasks whose persisted status was missing while still
  // excluding genuinely completed/cancelled/skipped work.
  const currentPlacement = findCurrentPlacement(sorted, taskMap, currentTime);
  const nextPlacement = findNextPlacement(sorted, taskMap, currentTime);

  const currentTask = currentPlacement ? taskMap.get(currentPlacement.taskId) : undefined;
  const nextTask = nextPlacement ? taskMap.get(nextPlacement.taskId) : undefined;
  const upcoming = sorted
    .filter(
      (item) =>
        isTaskLiveEligible(taskMap.get(item.taskId)) &&
        item.start.getTime() > currentTime.getTime(),
    )
    .slice(0, 4);
  const editingTask = editingTaskId ? taskMap.get(editingTaskId) : undefined;
  const previewChange = proposal?.change ?? recentFactChange;
  const editingPlacement = editingTaskId
    ? schedule.find((item) => item.taskId === editingTaskId)
    : undefined;

  const openEditor = (taskId: string) => {
    onPlayingChange(false);
    setEditingTaskId(taskId);
  };

  const submitUpdate = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = parseUpdateMessage(message, {
      currentTime,
      currentTask,
      currentPlacement,
    });

    if (!parsed.ok) {
      setParseMessage(parsed.message);
      return;
    }

    setParseMessage("");
    setMessage("");
    onChange(parsed.change);
  };

  return (
    <div className="page-wrap live-page calendar-workflow">
      <section className="live-status-grid">
        <NowCard
          currentTask={currentTask}
          currentPlacement={currentPlacement}
          currentTime={currentTime}
          activeBreak={activeBreak}
          travelContext={travelContext}
          previewChange={previewChange}
          previewTask={previewChange ? taskMap.get(previewChange.taskId) : undefined}
          onDone={() =>
            currentTask &&
            onChange({
              type: "TASK_COMPLETED",
              taskId: currentTask.id,
              actualEnd: currentTime,
            })
          }
          extraMinutes={currentTask ? timeAdjustmentByTaskId[currentTask.id] ?? 0 : 0}
          onAdjustTime={(deltaMinutes) => {
            if (!currentTask) return;
            onAdjustCurrentTask(currentTask.id, deltaMinutes);
          }}
          onCancel={() =>
            currentTask && onChange({ type: "TASK_CANCELLED", taskId: currentTask.id })
          }
          onSkip={() =>
            currentTask && onChange({ type: "TASK_SKIPPED", taskId: currentTask.id })
          }
        />

        <article className={`live-next-card ${nextTask ? `category-accent-${categoryForTask(nextTask)}` : ""}`}>
          <div className="live-card-kicker muted">Next</div>
          {nextTask && nextPlacement ? (
            <>
              <button className="next-task-edit" type="button" onClick={() => openEditor(nextTask.id)}>
                <h3>{nextTask.title}</h3>
                <p>{formatTimeRange(nextPlacement.start, nextPlacement.end)}</p>
              </button>
              <span className="next-distance">
                In {Math.max(0, Math.ceil((nextPlacement.start.getTime() - currentTime.getTime()) / 60_000))} min
              </span>
            </>
          ) : (
            <>
              <h3>Nothing queued</h3>
              <p>Your remaining day is clear.</p>
            </>
          )}
        </article>
      </section>

      <section className="live-calendar-layout">
        <aside className="upcoming-panel panel live-side-stack">
          <div className="section-label-row">
            <span>Upcoming</span>
            <strong>{upcoming.length}</strong>
          </div>
          <div className="upcoming-list">
            {upcoming.length > 0 ? (
              upcoming.map((placement) => {
                const task = taskMap.get(placement.taskId);
                if (!task) return null;
                return (
                  <button
                    className={`upcoming-item category-accent-${categoryForTask(task)}`}
                    type="button"
                    key={`${placement.taskId}-${placement.start.toISOString()}`}
                    onClick={() => openEditor(task.id)}
                  >
                    <span className="upcoming-time">{formatTime(placement.start)}</span>
                    <div>
                      <strong>{task.title}</strong>
                      <span>{formatTimeRange(placement.start, placement.end)}</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="mini-empty">No more tasks.</div>
            )}
          </div>

          {proposal ? (
            <div className="live-inline-proposal-wrap">
              <ReplanProposal
                title={proposal.title}
                result={proposal.result}
                tasks={tasks}
                currentTime={currentTime}
                relaxMinutes={proposal.relaxMinutes}
                kind={proposal.kind}
                previousScore={proposal.previousScore}
                proposedScore={proposal.proposedScore}
                previousOpenMinutes={proposal.previousOpenMinutes}
                proposedOpenMinutes={proposal.proposedOpenMinutes}
                onRelaxChange={onRelaxChange}
                onApply={onApplyProposal}
                onKeep={onDismissProposal}
                inline
              />
            </div>
          ) : null}
        </aside>

        <section className="calendar-panel panel">
          <div className="calendar-panel-heading">
            <span>{proposal?.result.status === "feasible" ? "Proposed timeline changes" : "Day timeline"}</span>
            <strong>{formatTime(currentTime)}</strong>
          </div>
          <DayCalendar
            tasks={tasks}
            schedule={proposal?.result.status === "feasible" ? proposal.result.schedule : schedule}
            dayStart={dayStart}
            dayEnd={dayEnd}
            currentTime={currentTime}
            showOpenTime
            onTaskClick={openEditor}
            weatherStatusByTaskId={weatherStatusByTaskId}
            highlightDiff={proposal?.result.diff ?? []}
          />
        </section>
      </section>

      {!activeBreak ? (
        <section className="quick-update-bar">
          <form className="update-form-clean" onSubmit={submitUpdate}>
            <span className="command-icon">⌁</span>
            <input
              aria-label="Quick schedule update"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Tell Replan what changed…"
            />
            <button className="send-update" type="submit" aria-label="Send update">↵</button>
          </form>
          {parseMessage ? <p className="parser-feedback">{parseMessage}</p> : null}
        </section>
      ) : null}

      <SimulationControls
        mode={mode}
        onModeChange={onModeChange}
        currentTime={currentTime}
        playing={playing}
        onPlayingChange={onPlayingChange}
        speed={speed}
        onSpeedChange={onSpeedChange}
        onNext={onNext}
        onReset={onReset}
      />

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


type ActiveTravelContext = {
  direction: "to" | "from";
  task: Task;
  start: Date;
  end: Date;
};

function findActiveTravelContext(
  sortedSchedule: ScheduledTask[],
  taskMap: Map<string, Task>,
  currentTime: Date,
): ActiveTravelContext | null {
  const now = currentTime.getTime();

  for (const placement of sortedSchedule) {
    const task = taskMap.get(placement.taskId);
    if (!task) continue;

    const beforeMinutes = Math.max(0, task.travelMinutesBefore ?? 0);
    if (beforeMinutes > 0) {
      const start = new Date(placement.start.getTime() - beforeMinutes * 60_000);
      if (start.getTime() <= now && now < placement.start.getTime()) {
        return { direction: "to", task, start, end: placement.start };
      }
    }

    const afterMinutes = Math.max(0, task.travelMinutesAfter ?? 0);
    if (afterMinutes > 0) {
      const end = new Date(placement.end.getTime() + afterMinutes * 60_000);
      if (placement.end.getTime() <= now && now < end.getTime()) {
        return { direction: "from", task, start: placement.end, end };
      }
    }
  }

  return null;
}
