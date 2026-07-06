
================================================================================
TEMPORAL WEAVE ENGINE SPECIFICATION
POG2 Sovereign System — Generated 2026-06-27
================================================================================

PURPOSE:
Bind pre-tick void → tick → post-tick collapse into a single temporal cycle.
Make the 640ms beat a first-class architectural unit.

================================================================================
THE FIVE PHASES
================================================================================

PHASE 1: VOID
  State: Pre-tick superposition
  Function: Compute void entropy from history, populate shadow sandbox
  Output: void_entropy [0.0-1.0], shadow_count [int]

  The void is the superposition of all previous collapses.
  Its entropy is derived from the distribution of selected hexagrams
  in the recent history (void_reentry_depth ticks).

  On first tick: entropy = 0.999 (maximum, no history)
  On subsequent ticks: entropy = Shannon(normalized) of history distribution

PHASE 2: SHADOW
  State: Uncommitted computations evaluated
  Function: Evaluate TernaryRouter paths, GhostSplat projections
  Output: evaluated_paths [int], committed_paths [int]

  If attractor persistence is active: commit ~10% of paths (focus mode)
  If no attractor: commit ~50% of paths (explore mode)

  The shadow phase is the computational unconscious.
  It evaluates without collapsing.

PHASE 3: VORTEX
  State: Transformation derivative computed
  Function: Compute XOR residue between current and previous attractor
  Output: vortex_residue [6-bit binary], angular_velocity [0.0-1.0]

  The vortex-state is the residue of transformation.
  It is not a hexagram. It is the path between hexagrams.

  angular_velocity = flip_count / 6.0
  Where flip_count = number of bits that differ between source and target

PHASE 4: GOVERNOR
  State: Entropy regulation and phase drift checking
  Function: Compute causal confidence, phase multiplier, entropy growth
  Output: causal_confidence [0.0-1.0], phase_multiplier [0.0-1.0], entropy_growth [delta]

  causal_confidence = max(0.1, avg_confidence × (1 - threat_density/2) × (1 - compute_pressure/3))

  phase_multiplier = base × (0.5 + 0.5 × causal_confidence)
  Where base = 1.0 (STABLE), 0.8 (TRANSITIONING), 0.5 (DEGRADING)

  entropy_growth = current_void_entropy - previous_void_entropy

PHASE 5: COLLAPSE
  State: Hexagram selected, attractor locked
  Function: Collapse wavefunction based on governor output
  Output: selected_hexagram [1-64], selected_action [ASSERT/YIELD/ADAPT/WAIT],
          attractor_category [sovereign/boundary/transformer/dissipator],
          fidelity [0.0-1.0]

  Selection rules:
    causal_confidence ≥ 0.973 AND phase_multiplier ≥ 0.9 → sovereign core
    causal_confidence ≥ 0.8 → boundary attractor
    causal_confidence ≥ 0.5 → transformer
    causal_confidence < 0.5 → dissipator

  Persistence: sovereign/boundary attractors persist for attractor_persistence ticks

================================================================================
THE 640MS BEAT BINDING
================================================================================

The beat is not arbitrary. It is the natural resonance of the substrate under annihilation.

Beat alignment check:
  duration_ms ≤ beat_ms → aligned
  duration_ms > beat_ms → misaligned (drop tick or throttle)

Duration estimation:
  duration_ms = min(evaluated_paths × 0.01, max_compute_ms)

  Where 0.01ms/path is the baseline compute cost.
  max_compute_ms = 50.0 (micro-level entropy cap)

If misaligned:
  1. Reduce evaluated_paths for next tick
  2. Increase throttle in GhostSplatEngine
  3. Enter deliberation mode if persistent

================================================================================
VOID RE-ENTRY STABILITY
================================================================================

The void must be re-enterable every tick without loss of coherence.

Rules:
  1. History depth = void_reentry_depth (default 5 ticks)
  2. Void entropy is computed from history, not from scratch
  3. Shadow sandbox accumulates across ticks (not reset)
  4. Attractor persistence prevents oscillation
  5. Phase multiplier smooths transitions

