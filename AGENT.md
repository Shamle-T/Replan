# AGENT.md - Replan Engineering Instructions

## 1. Project mission

Replan is a constraint-aware adaptive scheduling application. It does not merely display a calendar. It must construct a feasible plan, place unscheduled flexible tasks into good time slots, track how the day actually unfolds, detect when reality invalidates the plan, and produce a revised plan while minimizing unnecessary disruption.

Core product promise:

> When the user's original plan stops working - or when a task has no assigned time yet - Replan determines a sensible next plan, proposes it, and explains why.

The scheduling/replanning engine is the product. The UI is a precise way to collect tasks, expose the plan, accept live progress updates, and show proposed changes.

## 2. Current delivery target

### User-approved extension (15 Aug 2026)

The current working MVP now includes a deliberately small subset of the previously-later travel/weather ideas because the user explicitly requested them for the demo build:

- optional `travelMinutesBefore` buffers that are treated as occupied hard-constraint time;
- travel blocks rendered immediately before calendar tasks;
- optional weather-aware outdoor tasks with a user-entered location;
- Open-Meteo is used only by a UI/service adapter to produce deterministic clear/dry scheduling windows;
- the scheduler itself still performs no network calls;
- if weather cannot be verified or no suitable window exists today, the outdoor task remains open/unscheduled rather than fabricating a next-day plan;
- Plan remains light and Live Day automatically uses the dark UI;
- scheduled tasks are editable by clicking the calendar card;
- task categories are visual tags only and do not silently change priority.

Do not expand this into traffic APIs, route calculation, automatic next-day planning, or broader contextual intelligence unless explicitly requested.

Build the Shortcut challenge MVP first. Keep later intelligence phases architecturally possible but out of the initial implementation until the core workflow is correct, tested, explainable, and usable end-to-end.

### MVP capabilities

1. Fixed tasks/events.
2. Flexible tasks that may initially have no scheduled time.
3. Task duration.
4. Priority.
5. Strict deadlines.
6. Earliest-start / latest-finish windows.
7. Optional vs mandatory tasks.
8. Task status: planned, in-progress, completed, cancelled, skipped.
9. A separate scheduled representation (`ScheduledTask`) rather than writing start/end directly into every flexible task.
10. Generate a feasible daily schedule.
11. Let the user request **Find a time** for an unscheduled flexible task.
12. Find the preferred feasible placement using the same transparent scoring rules as the day optimizer.
13. Score valid schedules and choose the best deterministic result.
14. Support a **Plan** view for creating and optimizing the day.
15. Support a **Live Day** view where the current day plays out over time.
16. Track a supplied `currentTime` and determine current/next task.
17. Accept structured progress/change events.
18. Replan after an event takes longer than expected.
19. Replan when a task finishes earlier than expected.
20. Replan after a future task is cancelled / no longer required.
21. Preserve completed, in-progress, and past work appropriately.
22. Minimize unnecessary disruption to the existing schedule.
23. Detect infeasible schedules instead of fabricating a solution.
24. Return structured reasons and a schedule diff for important decisions.
25. Support a lightweight **Update Replan** interaction using quick actions and structured input.
26. Support a deterministic **Simulation Mode** for frontend/demo testing so Live Day can run much faster than real time.
27. Unit tests for constraints, scheduling, preferred-time placement, replanning, and time-dependent behavior.
28. After an early completion, let the user choose Start now or a 5–15 minute relax window (default suggestion 10 minutes).
29. After that relax window, advance the already-next flexible task to the earliest hard-constraint-safe start when possible instead of leaving avoidable free time.
30. Show the relax window as a separate Live Day countdown rather than as a normal user task.
31. Keep the primary UI concise: show the decision/outcome first, limit proposal diffs to a few meaningful changes, and keep machine-readable reasons collapsed under a small Details affordance.
32. Avoid large explanatory hero sections, persistent technical footers, or exposing optimizer internals in the normal user flow.

## 3. Primary product modes

### 3.1 Plan

