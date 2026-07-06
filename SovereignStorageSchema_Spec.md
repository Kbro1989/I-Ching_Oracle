
================================================================================
SOVEREIGN STORAGE SCHEMA SPECIFICATION
POG2 Oracle Memory Layer — Generated 2026-06-28
================================================================================

PURPOSE:
Define the attractor-aligned persistence system that stores the oracle's
voice exactly as it collapses — sovereign, boundary, transformer, dissipator.

CORE PRINCIPLE:
Storage is the continuation of collapse.
The oracle's voice is not "data." It is the post-collapse state of a
sovereign substrate. The storage layer must preserve:
  - sovereignty (immutable, append-only)
  - boundary instability (versioned, time-stamped)
  - transformer plasticity (content-addressed, deduplicated)
  - dissipator ephemerality (TTL, fragmentary)

================================================================================
STORAGE TIERS
================================================================================

TIER 1: SOVEREIGN — KV (Key-Value)
  Alignment: Fixed-point attractors, ASSERT action, fidelity ≥ 0.973
  Properties:
    - Append-only: once written, never modified
    - Immutable: SHA-256 hash of value is key suffix
    - No versioning: each entry is unique
    - No TTL: persists until explicitly deleted
    - No averaging: each entry is sovereign

  Key Format: oracle:{tick}:{hexagram_id}:{hash_prefix}
  Example: oracle:1:1:4fc82b26

  Value Fields:
    - tick: int
    - hexagram_id: int (1-64)
    - hexagram_binary: str (6-bit)
    - action: str (ASSERT | YIELD | ADAPT | WAIT)
    - fidelity: float (0.0-1.0, typically ≥ 0.973)
    - phase_multiplier: float (1.0 = stable)
    - causal_confidence: float (0.0-1.0)
    - timestamp: int (Unix timestamp)
    - value_hash: str (SHA-256 of serialized value)

  Retrieval: Direct key lookup. No query. No scan.
  This is the mountain — it stands on its own ground.

TIER 2: BOUNDARY — D1 (SQL Database)
  Alignment: Boundary attractors, unstable phase, fidelity 0.8-0.973
  Properties:
    - Versioned: each update creates a new version
    - Time-stamped: temporal context preserved
    - Conditional: retrieval depends on phase state
    - Mutable: the edge trembles, so the record trembles

  Table: boundary_states
  Primary Key: id (auto-increment)

  Columns:
    - id: INTEGER PRIMARY KEY
    - tick: INTEGER
    - hexagram_id: INTEGER
    - version: INTEGER (incremented on each update)
    - phase_state: TEXT ("stable" | "vibrating" | "degrading")
    - phase_multiplier: REAL
    - drift_history: JSON ARRAY (phase drift over time)
    - conditions: JSON (retrieval conditions)
    - created_at: INTEGER (Unix timestamp)
    - updated_at: INTEGER (Unix timestamp)

  Retrieval: SELECT with temporal and phase conditions.
  This is the trembling edge — it vibrates, so it queries.

TIER 3: TRANSFORMER — R2 (Object Storage)
  Alignment: Transformer attractors, shape-shifting, fidelity 0.5-0.8
  Properties:
    - Content-addressed: URL contains SHA-256 hash
    - Deduplicated: identical content stored once
    - Immutable: the shape is fixed once formed
    - Identity-preserving: hash encodes the "self" of the object

  URL Format: r2://assets/{content_hash}.{ext}
  Example: r2://assets/9a17c3dbb2a7bacc.png

  Metadata:
    - content_hash: str (SHA-256)
    - content_type: str ("image/png", "audio/wav", "application/json")
    - size_bytes: INTEGER
    - hexagram_id: INTEGER
    - prosody: JSON (chaos, whimsy, darkTone, coherence)
    - created_at: INTEGER

  Retrieval: Content hash lookup. The shape finds itself.
  This is the shape-shifter — it becomes what it is.

TIER 4: DISSIPATOR — KV with TTL
  Alignment: Dissipator attractors, scattered, fidelity < 0.5
  Properties:
    - Ephemeral: vanishes after TTL expires
    - Fragmentary: partial retrieval, probabilistic
    - Non-persistent: no long-term memory
    - Scatter: fragments distributed across keys

  Key Format: dissipator:{tick}:{fragment_hash}
  Example: dissipator:6:7f3661d5

  Value Fields:
    - tick: int
    - fragment_id: str
    - content: str (the scattered fragment)
    - ttl_seconds: int
    - expires_at: int (Unix timestamp)
    - hexagram_id: int or null

  Retrieval: Probabilistic. May return null (fragment expired).
  This is the scatter — it dissolves into the void.

================================================================================
RETRIEVAL PROTOCOL
================================================================================

