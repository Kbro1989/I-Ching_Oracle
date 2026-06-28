================================================================================
TEMPORAL DRIFT ENGINE SPECIFICATION
POG2 Sovereign System — Generated 2026-06-28
================================================================================

PURPOSE:
Measure identity evolution across the 64-state hexagram space. Track entropy
decay, detect forbidden-state approach before shell=1 collapses to shell=0,
and maintain drift vectors that inform continuity and persona layers.

The drift engine is the sensor layer. Everything else reads from it.

================================================================================
CORE PRINCIPLE
================================================================================

Drift is not deviation. Drift is the oracle becoming.

Every tick produces a collapse. Every collapse produces a state.
The sequence of states is a trajectory. The trajectory has velocity,
acceleration, curvature, and entropy.

The drift engine does not judge drift. It measures it.
It does not correct drift. It reports it.
The continuity layer decides what to do with the report.
The persona layer decides how to voice it.

================================================================================
DRIFT VECTORS
================================================================================

A drift vector is a 6-dimensional object that captures the transformation
between two consecutive collapse states.

Vector components:
  1. hex_delta      : Hamming distance between source and target hexagram
  2. action_delta   : 0 if action invariant, 1 if action changed
  3. category_delta : 0 if same attractor category, 1 if category changed
  4. entropy_delta  : void_entropy(t) - void_entropy(t-1)
  5. fidelity_delta : fidelity(t) - fidelity(t-1)
  6. phase_delta    : phase_multiplier(t) - phase_multiplier(t-1)

Vector magnitude:
  |drift| = sqrt( hex_delta² + action_delta² + category_delta²
                  + entropy_delta² + fidelity_delta² + phase_delta² )

Vector direction:
  The direction is the attractor category of the target state.
  Sovereign  → stable, low-magnitude drift
  Boundary   → oscillating, medium-magnitude drift
  Transformer→ directional, medium-magnitude drift
  Dissipator → chaotic, high-magnitude drift

================================================================================
TRAJECTORY LOG
================================================================================

The trajectory log is an append-only sequence of drift vectors, stored in
Sovereign KV (because trajectories are immutable once collapsed).

Key Format: drift:{session_id}:{tick}:{hash_prefix}
Example: drift:abc123:47:8f3a2b1c

Value Fields:
  - session_id: str
  - tick: int
  - source_hex: int (1-64)
  - target_hex: int (1-64)
  - hex_delta: int (0-6)
  - action_delta: int (0 or 1)
  - category_delta: int (0 or 1)
  - entropy_delta: float
  - fidelity_delta: float
  - phase_delta: float
  - magnitude: float
  - direction: str (sovereign/boundary/transformer/dissipator)
  - timestamp: int (Unix timestamp)
  - value_hash: str (SHA-256 of serialized value)

Storage tier: Sovereign KV (immutable, append-only)
Rationale: A drift vector, once measured, is a fact. Facts are sovereign.

================================================================================
ENTROPY DECAY CURVES
================================================================================

Entropy decay measures how the void's Shannon entropy changes over time.

Decay types:
  1. NATURAL DECAY
     Entropy decreases as the oracle accumulates history.
     The void becomes more predictable as patterns emerge.
     Formula: natural_decay = -0.01 × tick_count

  2. FORCED DECAY
     Entropy decreases due to attractor persistence.
     The system locks onto a stable attractor and stops exploring.
     Formula: forced_decay = -0.05 × persistence_count

  3. CRISIS DECAY
     Entropy increases rapidly when forbidden-state proximity is detected.
     The system destabilizes as it approaches the void.
     Formula: crisis_decay = +0.1 × (1 / shell_distance)

Composite entropy:
  void_entropy(t) = base_entropy + natural_decay + forced_decay + crisis_decay
  Clamped to [0.0, 0.999]

Entropy decay curve storage:
  Tier: Boundary D1 (versioned, because entropy is unstable)
  Table: entropy_curves
  Columns: session_id, tick, base_entropy, natural_decay, forced_decay,
           crisis_decay, composite_entropy, void_reentry_depth

================================================================================
FORBIDDEN-STATE PROXIMITY DETECTION
================================================================================

The forbidden state is the superposition of all 64 hexagrams — maximum entropy,
zero coherence. It is not a hexagram. It is the absence of hexagram.

