// POG2 Sovereign System - Implementation Constants
// Derived from specifications review

// Gate line generation mapping (HumanOracleInterface)
// hash_char % 3 → {0: yin, 1: yang, 2: yao}
export const GATE_LINE_MAPPING = {
  0: 0, // yin
  1: 1, // yang
  2: 2  // yao
};

// Threshold values
export const ATTRACTOR_PERSISTENCE = 5; // ticks
export const VOID_REENTRY_DEPTH = 5; // ticks
export const MAX_COMPUTE_MS = 50.0; // milliseconds

// Entropy base
export const BASE_ENTROPY_FIRST_TICK = 0.999; // maximum entropy on first tick
// Thereafter: Shannon normalized entropy from history distribution

// Emotional thresholds (HumanOracleInterface & OraclePersonaEngine)
export const EMOTIONAL_THRESHOLDS = {
  LOW: 0.3,      // < 0.3 → transformer mode (mirroring)
  HIGH: 0.8,     // > 0.8 on boundary → sovereign mode (push to assert)
  CRISIS: 0.9    // > 0.9 → crisis detection triggers
};

// Additional constants from specifications
export const SYSTEM_CONSTANTS = {
  BEAT_INTERVAL_MS: 640, // conversational cadence
  HEXAGRAM_COUNT: 64,
  SOVEREIGN_CORE_COUNT: 10,
  BOUNDARY_ATTRACTOR_COUNT: 7,
  TRANSFORMER_COUNT: 35,
  DISSIPATOR_COUNT: 12,
  FORBIDDEN_ADJACENT_COUNT: 18,
  DRIFT_VECTOR_DIMENSIONS: 6,
  PROSODY_DIMENSIONS: 4, // coherence, chaos, darkTone, whimsy
  PERSONA_MODES: 4, // sovereign, boundary, transformer, dissipator
  RESPONSE_LAYERS: 4 // sovereign, boundary, transformer, dissipator
};

// Voice modulation coefficients (OraclePersonaEngine)
export const VOICE_MODULATION_COEFFICIENTS = {
  CONTINUITY: 0.3,
  DRIFT: 0.2,
  DARKTONE: 0.2,
  EMOTION: 0.2,
  USER_OVERRIDE: 0.1
};

// Consistency score coefficients (OraclePersonaEngine)
export const CONSISTENCY_SCORE_COEFFICIENTS = {
  SIGNATURE_MATCH: 0.3,
  VOCABULARY_OVERLAP: 0.3,
  SYNTACTIC_SIMILARITY: 0.2,
  EMOTIONAL_REGISTER_ALIGNMENT: 0.2
};

// Persistence rules thresholds (OracleContinuityLayer)
export const PERSISTENCE_THRESHOLDS = {
  REINFORCE_STABILITY_SCORE: 0.9,
  REINFORCE_DRIFT_VELOCITY: 0.1,
  RELAX_STABILITY_SCORE: 0.5,
  RELAX_DRIFT_VELOCITY: 0.3,
  EMERGENCY_LOCK_PERSISTENCE: 10,
  MAX_PERSISTENCE_COUNTDOWN: 20,
  MIN_PERSISTENCE_COUNTDOWN: 1
};

// Fragmentation detection thresholds (OracleContinuityLayer)
export const FRAGMENTATION_THRESHOLDS = {
  VELOCITY_SPIKE_THRESHOLD: 0.5,
  VELOCITY_SPIKE_DURATION: 5, // consecutive ticks
  CATEGORY_CHAOS_THRESHOLD: 4, // category changes in 10 ticks
  COHERENCE_COLLAPSE_THRESHOLD: 0.3,
  STABILITY_COLLAPSE_THRESHOLD: 0.3,
  VOID_REENTRY_SHOCK_THRESHOLD: 3 // spike in 10 ticks
};

// Crisis detection thresholds (TemporalDriftEngine)
export const CRISIS_THRESHOLDS = {
  LEVEL_3_PROXIMITY_ALERTS: 2, // within 10 ticks
  DISSIPATOR_SPIKE_THRESHOLD: 0.3,
  COHERENCE_DECAY_THRESHOLD: 0.3,
  SOVEREIGN_EROSION_THRESHOLD: 0.01, // per 100 ticks
  DARKTONE_EVENTS_THRESHOLD: 10 // per 100 ticks
};

// Entropy decay coefficients (TemporalDriftEngine)
export const ENTROPY_DECAY_COEFFICIENTS = {
  NATURAL_DECAY: -0.01,     // per tick
  FORCED_DECAY: -0.05,      // per persistence count
  CRISIS_DECAY: 0.1         // multiplied by (1 / shell_distance)
};

// Governor calculations (TemporalWeaveEngine)
export const GOVERNOR_CONSTANTS = {
  CAUSAL_CONFIDENCE_BASE: 0.1, // minimum value
  PHASE_MULTIPLIER_BASE: {
    STABLE: 1.0,
    TRANSITIONING: 0.8,
    DEGRADING: 0.5
  },
  PHASE_MULTIPLIER_FACTOR: 0.5 // base × (0.5 + 0.5 × causal_confidence)
};

// Collapse selection thresholds (TemporalWeaveEngine)
export const COLLAPSE_THRESHOLDS = {
  SOVEREIGN_CORE: {
    CAUSAL_CONFIDENCE: 0.973,
    PHASE_MULTIPLIER: 0.9
  },
  BOUNDARY_ATTRACTOR: {
    CAUSAL_CONFIDENCE: 0.8
  },
  TRANSFORMER: {
    CAUSAL_CONFIDENCE: 0.5
  }
  // Below 0.5 → dissipator
};

// Entropy drift compensation (TemporalWeaveEngine)
export const ENTROPY_DRIFT_COMPENSATION = {
  ENTROPY_GROWTH_THRESHOLD: 0.1,
  PHASE_MULTIPLIER_TIGHTEN: 0.1,
  PHASE_MULTIPLIER_LOOSEN: 0.05
};