"use client";

import { useEffect, useState } from "react";
import { findPreferredTime, optimizeSchedule, type ScheduledTask, type Task } from "../scheduler";
import { createDemoState } from "../lib/demo";
import { loadReplanState, saveReplanState } from "../lib/storage";
import PlanView from "./PlanView";

export default function ReplanApp() {
  const [initial] = useState(() => createDemoState(new Date())); const [tasks, setTasks] = useState<Task[]>(initial.tasks); const [schedule, setSchedule] = useState<ScheduledTask[]>(initial.schedule); const [notice, setNotice] = useState<string>(); const options = { currentTime: initial.currentTime, dayStart: initial.dayStart, dayEnd: initial.dayEnd, slotMinutes: 30 };
  useEffect(() => { const saved = loadReplanState(); if (saved) { setTasks(saved.tasks); setSchedule(saved.schedule); } }, []); useEffect(() => { saveReplanState({ tasks, schedule }); }, [tasks, schedule]);
  const optimize = () => { const result = optimizeSchedule(tasks, { ...options, previousSchedule: schedule }); setSchedule(result.schedule); setNotice(result.status === "feasible" ? `Optimized ${result.schedule.length} activities.` : result.issues[0]?.message ?? "No feasible schedule found."); };
  const findTime = (taskId: string) => { const result = findPreferredTime(taskId, tasks, schedule, options); if (result.status === "feasible") { setSchedule(result.result.schedule); setNotice("Found a legal time for the task."); return; } setNotice("issues" in result.result ? result.result.issues[0]?.message ?? "No legal time found." : "No legal time found."); };
  const saveTask = (task: Task) => { setTasks((current) => current.some((item) => item.id === task.id) ? current.map((item) => item.id === task.id ? task : item) : [...current, task]); setSchedule((current) => current.filter((item) => item.taskId !== task.id)); setNotice("Task saved. Use Find a time or Optimize day to schedule it."); };
  return <PlanView tasks={tasks} schedule={schedule} dayStart={initial.dayStart} dayEnd={initial.dayEnd} onSaveTask={saveTask} onRemoveTask={(id) => { setTasks((items) => items.filter((task) => task.id !== id)); setSchedule((items) => items.filter((item) => item.taskId !== id)); }} onFindTime={findTime} onOptimize={optimize} notice={notice} />;
}
