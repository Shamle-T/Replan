"use client";

import { useEffect, useState } from "react";
import { findPreferredTime, optimizeSchedule, replanSchedule, type PostTaskBreakMinutes, type ScheduleChange, type ScheduleResult, type ScheduledTask, type Task } from "../scheduler";
import { applyChangeToTasks } from "../interactions/scheduleChanges";
import { createDemoState } from "../lib/demo";
import { loadReplanState, saveReplanState } from "../lib/storage";
import { advanceSimulatedTime, nextScheduleBoundary, type SimulationSpeed } from "../lib/simulation";
import LiveDayView from "./LiveDayView";
import PlanView from "./PlanView";
import ReplanProposal from "./ReplanProposal";

interface PendingProposal { change: ScheduleChange; result: ScheduleResult; baseTasks: Task[]; baseSchedule: ScheduledTask[]; relaxMinutes?: PostTaskBreakMinutes; }

export default function ReplanApp() {
  const [initial] = useState(() => createDemoState(new Date()));
  const [tasks, setTasks] = useState<Task[]>(initial.tasks);
  const [schedule, setSchedule] = useState<ScheduledTask[]>(initial.schedule);
  const [notice, setNotice] = useState<string>();
  const [view, setView] = useState<"plan" | "live">("plan");
  const [currentTime, setCurrentTime] = useState(initial.currentTime);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<SimulationSpeed>(5);
  const [proposal, setProposal] = useState<PendingProposal | null>(null);
  const options = { currentTime, dayStart: initial.dayStart, dayEnd: initial.dayEnd, slotMinutes: 30 };

  useEffect(() => { const saved = loadReplanState(); if (saved) { setTasks(saved.tasks); setSchedule(saved.schedule); } }, []);
  useEffect(() => { saveReplanState({ tasks, schedule }); }, [tasks, schedule]);
  useEffect(() => { if (!playing) return; const timer = window.setInterval(() => setCurrentTime((time) => advanceSimulatedTime(time, 1_000, speed)), 1_000); return () => window.clearInterval(timer); }, [playing, speed]);

  const optimize = () => { const result = optimizeSchedule(tasks, { ...options, previousSchedule: schedule }); setSchedule(result.schedule); setNotice(result.status === "feasible" ? `Optimized ${result.schedule.length} activities.` : result.issues[0]?.message ?? "No feasible schedule found."); };
  const findTime = (taskId: string) => { const result = findPreferredTime(taskId, tasks, schedule, options); if (result.status === "feasible") { setSchedule(result.result.schedule); setNotice("Found a legal time for the task."); return; } setNotice("issues" in result.result ? result.result.issues[0]?.message ?? "No legal time found." : "No legal time found."); };
  const saveTask = (task: Task, placement?: ScheduledTask) => { setTasks((current) => current.some((item) => item.id === task.id) ? current.map((item) => item.id === task.id ? task : item) : [...current, task]); setSchedule((current) => placement ? [...current.filter((item) => item.taskId !== task.id), placement] : current); setNotice(placement ? "Fixed commitment saved and anchored in the day." : "Task saved. Use Find a time or Optimize day to schedule it."); };
  const proposeLiveChange = (change: ScheduleChange) => { const relaxMinutes: PostTaskBreakMinutes | undefined = change.type === "TASK_COMPLETED" ? 10 : undefined; const result = replanSchedule(tasks, schedule, change, { ...options, postTaskBreakMinutes: relaxMinutes }); setProposal({ change, result, baseTasks: tasks, baseSchedule: schedule, relaxMinutes }); };
  const updateRelax = (relaxMinutes: PostTaskBreakMinutes) => { setProposal((current) => { if (!current) return null; const result = replanSchedule(current.baseTasks, current.baseSchedule, current.change, { ...options, postTaskBreakMinutes: relaxMinutes }); return { ...current, relaxMinutes, result }; }); };
  const applyProposal = () => { if (!proposal || proposal.result.status !== "feasible") return; const nextTasks = applyChangeToTasks(proposal.baseTasks, proposal.baseSchedule, proposal.change); setTasks(nextTasks); setSchedule(proposal.result.schedule); setNotice("Replan applied to the remaining day."); setProposal(null); };
  const nextEvent = () => { const boundary = nextScheduleBoundary(currentTime, schedule); if (boundary) setCurrentTime(boundary); };

  return <><nav className="app-nav"><button type="button" className={view === "plan" ? "active" : ""} onClick={() => setView("plan")}>Plan</button><button type="button" className={view === "live" ? "active" : ""} onClick={() => setView("live")}>Live Day</button></nav>{view === "plan" ? <PlanView tasks={tasks} schedule={schedule} dayStart={initial.dayStart} dayEnd={initial.dayEnd} onSaveTask={saveTask} onRemoveTask={(id) => { setTasks((items) => items.filter((task) => task.id !== id)); setSchedule((items) => items.filter((item) => item.taskId !== id)); }} onFindTime={findTime} onOptimize={optimize} notice={notice} /> : <LiveDayView tasks={tasks} schedule={schedule} currentTime={currentTime} playing={playing} speed={speed} onPlayingChange={setPlaying} onSpeedChange={setSpeed} onNext={nextEvent} onReset={() => { setCurrentTime(initial.currentTime); setPlaying(false); }} onChange={proposeLiveChange} notice={notice} />}{proposal ? <ReplanProposal result={proposal.result} tasks={tasks} currentTime={currentTime} relaxMinutes={proposal.relaxMinutes} onRelaxChange={proposal.relaxMinutes !== undefined ? updateRelax : undefined} onApply={applyProposal} onKeep={() => setProposal(null)} /> : null}</>;
}
