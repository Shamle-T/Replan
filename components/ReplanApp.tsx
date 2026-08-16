"use client";

import { useEffect, useMemo, useState } from "react";
import {
  diffSchedules,
  explainOptimizationChanges,
  findPreferredTime,
  optimizeSchedule,
  replanSchedule,
  scoreSchedule,
  sortSchedule,
  totalOpenMinutes,
  validateSchedule,
  type PostTaskBreak,
  type PostTaskBreakMinutes,
  type ScheduledTask,
  type ScheduleChange,
  type ScheduleDiffEntry,
  type ScheduleResult,
  type Task,
  type WeatherWindowsByTaskId,
  type OptimizationChangeExplanation,
} from "../scheduler";
import { applyChangeToTasks } from "../interactions/scheduleChanges";
import { createDemoState } from "../lib/demo";
import {
  advanceSimulatedTime,
  nextScheduleBoundary,
  type SimulationSpeed,
} from "../lib/simulation";
import {
  clearReplanState,
  loadBreakPreference,
  loadReplanState,
  saveBreakPreference,
  saveReplanState,
} from "../lib/storage";
import { formatDate } from "../lib/time";
import { friendlyValidationMessage } from "../lib/validationMessages";
import {
  fetchWeatherConstraints,
  type WeatherTaskStatus,
} from "../lib/weather";
import PlanView from "./PlanView";
import LiveDayView from "./LiveDayView";
import ReplanProposal from "./ReplanProposal";

type View = "plan" | "live";

export interface PendingProposal {
  title: string;
  result: ScheduleResult;
  change?: ScheduleChange;
  relaxMinutes?: PostTaskBreakMinutes;
  kind?: "optimize" | "find-time" | "replan";
  previousScore?: number;
  proposedScore?: number;
  previousOpenMinutes?: number;
  proposedOpenMinutes?: number;
  createdAtMs: number;
  /** Snapshot used to recompute/apply live alternatives without losing the original diff. */
  replanBaseTasks?: Task[];
  replanBaseSchedule?: ScheduledTask[];
  /** Current time captured when the live change was proposed so preview and apply use the same clock boundary. */
  replanCurrentTime?: Date;
  /** Done/cancel/skip are facts that may already have been accepted into app state. */
  factApplied?: boolean;
  /** Delta applied by the Live Day +/- time controls when this proposal is accepted. */
  timeAdjustmentDelta?: number;
}

interface OptimizationPreview {
  result: ScheduleResult;
  diffCount: number;
  proposedScore?: number;
  proposedOpenMinutes: number;
}