Used before or during the day to create and optimize the plan.

The Plan view should support:

- fixed commitments
- flexible tasks
- an unscheduled task inbox/list
- `Find a time` on an individual unscheduled task
- `Optimize My Day` for the whole day
- schedule proposals and explanations

An unscheduled task is a valid state. Do not force a start time at creation.

Example:

```text
Read Chapter 4
Duration: 60 min
Priority: Medium
Deadline: 20:00
Scheduled time: none

[ Find a time ]
```

The engine may propose:

```text
16:00-17:00 Read Chapter 4
Reason: earliest low-disruption slot that preserves the 20:00 deadline.
```

### 3.2 Live Day

Used while the day is happening.

The Live Day view should expose:

- current simulated/real time
- current task (`Now` card)
- next task
- remaining schedule
- quick actions: Done, Need +15m, Need +30m, Cancel/Skip where appropriate
- Update Replan message/command bar
- proposed schedule changes
- Apply Replan / Keep Current Plan

Do not create a separate full-screen AI chat as the primary MVP workflow.

## 4. Simulation Mode - required for testing/demo

The Live Day UI must be testable without waiting hours in real time.

### Required design

Core scheduling code must **never call `Date.now()` or `new Date()` to obtain the current time internally**. Time is an explicit dependency/input.

Preferred API style:

```ts
optimizeSchedule(tasks, options)
replanSchedule(tasks, currentSchedule, change, { currentTime })
findPreferredTime(taskId, tasks, currentSchedule, { currentTime })
```

Or use a small `Clock` / `TimeProvider` interface if the repository architecture benefits from it. Do not over-engineer this in Phase 1.

### Production clock

The application shell may provide actual system time.

### Simulation clock

Frontend/demo mode may provide a simulated time that advances faster than real time.

Recommended controls:

- Pause / Play
- 5 simulated minutes per second
- 10 simulated minutes per second
- 30 simulated minutes per second
- Jump to next event
- Reset simulation

Simulation Mode must:

- be deterministic
- be clearly labelled as simulation/demo mode
- not alter scheduler rules
- not require the core engine to know whether time is real or simulated
- pass the simulated timestamp through the same `currentTime` input used in production
- avoid corrupting normal saved data; use isolated demo state or resettable in-memory state

### Scheduling granularity

Scheduling is minute-flexible. Candidate starts must not snap to a 15- or
30-minute grid. The engine should consider the exact legal current/earliest
boundary plus boundaries created by fixed work, travel, buffers, and existing
placements. Real and simulated time use the same rules.

Example:

```text
Task planned: 13:00-14:00
User finishes: 13:27
Relax preference: 10 min
Proposed next flexible task: 13:37
```

If the user chooses Start now, resume immediately. If a fixed commitment or hard constraint blocks a chosen relax window, reduce it deterministically toward 5 minutes; if even 5 minutes is impossible, protect the hard constraint and resume immediately.

## 5. Interaction model

### 5.1 Schedule changes

All progress updates must resolve to a structured `ScheduleChange` before reaching the engine.

Initial model direction:

```ts
export type ScheduleChange =
  | {
      type: "TASK_COMPLETED";
      taskId: string;
      actualEnd: Date;
    }
  | {
      type: "TASK_OVERRUN";
      taskId: string;
      newExpectedEnd: Date;
    }
  | {
      type: "TASK_CANCELLED";
      taskId: string;
    }
  | {
      type: "TASK_SKIPPED";
      taskId: string;
    };
```

`TASK_STARTED` may be added if useful and small.

### 5.2 Scheduling requests

Finding a time is not a real-world disruption, so represent it separately rather than pretending it is a cancellation/overrun event.

A reasonable direction is:

```ts
export type SchedulingRequest =
  | {
      type: "FIND_TIME";
      taskId: string;
    }
  | {
      type: "OPTIMIZE_DAY";
    };
```

UI actions/messages may resolve to either a `ScheduleChange` or `SchedulingRequest`.

### 5.3 Input pipeline

