# Replan

Replan is a deterministic, constraint-aware daily scheduler. It keeps fixed commitments anchored, schedules flexible tasks around deadlines and availability, accounts for travel/buffers and weather windows, and creates reviewable replanning proposals during a live day.

## Commands

```powershell
npm install
npm run dev
npm test
npm run lint
npm run build
npm run verify:core
npm run verify:live
```

## Design

The scheduler is framework-independent. React supplies tasks and structured events; `scheduler/` validates and optimizes the day. Weather is fetched outside the engine and injected as deterministic valid windows.

See [architecture documentation](docs/ARCHITECTURE.md) and the [demo script](docs/DEMO_SCRIPT.md).
