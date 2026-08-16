# 3–5 Minute Demo Script

## 0:00–0:40 — Define the problem

“Replan is not another calendar. The interesting problem is what happens when a planned day stops working. I built a deterministic constraint-aware scheduler that creates a feasible plan, then repairs the remaining day after reality changes.”

Show the **Plan** screen and point out fixed commitments, flexible tasks, deadlines, availability windows, priorities, and the unscheduled state.

## 0:40–1:25 — Find a Time + optimize

Add one flexible task with no start time. Use **Find a time**.

Explain: “This is not the first free gap. Replan generates legal placements, rejects hard-constraint violations, scores the remaining candidates, and proposes the best deterministic result.”

Open the compact proposal and show the proposed time change. Mention that technical reasoning is still available under the collapsed **Details** control, but the normal user only sees the outcome and the changed times. Apply it.

Then click **Optimize my day** and briefly show any diff.

## 1:25–2:45 — Live Day / reality changes

Switch to **Live Day**. Keep Simulation mode on. Use **Next event** until a task is active.

Use **Need +30m**.

Explain: “The UI creates a `TASK_OVERRUN`. The scheduler locks work that already happened and the current task, preserves fixed commitments, and re-optimizes the remaining flexible work. It also penalizes unnecessary disruption against the old plan.”

Show the compact change summary, then Apply.

Next, use the demo lecture as the early-finish example. Finish it before 10:00. Show the 5–15-minute relax window preference, the proposal saying exactly when the assignment will now start, then Apply. The UI becomes a separate relax countdown; use **Next** to jump to the relax window end and show the assignment becoming the current task immediately.

## 2:45–3:30 — Architecture / correctness

Show the repository briefly:

- `scheduler/constraints.ts`
- `scheduler/scoring.ts`
- `scheduler/search.ts`
- `scheduler/replan.ts`
- `tests/`

Explain the hard/soft split and that the scheduler receives `currentTime` rather than reading the system clock. Mention that Simulation and Real modes use the same engine.

## 3:30–4:15 — AI + limitations

“AI helped me scaffold and accelerate implementation, but I kept the core decisions explicit and verified the scheduler independently. The main limitations are deliberate: single-day planning, a small-task bounded search, no recurring events, no travel/weather, no backend, and no LLM deciding schedules.”

Finish with: “The piece I wanted to go deep on is one complete, explainable workflow: plan the day, live it, report a disruption, and get a feasible low-disruption repair.”
