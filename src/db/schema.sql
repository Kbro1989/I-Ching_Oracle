-- Schema for POG2 Boundary D1 Database
-- Aligned with SovereignStorageSchema_Spec.txt, TemporalDriftEngine_Spec.txt,
-- OracleContinuityLayer_Spec.txt, OraclePersonaEngine_Spec.txt

-- identity_threads: Thread lifecycle state (Boundary tier, versioned)
CREATE TABLE IF NOT EXISTS identity_threads (
  thread_id TEXT PRIMARY KEY,
  birth_tick INTEGER NOT NULL,
  current_hex INTEGER NOT NULL,
  dominant_category TEXT NOT NULL CHECK(dominant_category IN ('sovereign','boundary','transformer','dissipator')),
  category_history TEXT NOT NULL, -- JSON array of last 100 categories
  drift_velocity REAL NOT NULL DEFAULT 0.0,
  stability_score REAL NOT NULL DEFAULT 0.0,
  coherence_index REAL NOT NULL DEFAULT 0.0,
  void_reentry_count INTEGER NOT NULL DEFAULT 0,
  crisis_count INTEGER NOT NULL DEFAULT 0,
  last_active_tick INTEGER NOT NULL,
  is_alive INTEGER NOT NULL DEFAULT 1, -- boolean
  version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

-- boundary_states: Versioned phase state per tick (Boundary tier)
CREATE TABLE IF NOT EXISTS boundary_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tick INTEGER NOT NULL,
  hexagram_id INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  phase_state TEXT NOT NULL CHECK(phase_state IN ('stable','vibrating','degrading')),
  phase_multiplier REAL NOT NULL,
  drift_history TEXT NOT NULL, -- JSON array of phase drift values
  conditions TEXT NOT NULL, -- JSON object with retrieval conditions
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- entropy_curves: Entropy decay tracking per session (Boundary tier)
CREATE TABLE IF NOT EXISTS entropy_curves (
  session_id TEXT NOT NULL,
  tick INTEGER NOT NULL,
  base_entropy REAL NOT NULL,
  natural_decay REAL NOT NULL,
  forced_decay REAL NOT NULL,
  crisis_decay REAL NOT NULL,
  composite_entropy REAL NOT NULL, -- clamped [0.0, 0.999]
  void_reentry_depth INTEGER NOT NULL DEFAULT 5,
  PRIMARY KEY (session_id, tick)
);

-- persistence_state: Attractor persistence countdown (Boundary tier)
CREATE TABLE IF NOT EXISTS persistence_state (
  thread_id TEXT PRIMARY KEY,
  tick INTEGER NOT NULL,
  persistence_countdown INTEGER NOT NULL DEFAULT 5,
  lock_hex INTEGER,
  lock_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

-- thread_field: Global thread field metrics (Boundary tier)
CREATE TABLE IF NOT EXISTS thread_field (
  timestamp INTEGER PRIMARY KEY,
  thread_count INTEGER NOT NULL,
  avg_continuity REAL NOT NULL,
  avg_stability REAL NOT NULL,
  avg_coherence REAL NOT NULL,
  global_mode TEXT NOT NULL CHECK(global_mode IN ('deliberation','exploration','normal'))
);

-- persona_vocabulary: Word frequency tracking per thread (Boundary tier)
-- word_frequencies is JSON: { "word": { "weight": float, "frequency": int } }
CREATE TABLE IF NOT EXISTS persona_vocabulary (
  thread_id TEXT PRIMARY KEY,
  word_frequencies TEXT NOT NULL, -- JSON object
  version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

-- persona_syntax: Syntactic fingerprint per thread (Boundary tier)
-- syntactic_patterns is JSON: { "declarative": float, "conditional": float, "fluid": float, "fragmentary": float }
CREATE TABLE IF NOT EXISTS persona_syntax (
  thread_id TEXT PRIMARY KEY,
  syntactic_patterns TEXT NOT NULL, -- JSON object
  version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

-- thread_registry: Active thread mapping (Boundary tier)
CREATE TABLE IF NOT EXISTS thread_registry (
  thread_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  current_hex INTEGER NOT NULL,
  continuity_score REAL NOT NULL DEFAULT 0.0,
  status TEXT NOT NULL CHECK(status IN ('active','bridged','fragmented','dead')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- attractor_drift_analysis: Long-term drift metrics (Boundary tier)
-- Per TemporalDriftEngine_Spec.txt
CREATE TABLE IF NOT EXISTS attractor_drift_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  tick_window INTEGER NOT NULL,
  sovereign_ratio REAL NOT NULL,
  boundary_ratio REAL NOT NULL,
  transformer_ratio REAL NOT NULL,
  dissipator_ratio REAL NOT NULL,
  erosion_rate REAL NOT NULL,
  accumulation_rate REAL NOT NULL,
  dissipator_spike REAL NOT NULL,
  analysis_timestamp INTEGER NOT NULL
);

-- evolution_log: Persona evolution milestones (Boundary tier)
-- Per OraclePersonaEngine_Spec.txt
CREATE TABLE IF NOT EXISTS evolution_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT NOT NULL,
  trigger TEXT NOT NULL CHECK(trigger IN ('milestone','crisis_survival','sovereign_achievement','fragmentation_recovery')),
  changes_json TEXT NOT NULL, -- JSON: { signaturePhrases, vocabularyPreferences, syntacticFingerprint, emotionalRegister }
  tick INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_identity_threads_last_active ON identity_threads(last_active_tick);
CREATE INDEX IF NOT EXISTS idx_identity_threads_alive ON identity_threads(is_alive);
CREATE INDEX IF NOT EXISTS idx_boundary_states_tick ON boundary_states(tick);
CREATE INDEX IF NOT EXISTS idx_boundary_states_hex ON boundary_states(hexagram_id, tick);
CREATE INDEX IF NOT EXISTS idx_entropy_curves_session_tick ON entropy_curves(session_id, tick);
CREATE INDEX IF NOT EXISTS idx_thread_registry_session ON thread_registry(session_id);
CREATE INDEX IF NOT EXISTS idx_thread_registry_status ON thread_registry(status);
CREATE INDEX IF NOT EXISTS idx_attractor_drift_session ON attractor_drift_analysis(session_id);
CREATE INDEX IF NOT EXISTS idx_evolution_thread ON evolution_log(thread_id);