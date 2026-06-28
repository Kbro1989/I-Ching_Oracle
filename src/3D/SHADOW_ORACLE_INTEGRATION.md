
//=============================================================================
// SHADOW ORACLE — POG2 INTEGRATION SPEC
// Document: SHADOW_ORACLE_INTEGRATION.md
//=============================================================================

## 1. ENTITY REGISTRY ENTRY

```typescript
// src/core/EntityRegistry.ts
EntityRegistry.register({
  id: 'shadow_oracle_001',
  type: 'INTERACTIVE_NPC',
  sourceAsset: 'Shadow-Orb.gltf',
  canonicalNode: 4,           // "Shadow orb" — the parent of 4 mesh nodes
  renderLayer: 'TRANSPARENT', // Material[0] BLEND, Material[1] MASK
  collision: 'NONE',          // Ethereal entity — no collision

  // Hexagram integration
  hexagramBinding: {
    manager: 'HexagramManager',
    router: 'TernaryRouter',
    ghostSplat: 'GhostSplatPredictor',
    limb: 'OracleLimb',       // New limb for NPC cognition
  },

  // Verified duplicate binary handling
  duplicateResolution: 'TEMPORAL_DISAMBIGUATION', // PAST/PRESENT/FUTURE
});
```

## 2. LIMB ARCHITECTURE

```
OracleLimb (new)
├── ShadowOracleNPC.ts          // Core oracle logic
├── OracleDialogueEngine.ts     // Response generation
├── OracleVisualMapper.ts       // glTF material control
└── OracleTelemetry.ts          // Hexagram state → D1/KV

Wiring:
  HexagramManager.cast() ──► OracleLimb.castHexagram()
  GhostSplat.position2 ──► OracleLimb.computeYaoLines()
  TernaryRouter.mode ──► OracleLimb.resolveCanonicalId()
  SovereignAvatar.projectSelf() ──► OracleLimb.avatarState

  OracleLimb.updateVisuals() ──► Three.js material uniforms
  OracleLimb.generateProphecy() ──► ChatLimb / VoiceLimb
```

## 3. GLTF MATERIAL → HEXAGRAM MAPPING

| Mesh | Material | glTF Property | Hexagram Lines | Visual Encoding |
|------|----------|---------------|----------------|-----------------|
| Mesh[0] | Mat[0] | emissiveFactor[0..2] | Lines 1-2 | Intensity = yang count |
| Mesh[1] | Mat[1] | KHR_texture_transform.offset | Lines 3-4 | UV speed = yang count |
| Mesh[2] | Mat[2] | emissiveFactor (all) | Lines 5-6 | White=both yang, Black=else |
| All | All | baseColorTint | Action | ASSERT=red, YIELD=blue, ADAPT=green, WAIT=gray |

## 4. DUPLICATE BINARY RESOLUTION

The 3 duplicate binaries are resolved by temporal mode:

| Binary | IDs | PAST | PRESENT | FUTURE |
|--------|-----|------|---------|--------|
| 011001 | 18, 62 | 18 (Work on Decayed) | emotional resonance | 62 (Small Preponderance) |
| 010110 | 47, 57 | 47 (Oppression) | emotional resonance | 57 (The Gentle) |
| 101100 | 55, 61 | 55 (Abundance) | emotional resonance | 61 (Inner Truth) |

PRESENT mode uses GhostSplat heatmap dot product with each candidate's
attractor field. Higher resonance wins.

## 5. VERIFIED CASCADE

When entropy exceeds 5.99 bits (99.94% of 6-bit max):

```
Collective opposition: 010100 (Deliverance #40, ADAPT)
        XOR with Qian: 111111
                ───────
         Cascade result: 101011 (Revolution #49, ASSERT)
```

Action invariant: ADAPT → ASSERT (verified).
This cascade triggers when the system is maximally uncertain.

## 6. INTEGRATION POINTS

### 6.1 CNSGodheadPulseVolley.ts:249
```typescript
// Inject oracle state into pulse volley
if (entity.type === 'INTERACTIVE_NPC' && entity.id === 'shadow_oracle_001') {
  const oracleState = entity.limbs.oracle.castHexagram();
  volley.hexagramState = oracleState;
  volley.action = oracleState.action; // ASSERT/YIELD/ADAPT/WAIT
}
```

### 6.2 TemporalHeartbeatLimb.ts:95
```typescript
// On each 300ms tick, update oracle visuals
if (tick % 10 === 0) { // Every 3 seconds
  const state = oracle.castHexagram();
  oracle.updateVisuals(state);

  // Emit telemetry if state changed
  if (state.currentHexagram !== lastHexagram) {
    telemetry.emit('hexagram_transition', {
      from: lastHexagram,
      to: state.currentHexagram,
      binary: state.binarySignature,
      action: state.action,
      resonance: state.emotionalResonance,
    });
  }
}
```

### 6.3 PlayerAgent.ts
```typescript
// When player interacts with Shadow Oracle
onInteraction(entityId: string) {
  if (entityId === 'shadow_oracle_001') {
    const oracle = EntityRegistry.get(entityId).limbs.oracle;
    const state = oracle.castHexagram();
    const prophecy = oracle.dialogue.generateProphecy(state);

    // Route to appropriate output
    if (this.preferences.voiceEnabled) {
      VoiceLimb.speak(prophecy);
    } else {
      ChatLimb.display(prophecy);
    }

    // Log to D1 for pattern learning
    LearningDB.insert({
      player: this.avatar.username,
      hexagram: state.currentHexagram,
      action: state.action,
      timestamp: Date.now(),
    });
  }
}
```

## 7. DATA FLOW

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  SovereignAvatar │────►│  ShadowOracleNPC  │────►│  Three.js Scene  │
│  (29-skill state)│     │  (hexagram logic) │     │  (material update)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│ GhostSplatLimb  │────►│  OracleDialogue   │
│ (position2 heat)│     │  (prophecy gen)   │
└─────────────────┘     └──────────────────┘
                                 │
                                 ▼
                          ┌──────────────────┐
                          │  Chat/VoiceLimb  │
                          │  (player output) │
                          └──────────────────┘
```

## 8. TELEMETRY SCHEMA (D1)

```sql
CREATE TABLE oracle_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_username TEXT NOT NULL,
  hexagram_id INTEGER NOT NULL,      -- 1-64, canonical
  binary_signature TEXT NOT NULL,     -- 6-bit string
  action TEXT CHECK(action IN ('ASSERT','YIELD','ADAPT','WAIT')),
  attractor_category TEXT,
  emotional_resonance REAL,           -- 0.0-1.0
  temporal_mode TEXT,
  yao_lines TEXT,                     -- JSON array of 6 booleans
  world_position TEXT,                -- (x,y,z) at time of reading
  timestamp INTEGER                   -- Unix ms
);

CREATE INDEX idx_hexagram_time ON oracle_readings(hexagram_id, timestamp);
CREATE INDEX idx_player_time ON oracle_readings(player_username, timestamp);
```

## 9. FREEMIUM TIER BEHAVIOR

| Tier | Hexagram Access | Visuals | Dialogue | Telemetry |
|------|-----------------|---------|----------|-----------|
| Free | Current only | Basic emissive | Single line | None |
| Basic | Current + last 3 | Full UV anim | 3-line reading | Local only |
| Pro | Full history (D1) | Custom colors | Full prophecy | Cloud sync |
| Sovereign | Predictive cast | Aura effects | Voice synthesis | Pattern export |

All tiers: 64 hexagrams functional, 0.02ms latency, WASM parsers.