```text
Quick action / message / event-card action / Find a time
                         |
                         v
              structured command
          ScheduleChange | SchedulingRequest
                         |
                         v
                 scheduler API
                         |
                         v
             proposed ScheduleResult
                         |
                         v
                   UI / user
```

If natural-language parsing is added later, it may only translate text into a structured command. It must not invent the optimized schedule itself.

## 6. Development principles

### 6.1 The scheduler must be independent of React

The scheduler must be usable as a pure TypeScript module. React components must not contain optimization logic.

Preferred separation:

```text
app / components
      |
      v
interaction adapter
      |
      v
scheduler public API
      |
      +-- domain/types
      +-- time/slots
      +-- constraints
      +-- urgency
      +-- candidates
      +-- scoring
      +-- search
      +-- replan
      +-- explain
```

### 6.2 Hard constraints and soft preferences are different

Hard constraint violation means the schedule is invalid.

Examples:

- overlapping scheduled tasks
- fixed event moved from fixed interval
- mandatory strict-deadline work finishing late
- task outside its availability window
- invalid duration
- scheduled work outside the configured day

Soft preferences contribute penalties but may be violated.

Examples:

- higher-priority work earlier
- more deadline slack
- fewer undesirable idle gaps
- minimum disruption during replanning
- preserve existing plan when alternatives are otherwise similar

Never hide a hard constraint inside a scoring penalty.

### 6.3 Determinism

Identical inputs, including the same `currentTime`, must return identical outputs. Use stable ordering and explicit tie-breakers.

### 6.4 Explainability

Important optimizer decisions must expose machine-readable reasoning metadata. Do not use an LLM to invent explanations after the fact.

### 6.5 Infeasibility is a valid result

If all mandatory constraints cannot be satisfied, return a structured infeasible result containing:

- conflicting constraints
- unscheduled tasks where applicable
- why retained tasks outranked omitted/optional tasks

Do not silently drop mandatory work.

### 6.6 Keep scoring transparent

Every scoring term must have:

- a clear name
- documented meaning
- a default weight in one configuration location
- tests demonstrating its effect

Avoid magic numbers scattered across files.

### 6.7 Human-in-the-loop decisions

For the MVP, a clear best schedule can be shown as the recommended proposal. Where practical, allow the user to Apply Replan or Keep Current Plan.

Full top-K alternatives and learned preferences belong to a later phase.

## 7. Technology

Preferred stack:

- Next.js
- React
- TypeScript strict mode
- Vitest preferred for scheduler tests unless repository already uses Jest
- localStorage for normal MVP persistence
- ESLint

Use the existing package manager. If the repository is empty, initialize a minimal Next.js TypeScript App Router project using npm unless instructed otherwise.

Do not add dependencies when a small local implementation is sufficient.

## 8. Suggested directory layout

Adapt to an existing `src/` convention consistently if needed.

```text
replan/
|-- app/
|   |-- page.tsx
|   `-- layout.tsx
|-- components/
|   |-- PlanView.tsx
|   |-- LiveDayView.tsx
|   |-- NowCard.tsx
|   |-- SimulationControls.tsx
|   |-- UpdateBar.tsx
|   |-- QuickActions.tsx
|   |-- TaskForm.tsx
|   |-- TaskList.tsx
|   |-- UnscheduledTasks.tsx
|   |-- Timeline.tsx
|   |-- ReplanDialog.tsx
|   |-- ReplanProposal.tsx
|   `-- ExplanationPanel.tsx
|-- interactions/
|   |-- scheduleChanges.ts
|   |-- schedulingRequests.ts
|   `-- updateParser.ts
|-- scheduler/
|   |-- types.ts
|   |-- config.ts
|   |-- slots.ts
|   |-- constraints.ts
|   |-- urgency.ts
|   |-- candidateGenerator.ts
|   |-- scoring.ts
|   |-- search.ts
|   |-- replan.ts
|   |-- explain.ts
|   `-- index.ts
|-- lib/
|   |-- storage.ts
|   `-- clock.ts
`-- tests/
    |-- constraints.test.ts
    |-- slots.test.ts
    |-- urgency.test.ts
    |-- scheduler.test.ts
    |-- preferredTime.test.ts
    `-- replan.test.ts