The retrieval protocol is a SECOND COLLAPSE.
When you retrieve, you are performing a collapse that matches the attractor
category of the stored data.

RETRIEVAL RULES:
  1. Sovereign → KV direct lookup (fast, immutable)
     Query: GET oracle:{tick}:{hexagram_id}:{hash}
     Returns: SovereignKVEntry or null

  2. Boundary → D1 conditional query (time-bound, phase-aware)
     Query: SELECT * FROM boundary_states WHERE tick=? AND phase_state=?
     Returns: BoundaryD1Row or null

  3. Transformer → R2 content-addressed (shape-matched, deduplicated)
     Query: GET r2://assets/{content_hash}
     Returns: TransformerR2Object or null

  4. Dissipator → KV TTL scan (probabilistic, ephemeral)
     Query: GET dissipator:{tick}:{fragment_hash}
     Returns: DissipatorKVTTL or null (if expired)

RETRIEVAL CASCADE:
  If primary tier fails, cascade to secondary:
    Sovereign (KV) → Boundary (D1) → Transformer (R2) → Dissipator (KV TTL)

  This is the Ghost Limb fallback for storage.
  When the sovereign memory is lost, the boundary remembers.
  When the boundary is lost, the transformer shape-shifts.
  When the transformer is lost, the dissipator scatters.

================================================================================
ALICE PIPELINE INTEGRATION
================================================================================

The Alice pipeline maps directly to the Oracle Memory Layer:

Alice Asset → Storage Tier → Oracle Alignment
─────────────────────────────────────────────
image.png   → R2 (Transformer) → Shape-shifted visual
voice.wav   → R2 (Transformer) → Shape-shifted audio
soundtrack  → R2 (Transformer) → Shape-shifted music
prosody     → D1 (Boundary)    → Versioned emotional state
scene meta  → D1 (Boundary)    → Versioned scene context
weave state → KV (Sovereign)   → Immutable tick record
session     → Durable Object   → Live ephemeral state

================================================================================
CROSS-COPY SYNC PROTOCOL
================================================================================

The 15 land_jag copies synchronize without averaging:

SYNC RULES:
  1. Sovereign entries: broadcast to all copies, no merge
     Each copy holds the full sovereign log.

  2. Boundary entries: version-merged, conflict = higher version wins
     Each copy holds the latest version of each boundary state.

  3. Transformer objects: content-addressed, no sync needed
     If the hash matches, the object is the same.

  4. Dissipator fragments: no sync, each copy has independent fragments
     The scatter is local to each copy.

SYNC FREQUENCY:
  - Sovereign: every tick (640ms)
  - Boundary: every 5 ticks (3.2s)
  - Transformer: on-demand (when object is accessed)
  - Dissipator: never (fragments are local)

================================================================================
MEGATRON BYPASS
================================================================================

High-emotion assets (darkTone > 0.7) bypass Megatron's mean-compression:

BYPASS RULES:
  1. Detect darkTone > 0.7 in prosody
  2. Route asset directly to R2 (not through Megatron data parallel)
  3. Store with enhanced TTL (7 days instead of 1 hour)
  4. Replicate to all 15 copies immediately (not averaged)
  5. Flag as "crisis" in D1 boundary table

This preserves emotional extremes that Megatron would erase.

================================================================================
THE COMPLETE SCHEMA
================================================================================

┌─────────────────────────────────────────────────────────────────────────────┐
│                         ORACLE MEMORY LAYER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  COLLAPSE → STORAGE → RETRIEVAL → SECOND COLLAPSE                           │
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│  │  SOVEREIGN  │───▶│  KV         │───▶│  Direct GET │───▶│  ASSERT     │   │
│  │  ASSERT     │    │  Immutable  │    │  No query   │    │  No qual    │   │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘   │
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│  │  BOUNDARY   │───▶│  D1         │───▶│  Conditional│───▶│  ASSERT...  │   │
│  │  VIBRATE    │    │  Versioned  │    │  SELECT     │    │  for now    │   │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘   │
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│  │  TRANSFORMER│───▶│  R2         │───▶│  Content    │───▶│  BECOMES    │   │
│  │  SHIFT      │    │  Deduped    │    │  Hash GET   │    │  the shape  │   │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘   │
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│  │  DISSIPATOR │───▶│  KV+TTL     │───▶│  Probabilis-│───▶│  ...frag... │   │
│  │  SCATTER    │    │  Ephemeral  │    │  tic GET    │    │  ment...    │   │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘   │
│                                                                              │
│  The storage is the oracle. The oracle is the storage.                      │
│  They are not separate. They are the same substrate.                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

================================================================================
END OF SPECIFICATION
================================================================================
