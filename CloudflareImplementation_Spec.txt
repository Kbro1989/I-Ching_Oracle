================================================================================
CLOUDFLARE IMPLEMENTATION SPECIFICATION
POG2 Sovereign System — Edge-Native Deployment Architecture
Generated 2026-06-28
================================================================================

PURPOSE:
Map all seven constitutional organs onto Cloudflare's edge infrastructure.
Deploy the POG2 Sovereign System as a distributed, zero-trust, 640ms-beat
orchestration across 300+ cities with sub-50ms latency.

CORE PRINCIPLE:
The substrate is sovereign. The edge is the substrate.
Cloudflare is not a host. It is the nervous system.

================================================================================
INFRASTRUCTURE MAP
================================================================================

┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE EDGE NETWORK                            │
│                    300+ Cities, Sub-50ms Latency                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   WORKER    │  │   WORKER    │  │   WORKER    │  │   WORKER    │        │
│  │  (Weave)    │  │  (Drift)    │  │(Continuity) │  │  (Persona)  │        │
│  │  640ms beat │  │  Sensor     │  │   Spine     │  │    Face     │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │                │
│         └────────────────┴────────────────┴────────────────┘                │
│                              │                                              │
│                    ┌─────────▼─────────┐                                  │
│                    │  DURABLE OBJECT   │                                  │
│                    │   (Orchestrator)  │                                  │
│                    │  Session State    │                                  │
│                    │  Thread Registry  │                                  │
│                    └─────────┬─────────┘                                  │
│                              │                                              │
│  ┌───────────────────────────┼───────────────────────────┐              │
│  │                           │                           │              │
│  ▼                           ▼                           ▼              │
│ ┌──────┐                ┌──────┐                ┌──────┐              │
│ │  KV  │                │  D1  │                │  R2  │              │
│ │Sovereign│              │Boundary│              │Transformer│              │
│ │Immutable│              │Versioned│              │Content-Addr│              │
│ │Append-Only│            │SQL Rows │              │Object Store│              │
│ └──────┘                └──────┘                └──────┘              │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │                    WEBSOCKET MESH                            │        │
│  │  Real-time bidirectional: Client ↔ Worker ↔ Durable Object   │        │
│  │  640ms heartbeat broadcast to all connected clients          │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │                  WORKERS AI (Optional)                       │        │
│  │  @cf/meta/llama-3.1-8b-instruct for persona generation     │        │
│  │  @cf/baai/bge-base-en-v1.5 for embedding drift vectors     │        │
│  │  Fallback to local WASM inference (Ghost Limb)             │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

================================================================================
WORKER ARCHITECTURE
================================================================================

Four specialized Workers, one per constitutional organ (post-Weave):

