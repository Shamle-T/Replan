"use client";

import { useState } from "react";
import type { ScheduledTask, Task, TaskCategory, TaskPriority } from "../scheduler";
import { dateFromTimeInput, timeInputValue } from "../lib/time";
import { TASK_CATEGORIES } from "../lib/taskCategories";
import { PRIORITY_CHOICES, normalizePriority, type PriorityChoice } from "../lib/taskPriorities";

interface TaskFormProps {
  baseDate: Date;
  task?: Task;
  onSave: (task: Task, placement?: ScheduledTask) => void;
  onCancel: () => void;
}

type TaskKind = "flexible" | "fixed";
const DURATION_PRESETS = [15, 30, 45, 60, 90, 120, 180] as const;

export default function TaskForm({ baseDate, task, onSave, onCancel }: TaskFormProps) {
  const [kind, setKind] = useState<TaskKind>(task?.fixedStart ? "fixed" : "flexible");
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [presetDuration, setPresetDuration] = useState(task?.durationMinutes ?? 60);
  const [customDuration, setCustomDuration] = useState("");
  const [priority, setPriority] = useState<PriorityChoice>(normalizePriority(task?.priority ?? 3));
  const [category, setCategory] = useState<TaskCategory>(task?.category ?? "other");
  const [deadline, setDeadline] = useState(timeInputValue(task?.deadline));
  const [earliest, setEarliest] = useState(timeInputValue(task?.earliestStart));
  const [latest, setLatest] = useState(timeInputValue(task?.latestEnd));
  const [fixedStart, setFixedStart] = useState(timeInputValue(task?.fixedStart));
  const [fixedEnd, setFixedEnd] = useState(timeInputValue(task?.fixedEnd));
  const [optional, setOptional] = useState(task?.optional ?? false);
  const [bufferMinutesAfter, setBufferMinutesAfter] = useState(task?.bufferMinutesAfter ?? 0);
  const [travelMinutesBefore, setTravelMinutesBefore] = useState(task?.travelMinutesBefore ?? 0);
  const [travelMinutesAfter, setTravelMinutesAfter] = useState(task?.travelMinutesAfter ?? 0);
  const [location, setLocation] = useState(task?.location ?? "");
  const [weatherSensitive, setWeatherSensitive] = useState(task?.weatherSensitive ?? false);
  const [weatherLocation, setWeatherLocation] = useState(task?.weatherLocation ?? "");
  const [error, setError] = useState("");

  const selectedDuration = customDuration ? Number(customDuration) : presetDuration;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!title.trim()) return setError("Give the task a name.");
    if (!Number.isInteger(selectedDuration) || selectedDuration < 5 || selectedDuration > 720) return setError("Duration must be between 5 and 720 minutes.");
    if (![bufferMinutesAfter, travelMinutesBefore, travelMinutesAfter].every((value) => Number.isInteger(value) && value >= 0 && value <= 180)) return setError("Intervals and travel times must be between 0 and 180 minutes.");
    if (weatherSensitive && !(weatherLocation.trim() || location.trim())) return setError("Add a location for an outdoor task.");

    const shared = {
      id: task?.id ?? crypto.randomUUID(), title: title.trim(), description: description.trim() || undefined,
      priority: priority as TaskPriority, category, optional, status: task?.status ?? ("planned" as const),
      bufferMinutesAfter: bufferMinutesAfter || undefined, travelMinutesBefore: travelMinutesBefore || undefined,
      travelMinutesAfter: travelMinutesAfter || undefined, location: location.trim() || undefined,
      weatherSensitive: weatherSensitive || undefined, weatherLocation: weatherLocation.trim() || undefined,
    };

    if (kind === "fixed") {
      const start = dateFromTimeInput(baseDate, fixedStart);
      const end = dateFromTimeInput(baseDate, fixedEnd);
      if (!start || !end || end <= start) return setError("Choose a fixed end time after its start time.");
      const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60_000);
      const nextTask: Task = { ...shared, durationMinutes, fixedStart: start, fixedEnd: end };
      onSave(nextTask, { taskId: nextTask.id, start, end });
      return;
    }

    const earliestStart = dateFromTimeInput(baseDate, earliest);
    const latestEnd = dateFromTimeInput(baseDate, latest);
    const deadlineDate = dateFromTimeInput(baseDate, deadline);
    if (earliestStart && latestEnd && latestEnd <= earliestStart) return setError("Latest finish must be after earliest start.");
    onSave({ ...shared, durationMinutes: selectedDuration, earliestStart, latestEnd, deadline: deadlineDate });
  };

  return <form className={`task-form form-kind-${kind}`} onSubmit={submit}>
    <div className="form-heading"><div><p className="eyebrow">{task ? "Edit schedule item" : "New commitment"}</p><h2>{task ? "Update task" : "Add task"}</h2></div><div className="segmented"><button type="button" className={kind === "flexible" ? "active" : ""} onClick={() => setKind("flexible")}>Flexible</button><button type="button" className={kind === "fixed" ? "active" : ""} onClick={() => setKind("fixed")}>Fixed</button></div></div>
    <label>Name<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
    <label>Description <span>optional</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} /></label>
    {kind === "flexible" ? <label>Duration<select value={customDuration ? "custom" : String(presetDuration)} onChange={(event) => { if (event.target.value === "custom") { setCustomDuration(String(presetDuration)); } else { setCustomDuration(""); setPresetDuration(Number(event.target.value)); } }}>{DURATION_PRESETS.map((minutes) => <option key={minutes} value={minutes}>{minutes} min</option>)}<option value="custom">Custom</option></select>{customDuration ? <input aria-label="Custom duration in minutes" type="number" min="5" max="720" value={customDuration} onChange={(event) => setCustomDuration(event.target.value)} /> : null}</label> : <div className="form-grid two"><label>Start<input type="time" value={fixedStart} onChange={(event) => setFixedStart(event.target.value)} required /></label><label>End<input type="time" value={fixedEnd} onChange={(event) => setFixedEnd(event.target.value)} required /></label></div>}
    <div className="form-grid two"><label>Priority<select value={priority} onChange={(event) => setPriority(Number(event.target.value) as PriorityChoice)}>{PRIORITY_CHOICES.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select></label><label>Category<select value={category} onChange={(event) => setCategory(event.target.value as TaskCategory)}>{TASK_CATEGORIES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label></div>
    {kind === "flexible" ? <><label>Deadline <span>optional</span><input type="time" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label><details className="form-details"><summary>More constraints</summary><div className="form-details-body"><div className="form-grid two"><label>Earliest start<input type="time" value={earliest} onChange={(event) => setEarliest(event.target.value)} /></label><label>Latest finish<input type="time" value={latest} onChange={(event) => setLatest(event.target.value)} /></label></div><label className="check-row"><input type="checkbox" checked={optional} onChange={(event) => setOptional(event.target.checked)} />Optional task</label></div></details></> : <label className="check-row"><input type="checkbox" checked={optional} onChange={(event) => setOptional(event.target.checked)} />Optional commitment</label>}
    <section className="task-interval-card"><strong>Interval after</strong><span>Reserve a pause before the next task.</span><div className="interval-buttons">{[0, 5, 10, 15].map((minutes) => <button key={minutes} type="button" className={bufferMinutesAfter === minutes ? "active" : ""} onClick={() => setBufferMinutesAfter(minutes)}>{minutes === 0 ? "None" : `${minutes} min`}</button>)}</div></section>
    <details className="form-details"><summary>Travel & conditions</summary><div className="form-details-body"><label>Location <span>optional</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Where does this happen?" /></label><div className="form-grid two"><label>Travel before<input type="number" min="0" max="180" step="5" value={travelMinutesBefore} onChange={(event) => setTravelMinutesBefore(Number(event.target.value))} /></label><label>Travel after<input type="number" min="0" max="180" step="5" value={travelMinutesAfter} onChange={(event) => setTravelMinutesAfter(Number(event.target.value))} /></label></div><label className="check-row"><input type="checkbox" checked={weatherSensitive} onChange={(event) => setWeatherSensitive(event.target.checked)} />Outdoor task</label>{weatherSensitive ? <label>Weather area<input value={weatherLocation} onChange={(event) => setWeatherLocation(event.target.value)} placeholder="City, suburb, or postcode" /></label> : null}</div></details>
    {error ? <p className="form-error" role="alert">{error}</p> : null}<div className="form-actions"><button type="button" onClick={onCancel}>Cancel</button><button className="primary-action" type="submit">{task ? "Save changes" : kind === "fixed" ? "Add commitment" : "Add to unscheduled"}</button></div>
  </form>;
}
