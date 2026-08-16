"use client";

import { useState } from "react";
import type { Task, TaskCategory, TaskPriority } from "../scheduler";
import { TASK_CATEGORIES } from "../lib/taskCategories";

interface TaskFormProps { task?: Task; onSave: (task: Task) => void; onCancel: () => void; }
export default function TaskForm({ task, onSave, onCancel }: TaskFormProps) {
  const [title, setTitle] = useState(task?.title ?? ""); const [duration, setDuration] = useState(String(task?.durationMinutes ?? 30)); const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 3); const [category, setCategory] = useState<TaskCategory>(task?.category ?? "other");
  const submit = (event: React.FormEvent) => { event.preventDefault(); const durationMinutes = Number(duration); if (!title.trim() || !Number.isFinite(durationMinutes) || durationMinutes <= 0) return; onSave({ ...task, id: task?.id ?? crypto.randomUUID(), title: title.trim(), durationMinutes, priority, category, optional: task?.optional ?? false, status: task?.status ?? "planned" }); };
  return <form className="task-form" onSubmit={submit}><h2>{task ? "Edit task" : "Add task"}</h2><label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label><label>Duration (minutes)<input type="number" min="5" step="5" value={duration} onChange={(event) => setDuration(event.target.value)} required /></label><label>Priority<select value={priority} onChange={(event) => setPriority(Number(event.target.value) as TaskPriority)}><option value="1">Nice to have</option><option value="3">Important</option><option value="5">Must do</option></select></label><label>Category<select value={category} onChange={(event) => setCategory(event.target.value as TaskCategory)}>{TASK_CATEGORIES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label><div><button className="primary-action" type="submit">{task ? "Save task" : "Add task"}</button>{task ? <button type="button" onClick={onCancel}>Cancel</button> : null}</div></form>;
}
