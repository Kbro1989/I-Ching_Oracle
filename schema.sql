-- POG2 Sovereign Boundary D1 Schema

CREATE TABLE IF NOT EXISTS thread_registry (
    thread_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    current_hex INTEGER NOT NULL,
    continuity_score REAL NOT NULL DEFAULT 1.0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS identity_threads (
    thread_id TEXT PRIMARY KEY,
    current_hex INTEGER NOT NULL,
    dominant_category TEXT NOT NULL DEFAULT 'transformer',
    stability_score REAL NOT NULL DEFAULT 0.7,
    coherence_index REAL NOT NULL DEFAULT 0.7,
    drift_velocity REAL NOT NULL DEFAULT 0.1,
    sovereign_ratio REAL DEFAULT 0.0,
    continuity_score REAL NOT NULL DEFAULT 0.7,
    birth_tick INTEGER,
    void_reentry_count INTEGER NOT NULL DEFAULT 0,
    crisis_count INTEGER NOT NULL DEFAULT 0,
    last_active_tick INTEGER,
    is_alive INTEGER NOT NULL DEFAULT 1,
    category_history TEXT DEFAULT '[]',
    version INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS persistence_state (
    thread_id TEXT PRIMARY KEY,
    tick INTEGER NOT NULL,
    persistence_countdown INTEGER NOT NULL,
    lock_hex INTEGER NOT NULL,
    lock_reason TEXT,
    version INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS boundary_states (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tick INTEGER,
    hexagram_id INTEGER,
    version INTEGER,
    phase_state TEXT,
    phase_multiplier REAL,
    drift_history TEXT,
    conditions TEXT,
    created_at INTEGER,
    updated_at INTEGER
);
