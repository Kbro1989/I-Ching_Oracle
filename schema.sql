-- POG2 Sovereign Boundary D1 Schema

CREATE TABLE IF NOT EXISTS thread_registry (
    thread_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    current_hex INTEGER NOT NULL,
    continuity_score REAL NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS identity_threads (
    thread_id TEXT PRIMARY KEY,
    current_hex INTEGER NOT NULL,
    stability_score REAL NOT NULL,
    coherence_index REAL NOT NULL,
    drift_velocity REAL NOT NULL,
    sovereign_ratio REAL,
    birth_tick INTEGER
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