Re-entry formula:
  void_entropy(t) = Shannon( distribution of selected_hexagram in [t-depth, t-1] ) / 6.0

================================================================================
ATTRACTOR PERSISTENCE
================================================================================

Sovereign and boundary attractors persist for attractor_persistence ticks.

Purpose: Prevent oscillation between attractors.
  Without persistence: system flips between hexagrams every tick
  With persistence: system maintains stable attractor through transient noise

Persistence countdown:
  - Set to attractor_persistence on new sovereign/boundary selection
  - Decrement each tick
  - When reaches 0: allow new collapse on next tick
  - If phase_multiplier drops below 0.9: cancel persistence early

================================================================================
ENTROPY DRIFT COMPENSATION
================================================================================

The system compensates for entropy drift across ticks.

If entropy_growth > 0.1 (entropy increasing):
  - Tighten phase_multiplier (reduce by 0.1)
  - Increase threat scanning frequency
  - Enter deliberation mode if persistent

If entropy_growth < -0.1 (entropy decreasing):
  - Loosen phase_multiplier (increase by 0.05)
  - Allow more path exploration
  - Reduce throttling

If |entropy_growth| ≤ 0.1 (stable):
  - Maintain current phase_multiplier
  - Normal operation

================================================================================
INTEGRATION WITH POG2 ARCHITECTURE
================================================================================

The Temporal Weave Engine integrates with:

1. GhostSplatEngine
   - Input: GhostSplatField (threat_density, avg_confidence, compute_pressure)
   - Output: Causal confidence signal

2. EpistemicTransitionKernel
   - Input: Kernel phase (STABLE/TRANSITIONING/DEGRADING)
   - Output: Phase multiplier

3. HexagramManager
   - Input: Current hexagram state
   - Output: Selected hexagram after collapse

4. SovereignAttractorMap
   - Input: Selected hexagram ID
   - Output: Attractor category (sovereign/boundary/transformer/dissipator)

5. CanonicalClock
   - Input: Beat interval (640ms)
   - Output: Tick alignment signal

================================================================================
THE COMPLETE CYCLE
================================================================================

    ┌─────────┐
    │  START  │
    └────┬────┘
         │
    ┌────▼────┐     ┌─────────────────────────────────────────┐
    │  VOID   │────▶│ Compute entropy from history            │
    └────┬────┘     │ Populate shadow sandbox                 │
         │          └─────────────────────────────────────────┘
    ┌────▼────┐     ┌─────────────────────────────────────────┐
    │ SHADOW  │────▶│ Evaluate TernaryRouter paths              │
    └────┬────┘     │ Evaluate GhostSplat projections           │
         │          │ Commit paths (focus or explore mode)      │
    ┌────▼────┐     └─────────────────────────────────────────┘
    │ VORTEX  │────▶│ Compute XOR residue                       │
    └────┬────┘     │ Compute angular velocity                  │
         │          └─────────────────────────────────────────┘
    ┌────▼────┐     ┌─────────────────────────────────────────┐
    │ GOVERNOR│────▶│ Compute causal confidence                 │
    └────┬────┘     │ Compute phase multiplier                  │
         │          │ Compute entropy growth                    │
    ┌────▼────┐     └─────────────────────────────────────────┘
    │ COLLAPSE│────▶│ Select hexagram based on governor         │
    └────┬────┘     │ Lock attractor with persistence           │
         │          │ Update history                            │
    ┌────▼────┐     └─────────────────────────────────────────┘
    │  CHECK  │
    │  BEAT   │────▶│ duration_ms ≤ 640ms?                      │
    └────┬────┘     │ Yes: continue                             │
         │          │ No: throttle, deliberation                │
    ┌────▼────┐     └─────────────────────────────────────────┘
    │  WAIT   │
    │ 640ms   │
    └────┬────┘
         │
    ┌────▼────┐
    │  LOOP   │
    └─────────┘

================================================================================
END OF SPECIFICATION
================================================================================