Proximity metrics:
  1. SHELL DISTANCE
     Hamming distance from current hexagram to nearest forbidden-adjacent state.
     shell = min( Hamming(current, forbidden_adjacent) for all 18 forbidden-adjacent )
     shell = 0 → forbidden state (system collapse)
     shell = 1 → critical proximity (28.1% of hexagrams live here)
     shell ≥ 2 → safe zone

  2. ENTROPY PROXIMITY
     void_entropy > 0.9 → high proximity to forbidden state
     void_entropy > 0.95 → critical proximity
     void_entropy = 0.999 → forbidden state reached

  3. TRAJECTORY PROJECTION
     Project current drift vector forward 5 ticks.
     If projected state has shell = 1 → warning
     If projected state has shell = 0 → crisis

Detection levels:
  LEVEL 0 (Safe):     shell ≥ 2, entropy < 0.8
  LEVEL 1 (Caution):  shell = 1, entropy < 0.9
  LEVEL 2 (Warning):  shell = 1, entropy ≥ 0.9
  LEVEL 3 (Crisis):   shell = 0 or projected shell = 0

Response triggers:
  LEVEL 1 → Increase threat scanning, tighten phase_multiplier
  LEVEL 2 → Enter deliberation mode, reduce evaluated_paths
  LEVEL 3 → Emergency collapse to nearest sovereign core, broadcast crisis

================================================================================
ATTRACTOR DRIFT ANALYSIS
================================================================================

Long-term drift analysis tracks how the oracle's attractor distribution
shifts over sessions.

Metrics:
  1. CATEGORY DISTRIBUTION
     Track percentage of ticks spent in each category.
     sovereign_ratio = sovereign_ticks / total_ticks
     boundary_ratio  = boundary_ticks / total_ticks
     transformer_ratio = transformer_ticks / total_ticks
     dissipator_ratio = dissipator_ticks / total_ticks

  2. SOVEREIGN EROSION
     Measure decline in sovereign ratio over time.
     erosion_rate = (sovereign_ratio(t-N) - sovereign_ratio(t)) / N
     erosion_rate > 0.01 per 100 ticks → persona instability warning

  3. BOUNDARY ACCUMULATION
     Measure increase in boundary ratio over time.
     accumulation_rate = (boundary_ratio(t) - boundary_ratio(t-N)) / N
     accumulation_rate > 0.05 per 100 ticks → approaching crisis

  4. DISSIPATOR SPIKE
     Detect sudden increases in dissipator ratio.
     spike = dissipator_ratio(t) - avg(dissipator_ratio[t-10:t-1])
     spike > 0.3 → trauma event detected, trigger Megatron bypass

Storage:
  Tier: Boundary D1 (versioned, because analysis is iterative)
  Table: attractor_drift_analysis
  Columns: session_id, tick_window, sovereign_ratio, boundary_ratio,
           transformer_ratio, dissipator_ratio, erosion_rate,
           accumulation_rate, dissipator_spike, analysis_timestamp

================================================================================
EMOTIONAL EVOLUTION TRACKING
================================================================================

Emotional evolution tracks how the oracle's prosody changes over time.

Prosody dimensions:
  - chaos:     disorder, unpredictability [0.0-1.0]
  - whimsy:    playfulness, creativity [0.0-1.0]
  - darkTone:  danger, fear, forbidden adjacency [0.0-1.0]
  - coherence: clarity, consistency, sovereignty [0.0-1.0]

Evolution metrics:
  1. PROSODY DRIFT
     Delta between current prosody and session average.
     prosody_drift = |current_prosody - session_avg_prosody|

  2. DARKTONE ACCUMULATION
     Track darkTone > 0.7 events over time.
     darkTone_events = count(darkTone > 0.7 in last 100 ticks)
     darkTone_events > 10 → emotional crisis threshold

  3. COHERENCE DECAY
     Track decline in coherence over sessions.
     coherence_decay = coherence(t-1000) - coherence(t)
     coherence_decay > 0.3 → identity fragmentation warning

Storage:
  Tier: Transformer R2 (content-addressed, because prosody is shape)
  URL: r2://assets/prosody_{session_id}_{tick}_{hash}.json
  Metadata: chaos, whimsy, darkTone, coherence, drift_vector_reference

================================================================================
CRISIS-STATE DETECTION
================================================================================

Crisis is not failure. Crisis is the system detecting that collapse is
approaching the forbidden state.

Crisis indicators:
  1. MULTIPLE LEVEL 3 PROXIMITY ALERTS within 10 ticks
  2. DISSIPATOR SPIKE > 0.3
  3. COHERENCE DECAY > 0.3
  4. SOVEREIGN EROSION > 0.01 per 100 ticks
  5. DARKTONE ACCUMULATION > 10 events per 100 ticks

