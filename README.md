# I-Ching Oracle — POG2 Sovereign Worker

> Cloudflare Workers · TypeScript · Durable Objects · Queues · KV · D1 · R2

The **POG2 Sovereign Worker** — primary Cloudflare deployment entry point for the POG2 system.
The repo name reflects its origin in I Ching symbolic architecture; the worker now runs
the full multi-worker orchestration layer.

## Workers

| Worker | Role |
|---|---|
| `WeaveWorker` | State weaving — attractor integration |
| `DriftWorker` | Temporal drift tracking |
| `ContinuityWorker` | Session continuity management |
| `PersonaWorker` | Persona output pipeline |

## Durable Objects

| DO | Purpose |
|---|---|
| `POG2OrchestratorDO` | Global state coordination |
| `POG2WebSocketDO` | Real-time WebSocket sessions |

## Queues

`POG2_COLLAPSE_QUEUE` · `POG2_DRIFT_QUEUE` · `POG2_CONTINUITY_QUEUE` · `POG2_CRISIS_QUEUE` · `POG2_PERSONA_QUEUE`

## Bindings

`POG2_SOVEREIGN` (KV) · `POG2_DISSIPATOR` (KV) · `POG2_BOUNDARY` (D1) · `POG2_TRANSFORMER` (R2) · Workers AI

## Architecture

```
src/
├── index.ts              # Entry — exports all workers, DOs, queue handlers
├── core/SovereignAvatar.ts  models.ts
├── durable-objects/orchestrator.ts  websocket.ts
├── workers/weave.ts  drift.ts  continuity.ts  persona.ts
├── queues/handlers.ts
├── interfaces/  constants/  db/  3D/
```

## Hexagram Routing

`HexagramManager` implements 64 I Ching states × 3 temporal dimensions (Past/Present/Future).
`TernaryRouter` resolves 729-path (3^6) ternary sequences to 64 hexagram destinations.
`BEAT_INTERVAL_MS` env var controls the metabolic tick.

```bash
wrangler deploy
```