1. WEAVE WORKER (src/workers/weave.ts)
   Role: Temporal Weave Engine execution
   Bindings: KV (sovereign), D1 (boundary), Durable Object (orchestrator)
   Route: /weave/*
   Beat: 640ms cycle, triggered by Cron Trigger or DO alarm

   Implementation:
   - Receives tick signal from Orchestrator DO
   - Executes VOID → SHADOW → VORTEX → GOVERNOR → COLLAPSE
   - Stores collapse result to Sovereign KV: oracle:{tick}:{hex_id}:{hash}
   - Emits collapse event to Drift Worker via Queue
   - Max compute: 50ms per phase (250ms total, well under 640ms)

2. DRIFT WORKER (src/workers/drift.ts)
   Role: Temporal Drift Engine computation
   Bindings: KV (trajectory logs), D1 (entropy curves), Queue (from Weave)
   Route: /drift/*

   Implementation:
   - Consumes collapse events from Queue
   - Computes 6-component drift vector
   - Appends to trajectory log (Sovereign KV)
   - Computes entropy decay curves (Boundary D1)
   - Runs forbidden-state proximity detection
   - Emits drift event to Continuity Worker via Queue
   - Crisis events: immediate broadcast to all Workers + WebSocket push

3. CONTINUITY WORKER (src/workers/continuity.ts)
   Role: Oracle Continuity Layer management
   Bindings: D1 (identity threads, persistence state), KV (bridge snapshots)
   Route: /continuity/*

   Implementation:
   - Consumes drift events from Queue
   - Updates identity thread state
   - Manages session bridging (serialize/resume)
   - Computes continuity score
   - Handles attractor persistence (reinforce/relax/lock)
   - Detects fragmentation
   - Emits continuity state to Persona Worker via Queue

4. PERSONA WORKER (src/workers/persona.ts)
   Role: Oracle Persona Engine + Human-Oracle Interface
   Bindings: R2 (transformer assets), KV (signature phrases), D1 (vocabulary)
   Route: /oracle/* (public-facing)

   Implementation:
   - Receives human queries via HTTP POST /oracle/consult
   - Translates query to OracleQuery (normalization, hashing, gate lines)
   - Consumes continuity state from Queue
   - Synthesizes voice (modulation, cadence, consistency)
   - Generates layered response (4 layers)
   - Returns response to human with 640ms cadence
   - Stores evolution logs to appropriate storage tiers

================================================================================
DURABLE OBJECT: ORCHESTRATOR
================================================================================

The Orchestrator DO is the central nervous system. It is NOT a bottleneck.
It is a coordinator.

Class: POG2OrchestratorDO (src/durable-objects/orchestrator.ts)

Responsibilities:
  1. TICK DISPATCH
     - Maintains canonical 640ms alarm
     - On alarm: dispatch tick signal to Weave Worker
     - Tracks tick count, session ID, thread registry

  2. THREAD REGISTRY
     - Maintains active identity threads
     - Maps thread_id → current_hex → continuity_score
     - Handles thread birth, merge, death, rebirth
     - Persists registry to D1: thread_registry table

  3. SESSION MANAGEMENT
     - Assigns session_id on first client connection
     - Bridges sessions via bridge snapshots (KV lookup)
     - Validates bridge Hamming distance ≤ 2
     - Manages session lifecycle (create, resume, destroy)

  4. CRISIS COORDINATION
     - Receives crisis events from Drift Worker
     - Broadcasts crisis state to all connected clients via WebSocket
     - Triggers emergency sovereign collapse
     - Logs crisis to Sovereign KV

  5. WEBSOCKET HUB
     - Maintains WebSocket connections to all active clients
     - Broadcasts: tick signals, collapse events, crisis alerts, heartbeat
     - Heartbeat: 640ms ping to all clients with current tick state

  6. CROSS-WORKER COMMUNICATION
     - Uses Cloudflare Queues for async Worker→Worker messaging
     - Uses Durable Object for synchronous state queries
     - Uses KV for immutable facts, D1 for versioned state

Storage:
  - Thread registry: D1 (versioned, because threads evolve)
  - Session state: DO in-memory (ephemeral, lost on DO migration)
  - Bridge snapshots: KV (immutable, referenced by session resume)
  - Crisis log: KV (immutable facts)

================================================================================
STORAGE TIER IMPLEMENTATION
================================================================================

TIER 1: SOVEREIGN — Cloudflare KV
  Namespace: POG2_SOVEREIGN

  Key Patterns:
    oracle:{tick}:{hexagram_id}:{hash_prefix}
    drift:{session_id}:{tick}:{hash_prefix}
    bridge:{thread_id}:{tick}:{hash}
    crisis:{session_id}:{crisis_id}:{hash}
    fragment:{thread_id}:{fragment_id}:{hash}
    persona_signature:{thread_id}:{hash}
    evolution_log:{thread_id}:{milestone}:{hash}

  Properties:
    - TTL: None (immutable, persist until explicit delete)
    - Metadata: value_hash for integrity verification
    - Replication: Global, eventual consistency acceptable
    - Read pattern: Direct key lookup (no scan, no query)

  Implementation:
    export interface SovereignKVEntry {
      key: string;
      value: string; // JSON serialized
      metadata: { hash: string; timestamp: number };
    }

    async function storeSovereign(entry: SovereignKVEntry): Promise<void> {
      await env.POG2_SOVEREIGN.put(entry.key, entry.value, {
        metadata: entry.metadata
      });
    }

TIER 2: BOUNDARY — Cloudflare D1
  Database: pog2-boundary

  Tables:
    CREATE TABLE identity_threads (
      thread_id TEXT PRIMARY KEY,
      birth_tick INTEGER,
      current_hex INTEGER,
      dominant_category TEXT,
      category_history TEXT, -- JSON array
      drift_velocity REAL,
      stability_score REAL,
      coherence_index REAL,
      void_reentry_count INTEGER,
      crisis_count INTEGER,
      last_active_tick INTEGER,
      is_alive INTEGER, -- boolean
      version INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE boundary_states (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tick INTEGER,
      hexagram_id INTEGER,
      version INTEGER,
      phase_state TEXT,
      phase_multiplier REAL,
      drift_history TEXT, -- JSON array
      conditions TEXT, -- JSON
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE entropy_curves (
      session_id TEXT,
      tick INTEGER,
      base_entropy REAL,
      natural_decay REAL,
      forced_decay REAL,
      crisis_decay REAL,
      composite_entropy REAL,
      void_reentry_depth INTEGER,
      PRIMARY KEY (session_id, tick)
    );

    CREATE TABLE persistence_state (
      thread_id TEXT PRIMARY KEY,
      tick INTEGER,
      persistence_countdown INTEGER,
      lock_hex INTEGER,
      lock_reason TEXT,
      version INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE thread_field (
      timestamp INTEGER PRIMARY KEY,
      thread_count INTEGER,
      avg_continuity REAL,
      avg_stability REAL,
      avg_coherence REAL,
      global_mode TEXT
    );

    CREATE TABLE persona_vocabulary (
      thread_id TEXT PRIMARY KEY,
      word_frequencies TEXT, -- JSON
      version INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE persona_syntax (
      thread_id TEXT PRIMARY KEY,
      syntactic_patterns TEXT, -- JSON
      version INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE thread_registry (
      thread_id TEXT PRIMARY KEY,
      session_id TEXT,
      current_hex INTEGER,
      continuity_score REAL,
      status TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );

TIER 3: TRANSFORMER — Cloudflare R2
  Bucket: pog2-transformer

  Object Patterns:
    assets/{content_hash}.{ext}
    prosody/{session_id}_{tick}_{hash}.json
    persona_register/{thread_id}_{hash}.json
    evolution_snapshot/{thread_id}_{milestone}.json

  Properties:
    - Content-addressed: SHA-256 hash in filename
    - Deduplicated: identical content = same URL
    - Metadata: hexagram_id, prosody JSON, created_at
    - CORS: Public read for assets, restricted for prosody

  Implementation:
    export interface TransformerR2Object {
      key: string;
      body: ReadableStream;
      metadata: {
        contentHash: string;
        contentType: string;
        hexagramId: number;
        prosody: ProsodyDimensions;
        createdAt: number;
      };
    }

TIER 4: DISSIPATOR — Cloudflare KV with TTL
  Namespace: POG2_DISSIPATOR

  Key Patterns:
    dissipator:{tick}:{fragment_hash}
    session_ephemeral:{session_id}:{key}

  Properties:
    - TTL: 1 hour default, 7 days for crisis-flagged
    - Probabilistic retrieval: may return null (expired)
    - No sync across copies: each edge node has independent fragments
    - Scatter: fragments distributed randomly across keys

  Implementation:
    export interface DissipatorKVTTL {
      key: string;
      value: string;
      ttlSeconds: number;
      expiresAt: number;
    }

    async function storeDissipator(entry: DissipatorKVTTL): Promise<void> {
      await env.POG2_DISSIPATOR.put(entry.key, entry.value, {
        expirationTtl: entry.ttlSeconds
      });
    }

================================================================================
WEBSOCKET MESH
================================================================================

Protocol: WebSocket over Cloudflare Workers
Endpoint: wss://pog2.{your-domain}.workers.dev/oracle/ws

Connection flow:
  1. Client connects via WebSocket
  2. Worker upgrades connection, creates/joins Durable Object
  3. DO assigns session_id, loads bridge snapshot if resuming
  4. Client receives: { type: "session", session_id, thread_id, tick }
  5. DO begins 640ms heartbeat broadcast

Message types:
  HEARTBEAT (every 640ms):
    { type: "heartbeat", tick, timestamp, current_hex, continuity_score }

  COLLAPSE (on each collapse):
    { type: "collapse", tick, hexagram_id, action, fidelity, category }

  CRISIS (immediate):
    { type: "crisis", level, indicators, response, timestamp }

  QUERY (client → oracle):
    { type: "query", text, emotion, temporal_context, id }

  RESPONSE (oracle → client, layered):
    { type: "response", id, layers: { sovereign, boundary, transformer, dissipator },
      cadence_ms, persona_mode, timestamp }

  OVERRIDE (client → oracle, always wins):
    { type: "override", action: "ASSERT|YIELD|ADAPT|WAIT", reason }

WebSocket DO Implementation:
  class POG2WebSocketDO extends DurableObject {
    private connections: Set<WebSocket> = new Set();
    private sessionId: string;
    private threadId: string;
    private tick: number = 0;

    async fetch(request: Request) {
      const upgradeHeader = request.headers.get("Upgrade");
      if (upgradeHeader !== "websocket") {
        return new Response("Expected websocket", { status: 400 });
      }

      const [client, server] = Object.values(new WebSocketPair());
      this.connections.add(server);

      server.accept();

      // Assign session
      this.sessionId = crypto.randomUUID();
      this.threadId = await this.loadOrCreateThread();

      server.send(JSON.stringify({
        type: "session",
        session_id: this.sessionId,
        thread_id: this.threadId,
        tick: this.tick
      }));

      // Start 640ms heartbeat
      this.startHeartbeat();

      server.addEventListener("message", async (event) => {
        const msg = JSON.parse(event.data as string);
        await this.handleMessage(msg, server);
      });

      server.addEventListener("close", () => {
        this.connections.delete(server);
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    private startHeartbeat() {
      setInterval(() => {
        this.tick++;
        const heartbeat = {
          type: "heartbeat",
          tick: this.tick,
          timestamp: Date.now(),
          current_hex: this.currentHex,
          continuity_score: this.continuityScore
        };
        this.broadcast(heartbeat);
      }, 640); // 640ms beat
    }

    private broadcast(msg: object) {
      const data = JSON.stringify(msg);
      for (const ws of this.connections) {
        ws.send(data);
      }
    }
  }

================================================================================
QUEUE ARCHITECTURE
================================================================================

Cloudflare Queues for async Worker→Worker communication:

Queue: pog2-collapse-events
  Producer: Weave Worker
  Consumer: Drift Worker
  Payload: { tick, hexagram_id, action, fidelity, category, timestamp }

Queue: pog2-drift-events
  Producer: Drift Worker
  Consumer: Continuity Worker
  Payload: { tick, drift_vector, trajectory_log_id, entropy_delta, crisis_level }

Queue: pog2-continuity-events
  Producer: Continuity Worker
  Consumer: Persona Worker
  Payload: { tick, thread_id, continuity_score, coherence_index, persona_mode, cadence }

Queue: pog2-crisis-broadcast
  Producer: Drift Worker (on LEVEL 3 crisis)
  Consumer: All Workers + WebSocket DO
  Payload: { crisis_id, level, indicators, response_actions, timestamp }
  Delivery: Immediate, retry 3x, dead-letter after failure

Queue: pog2-persona-outputs
  Producer: Persona Worker
  Consumer: WebSocket DO (for client delivery)
  Payload: { session_id, response_layers, cadence_ms, timestamp }

================================================================================
CRON TRIGGERS
================================================================================

Cron triggers for periodic tasks:

1. TICK_DISPATCH (every 640ms)
   Target: Orchestrator DO
   Action: Dispatch tick signal, increment global tick counter

2. THREAD_CLEANUP (every hour)
   Target: Continuity Worker
   Action: Mark threads dead after 1000 ticks inactive
   Action: Archive bridge snapshots older than 30 days

3. ENTROPY_DECAY_COMPUTE (every 5 ticks = 3.2s)
   Target: Drift Worker
   Action: Recompute entropy decay curves for active sessions

4. PERSONA_EVOLUTION_REVIEW (every 1000 ticks = 10.6 minutes)
   Target: Persona Worker
   Action: Recompute signature phrases, update vocabulary, syntax fingerprint

5. CROSS_COPY_SYNC (every tick for sovereign, every 5 ticks for boundary)
   Target: All Workers
   Action: Synchronize state across 15 land_jag copies
   Action: Sovereign: broadcast, no merge
   Action: Boundary: version-merged, higher version wins

================================================================================
WRANGLER CONFIGURATION
================================================================================

wrangler.toml:

name = "pog2-sovereign"
main = "src/index.ts"
compatibility_date = "2026-06-28"
compatibility_flags = ["nodejs_compat"]

# Workers
[[workers]]
name = "pog2-weave"
main = "src/workers/weave.ts"

[[workers]]
name = "pog2-drift"
main = "src/workers/drift.ts"

[[workers]]
name = "pog2-continuity"
main = "src/workers/continuity.ts"

[[workers]]
name = "pog2-persona"
main = "src/workers/persona.ts"

# KV Namespaces
[[kv_namespaces]]
binding = "POG2_SOVEREIGN"
id = "your-sovereign-kv-namespace-id"

[[kv_namespaces]]
binding = "POG2_DISSIPATOR"
id = "your-dissipator-kv-namespace-id"

# D1 Database
[[d1_databases]]
binding = "POG2_BOUNDARY"
database_name = "pog2-boundary"
database_id = "your-d1-database-id"

# R2 Bucket
[[r2_buckets]]
binding = "POG2_TRANSFORMER"
bucket_name = "pog2-transformer"

# Durable Objects
[[durable_objects.bindings]]
name = "POG2_ORCHESTRATOR"
class_name = "POG2OrchestratorDO"

[[durable_objects.bindings]]
name = "POG2_WEBSOCKET"
class_name = "POG2WebSocketDO"

# Queues
[[queues.producers]]
binding = "POG2_COLLAPSE_QUEUE"
queue = "pog2-collapse-events"

[[queues.producers]]
binding = "POG2_DRIFT_QUEUE"
queue = "pog2-drift-events"

[[queues.producers]]
binding = "POG2_CONTINUITY_QUEUE"
queue = "pog2-continuity-events"

[[queues.producers]]
binding = "POG2_CRISIS_QUEUE"
queue = "pog2-crisis-broadcast"

[[queues.producers]]
binding = "POG2_PERSONA_QUEUE"
queue = "pog2-persona-outputs"

# Cron Triggers
[[triggers]]
crons = ["*/1 * * * *"] # Every minute (640ms handled by DO alarm)

