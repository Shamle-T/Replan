# Replan

Current implementation note: Live Day supports preset and custom 5-60-minute relax intervals after completion, cancellation, and skipping. Replan previews downstream movement before applying it, while fixed commitments remain anchored. Same-day travel buffers and weather-sensitive outdoor placement are included; the app remains a single-browser, single-day MVP with no backend database.

Replan is a constraint-aware adaptive daily scheduler built for the Shortcut Asia Internship Challenge. It is deliberately **not** a generic calendar: the product is the deterministic scheduling and replanning engine.

The defining workflow is:

> Plan the day → live the day → reality changes → Replan proposes the smallest useful repair → apply or keep it.

## What the MVP includes

- Fixed commitments that cannot move.
- Flexible tasks that may remain unscheduled.
- Duration, priority, categories, descriptions, strict deadlines, availability windows, mandatory/optional tasks.
- **Find a time** for one unscheduled task using the same score model as full-day optimization.
- **Optimize my day** using deterministic candidate search and transparent scoring.
- Infeasibility reporting instead of silently violating a hard constraint.
- **Live Day** with current/next task, automatic dark mode, a moving current-time line, and accelerated simulation controls.
- Structured updates: Done, +15m, +30m, Skip, Cancel.
- A lightweight text command adapter that maps phrases to structured changes; it does not decide schedules.
- Adaptive replanning after early completion, overruns, cancellation, and skipped work.
- User-selectable 5–15-minute relax window after an early finish, with a separate Live Day countdown.
- When safe, the already-next flexible task is pulled forward to begin as soon as that relax window ends.
- Minimum-disruption scoring so existing plans are preserved when reasonable.
- Machine-readable explanations and schedule diffs, rendered as a compact proposal instead of a wall of reasoning.
- Click-to-edit scheduled tasks using the same form used to create them, including flexible scheduled start time.
- Optional travel-before buffers that reserve calendar time and participate in hard overlap checks.
- Optional clear/dry weather constraints for outdoor tasks via Open-Meteo; unsuitable tasks remain open instead of being scheduled into bad weather.
- Category colors for academic, fitness, personal development, social/personal, and other work.
- Animated green Open Time blocks so unused capacity is explicit instead of appearing as unexplained blank space.
- localStorage persistence only; no backend/auth/database.
- Unit tests for constraints, search, preferred time, replanning, determinism, parsing, and simulation time.

## Stack

- Next.js App Router
- React
- TypeScript strict mode
- Vitest
- ESLint
- Browser localStorage
- No scheduler dependencies

## Current UX

The interface is intentionally quiet and task-focused:

- **Plan** shows one compact add-task form, the schedule, and only surfaces the unscheduled queue when something actually needs a time.
- Advanced availability fields are hidden under **More constraints** until needed.
- **Live** puts the current task first and keeps demo controls compact.
- Finishing a task early proposes a **5–15 minute relax window** and, when hard constraints allow, starts the already-next flexible task immediately after that relax window instead of showing avoidable free time.
- After the proposal is applied, the relax window is shown as a dedicated countdown. At zero, the revised next task becomes current naturally through the same schedule/current-time logic.
- The proposal modal shows the outcome and up to three changed items. Detailed algorithm reasons remain available under a collapsed **Details** control for trust/debugging, but are not part of the primary flow.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

Verification:

```bash
npm test
npm run lint
npm run build
```

A dependency-free core smoke check is also included:

```bash
npm run verify:core
```

That script compiles only the framework-independent scheduler with TypeScript and runs deterministic checks using Node's built-in assertions.

## Architecture

```text
React UI
  |
  v
Interaction adapters
  |-- quick actions
  |-- structured text parser
  v
Scheduler public API
  |-- validateSchedule
  |-- optimizeSchedule
  |-- findPreferredTime
  |-- replanSchedule
  v
Pure TypeScript engine
  |-- slot/time helpers
  |-- hard constraints
  |-- candidate generation
  |-- urgency ordering
  |-- scoring
  |-- bounded backtracking search
  |-- diff + explanation
```

The scheduler never reads the system clock. `currentTime`, `dayStart`, `dayEnd`, and any fetched weather windows are explicit inputs. The React shell can supply either a real clock or the accelerated simulation clock through the same API.

## Scheduling model

### Hard constraints

A candidate schedule is invalid when it contains any of these:

- overlapping placements;
- a moved fixed commitment;
- a strict deadline miss;
- work outside its earliest/latest availability;
- work (including required travel-before time) outside the configured day;
- invalid task duration;
- an unscheduled mandatory task, except a weather-aware outdoor task that has been deliberately held open for a verified-weather day.

Hard constraints are rejected, never converted to a soft penalty.

### Soft scoring

All legal complete schedules are ranked using named weights in `scheduler/config.ts`:

1. **Priority delay** — later starts cost more for higher-priority work.
2. **Deadline pressure** — low remaining slack costs more.
3. **Idle gaps** — unnecessary fragmentation is mildly penalized.
4. **Optional unscheduled** — optional work can be omitted, but doing so has a visible cost.
5. **Disruption** — replanning penalizes moving/resizing existing placements.

Lower score is better. Ties use a stable schedule signature, so identical inputs produce identical outputs.

## Search approach

The engine first places locked and fixed work. Flexible tasks are then ordered by constraint pressure (mandatory first, earlier deadlines, narrower windows, higher priority, longer duration). Candidate starts are generated from exact legal boundaries: the task's current/earliest window and the edges created by fixed work, travel, buffers, and already placed tasks. There is no 15- or 30-minute scheduling grid.

Live Day uses the same minute-flexible candidate rules after an early completion, cancellation, skip, or overrun. The user can take a 5–15-minute relax window and the already-next flexible task may begin at the exact minute that window ends if all hard constraints remain valid.

The optimizer uses deterministic bounded backtracking. This is appropriate for a single-day MVP with a small task count: it can reason across combinations rather than greedily accepting the first open slot, but it avoids pretending to be a production-scale solver. The search budget is explicit and a `SEARCH_LIMIT_REACHED` reason is returned if it is exhausted.

## Replanning

`replanSchedule()` first converts reality into a structured change. It then:

1. updates the affected task state;
2. locks completed, past, and currently-running work;
3. protects the user-selected relax window after an early finish when feasible;
4. attempts to advance the already-next flexible task to the relax window end;
5. preserves fixed future commitments and re-optimizes the remaining flexible work;
6. scores disruption against the old schedule;
7. returns the proposed schedule, explanations, and a diff.

This is intentionally different from shifting every later event forward.

## Simulation mode

The Live Day screen supports:

- Play / Pause
- 1 min / 5 min / 10 min / 30 min per second
- Next event
- Reset
- Simulation / Real clock switch

The simulation changes only the timestamp injected into the scheduler. There is no separate “demo scheduler.” The calendar spans 6:00 AM through 12:00 AM.

## Weather and travel

Weather is deliberately kept outside the deterministic engine. The browser adapter geocodes the task location and requests hourly `weather_code` and `precipitation` data from Open-Meteo. It converts clear/mainly-clear/partly-cloudy and dry hours into explicit scheduling windows, then passes those windows into the scheduler. The scheduler itself performs no network calls. If weather cannot be verified or there is no suitable window today, the outdoor task stays unscheduled/open.

`travelMinutesBefore` is an optional task property. The scheduler treats the interval immediately before the task as occupied time, so another task cannot consume the time needed to get to a lecture, lunch, run, gym, or other location. The calendar renders this interval as a separate Travel block.

Weather data attribution: Open-Meteo (https://open-meteo.com/).

## Important limitations

This MVP is intentionally narrow.

- It schedules one day at a time.
- The default search is designed for small daily task sets, not hundreds of tasks.
- Tasks are not splittable.
- No recurring events, sleep model, contextual recovery model, or multi-day preparation. Travel buffers and same-day weather-aware outdoor placement are supported, but weather-blocked work is kept open rather than automatically creating a next-day calendar.
- The text update parser recognizes a small explicit vocabulary; it is not open-ended natural-language AI.
- localStorage is single-browser persistence, not multi-device synchronization.
- The optimizer returns one recommended plan rather than top-K meaningfully different alternatives.

These are deliberate scope boundaries, not hidden unfinished features.

## Repository map

```text
app/                  Next.js shell and styling
components/           Plan / Live Day UI
interactions/         Structured command adapters
scheduler/            Pure TypeScript scheduling engine
lib/                  Demo data, clock helpers, persistence
scripts/              Core smoke verification
tests/                Deterministic Vitest coverage
docs/                 Submission notes, architecture, demo script
AGENT.md               Project engineering instructions
```

## AI use

AI was used as an implementation assistant for scaffolding, test-case drafting, refactoring, and UI code. The scheduling model remains explicit and inspectable rather than being delegated to an LLM. The verification strategy is to compile and test the deterministic core, inspect edge cases, and keep scoring/constraints in named modules with centralized weights.

## Weather API setup

Replan uses Open-Meteo for the internship MVP. No API key or environment variable is required for the non-commercial public API. The app calls a same-origin Next.js route (`/api/weather`) which resolves a city/suburb/postcode through Open-Meteo geocoding and then fetches current/hourly weather. The client also has a direct Open-Meteo fallback for local previews.

For an outdoor/weather-sensitive task, keep the venue in **Location** and enter a geocodable area such as `Subang Jaya, Malaysia` in **Weather area**. Open-Meteo geocoding is designed around place names/postcodes rather than venue/POI names such as a specific sports field.
