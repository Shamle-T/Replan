# Verification Notes

Replan is a constraint-aware adaptive daily scheduler built with Next.js, React, and strict TypeScript. The scheduling engine is deterministic and has no LLM dependency.

Core behaviors covered by tests include validation, optimization determinism, adaptive replanning, simulation time progression, structured update parsing, travel occupancy, weather windows, and plan-quality presentation.

Run `npm test`, `npm run lint`, `npm run build`, `npm run verify:core`, and `npm run verify:live` from the repository root.
