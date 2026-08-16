"use client";

import { useState } from "react";
import type { ScheduledTask, Task } from "../scheduler";
import { categoryForTask, categoryLabel } from "../lib/taskCategories";
import { formatDurationCompact, formatTime } from "../lib/time";
import DayCalendar from "./DayCalendar";
import TaskForm from "./TaskForm";
import type { WeatherTaskStatus } from "../lib/weather";

interface PlanViewProps { tasks: Task[]; schedule: ScheduledTask[]; dayStart: Date; dayEnd: Date; onSaveTask: (task: Task, placement?: ScheduledTask) => void; onRemoveTask: (taskId: string) => void; onFindTime: (taskId: string) => void; onOptimize: () => void; notice?: string; weatherStatusByTaskId?: Record<string, WeatherTaskStatus>; }

export default function PlanView(props: PlanViewProps) {
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const scheduledIds = new Set(props.schedule.map((item) => item.taskId));
  const unscheduled = props.tasks.filter((task) => task.status === "planned" && !scheduledIds.has(task.id));
  const editingTask = props.tasks.find((task) => task.id === editingTaskId);
  return <main className="plan-shell"><header className="plan-header"><div><p className="eyebrow">Constraint-aware planning</p><h1>Plan your day</h1><p>Fixed commitments stay anchored while flexible tasks can find their best legal time.</p></div><button className="primary-action" type="button" onClick={props.onOptimize}>Optimize day</button></header>{props.notice ? <p className="notice" role="status">{props.notice}</p> : null}<div className="plan-grid"><aside className="task-panel"><TaskForm baseDate={props.dayStart} task={editingTask} onSave={(task, placement) => { props.onSaveTask(task, placement); setEditingTaskId(null); }} onCancel={() => setEditingTaskId(null)} /><h2>Unscheduled tasks</h2>{unscheduled.length === 0 ? <p className="muted">Everything has a time.</p> : unscheduled.map((task) => <article className="task-card" key={task.id}><strong>{task.title}</strong><span>{categoryLabel(categoryForTask(task))} · {formatDurationCompact(task.durationMinutes)}</span>{task.deadline ? <small>Due {formatTime(task.deadline)}</small> : null}{props.weatherStatusByTaskId?.[task.id] ? <small className={`weather-state ${props.weatherStatusByTaskId[task.id].state}`}>{props.weatherStatusByTaskId[task.id].summary}</small> : null}<div><button type="button" onClick={() => props.onFindTime(task.id)}>Find a time</button><button type="button" onClick={() => setEditingTaskId(task.id)}>Edit</button><button type="button" onClick={() => props.onRemoveTask(task.id)}>Remove</button></div></article>)}</aside><section className="schedule-panel"><h2>Today</h2><DayCalendar tasks={props.tasks} schedule={props.schedule} dayStart={props.dayStart} dayEnd={props.dayEnd} onTaskClick={setEditingTaskId} weatherStatusByTaskId={props.weatherStatusByTaskId} /></section></div></main>;
}