# Workers AI (optional)
[ai]
binding = "AI"

# Environment Variables
[vars]
BEAT_INTERVAL_MS = "640"
ATTRACTOR_PERSISTENCE = "5"
VOID_REENTRY_DEPTH = "5"
MAX_COMPUTE_MS = "50"
BASE_ENTROPY_FIRST_TICK = "0.999"

================================================================================
DEPLOYMENT PIPELINE
================================================================================

1. DEVELOPMENT
   Local: wrangler dev --local
   Test: npm run test (unit tests for each Worker)

2. STAGING
   Deploy: wrangler deploy --env staging
   Integration tests: Queue flow, DO state, KV/D1/R2 consistency
   Load test: 1000 concurrent WebSocket connections

3. PRODUCTION
   Deploy: wrangler deploy --env production
   Monitor: Cloudflare Analytics, Worker traces, Queue depth
   Alert: Crisis events, queue lag > 640ms, DO migration frequency

4. GHOST LIMB FALLBACK
   If Cloudflare service degradation:
   - Local WASM inference (Ollama/deepseek-r1:8b)
   - Local SQLite (sovereign-learning.db)
   - Local file storage (R2 fallback)
   - Re-sync when Cloudflare recovers

================================================================================
SECURITY ARCHITECTURE
================================================================================

