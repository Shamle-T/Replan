"use client";

import { useEffect, useState } from "react";
import { diffSchedules, explainOptimizationChanges, findPreferredTime, optimizeSchedule, replanSchedule, scoreSchedule, type OptimizationChangeExplanation, type PostTaskBreakMinutes, type ScheduleChange, type ScheduleDiffEntry, type ScheduleResult, type ScheduledTask, type Task, type WeatherWindowsByTaskId } from "../scheduler";
import { applyChangeToTasks } from "../interactions/scheduleChanges";
import { createDemoState } from "../lib/demo";
import { loadReplanState, saveReplanState } from "../lib/storage";
import { advanceSimulatedTime, nextScheduleBoundary, type SimulationSpeed } from "../lib/simulation";
import { fetchWeatherConstraints, type WeatherTaskStatus } from "../lib/weather";
import LiveDayView from "./LiveDayView";
import PlanView from "./PlanView";
import ReplanProposal from "./ReplanProposal";

interface PendingProposal { change: ScheduleChange; result: ScheduleResult; baseTasks: Task[]; baseSchedule: ScheduledTask[]; relaxMinutes?: PostTaskBreakMinutes; }
interface OptimizationFeedback { diff: ScheduleDiffEntry[]; explanations: OptimizationChangeExplanation[]; score: number; }

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
  const [optimizationFeedback, setOptimizationFeedback] = useState<OptimizationFeedback | null>(null);
  const [weatherWindowsByTaskId, setWeatherWindowsByTaskId] = useState<WeatherWindowsByTaskId>({});
  const [weatherStatusByTaskId, setWeatherStatusByTaskId] = useState<Record<string, WeatherTaskStatus>>({});
  const options = { currentTime, dayStart: initial.dayStart, dayEnd: initial.dayEnd, slotMinutes: 30, weatherWindowsByTaskId };

  useEffect(() => { const saved = loadReplanState(); if (saved) { setTasks(saved.tasks); setSchedule(saved.schedule); } }, []);
  useEffect(() => { saveReplanState({ tasks, schedule }); }, [tasks, schedule]);
  useEffect(() => { if (!playing) return; const timer = window.setInterval(() => setCurrentTime((time) => advanceSimulatedTime(time, 1_000, speed)), 1_000); return () => window.clearInterval(timer); }, [playing, speed]);
  useEffect(() => { const controller = new AbortController(); const weatherTasks = tasks.filter((task) => task.weatherSensitive && !task.weatherOverride && (task.weatherLocation || task.location)); if (weatherTasks.length === 0) { setWeatherWindowsByTaskId({}); setWeatherStatusByTaskId({}); return () => controller.abort(); } fetchWeatherConstraints(weatherTasks, initial.dayStart, initial.dayEnd, controller.signal).then((result) => { if (!controller.signal.aborted) { setWeatherWindowsByTaskId(result.windowsByTaskId); setWeatherStatusByTaskId(result.statusByTaskId); } }); return () => controller.abort(); }, [tasks, initial.dayStart, initial.dayEnd]);

  const optimize = () => { const result = optimizeSchedule(tasks, { ...options, previousSchedule: schedule }); if (result.status === "feasible") { const diff = diffSchedules(schedule, result.schedule); setOptimizationFeedback({ diff, explanations: explainOptimizationChanges(tasks, schedule, result.schedule, options), score: result.score.total }); } setSchedule(result.schedule); setNotice(result.status === "feasible" ? `Optimized ${result.schedule.length} activities.` : result.issues[0]?.message ?? "No feasible schedule found."); };
  const findTime = (taskId: string) => { const result = findPreferredTime(taskId, tasks, schedule, options); if (result.status === "feasible") { setSchedule(result.result.schedule); setNotice("Found a legal time for the task."); return; } setNotice("issues" in result.result ? result.result.issues[0]?.message ?? "No legal time found." : "No legal time found."); };
  const saveTask = (task: Task, placement?: ScheduledTask) => { const weather = weatherStatusByTaskId[task.id]; if (task.weatherSensitive && weather?.state === "blocked" && !task.weatherOverride && !window.confirm("No clear weather window is available. Schedule this outdoor task anyway?")) return; const savedTask = task.weatherSensitive && weather?.state === "blocked" ? { ...task, weatherOverride: true } : task; setTasks((current) => current.some((item) => item.id === savedTask.id) ? current.map((item) => item.id === savedTask.id ? savedTask : item) : [...current, savedTask]); setSchedule((current) => placement ? [...current.filter((item) => item.taskId !== savedTask.id), placement] : current); setNotice(placement ? "Fixed commitment saved and anchored in the day." : "Task saved. Use Find a time or Optimize day to schedule it."); };
  const proposeLiveChange = (change: ScheduleChange) => { const relaxMinutes: PostTaskBreakMinutes | undefined = change.type === "TASK_COMPLETED" ? 10 : undefined; const result = replanSchedule(tasks, schedule, change, { ...options, postTaskBreakMinutes: relaxMinutes }); setProposal({ change, result, baseTasks: tasks, baseSchedule: schedule, relaxMinutes }); };
  const updateRelax = (relaxMinutes: PostTaskBreakMinutes) => { setProposal((current) => { if (!current) return null; const result = replanSchedule(current.baseTasks, current.baseSchedule, current.change, { ...options, postTaskBreakMinutes: relaxMinutes }); return { ...current, relaxMinutes, result }; }); };
  const applyProposal = () => { if (!proposal || proposal.result.status !== "feasible") return; const nextTasks = applyChangeToTasks(proposal.baseTasks, proposal.baseSchedule, proposal.change); setTasks(nextTasks); setSchedule(proposal.result.schedule); setNotice("Replan applied to the remaining day."); setProposal(null); };
  const nextEvent = () => { const boundary = nextScheduleBoundary(currentTime, schedule); if (boundary) setCurrentTime(boundary); };

  const currentScore = scoreSchedule(schedule, tasks, options).total;
  return <><nav className="app-nav"><button type="button" className={view === "plan" ? "active" : ""} onClick={() => setView("plan")}>Plan</button><button type="button" className={view === "live" ? "active" : ""} onClick={() => setView("live")}>Live Day</button></nav>{view === "plan" ? <PlanView tasks={tasks} schedule={schedule} dayStart={initial.dayStart} dayEnd={initial.dayEnd} onSaveTask={saveTask} onRemoveTask={(id) => { setTasks((items) => items.filter((task) => task.id !== id)); setSchedule((items) => items.filter((item) => item.taskId !== id)); }} onFindTime={findTime} onOptimize={optimize} notice={notice} weatherStatusByTaskId={weatherStatusByTaskId} score={currentScore} feedback={optimizationFeedback} /> : <LiveDayView tasks={tasks} schedule={schedule} currentTime={currentTime} playing={playing} speed={speed} onPlayingChange={setPlaying} onSpeedChange={setSpeed} onNext={nextEvent} onReset={() => { setCurrentTime(initial.currentTime); setPlaying(false); }} onChange={proposeLiveChange} notice={notice} />}{proposal ? <ReplanProposal result={proposal.result} tasks={tasks} currentTime={currentTime} relaxMinutes={proposal.relaxMinutes} onRelaxChange={proposal.relaxMinutes !== undefined ? updateRelax : undefined} onApply={applyProposal} onKeep={() => setProposal(null)} /> : null}</>;
}
