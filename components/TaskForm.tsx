"use client";

import { useMemo, useState } from "react";
import type {
  ScheduledTask,
  Task,
  TaskCategory,
  TaskPriority,
} from "../scheduler";
import { addMinutes } from "../scheduler";
import { dateFromTimeInput, timeInputValue } from "../lib/time";
import { TASK_CATEGORIES } from "../lib/taskCategories";
import { fetchWeatherConstraints, type WeatherTaskStatus } from "../lib/weather";
import { PRIORITY_CHOICES, normalizePriority, type PriorityChoice } from "../lib/taskPriorities";

interface TaskFormProps {
  baseDate: Date;
  initialTask?: Task;
  initialPlacement?: ScheduledTask;
  onSave: (task: Task, placement?: ScheduledTask) => string | void;
  onCancel?: () => void;
}

type TaskKind = "flexible" | "fixed";

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120, 150, 180] as const;
type DurationMode = "preset" | "custom";
type IntervalMode = "immediate" | "5" | "10" | "custom";
type WeatherCheckState = "idle" | "checking" | "ready" | "blocked" | "error";

interface WeatherCheckResult {
  signature: string;
  state: WeatherCheckState;
  message?: string;
  status?: WeatherTaskStatus;
}

interface PendingOutdoorSave {
  task: Task;
  placement?: ScheduledTask;
}

