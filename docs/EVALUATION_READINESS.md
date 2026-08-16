# Shortcut Asia Evaluation Readiness

This document maps Replan to the published Internship Challenge criteria and is intended to guide the written submission and pitch. It is evidence, not a claim that every mark is guaranteed.

## Product in one sentence

Replan is a single-day, constraint-aware scheduler for a student whose plan changes during the day. It creates a feasible plan, explains movement, and lets the user approve a low-disruption repair after completion, overrun, cancellation, or skipping.

## Rubric evidence

### Understanding and reasoning - 30%

- The problem is deliberately narrow: adaptive single-day planning, not a generic calendar.
- Hard constraints are separated from soft scoring in `scheduler/constraints.ts` and `scheduler/scoring.ts`.
- Fixed commitments and completed/current work are protected; future flexible work is the repair surface.
- The search is deterministic bounded backtracking rather than an opaque LLM decision.
- `currentTime` is injected, which makes real-time and simulation use the same engine.
- Deliberate trade-offs and non-goals are documented in `docs/SUBMISSION.md`.

Pitch proof: explain why a greedy first-gap strategy can fail, why fixed events are not scored preferences, and why the search budget is explicit.

### Correctness and verification - 20%

- Vitest covers constraints, candidate placement, scoring, deterministic optimization, replanning, travel/weather, simulation, parsing, and default-plan loading.
- `tests/replan.test.ts` covers early completion, relax windows, cancellation, skipping, overruns, fixed commitments, and downstream movement.
- `scripts/core-check.cjs` provides a framework-independent smoke check for the pure scheduler.
- `scripts/live-activity-check.cjs` checks current/next activity behavior and legacy status handling.
- `npm run build` verifies production compilation and TypeScript validity.

Before submission, run the checks in a clean dependency install and resolve any failing test or environment-specific lint issue. Do not present a green status without checking the command output.

### Engineering judgement and responsible AI use - 20%

- AI was used for scaffolding, test drafting, UI acceleration, and refactoring.
- The domain model, constraint/score split, search, lock policy, and scope decisions remain explicit and reviewed.
- The scheduler never calls an LLM and never performs network requests.
- Weather is an adapter concern; the engine receives explicit weather windows.
- Generated suggestions are tested as ordinary deterministic TypeScript behavior.
- Unnecessary legacy files and helpers were removed after reference analysis.

Explain one rejected or reworked suggestion in the pitch, such as keeping scheduling deterministic instead of delegating placement to an LLM.

### Product - 15%

The complete workflow is:

```text
Create constrained tasks
        -> plan the day
        -> start Live Day
        -> report what changed
        -> preview moved events and fixed commitments
        -> apply or keep the proposal
```

The Plan page makes unscheduled work visible. Live Day makes the current and next task obvious. Proposals show before/after times instead of silently changing the user’s day. The application is intentionally single-browser and single-day so the core workflow remains understandable.

### Code quality - 15%

- `scheduler/` is framework-independent and organized by responsibility.
- React components own presentation and interaction state; scheduling modules own domain behavior.
- Result types, change events, validation codes, score breakdowns, and explanation codes are explicit.
- Time-dependent functions accept dates as inputs instead of reading the system clock.
- Tests use deterministic dates and fixtures.
- Complex logic has short comments explaining constraints, search bounds, and live compaction decisions.

## Recommended demo order

1. Show the default Plan with fixed lecture/meeting commitments and flexible work.
2. Add or edit one task and use Find a Time.
3. Click Optimize and show the confirmation proposal before applying it.
4. Switch to Live Day and simulate an overrun.
5. Demonstrate early completion, choose a relax interval, and show the downstream event moving.
6. Demonstrate Skip or Cancel with the same preview/apply flow.
7. Open the repository and explain `constraints.ts`, `candidateGenerator.ts`, `scoring.ts`, `search.ts`, `compaction.ts`, `replan.ts`, and the corresponding tests.

## Honest limitations

- The optimizer is bounded for small daily task sets; it is not a production-scale solver.
- The plan covers one day and does not model recurring events, sleep, or multi-day preparation.
- Persistence is browser `localStorage`, not a shared account database.
- Weather uses same-day windows and does not predict traffic or travel duration dynamically.
- The text parser maps a small explicit vocabulary; it is not general natural-language understanding.

## Submission checklist

- Run `npm install` from a clean checkout.
- Run `npm test`, `npm run verify:core`, `npm run verify:live`, `npm run build`, and `npm run lint`.
- Record any known failure honestly and fix it before submission where practical.
- Include the repository, this documentation, `docs/SUBMISSION.md`, `docs/ARCHITECTURE.md`, and `docs/DEMO_SCRIPT.md`.
- Provide a 3-5 minute demo focused on the workflow and reasoning, not a feature tour.
- State exactly where AI assisted and how each important output was verified.