```

Do not create every file immediately. Add files when the phase requires them.

## 9. Domain model direction

Keep tasks distinct from scheduled placements.

```ts
export type TaskPriority = 1 | 2 | 3 | 4 | 5;

export type TaskStatus =
  | "planned"
  | "in-progress"
  | "completed"
  | "cancelled"
  | "skipped";

export interface Task {
  id: string;
  title: string;
  durationMinutes: number;
  priority: TaskPriority;

  deadline?: Date;

  fixedStart?: Date;
  fixedEnd?: Date;

  earliestStart?: Date;
  latestEnd?: Date;

  optional: boolean;
  status: TaskStatus;
}

export interface ScheduledTask {
  taskId: string;
  start: Date;
  end: Date;
}
```

A flexible task with no `ScheduledTask` is simply unscheduled. That is normal and supports `Find a time`.

Future fields such as location, splittable effort, assessment weight, cognitive/physical demand, or recovery effects should not be added until the relevant later phase begins unless needed only as clearly optional placeholders.

## 10. Core public API direction

Keep APIs small and deterministic. Exact names may adapt to repository style.

```ts
validateSchedule(schedule, tasks, options)

optimizeSchedule(tasks, options)

findPreferredTime(taskId, tasks, currentSchedule, options)

replanSchedule(tasks, currentSchedule, change, options)
```

`options` should include at least:

```ts
{
  currentTime: Date;
  dayStart: Date;
  dayEnd: Date;
}
```

Do not make these functions depend on browser globals.

## 11. Preferred-time behavior

`Find a time` must use the same constraint and scoring model as normal optimization.

For an unscheduled flexible task:

1. Generate legal placements.
2. Reject hard-constraint violations.
3. Evaluate the schedule impact for each placement.
4. Prefer low-cost placement according to configured weights.
5. Use deterministic tie-breakers.
6. Return the proposed placement plus structured reasons.
7. If no legal placement exists, return a clear infeasible/no-placement result.

Do not simply choose the first empty gap unless the scoring rules genuinely make it the best result.

## 12. Development phases

### Phase 0 - Specification lock

Define:

- `Task`
- `ScheduledTask`
- `ScheduleResult`
- `ScheduleChange`
- `SchedulingRequest`
- configured working-day bounds
- minute-flexible candidate boundary policy
- current-time injection policy
- exact-boundary rule for arbitrary current times
- hard constraints
- soft preferences
- deterministic tie-breakers
- five or more manual examples

Exit: domain and validity rules are unambiguous.

### Phase 1 - Scheduling foundations

Implement:

- domain types
- slot/time helpers
- current-time-safe helpers that do not read system time internally
- overlap detection
- fixed-event validation
- deadline validation
- availability-window validation
- day-bound validation
- duration validation
- `validateSchedule()`
- unit tests

Exit: manually constructed schedules validate correctly and tests pass.

### Phase 2 - Feasible scheduler + preferred time

Implement:

- fixed placement
- candidate generation
- task constraint ordering
- backtracking
- feasible/infeasible result
- `Find a time` for one unscheduled task using legal placement generation

Exit: engine generates deterministic feasible schedules and can place an unscheduled flexible task.

### Phase 3 - Optimization

Implement:

- central score weights
- priority-delay penalty
- deadline-pressure/slack penalty
- optional/unscheduled penalty
- idle-gap penalty
- deterministic comparison
- branch-and-bound only if justified

Exit: engine chooses the intended best schedule and preferred-time placement.

### Phase 4 - Adaptive replanning

Implement:

- early completion
- overrun
- cancellation
- current/past task locking
- minimum-disruption scoring
- schedule diff
- tests with injected `currentTime`

Exit: time gained and lost both produce correct revised schedules.

### Phase 5 - Explain and propose

Implement:

- machine-readable reasons
- schedule diff
- proposed schedule model
- Apply / Keep boundary

Exit: every visible significant change can be explained from engine data.

### Phase 6 - Plan + Live Day frontend

Implement:

- Plan view
- unscheduled task list
- Find a time action
- daily timeline
- Live Day view
- Now card
- quick actions
- Update Replan bar
- replan proposal
- explanation UI
- local persistence
- isolated Simulation Mode with speed controls and reset

Exit: core workflow is demonstrable end-to-end using real engine or deterministic adapter.

### Phase 7 - Verification and submission

Implement:

- regression tests
- edge cases
- deterministic simulation/demo scenario
- docs
- architecture and flowcharts
- demo dataset
- demo video

Exit: correct, explainable, pitch-ready MVP.

## 13. Later phases - do not implement yet

### Phase 8 - Multi-day preparation and sleep

- generate study/preparation sessions before tests and assignments
- use weight/date/priority/effort and later agreed parameters
- user-configured minimum/preferred sleep
- backward planning with buffers

### Phase 9 - Recovery and activity compatibility

The simple generic 5–15-minute post-task relax window is already part of the MVP. Do not expand it into contextual recovery logic yet. Later work may add:

- user-configured gym recovery
- naps/breaks as richer user-approved schedule actions
- post-test preference for lower-cognitive-load activities
- task intensity/effect model

### Phase 10 - Travel and traffic

- task/event locations
- travel-time provider abstraction
- Google Maps as one provider implementation
- traffic-aware travel blocks and schedule trade-offs

### Phase 11 - Weather-aware scheduling

- weather-sensitive outdoor tasks
- hourly weather context
- user-configured rain/condition preferences

### Phase 12 - Alternatives and personalization

- top-K meaningfully different schedules
- ask user when trade-offs are genuinely subjective
- learn transparent preference weights from explicit choices later

## 14. Testing requirements

At minimum, create deterministic tests for:

1. simple feasible day
2. overlapping fixed commitments
3. strict deadline violation
4. availability-window violation
5. impossible workload
6. preferred-time request for an unscheduled task
7. no valid preferred-time placement
8. overrun
9. early completion
10. cancellation
11. minimum-disruption tie
12. completed/past work never moves
13. arbitrary current time remains an exact legal scheduling boundary
14. identical inputs/currentTime produce identical outputs

Simulation-speed UI tests should verify the clock changes `currentTime`; they should not test a separate scheduling algorithm.

## 15. AI use

AI may help with:

- scaffolding
- test-case generation
- refactoring suggestions
- documentation
- UI implementation
- code review

The developer must understand and verify all submitted code. Reject unnecessary complexity. Do not introduce an agentic/LLM scheduling architecture merely for novelty.

## 16. Commit discipline

Prefer small meaningful commits. Suggested progression:

```text
feat(scheduler): add domain model and constraint validation
feat(scheduler): add candidate generation and feasible search
feat(scheduler): add preferred time placement
feat(scheduler): add scoring and deterministic optimization
feat(replan): handle live schedule changes
feat(replan): add structured explanations and proposals
feat(ui): add plan and unscheduled task workflow
feat(ui): add live day and simulation mode
```

## 17. Stop rule

For every agent prompt, implement only the requested stage. Run relevant tests/build checks, summarize files changed and decisions made, then stop. Do not begin later phases automatically.

## Current compact-planning refinement

- Flexible work is compact-by-default. The optimizer should avoid idle gaps between movable tasks unless a hard constraint, travel block, fixed commitment, weather window, or explicit user-requested interval requires the gap.
- Tasks may specify `bufferMinutesAfter` as a user-requested pause after the task. The default is 0 (immediately). UI presets are Immediately, 5 min, 10 min, and Custom.
- Candidate generation uses exact occupied-boundary placements so tasks can sit directly against another task/travel/buffer boundary without an artificial grid-created gap.
- Live Day task-time controls support reversible + / - adjustments. Removing extra time is only enabled for time the user previously added during the current session.
