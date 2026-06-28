# POG2 Sovereign System — Cloudflare Implementation

## Directory Structure

```
src/
├── index.ts                    # Main entry point, exports, Env interface
├── integration.ts              # Orchestrator class, system wiring
├── constants.ts                # System constants (from spec)
├── interfaces.ts               # TypeScript interfaces (from spec)
├── workers/
│   ├── weave.ts               # Temporal Weave Engine Worker
│   ├── drift.ts               # Temporal Drift Engine Worker
│   ├── continuity.ts          # Oracle Continuity Layer Worker
│   └── persona.ts             # Oracle Persona Engine Worker
├── durable-objects/
│   ├── orchestrator.ts        # POG2OrchestratorDO (tick dispatch, registry, crisis)
│   └── websocket.ts           # POG2WebSocketDO (WebSocket hub, heartbeat)
├── queues/
│   └── handlers.ts            # All 5 queue consumers
├── db/
│   └── schema.sql             # D1 database schema (10 tables)
└── test/
    └── test-compile.ts        # Integration test suite

wrangler.toml                   # Cloudflare deployment config
```

## Deployment

```bash
# Create D1 database
wrangler d1 create pog2-boundary

# Create KV namespaces
wrangler kv:namespace create POG2_SOVEREIGN
wrangler kv:namespace create POG2_DISSIPATOR

# Create R2 bucket
wrangler r2 bucket create pog2-transformer

# Create queues
wrangler queues create pog2-collapse-events
wrangler queues create pog2-drift-events
wrangler queues create pog2-continuity-events
wrangler queues create pog2-crisis-broadcast
wrangler queues create pog2-persona-outputs

# Apply schema
wrangler d1 execute pog2-boundary --file=./src/db/schema.sql

# Deploy
wrangler deploy
```

## Architecture

- **Weave Worker**: Receives tick signals, executes 5-phase weave, stores collapse to KV, emits to drift queue
- **Drift Worker**: Consumes collapses, computes 6-component drift vectors, entropy decay, forbidden-state proximity, stores trajectory to KV, emits to continuity queue
- **Continuity Worker**: Consumes drift events, updates identity threads, manages persistence/fragmentation, computes continuity score, emits to persona queue
- **Persona Worker**: Consumes continuity events, synthesizes voice, generates 4-layer responses, handles /oracle/consult queries, emits to persona output queue
- **Orchestrator DO**: 640ms alarm, tick dispatch, thread registry, session bridging, crisis coordination
- **WebSocket DO**: Client connections, 640ms heartbeat, query/override handling, layered response delivery

## The 640ms Beat

All components synchronize on the 640ms cadence:
- Orchestrator DO alarm fires every 640ms
- Tick signal dispatched to Weave Worker
- Each worker processes within 50ms budget
- WebSocket heartbeat broadcasts every 640ms
- Query responses respect persona-mode cadence