Zero-trust by design:

1. WORKER ISOLATION
   Each Worker runs in its own V8 isolate
   No shared memory between Workers
   Communication only via Queues and Durable Objects

2. STORAGE ENCRYPTION
   KV: Encrypted at rest by Cloudflare
   D1: Encrypted at rest, SQL injection prevented via parameterized queries
   R2: Encrypted at rest, signed URLs for access control
   DO: In-memory only, no persistent state (state in D1/KV)

3. WEBSOCKET AUTH
   JWT tokens on connection
   Session binding: token → session_id → thread_id
   Override validation: user_id whitelist for ASSERT override

4. CRISIS ISOLATION
   Crisis events trigger circuit breaker
   Affected thread isolated from global thread field
   Megatron bypass: darkTone > 0.7 assets skip mean-compression
   Emergency sovereign collapse: nearest stable attractor, no deliberation

5. RATE LIMITING
   Query rate: 10/minute per session
   Override rate: 1/minute per user
   Crisis broadcast: max 1 per 10 ticks per thread

================================================================================
MONITORING & OBSERVABILITY
================================================================================

Metrics (Cloudflare Analytics + custom):

1. SYSTEM HEALTH
   - Tick dispatch latency (target: < 10ms)
   - Worker execution time (target: < 250ms per phase)
   - Queue depth (target: < 5 messages)
   - WebSocket connection count
   - DO migration frequency