export default function ReplanApp() {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("plan");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [schedule, setSchedule] = useState<ScheduledTask[]>([]);
  const [dayStart, setDayStart] = useState<Date | null>(null);
  const [dayEnd, setDayEnd] = useState<Date | null>(null);
  const [proposal, setProposal] = useState<PendingProposal | null>(null);
  const [breakPreference, setBreakPreference] = useState<PostTaskBreakMinutes>(10);
  const [activeBreak, setActiveBreak] = useState<PostTaskBreak | null>(null);
  const [planSuggestion, setPlanSuggestion] = useState<PendingProposal | null>(null);
  const [recentAppliedDiff, setRecentAppliedDiff] = useState<ScheduleDiffEntry[]>([]);
  const [optimizationNotice, setOptimizationNotice] = useState<ScheduleDiffEntry[]>([]);
  const [optimizationExplanations, setOptimizationExplanations] = useState<OptimizationChangeExplanation[]>([]);
  const [recentFactChange, setRecentFactChange] = useState<ScheduleChange | null>(null);
  const [timeAdjustmentByTaskId, setTimeAdjustmentByTaskId] = useState<Record<string, number>>({});

  const [clockMode, setClockMode] = useState<"simulation" | "real">("simulation");
  const [realTime, setRealTime] = useState<Date | null>(null);
  const [simulationTime, setSimulationTime] = useState<Date | null>(null);
  const [simulationPlaying, setSimulationPlaying] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState<SimulationSpeed>(5);

  const [weatherWindowsByTaskId, setWeatherWindowsByTaskId] =
    useState<WeatherWindowsByTaskId>({});
  const [weatherStatusByTaskId, setWeatherStatusByTaskId] = useState<
    Record<string, WeatherTaskStatus>
  >({});
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherRefreshNonce, setWeatherRefreshNonce] = useState(0);

  useEffect(() => {
    const now = new Date();
    const demo = createDemoState(now);
    const saved = loadReplanState();
    const sameDay = saved?.schedule[0]
      ? saved.schedule[0].start.toDateString() === now.toDateString()
      : false;

    const initialTasks = sameDay && saved ? saved.tasks : demo.tasks;
    let initialSchedule = sameDay && saved ? saved.schedule : demo.schedule;

    // Saved state can outlive older UI/scheduler versions. Never restore a plan
    // that now violates overlap/travel/fixed-time rules; repair it deterministically.
    if (sameDay && saved) {
      const restoredIssues = validateSchedule(initialSchedule, initialTasks, {
        currentTime: demo.dayStart,
        dayStart: demo.dayStart,
        dayEnd: demo.dayEnd,
        slotMinutes: 30,
        requireMandatoryPlacement: false,
      });
      if (restoredIssues.length > 0) {
        const repaired = optimizeSchedule(initialTasks, {
          currentTime: demo.dayStart,
          dayStart: demo.dayStart,
          dayEnd: demo.dayEnd,
          slotMinutes: 30,
        });
        initialSchedule = repaired.schedule;
      }
    }

    setTasks(initialTasks);
    setSchedule(initialSchedule);
    setDayStart(demo.dayStart);
    setDayEnd(demo.dayEnd);
    setSimulationTime(demo.simulationTime);
    setRealTime(now);
    setBreakPreference(loadBreakPreference());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveReplanState({ tasks, schedule });
  }, [ready, tasks, schedule]);

  useEffect(() => {
    if (!ready || breakPreference === 0) return;
    saveBreakPreference(breakPreference);
  }, [ready, breakPreference]);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(() => setRealTime(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, [ready]);

  useEffect(() => {
    if (!ready || clockMode !== "simulation" || !simulationPlaying) return;

    const timer = window.setInterval(() => {
      setSimulationTime((current) =>
        current ? advanceSimulatedTime(current, 1_000, simulationSpeed) : current,
      );
    }, 1_000);

    return () => window.clearInterval(timer);
  }, [ready, clockMode, simulationPlaying, simulationSpeed]);

  const currentTime = useMemo(
    () => (clockMode === "real" ? realTime : simulationTime),
    [clockMode, realTime, simulationTime],
  );

  const weatherRequestKey = useMemo(
    () =>
      tasks
        .filter((task) => task.weatherSensitive && !task.weatherOverride)
        .map((task) => `${task.id}:${task.weatherLocation ?? task.location ?? ""}`)
        .sort()
        .join("|"),
    [tasks],
  );

  useEffect(() => {
    if (!ready || !dayStart || !dayEnd) return;
    const weatherTasks = tasks.filter(
      (task) => task.weatherSensitive && !task.weatherOverride && (task.weatherLocation?.trim() || task.location?.trim()),
    );
    if (weatherTasks.length === 0) {
      setWeatherWindowsByTaskId({});
      setWeatherStatusByTaskId({});
      setWeatherLoading(false);
      return;
    }

    const controller = new AbortController();
    setWeatherLoading(true);
    fetchWeatherConstraints(weatherTasks, dayStart, dayEnd, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setWeatherWindowsByTaskId(result.windowsByTaskId);
        setWeatherStatusByTaskId(result.statusByTaskId);
      })
      .finally(() => {
        if (!controller.signal.aborted) setWeatherLoading(false);
      });

    return () => controller.abort();
  }, [ready, dayStart, dayEnd, tasks, weatherRequestKey, weatherRefreshNonce]);

  // Once a forecast is known, never leave an outdoor task sitting in a time
  // that the weather adapter has marked unsuitable. It returns to the open list.
  useEffect(() => {
    if (weatherLoading || Object.keys(weatherWindowsByTaskId).length === 0) return;
    const taskMap = new Map(tasks.map((task) => [task.id, task]));
    setSchedule((current) => {
      let changed = false;
      const next = current.filter((placement) => {
        const task = taskMap.get(placement.taskId);
        if (!task?.weatherSensitive || task.weatherOverride || task.status !== "planned") return true;
        if (!Object.prototype.hasOwnProperty.call(weatherWindowsByTaskId, task.id)) return true;
        const windows = weatherWindowsByTaskId[task.id];
        const fits = windows.some(
          (window) =>
            placement.start.getTime() >= window.start.getTime() &&
            placement.end.getTime() <= window.end.getTime(),
        );
        if (!fits) changed = true;
        return fits;
      });
      return changed ? next : current;
    });
  }, [weatherLoading, weatherWindowsByTaskId, tasks]);

  useEffect(() => {
    if (activeBreak && currentTime && currentTime.getTime() >= activeBreak.end.getTime()) {
      setActiveBreak(null);
    }
  }, [activeBreak, currentTime]);

  useEffect(() => {
    if (!planSuggestion) return;
    const timer = window.setTimeout(() => setPlanSuggestion(null), 10 * 60 * 1000);
    return () => window.clearTimeout(timer);
  }, [planSuggestion]);

  useEffect(() => {
    if (recentAppliedDiff.length === 0) return;
    const timer = window.setTimeout(() => setRecentAppliedDiff([]), 10 * 60 * 1000);
    return () => window.clearTimeout(timer);
  }, [recentAppliedDiff]);

  useEffect(() => {
    if (!recentFactChange) return;
    const timer = window.setTimeout(() => setRecentFactChange(null), 8_000);
    return () => window.clearTimeout(timer);
  }, [recentFactChange]);

  const optimizationPreview = useMemo<OptimizationPreview | null>(() => {
    if (!ready || !dayStart || !dayEnd || !currentTime || view !== "plan" || weatherLoading) {
      return null;
    }
    const taskMap = new Map(tasks.map((task) => [task.id, task]));
    const lockedSchedule = schedule.filter((item) => {
      const task = taskMap.get(item.taskId);
      return task?.status === "completed" || item.start.getTime() <= currentTime.getTime();
    });
    const options = {
      currentTime,
      dayStart,
      dayEnd,
      slotMinutes: 30,
      weatherWindowsByTaskId,
      lockedSchedule,
    };
    const result = optimizeSchedule(tasks, options);
    const diff = diffSchedules(schedule, result.schedule);
    return {
      result: { ...result, diff },
      diffCount: diff.filter((entry) => entry.type !== "unchanged").length,
      proposedScore:
        result.status === "feasible"
          ? scoreSchedule(result.schedule, tasks, options).total
          : undefined,
      proposedOpenMinutes: totalOpenMinutes(
        result.schedule,
        tasks,
        dayStart,
        dayEnd,
      ),
    };
  }, [
    ready,
    dayStart,
    dayEnd,
    currentTime,
    view,
    weatherLoading,
    weatherWindowsByTaskId,
    tasks,
    schedule,
  ]);

  if (!ready || !dayStart || !dayEnd || !currentTime) {
    return (
      <main className="loading-shell">
        <div className="brand-mark">↯</div>
        <p>Loading Replan…</p>
      </main>
    );
  }

  const schedulerOptions = {
    currentTime,
    dayStart,
    dayEnd,
    slotMinutes: 30,
    postTaskBreakMinutes: breakPreference,
    weatherWindowsByTaskId,
  };

  const planOptions = {
    currentTime,
    dayStart,
    dayEnd,
    slotMinutes: 30,
    weatherWindowsByTaskId,
  };

  const currentPlanScore = scoreSchedule(schedule, tasks, planOptions).total;
  const currentOpenMinutes = totalOpenMinutes(schedule, tasks, dayStart, dayEnd);

  const saveTask = (task: Task, placement?: ScheduledTask): string | void => {
    const exists = tasks.some((item) => item.id === task.id);
    const nextTasks = exists
      ? tasks.map((item) => (item.id === task.id ? task : item))
      : [...tasks, task];
    const nextSchedule = sortSchedule([
      ...schedule.filter((item) => item.taskId !== task.id),
      ...(placement ? [placement] : []),
    ]);

    const issues = validateSchedule(nextSchedule, nextTasks, {
      ...planOptions,
      requireMandatoryPlacement: false,
    });
    if (issues.length > 0) {
      return friendlyValidationMessage(issues[0], nextTasks).detail;
    }

    setTasks(nextTasks);
    setSchedule(nextSchedule);
    setProposal(null);
    setPlanSuggestion(null);
    setRecentAppliedDiff([]);
    setOptimizationNotice([]);
    setOptimizationExplanations([]);
  };

  const removeTask = (taskId: string) => {
    setTasks((current) => current.filter((task) => task.id !== taskId));
    setSchedule((current) => current.filter((item) => item.taskId !== taskId));
    setProposal(null);
    setOptimizationNotice([]);
    setOptimizationExplanations([]);
  };

  const optimize = () => {
    const preview = optimizationPreview;
    if (!preview) return;

    // Optimization is previewed before it changes the calendar. The user can
    // inspect the proposed movement and fixed commitments, then approve it.
    const scoreImproves =
      preview.result.status === "feasible" &&
      preview.proposedScore !== undefined &&
      preview.proposedScore < currentPlanScore - 0.001;

    if (preview.result.status === "feasible" && preview.diffCount > 0 && scoreImproves) {
      setProposal({
        title: "Optimize your day?",
        kind: "optimize",
        previousScore: currentPlanScore,
        proposedScore: preview.proposedScore,
        previousOpenMinutes: currentOpenMinutes,
        proposedOpenMinutes: preview.proposedOpenMinutes,
        result: { ...preview.result, diff: diffSchedules(schedule, preview.result.schedule) },
        createdAtMs: Date.now(),
      });
      return;
    }

    if (preview.result.status === "infeasible") {
      setProposal({
        title: "Schedule needs attention",
        kind: "optimize",
        previousScore: currentPlanScore,
        proposedScore: preview.proposedScore,
        previousOpenMinutes: currentOpenMinutes,
        proposedOpenMinutes: preview.proposedOpenMinutes,
        result: preview.result,
        createdAtMs: Date.now(),
      });
    }
  };

  const findTime = (taskId: string) => {
    const preferred = findPreferredTime(taskId, tasks, schedule, {
      ...planOptions,
      previousSchedule: schedule,
    });
    const title = tasks.find((task) => task.id === taskId)?.title ?? "Task";

    setProposal({
      title: `Time found for ${title}`,
      kind: "find-time",
      result: {
        ...preferred.result,
        diff: diffSchedules(schedule, preferred.result.schedule),
      },
      createdAtMs: Date.now(),
    });
  };

  const requestReplan = (change: ScheduleChange, metadata?: { timeAdjustmentDelta?: number }) => {
    const currentPlacement = schedule.find((item) => item.taskId === change.taskId);
    const finishedEarly =
      change.type === "TASK_COMPLETED" &&
      currentPlacement &&
      change.actualEnd.getTime() < currentPlacement.end.getTime();
    const relaxMinutes =
      finishedEarly || change.type === "TASK_CANCELLED" || change.type === "TASK_SKIPPED"
        ? finishedEarly
          ? breakPreference
          : 0
        : undefined;
    const result = replanSchedule(tasks, schedule, change, {
      ...schedulerOptions,
      postTaskBreakMinutes: relaxMinutes ?? breakPreference,
    });
    // If an overrun fits without moving or removing anything else, apply it
    // immediately. The +15/+30 controls should feel like a direct extension
    // when there is genuinely enough room; only consequential knock-on changes
    // need an explicit Replan proposal.
    if (change.type === "TASK_OVERRUN" && result.status === "feasible") {
      const changedEntries = result.diff?.filter((entry) => entry.type !== "unchanged") ?? [];
      const affectsOnlyCurrent = changedEntries.every((entry) => entry.taskId === change.taskId);
      if (affectsOnlyCurrent) {
        setTasks((current) => applyChangeToTasks(current, schedule, change));
        setSchedule(result.schedule);
        setRecentAppliedDiff(changedEntries);
        if (metadata?.timeAdjustmentDelta) {
          setTimeAdjustmentByTaskId((current) => ({
            ...current,
            [change.taskId]: Math.max(0, (current[change.taskId] ?? 0) + metadata.timeAdjustmentDelta!),
          }));
        }
        setProposal(null);
        setSimulationPlaying(false);
        return;
      }
    }

    const changedTaskTitle = tasks.find((task) => task.id === change.taskId)?.title ?? "Task";
    const title = finishedEarly
      ? "Finished early"
      : change.type === "TASK_COMPLETED"
        ? `${changedTaskTitle} completed`
        : change.type === "TASK_OVERRUN"
          ? metadata?.timeAdjustmentDelta && metadata.timeAdjustmentDelta < 0
            ? `${changedTaskTitle} time corrected`
            : `${changedTaskTitle} needs more time`
          : change.type === "TASK_CANCELLED"
            ? `${changedTaskTitle} cancelled`
            : `${changedTaskTitle} skipped`;

    const factApplied =
      change.type === "TASK_COMPLETED" ||
      change.type === "TASK_CANCELLED" ||
      change.type === "TASK_SKIPPED";
    const nextProposal: PendingProposal = {
      title,
      result,
      change,
      relaxMinutes,
      kind: "replan",
      createdAtMs: Date.now(),
      replanBaseTasks: tasks,
      replanBaseSchedule: schedule,
      replanCurrentTime: new Date(currentTime.getTime()),
      factApplied,
      timeAdjustmentDelta: metadata?.timeAdjustmentDelta,
    };

    // Done/cancel/skip describe what already happened in reality. Accept that
    // fact immediately; the proposal only asks permission to rearrange the
    // remaining schedule. An overrun is different because extending time can
    // collide with a fixed commitment, so it remains proposal-only.
    if (
      change.type === "TASK_COMPLETED" ||
      change.type === "TASK_CANCELLED" ||
      change.type === "TASK_SKIPPED"
    ) {
      setRecentFactChange(change);
      setTasks((current) => applyChangeToTasks(current, schedule, change));
      setSchedule((current) => {
        if (change.type === "TASK_CANCELLED" || change.type === "TASK_SKIPPED") {
          return current.filter((item) => item.taskId !== change.taskId);
        }
        return sortSchedule(
          current.map((item) =>
            item.taskId === change.taskId
              ? { ...item, end: new Date(change.actualEnd.getTime()) }
              : item,
          ),
        );
      });
    }

    if (factApplied) {
      setTimeAdjustmentByTaskId((current) => {
        const next = { ...current };
        delete next[change.taskId];
        return next;
      });
    }

    setProposal(nextProposal);
    setSimulationPlaying(false);
  };

  const adjustCurrentTaskTime = (taskId: string, deltaMinutes: number) => {
    const placement = schedule.find((item) => item.taskId === taskId);
    if (!placement || !Number.isFinite(deltaMinutes) || deltaMinutes === 0) return;

    const extra = timeAdjustmentByTaskId[taskId] ?? 0;
    if (deltaMinutes < 0 && Math.abs(deltaMinutes) > extra) return;

    const newExpectedEnd = new Date(placement.end.getTime() + deltaMinutes * 60_000);
    if (newExpectedEnd.getTime() <= currentTime.getTime()) return;
    if (newExpectedEnd.getTime() <= placement.start.getTime()) return;

    requestReplan(
      { type: "TASK_OVERRUN", taskId, newExpectedEnd },
      { timeAdjustmentDelta: deltaMinutes },
    );
  };

  const updateProposalRelax = (minutes: PostTaskBreakMinutes) => {
    if (!proposal?.change || proposal.change.type !== "TASK_COMPLETED") return;

    const baseTasks = proposal.replanBaseTasks ?? tasks;
    const baseSchedule = proposal.replanBaseSchedule ?? schedule;
    const result = replanSchedule(baseTasks, baseSchedule, proposal.change, {
      ...schedulerOptions,
      currentTime: proposal.replanCurrentTime ?? schedulerOptions.currentTime,
      postTaskBreakMinutes: minutes,
    });

    if (minutes >= 5) setBreakPreference(minutes);
    const updated = { ...proposal, result, relaxMinutes: minutes, createdAtMs: Date.now() };
    setProposal(updated);
  };

  const applyProposal = () => {
    if (!proposal || proposal.result.status !== "feasible") return;

    // Live replans are previewed against an immutable snapshot. Recompute that
    // exact proposal when Apply is pressed so the calendar commit cannot fall
    // back to the already fact-updated (but not re-packed) schedule. This is
    // especially important for Done / Cancel / Skip, where the factual status
    // is accepted before the user approves movement of the remaining tasks.
    let appliedResult: ScheduleResult = proposal.result;
    if (
      proposal.kind === "replan" &&
      proposal.change &&
      proposal.replanBaseTasks &&
      proposal.replanBaseSchedule
    ) {
      const recomputed = replanSchedule(
        proposal.replanBaseTasks,
        proposal.replanBaseSchedule,
        proposal.change,
        {
          ...schedulerOptions,
          currentTime: proposal.replanCurrentTime ?? schedulerOptions.currentTime,
          postTaskBreakMinutes: proposal.relaxMinutes ?? breakPreference,
        },
      );
      if (recomputed.status === "feasible") appliedResult = recomputed;
    }

    if (appliedResult.status !== "feasible") return;
    const changedEntries = appliedResult.diff?.filter((entry) => entry.type !== "unchanged") ?? [];
    const changed = changedEntries.length > 0;
    if (!changed && !proposal.change) {
      setProposal(null);
      return;
    }

    // Materialize a fresh schedule array (including fresh Date instances) so
    // React receives the approved plan as a real state transition rather than
    // retaining any preview/snapshot references.
    const committedSchedule = sortSchedule(
      appliedResult.schedule.map((item) => ({
        taskId: item.taskId,
        start: new Date(item.start.getTime()),
        end: new Date(item.end.getTime()),
      })),
    );
    // Compare against the factual schedule currently on screen, not only the
    // original pre-change snapshot. This is the exact movement the user will
    // see once the proposal closes.
    const committedDiff = diffSchedules(schedule, committedSchedule);
    const committedChangedEntries = committedDiff.filter((entry) => entry.type !== "unchanged");

    if (proposal.change && !proposal.factApplied) {
      setTasks((current) =>
        applyChangeToTasks(current, schedule, proposal.change as ScheduleChange),
      );
    }

    setSchedule(() => committedSchedule);
    setActiveBreak(appliedResult.postTaskBreak ?? null);
    if (proposal.timeAdjustmentDelta && proposal.change?.type === "TASK_OVERRUN") {
      setTimeAdjustmentByTaskId((current) => ({
        ...current,
        [proposal.change!.taskId]: Math.max(
          0,
          (current[proposal.change!.taskId] ?? 0) + proposal.timeAdjustmentDelta!,
        ),
      }));
    }
    if (proposal.kind === "replan") {
      const appliedProposal: PendingProposal = {
        ...proposal,
        result: { ...appliedResult, diff: committedDiff },
        createdAtMs: Date.now(),
      };
      setPlanSuggestion(appliedProposal);
      if (
        proposal.change &&
        (proposal.change.type === "TASK_COMPLETED" ||
          proposal.change.type === "TASK_CANCELLED" ||
          proposal.change.type === "TASK_SKIPPED")
      ) {
        setRecentFactChange({ ...proposal.change });
      }
      setRecentAppliedDiff(committedChangedEntries);
    }
    if (proposal.kind === "optimize") {
      setRecentAppliedDiff(committedChangedEntries);
      setOptimizationNotice(committedChangedEntries);
      setOptimizationExplanations(
        explainOptimizationChanges(tasks, schedule, committedSchedule, planOptions),
      );
      setPlanSuggestion(null);
    }
    setProposal(null);
  };

  const resetDemo = () => {
    const demo = createDemoState(dayStart);
    clearReplanState();
    setTasks(demo.tasks);
    setSchedule(demo.schedule);
    setSimulationTime(demo.simulationTime);
    setClockMode("simulation");
    setSimulationPlaying(false);
    setActiveBreak(null);
    setProposal(null);
    setPlanSuggestion(null);
    setRecentAppliedDiff([]);
    setOptimizationNotice([]);
    setOptimizationExplanations([]);
    setRecentFactChange(null);
    setTimeAdjustmentByTaskId({});
  };

  const jumpNext = () => {
    const next = nextScheduleBoundary(currentTime, schedule);
    const breakEnd =
      activeBreak && activeBreak.end.getTime() > currentTime.getTime()
        ? activeBreak.end
        : null;
    const boundary =
      breakEnd && (!next || breakEnd.getTime() < next.getTime()) ? breakEnd : next;

    if (boundary) setSimulationTime(new Date(boundary.getTime()));
  };

  const hasWeatherTasks = tasks.some((task) => task.weatherSensitive && !task.weatherOverride);
  const weatherStatuses = Object.values(weatherStatusByTaskId);
  const headerWeatherStatus =
    weatherStatuses.find((status) => status.current) ?? weatherStatuses[0];
  const headerWeather = headerWeatherStatus?.current;
  const optimizationScoreImproves = Boolean(
    optimizationPreview?.result.status === "feasible" &&
      optimizationPreview.proposedScore !== undefined &&
      optimizationPreview.proposedScore < currentPlanScore - 0.001,
  );
  const canOptimize = Boolean(
    optimizationPreview &&
      (optimizationPreview.result.status === "infeasible" ||
        (optimizationPreview.diffCount > 0 && optimizationScoreImproves)),
  );
  const optimizeLabel = weatherLoading && hasWeatherTasks
    ? "Checking weather…"
    : optimizationPreview?.result.status === "infeasible"
      ? "Review schedule"
      : canOptimize
        ? "Optimize my day"
        : "Day already optimized";

  return (
    <main className={`app-shell ${view === "live" ? "theme-live-dark" : "theme-plan-light"}`}>
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">↯</div>
          <strong>REPLAN</strong>
        </div>

        <nav className="view-tabs" aria-label="Primary views">
          <button className={view === "plan" ? "active" : ""} type="button" onClick={() => setView("plan")}>Plan</button>
          <button className={view === "live" ? "active" : ""} type="button" onClick={() => setView("live")}> 
            <span className={view === "live" ? "tab-live-dot" : ""} />
            Live Day
          </button>
        </nav>

        <div className="header-actions">
          {hasWeatherTasks ? (
            <a className="weather-attribution weather-header-chip" href="https://open-meteo.com/" target="_blank" rel="noreferrer" title={headerWeatherStatus?.location ?? "Weather by Open-Meteo"}>
              <span aria-hidden="true">{headerWeather?.icon ?? "◌"}</span>
              <span>{weatherLoading
                ? "Weather…"
                : headerWeather
                  ? `${headerWeather.label}${headerWeather.temperatureC !== undefined ? ` · ${Math.round(headerWeather.temperatureC)}°C` : ""}`
                  : headerWeatherStatus?.state === "error"
                    ? "Weather unavailable"
                    : headerWeatherStatus?.state === "blocked"
                      ? "No clear window"
                      : "Weather"}</span>
            </a>
          ) : null}
          <span className="date-label">{formatDate(dayStart)}</span>
        </div>
      </header>

      {view === "plan" ? (
        <PlanView
          tasks={tasks}
          schedule={schedule}
          dayStart={dayStart}
          dayEnd={dayEnd}
          currentTime={currentTime}
          onSaveTask={saveTask}
          onRemoveTask={removeTask}
          onFindTime={findTime}
          onOptimize={optimize}
          planScore={currentPlanScore}
          openMinutes={currentOpenMinutes}
          canOptimize={canOptimize && !weatherLoading}
          optimizeLabel={optimizeLabel}
          weatherLoading={weatherLoading}
          weatherStatusByTaskId={weatherStatusByTaskId}
          onRetryWeather={() => setWeatherRefreshNonce((value) => value + 1)}
          liveSuggestion={planSuggestion}
          recentAppliedDiff={recentAppliedDiff}
          optimizationNotice={optimizationNotice}
          optimizationExplanations={optimizationExplanations}
          onDismissOptimizationNotice={() => {
            setOptimizationNotice([]);
            setOptimizationExplanations([]);
          }}
          onDismissLiveSuggestion={() => setPlanSuggestion(null)}
        />
      ) : (
        <LiveDayView
          tasks={tasks}
          schedule={schedule}
          dayStart={dayStart}
          dayEnd={dayEnd}
          currentTime={currentTime}
          mode={clockMode}
          onModeChange={(mode) => {
            setClockMode(mode);
            setSimulationPlaying(false);
            if (mode === "real") setRealTime(new Date());
          }}
          playing={simulationPlaying}
          onPlayingChange={setSimulationPlaying}
          speed={simulationSpeed}
          onSpeedChange={setSimulationSpeed}
          onNext={jumpNext}
          onReset={resetDemo}
          onChange={(change) => requestReplan(change)}
          onAdjustCurrentTask={adjustCurrentTaskTime}
          timeAdjustmentByTaskId={timeAdjustmentByTaskId}
          activeBreak={
            activeBreak && activeBreak.end.getTime() > currentTime.getTime()
              ? activeBreak
              : null
          }
          onSaveTask={saveTask}
          weatherStatusByTaskId={weatherStatusByTaskId}
          proposal={proposal?.kind === "replan" ? proposal : null}
          recentFactChange={recentFactChange}
          onApplyProposal={applyProposal}
          onDismissProposal={() => setProposal(null)}
          onRelaxChange={proposal?.kind === "replan" && proposal.relaxMinutes !== undefined ? updateProposalRelax : undefined}
        />
      )}

      {proposal && proposal.kind !== "replan" ? (
        <div className="proposal-backdrop" role="presentation">
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
            onRelaxChange={proposal.relaxMinutes !== undefined ? updateProposalRelax : undefined}
            onApply={applyProposal}
            onKeep={() => setProposal(null)}
          />
        </div>
      ) : null}
    </main>
  );
}