export default function TaskForm({
  baseDate,
  initialTask,
  initialPlacement,
  onSave,
  onCancel,
}: TaskFormProps) {
  const editing = Boolean(initialTask);
  const [kind, setKind] = useState<TaskKind>(initialTask?.fixedStart ? "fixed" : "flexible");
  const [title, setTitle] = useState(initialTask?.title ?? "");
  const [description, setDescription] = useState(initialTask?.description ?? "");
  const initialDuration = initialTask?.durationMinutes ?? 60;
  const initialUsesPreset = DURATION_PRESETS.includes(initialDuration as (typeof DURATION_PRESETS)[number]);
  const [duration, setDuration] = useState(initialUsesPreset ? initialDuration : 60);
  const [durationMode, setDurationMode] = useState<DurationMode>(initialUsesPreset ? "preset" : "custom");
  const [customDuration, setCustomDuration] = useState(initialUsesPreset ? "" : String(initialDuration));
  const initialInterval = initialTask?.bufferMinutesAfter ?? 0;
  const initialIntervalMode: IntervalMode = initialInterval === 0 ? "immediate" : initialInterval === 5 ? "5" : initialInterval === 10 ? "10" : "custom";
  const [intervalMode, setIntervalMode] = useState<IntervalMode>(initialIntervalMode);
  const [customInterval, setCustomInterval] = useState(initialIntervalMode === "custom" ? String(initialInterval) : "");
  const [priority, setPriority] = useState<PriorityChoice>(normalizePriority(initialTask?.priority ?? 3));
  const [category, setCategory] = useState<TaskCategory>(initialTask?.category ?? "other");
  const [deadline, setDeadline] = useState(timeInputValue(initialTask?.deadline));
  const [earliest, setEarliest] = useState(timeInputValue(initialTask?.earliestStart));
  const [latest, setLatest] = useState(timeInputValue(initialTask?.latestEnd));
  const [fixedStart, setFixedStart] = useState(timeInputValue(initialTask?.fixedStart));
  const [fixedEnd, setFixedEnd] = useState(timeInputValue(initialTask?.fixedEnd));
  const [scheduledStart, setScheduledStart] = useState(
    !initialTask?.fixedStart ? timeInputValue(initialPlacement?.start) : "",
  );
  const [optional, setOptional] = useState(initialTask?.optional ?? false);
  const [travelMinutes, setTravelMinutes] = useState(initialTask?.travelMinutesBefore ?? 0);
  const [travelMinutesAfter, setTravelMinutesAfter] = useState(initialTask?.travelMinutesAfter ?? 0);
  const [location, setLocation] = useState(initialTask?.location ?? "");
  const [weatherLocation, setWeatherLocation] = useState(initialTask?.weatherLocation ?? "");
  const [weatherSensitive, setWeatherSensitive] = useState(initialTask?.weatherSensitive ?? false);
  const [weatherCheck, setWeatherCheck] = useState<WeatherCheckResult>({ signature: "", state: "idle" });
  const [pendingOutdoorSave, setPendingOutdoorSave] = useState<PendingOutdoorSave | null>(null);
  const [error, setError] = useState("");

  const fixedDuration = useMemo(() => {
    const start = dateFromTimeInput(baseDate, fixedStart);
    const end = dateFromTimeInput(baseDate, fixedEnd);
    if (!start || !end || end <= start) return 0;
    return Math.round((end.getTime() - start.getTime()) / 60_000);
  }, [baseDate, fixedStart, fixedEnd]);

  const weatherFormSignature = [
    kind,
    title.trim(),
    durationMode,
    durationMode === "custom" ? customDuration : duration,
    intervalMode,
    customInterval,
    fixedStart,
    fixedEnd,
    scheduledStart,
    earliest,
    latest,
    deadline,
    weatherLocation.trim(),
    location.trim(),
    weatherSensitive ? "outdoor" : "indoor",
  ].join("|");

  const buildCandidate = (weatherOverride = false): PendingOutdoorSave | null => {
    setError("");
    const cleanTitle = title.trim();
    const effectiveDuration = durationMode === "custom" ? Number(customDuration) : duration;
    const effectiveInterval = intervalMode === "immediate" ? 0 : intervalMode === "custom" ? Number(customInterval) : Number(intervalMode);

    if (!cleanTitle) {
      setError("Give the task a name.");
      return null;
    }
    if (weatherSensitive && !(weatherLocation.trim() || location.trim())) {
      setError("Add a weather area so Replan can check the forecast.");
      return null;
    }
    if (!Number.isInteger(effectiveInterval) || effectiveInterval < 0 || effectiveInterval > 180) {
      setError("Choose an interval between 0 and 180 minutes.");
      return null;
    }
    if (!Number.isFinite(travelMinutes) || travelMinutes < 0 || travelMinutes > 180) {
      setError("Travel time to the event must be between 0 and 180 minutes.");
      return null;
    }
    if (!Number.isFinite(travelMinutesAfter) || travelMinutesAfter < 0 || travelMinutesAfter > 180) {
      setError("Travel time after the event must be between 0 and 180 minutes.");
      return null;
    }

    const id = initialTask?.id ?? `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const shared = {
      id,
      title: cleanTitle,
      description: description.trim() || undefined,
      priority: priority as TaskPriority,
      category,
      travelMinutesBefore: Math.round(travelMinutes) || undefined,
      travelMinutesAfter: Math.round(travelMinutesAfter) || undefined,
      bufferMinutesAfter: effectiveInterval || undefined,
      location: location.trim() || undefined,
      weatherLocation: weatherLocation.trim() || undefined,
      weatherSensitive: weatherSensitive || undefined,
      weatherOverride: weatherSensitive && weatherOverride ? true : undefined,
      optional,
      status: initialTask?.status ?? ("planned" as const),
    };

    let task: Task;
    let placement: ScheduledTask | undefined;

    if (kind === "fixed") {
      const start = dateFromTimeInput(baseDate, fixedStart);
      const end = dateFromTimeInput(baseDate, fixedEnd);
      if (!start || !end || end <= start) {
        setError("Choose a valid start and end time.");
        return null;
      }
      task = {
        ...shared,
        durationMinutes: fixedDuration,
        fixedStart: start,
        fixedEnd: end,
      };
      placement = { taskId: id, start, end };
    } else {
      if (!Number.isInteger(effectiveDuration) || effectiveDuration <= 0 || effectiveDuration > 720) {
        setError("Choose a duration between 1 and 720 minutes.");
        return null;
      }

      const earliestDate = dateFromTimeInput(baseDate, earliest);
      const latestDate = dateFromTimeInput(baseDate, latest);
      const deadlineDate = dateFromTimeInput(baseDate, deadline);
      if (earliestDate && latestDate && latestDate <= earliestDate) {
        setError("Latest finish must be after earliest start.");
        return null;
      }

      const requestedStart = dateFromTimeInput(baseDate, scheduledStart);
      task = {
        ...shared,
        // Clearing Scheduled start is an explicit request to return an edited
        // item to the Unscheduled queue. Re-open it as planned even if the
        // item had previously become in-progress/completed/skipped during the
        // live demo; otherwise it disappears from both the calendar and the
        // Plan backlog and looks as though it was deleted.
        status: editing && !requestedStart ? "planned" : shared.status,
        durationMinutes: effectiveDuration,
        deadline: deadlineDate,
        earliestStart: earliestDate,
        latestEnd: latestDate,
      };

      if (requestedStart) {
        placement = {
          taskId: id,
          start: requestedStart,
          end: addMinutes(requestedStart, effectiveDuration),
        };
      }
    }

    return { task, placement };
  };

  const saveCandidate = (candidate: PendingOutdoorSave) => {
    const saveError = onSave(candidate.task, candidate.placement);
    if (saveError) {
      setError(saveError);
      return false;
    }
    return true;
  };

  const checkOutdoorWeather = async (candidate?: PendingOutdoorSave): Promise<WeatherCheckResult> => {
    const draft = candidate ?? buildCandidate(false);
    if (!draft || !draft.task.weatherSensitive) {
      const result: WeatherCheckResult = { signature: weatherFormSignature, state: "idle" };
      setWeatherCheck(result);
      return result;
    }

    const signature = weatherFormSignature;
    setWeatherCheck({ signature, state: "checking" });
    setPendingOutdoorSave(null);

    try {
      const weatherDayEnd = new Date(baseDate.getTime() + 18 * 60 * 60_000);
      const checkedTask = { ...draft.task, weatherOverride: undefined };
      const response = await fetchWeatherConstraints([checkedTask], baseDate, weatherDayEnd);
      const status = response.statusByTaskId[checkedTask.id];
      const windows = response.windowsByTaskId[checkedTask.id] ?? [];

      if (!status || status.state === "error") {
        const result: WeatherCheckResult = {
          signature,
          state: "error",
          status,
          message: status?.summary ?? "Weather could not be checked right now.",
        };
        setWeatherCheck(result);
        return result;
      }

      const fitsSelectedTime = draft.placement
        ? windows.some(
            (window) =>
              draft.placement!.start.getTime() >= window.start.getTime() &&
              draft.placement!.end.getTime() <= window.end.getTime(),
          )
        : hasUsableWeatherWindow(checkedTask, windows, baseDate, weatherDayEnd);

      if (status.state === "blocked" || !fitsSelectedTime) {
        const conditions = status.current
          ? `${status.current.label}${status.current.temperatureC !== undefined ? ` · ${Math.round(status.current.temperatureC)}°C` : ""}`
          : "Unsuitable weather";
        const result: WeatherCheckResult = {
          signature,
          state: "blocked",
          status,
          message: draft.placement
            ? `Weather is not suitable for this selected time. ${conditions}.`
            : `No clear, dry window can fit this task today. ${conditions}.`,
        };
        setWeatherCheck(result);
        return result;
      }

      const result: WeatherCheckResult = {
        signature,
        state: "ready",
        status,
        message: status.current
          ? `${status.current.icon} ${status.current.label}${status.current.temperatureC !== undefined ? ` · ${Math.round(status.current.temperatureC)}°C` : ""}`
          : "Weather checked",
      };
      setWeatherCheck(result);
      return result;
    } catch (caught) {
      const result: WeatherCheckResult = {
        signature,
        state: "error",
        message: caught instanceof Error ? caught.message : "Weather could not be checked right now.",
      };
      setWeatherCheck(result);
      return result;
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const candidate = buildCandidate(false);
    if (!candidate) return;

    if (candidate.task.weatherSensitive) {
      const fresh = weatherCheck.signature === weatherFormSignature && weatherCheck.state !== "idle" && weatherCheck.state !== "checking";
      const result = fresh ? weatherCheck : await checkOutdoorWeather(candidate);
      if (result.state !== "ready") {
        setPendingOutdoorSave(candidate);
        return;
      }
    }

    saveCandidate(candidate);
  };

  const confirmOutdoorOverride = () => {
    if (!pendingOutdoorSave) return;
    const overridden: PendingOutdoorSave = {
      task: { ...pendingOutdoorSave.task, weatherOverride: true },
      placement: pendingOutdoorSave.placement,
    };
    if (saveCandidate(overridden)) setPendingOutdoorSave(null);
  };


  return (
    <form className={`task-form form-kind-${kind}`} onSubmit={submit}>
      <div className="section-heading form-heading">
        <div>
          <span className="form-kicker">{editing ? "Edit schedule item" : "New commitment"}</span>
          <h2>{editing ? "Update task" : "Add task"}</h2>
        </div>
        <div className="segmented compact" aria-label="Task type">
          <button
            type="button"
            className={kind === "flexible" ? "active" : ""}
            onClick={() => setKind("flexible")}
          >
            Flexible
          </button>
          <button
            type="button"
            className={kind === "fixed" ? "active" : ""}
            onClick={() => setKind("fixed")}
          >
            Fixed
          </button>
        </div>
      </div>

      <label>
        Name
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={kind === "fixed" ? "Algorithms lecture" : "Study for A1"}
        />
      </label>

      <label>
        Description <span>optional</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Add a short note"
          rows={2}
        />
      </label>

      <div className="form-grid two">
        {kind === "flexible" ? (
          <label className="duration-field">
            Duration
            <select
              value={durationMode === "custom" ? "custom" : String(duration)}
              onChange={(event) => {
                if (event.target.value === "custom") {
                  setDurationMode("custom");
                  if (!customDuration) setCustomDuration(String(duration));
                  return;
                }
                setDurationMode("preset");
                setCustomDuration("");
                setDuration(Number(event.target.value));
              }}
            >
              {DURATION_PRESETS.map((minutes) => (
                <option key={minutes} value={minutes}>{minutes} min</option>
              ))}
              <option value="custom">Custom…</option>
            </select>
            {durationMode === "custom" ? (
              <div className="custom-duration-row">
                <input
                  aria-label="Custom task duration in minutes"
                  type="number"
                  min={1}
                  max={720}
                  step={1}
                  inputMode="numeric"
                  value={customDuration}
                  onChange={(event) => setCustomDuration(event.target.value)}
                  placeholder="e.g. 75"
                  autoFocus
                />
                <span>minutes</span>
              </div>
            ) : null}
          </label>
        ) : (
          <label className="duration-field">
            Duration
            <input value={fixedDuration ? `${fixedDuration} min` : "—"} disabled />
          </label>
        )}

        <label>
          Priority
          <select value={priority} onChange={(event) => setPriority(Number(event.target.value) as PriorityChoice)}>
            {PRIORITY_CHOICES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
          <small className="field-help">{PRIORITY_CHOICES.find((item) => item.value === priority)?.help}</small>
        </label>
      </div>

      <label>
        Category
        <select value={category} onChange={(event) => setCategory(event.target.value as TaskCategory)}>
          {TASK_CATEGORIES.map((item) => (
            <option key={item.key} value={item.key}>{item.label}</option>
          ))}
        </select>
      </label>

      <section className="task-interval-card" aria-label="Preferred interval after this task">
        <div className="task-interval-copy">
          <strong>Interval after</strong>
          <span>Keep tasks back-to-back unless you want a short pause.</span>
        </div>
        <div className="task-interval-options">
          <button type="button" className={intervalMode === "immediate" ? "active" : ""} onClick={() => { setIntervalMode("immediate"); setCustomInterval(""); }}>Immediately</button>
          <button type="button" className={intervalMode === "5" ? "active" : ""} onClick={() => { setIntervalMode("5"); setCustomInterval(""); }}>5 min</button>
          <button type="button" className={intervalMode === "10" ? "active" : ""} onClick={() => { setIntervalMode("10"); setCustomInterval(""); }}>10 min</button>
          <button type="button" className={intervalMode === "custom" ? "active" : ""} onClick={() => setIntervalMode("custom")}>Custom</button>
        </div>
        {intervalMode === "custom" ? (
          <div className="task-interval-custom">
            <input
              aria-label="Custom interval after task in minutes"
              type="number"
              min={1}
              max={180}
              step={1}
              inputMode="numeric"
              value={customInterval}
              onChange={(event) => setCustomInterval(event.target.value)}
              placeholder="e.g. 12"
              autoFocus
            />
            <span>minutes</span>
          </div>
        ) : null}
      </section>

      {kind === "fixed" ? (
        <div className="form-grid two">
          <label>
            Start
            <input type="time" value={fixedStart} onChange={(event) => setFixedStart(event.target.value)} />
          </label>
          <label>
            End
            <input type="time" value={fixedEnd} onChange={(event) => setFixedEnd(event.target.value)} />
          </label>
        </div>
      ) : (
        <>
          {editing ? (
            <label>
              Scheduled start <span>clear to leave unscheduled</span>
              <input type="time" value={scheduledStart} onChange={(event) => setScheduledStart(event.target.value)} />
            </label>
          ) : null}

          <label>
            Deadline <span>optional</span>
            <input type="time" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
          </label>

          <details className="form-details constraints-details">
            <summary>More constraints</summary>
            <div className="form-details-body">
              <div className="form-grid two">
                <label>
                  Earliest start
                  <input type="time" value={earliest} onChange={(event) => setEarliest(event.target.value)} />
                </label>
                <label>
                  Latest finish
                  <input type="time" value={latest} onChange={(event) => setLatest(event.target.value)} />
                </label>
              </div>
              <label className="check-row compact-check">
                <input type="checkbox" checked={optional} onChange={(event) => setOptional(event.target.checked)} />
                <span>Optional task</span>
              </label>
            </div>
          </details>
        </>
      )}

      {kind === "fixed" ? (
        <label className="check-row compact-check">
          <input type="checkbox" checked={optional} onChange={(event) => setOptional(event.target.checked)} />
          <span>Optional commitment</span>
        </label>
      ) : null}

      <details className="form-details travel-details" open={Boolean(initialTask?.travelMinutesBefore || initialTask?.travelMinutesAfter || initialTask?.weatherSensitive)}>
        <summary>Travel & conditions</summary>
        <div className="form-details-body">
          <label>
            Location <span>optional</span>
            <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Monash sports field" />
          </label>

          <div className="form-grid two travel-direction-grid">
            <div>
              <label>
                Time to get there <span>before the event</span>
                <input
                  type="number"
                  min={0}
                  max={180}
                  step={5}
                  value={travelMinutes}
                  onChange={(event) => setTravelMinutes(Number(event.target.value))}
                />
              </label>
              <div className="travel-preset-row" aria-label="Travel time to event presets">
                {[0, 5, 10, 15, 30].map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    className={travelMinutes === minutes ? "active" : ""}
                    onClick={() => setTravelMinutes(minutes)}
                  >
                    {minutes === 0 ? "None" : `${minutes}m`}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label>
                Time after event <span>return / onward travel</span>
                <input
                  type="number"
                  min={0}
                  max={180}
                  step={5}
                  value={travelMinutesAfter}
                  onChange={(event) => setTravelMinutesAfter(Number(event.target.value))}
                />
              </label>
              <div className="travel-preset-row" aria-label="Travel time after event presets">
                {[0, 5, 10, 15, 30].map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    className={travelMinutesAfter === minutes ? "active" : ""}
                    onClick={() => setTravelMinutesAfter(minutes)}
                  >
                    {minutes === 0 ? "None" : `${minutes}m`}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="travel-explainer">The event keeps its exact start/end time. Travel is blocked separately before and after it.</p>

          <div className="weather-check-row">
            <label className="check-row compact-check weather-check">
              <input
                type="checkbox"
                checked={weatherSensitive}
                onChange={(event) => {
                  setWeatherSensitive(event.target.checked);
                  setWeatherCheck({ signature: "", state: "idle" });
                  setPendingOutdoorSave(null);
                }}
              />
              <span>Outdoor task · check clear, dry weather</span>
            </label>
            {weatherSensitive ? (
              <button
                className={`weather-check-button ${weatherCheck.signature === weatherFormSignature ? weatherCheck.state : "idle"}`}
                type="button"
                onClick={() => void checkOutdoorWeather()}
                disabled={weatherCheck.signature === weatherFormSignature && weatherCheck.state === "checking"}
              >
                {weatherCheck.signature === weatherFormSignature && weatherCheck.state === "checking" ? (
                  <><span className="weather-spinner" aria-hidden="true" /> Checking</>
                ) : weatherCheck.signature === weatherFormSignature && weatherCheck.state === "ready" ? (
                  <>✓ Good to go</>
                ) : (
                  <>Check weather</>
                )}
              </button>
            ) : null}
          </div>
          {weatherSensitive ? (
            <>
              <label>
                Weather area <span>city / suburb / postcode</span>
                <input
                  value={weatherLocation}
                  onChange={(event) => {
                    setWeatherLocation(event.target.value);
                    setPendingOutdoorSave(null);
                  }}
                  placeholder="e.g. Subang Jaya, Malaysia"
                />
              </label>
              {weatherCheck.signature === weatherFormSignature && weatherCheck.state === "blocked" ? (
                <p className="weather-check-message blocked">⚠ {weatherCheck.message}</p>
              ) : null}
              {weatherCheck.signature === weatherFormSignature && weatherCheck.state === "error" ? (
                <p className="weather-check-message blocked">Weather check failed: {weatherCheck.message}</p>
              ) : null}
              <p className="weather-form-note">Forecast data: Open-Meteo. If conditions are unsuitable, Replan will ask before you schedule it anyway.</p>
            </>
          ) : null}
        </div>
      </details>

      {pendingOutdoorSave && weatherCheck.signature === weatherFormSignature ? (
        <section className="weather-override-card" role="alert">
          <div>
            <strong>Weather may not suit this outdoor task</strong>
            <p>{weatherCheck.message ?? "Replan could not verify a clear, dry window for this task."}</p>
          </div>
          <div className="weather-override-actions">
            <button type="button" className="button secondary" onClick={() => setPendingOutdoorSave(null)}>
              Go back
            </button>
            <button type="button" className="button weather-anyway" onClick={confirmOutdoorOverride}>
              Schedule it anyway
            </button>
          </div>
        </section>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}
      <div className="form-actions">
        {onCancel ? (
          <button className="button secondary" type="button" onClick={onCancel}>Cancel</button>
        ) : null}
        <button className="button primary" type="submit">
          {editing ? "Save changes" : kind === "fixed" ? "Add commitment" : "Add to unscheduled"}
        </button>
      </div>
    </form>
  );
}


function hasUsableWeatherWindow(
  task: Task,
  windows: Array<{ start: Date; end: Date }>,
  dayStart: Date,
  dayEnd: Date,
): boolean {
  return windows.some((window) => {
    const start = Math.max(
      window.start.getTime(),
      dayStart.getTime(),
      task.earliestStart?.getTime() ?? Number.NEGATIVE_INFINITY,
    );
    const end = Math.min(
      window.end.getTime(),
      dayEnd.getTime(),
      task.latestEnd?.getTime() ?? Number.POSITIVE_INFINITY,
      task.deadline?.getTime() ?? Number.POSITIVE_INFINITY,
    );
    return end - start >= task.durationMinutes * 60_000;
  });
}
