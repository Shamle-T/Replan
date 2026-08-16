# Architecture Notes

## Public scheduler API

```ts
validateSchedule(schedule, tasks, options)
optimizeSchedule(tasks, options)
findPreferredTime(taskId, tasks, currentSchedule, options)
replanSchedule(tasks, currentSchedule, change, options)
```

Every time-dependent call receives:

```ts
{
  currentTime: Date;
  dayStart: Date;
  dayEnd: Date;
  slotMinutes: 30;
}
```

## Module responsibilities

- `types.ts`: domain and result contracts.
- `slots.ts`: interval math, grid snapping, deterministic schedule ordering.
- `constraints.ts`: validity only; no optimization preference.
- `urgency.ts`: deterministic ordering for constrained tasks.
- `candidateGenerator.ts`: legal start-time candidates.
- `scoring.ts`: named soft costs and centralized weights.
- `search.ts`: fixed/locked seeding + bounded backtracking.
- `preferredTime.ts`: one-task placement using the same score model.
- `replan.ts`: structured change application, locking policy, minimum-disruption re-optimization.
- `diff.ts`: before/after machine-readable changes.
- `explain.ts`: reasons derived from engine state.

## Determinism rules

1. No current-time reads inside scheduler modules.
2. Stable task ordering with task-id fallback.
3. Stable candidate ordering.
4. Stable schedule signature as final tie-breaker.
5. Centralized score weights.
6. Explicit search-node budget.

## Replanning lock policy

Locked during a replan:

- completed work;
- any placement that has already started at `currentTime`;
- historical work earlier in the day.

Not automatically locked:

- future flexible tasks, because they are the repair surface.

Fixed future tasks are not “locked” through state; they are reintroduced from their immutable `fixedStart/fixedEnd` hard constraint.