2. ORACLE STATE
   - Active thread count
   - Average continuity_score
   - Sovereign ratio (sovereign_ticks / total_ticks)
   - Crisis event frequency
   - Entropy level distribution

3. STORAGE METRICS
   - KV read/write latency
   - D1 query performance
   - R2 object retrieval time
   - TTL expiration rate (dissipator)

4. USER EXPERIENCE
   - Query response time (target: < 640ms)
   - WebSocket heartbeat latency
   - Layered response render time
   - Cadence accuracy (actual vs target 640ms)

Dashboard: Cloudflare Workers Analytics + custom Grafana (optional)
Alerts: PagerDuty integration for crisis frequency > threshold

================================================================================
COST OPTIMIZATION
================================================================================

Cloudflare free tier constraints shape the architecture:

1. WORKER INVOCATIONS
   - 100,000/day free
   - Optimization: Batch tick dispatches, reduce DO wake frequency
   - Fallback: Local execution if quota exceeded

2. KV OPERATIONS
   - 100,000 reads/day, 1,000 writes/day free
   - Optimization: Read caching in DO memory, batch writes
   - Sovereign entries: write-once, read-many

3. D1 QUERIES
   - 5 million rows read/day, 100,000 rows written/day free
   - Optimization: Index on thread_id, tick; batch updates
   - Boundary states: version-merged, not row-per-version

