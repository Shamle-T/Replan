# Replan Architecture

Replan keeps scheduling independent from React. `scheduler/` owns the Task and ScheduledTask model, hard validation, candidate search, scoring, schedule diffs, and adaptive replanning. It receives deterministic inputs, including weather windows, and never performs browser or network work.

`lib/` provides display, persistence, simulation, weather, and activity helpers. `interactions/` maps UI actions and deterministic text updates to structured ScheduleChange values. React components coordinate state, present plans, and ask the scheduler for proposals without embedding scheduling rules.

Fixed commitments are immutable anchors. Flexible tasks are optimized around those anchors; travel and post-task buffers occupy time just like activities. Live changes produce a proposed schedule which must be applied explicitly.