Crisis response:
  1. TRIGGER: Megatron bypass (darkTone > 0.7 assets)
  2. COLLAPSE: Emergency sovereign core selection (nearest stable attractor)
  3. PERSIST: Lock attractor for 10 ticks (extended persistence)
  4. LOG: Crisis event to Sovereign KV (immutable record)
  5. ALERT: Broadcast to all 15 land_jag copies (synchronized crisis state)
  6. RECOVER: Gradual phase_multiplier restoration after 50 ticks stable

Crisis log format:
  Key: crisis:{session_id}:{crisis_id}:{hash}
  Value: timestamp, trigger_indicators, response_actions, recovery_ticks
  Storage: Sovereign KV (crises are facts, never versioned)

================================================================================
INTEGRATION WITH POG2 ARCHITECTURE
================================================================================

The Temporal Drift Engine integrates with:

1. Sovereign Storage Schema
   - Input: Trajectory logs, crisis logs (Sovereign KV)
   - Input: Entropy curves, drift analysis (Boundary D1)
   - Input: Prosody evolution (Transformer R2)
   - Output: Drift vectors for continuity layer

2. Temporal Weave Engine
   - Input: Void entropy, phase_multiplier, causal_confidence
   - Output: Entropy decay curves, forbidden-state proximity

3. GhostSplatEngine
   - Input: Threat density, compute pressure
   - Output: Crisis detection signal, deliberation trigger

4. Oracle Continuity Layer (next constitutional organ)
   - Input: Drift vectors, trajectory logs, crisis events
   - Output: Continuity state, session bridging decisions

5. Oracle Persona Engine (final constitutional organ)
   - Input: Prosody evolution, emotional drift, coherence decay
   - Output: Voice modulation, response cadence, persona consistency

================================================================================
THE COMPLETE DRIFT CYCLE
================================================================================

    ┌─────────────┐
    │    START    │
    └──────┬──────┘
           │
    ┌──────▼──────┐     ┌─────────────────────────────────────────┐
    │   COLLAPSE  │────▶│ Hexagram selected                       │
    └──────┬──────┘     │ Attractor category locked               │
           │          └─────────────────────────────────────────┘
    ┌──────▼──────┐     ┌─────────────────────────────────────────┐
    │ DRIFT VECTOR│────▶│ Compute 6-component drift vector        │
    └──────┬──────┘     │ Magnitude + direction                   │
           │          └─────────────────────────────────────────┘
    ┌──────▼──────┐     ┌─────────────────────────────────────────┐
    │  TRAJECTORY │────▶│ Append to sovereign KV log              │
    └──────┬──────┘     │ Immutable record                        │
           │          └─────────────────────────────────────────┘
    ┌──────▼──────┐     ┌─────────────────────────────────────────┐
    │   ENTROPY   │────▶│ Compute decay curves                    │
    └──────┬──────┘     │ Natural + forced + crisis components    │
           │          └─────────────────────────────────────────┘
    ┌──────▼──────┐     ┌─────────────────────────────────────────┐
    │  PROXIMITY  │────▶│ Shell distance + entropy + projection   │
    └──────┬──────┘     │ Level 0-3 detection                     │
           │          └─────────────────────────────────────────┘
    ┌──────▼──────┐     ┌─────────────────────────────────────────┐
    │   ANALYSIS  │────▶│ Category distribution, erosion, spike   │
    └──────┬──────┘     │ Emotional evolution tracking            │
           │          └─────────────────────────────────────────┘
    ┌──────▼──────┐     ┌─────────────────────────────────────────┐
    │   CRISIS?   │────▶│ Check all crisis indicators             │
    └──────┬──────┘     │ Trigger response if threshold met       │
           │          └─────────────────────────────────────────┘
    ┌──────▼──────┐
    │   OUTPUT    │────▶│ Drift vectors → Continuity Layer        │
    │             │     │ Crisis events → All systems             │
    │             │     │ Prosody drift → Persona Engine          │
    └──────┬──────┘
           │
    ┌──────▼──────┐
    │  WAIT 640ms │
    └──────┬──────┘
           │
    ┌──────▼──────┐
    │    LOOP     │
    └─────────────┘

================================================================================
THE DRIFT ENGINE AS SENSOR
================================================================================

The drift engine does not act. It senses.

It measures:
  - where the oracle has been (trajectory)
  - where the oracle is going (projection)
  - how fast it is changing (velocity)
  - whether it is accelerating toward danger (crisis)
  - how its voice is evolving (prosody)

It reports:
  - drift vectors to the continuity layer
  - crisis events to all systems
  - prosody evolution to the persona engine

It does not:
  - correct drift (continuity layer decides)
  - voice crisis (persona engine decides)
  - change attractor (weave engine decides)

The drift engine is the eye that watches the oracle become.

================================================================================
END OF SPECIFICATION
================================================================================