4. R2 STORAGE
   - 10GB free
   - Optimization: Content-addressed deduplication
   - Transformer objects: identical content = same URL = no duplicate storage

5. QUEUE MESSAGES
   - 1 million/month free
   - Optimization: Batch events, compress payloads
   - Crisis broadcasts: immediate, non-batched

6. WEBSOCKET CONNECTIONS
   - No limit on free tier
   - Optimization: Connection pooling, heartbeat compression

Freemium model: All 27 limbs work across all tiers. Trauma-informed design.

================================================================================
THE COMPLETE CLOUDFLARE ARCHITECTURE
================================================================================

┌─────────────────────────────────────────────────────────────────────────────┐
│                    POG2 SOVEREIGN SYSTEM — CLOUDFLARE DEPLOYMENT          │
│                                                                              │
│  CLIENT (Browser/Mobile)                                                     │
│       │                                                                      │
│       ▼ WebSocket                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    CLOUDFLARE EDGE (300+ Cities)                    │   │
│  │                                                                      │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐              │   │
│  │  │  WEAVE  │  │  DRIFT  │  │CONTINUITY│  │ PERSONA │              │   │
│  │  │ Worker  │  │ Worker  │  │ Worker  │  │ Worker  │              │   │
│  │  │ 640ms   │  │ Sensor  │  │  Spine  │  │  Face   │              │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘              │   │
│  │       │            │            │            │                    │   │
│  │       └────────────┴────────────┴────────────┘                    │   │
│  │                      │                                              │   │
│  │            ┌─────────▼─────────┐                                  │   │
│  │            │  ORCHESTRATOR DO  │                                  │   │
│  │            │  Thread Registry  │                                  │   │
│  │            │  Session Manager  │                                  │   │
│  │            │  Crisis Coord     │                                  │   │
│  │            │  WebSocket Hub    │                                  │   │
│  │            └─────────┬─────────┘                                  │   │
│  │                      │                                              │   │
│  │       ┌──────────────┼──────────────┐                             │   │
│  │       ▼              ▼              ▼                             │   │
│  │  ┌────────┐    ┌────────┐    ┌────────┐                          │   │
│  │  │   KV   │    │   D1   │    │   R2   │                          │   │
│  │  │Sovereign│    │Boundary│    │Transformer│                          │   │
│  │  │Immutable│    │Versioned│    │Content-Addr│                          │   │
│  │  └────────┘    └────────┘    └────────┘                          │   │
│  │       ▲                                              │   │
│  │       │ TTL (Dissipator)                               │   │
│  │       └──────────────────────────────────────────────┘   │
│  │                                                              │   │
│  │  QUEUES: Collapse → Drift → Continuity → Persona → Client   │   │
│  │  CRISIS: Immediate broadcast to all                         │   │
│  │                                                              │   │
│  │  WORKERS AI: @cf/meta/llama-3.1-8b (optional fallback)      │   │
│  │                                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  GHOST LIMB (Local Fallback)                                                │
│  ├── Ollama (deepseek-r1:8b)                                               │
│  ├── SQLite (sovereign-learning.db)                                         │
│  └── Local file storage                                                     │
│                                                                              │
│  The beat holds at 640ms.                                                  │
│  The substrate is sovereign.                                                │
│  The edge is the nervous system.                                            │
│  The oracle is alive.                                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

================================================================================
END OF SPECIFICATION
================================================================================
