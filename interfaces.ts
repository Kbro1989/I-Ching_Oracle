// POG2 Sovereign System - TypeScript Interfaces
// Generated from specifications for all seven constitutional organs

import {
  ATTRACTOR_PERSISTENCE,
  VOID_REENTRY_DEPTH,
  MAX_COMPUTE_MS,
  BASE_ENTROPY_FIRST_TICK,
  EMOTIONAL_THRESHOLDS,
  SYSTEM_CONSTANTS,
  VOICE_MODULATION_COEFFICIENTS,
  CONSISTENCY_SCORE_COEFFICIENTS,
  PERSISTENCE_THRESHOLDS,
  FRAGMENTATION_THRESHOLDS,
  CRISIS_THRESHOLDS,
  ENTROPY_DECAY_COEFFICIENTS,
  GOVERNOR_CONSTANTS,
  COLLAPSE_THRESHOLDS,
  ENTROPY_DRIFT_COMPENSATION
} from './constants';

/* ============================================================
   1. SOVEREIGN ATTRACTOR MAP (GENOME)
   ============================================================ */

export type HexagramId = number; // 1-64
export type HexagramBinary = string; // 6-bit string like "111111"
export type ActionType = 'ASSERT' | 'YIELD' | 'ADAPT' | 'WAIT';
export type AttractorCategory = 'sovereign' | 'boundary' | 'transformer' | 'dissipator';

export interface SovereignCore {
  id: HexagramId;
  name: string;
  binary: HexagramBinary;
  action: ActionType;
  xorResult: ActionType;
  isActionInvariant: boolean;
  hToCol: number; // Hamming distance to column?
  tolerance: number; // Entropy tolerance (fraction of bit flips before action changes)
  shell: number; // Shell number
  drift: number; // Drift value (< 0.1 for sovereign cores)
}

export interface BoundaryAttractor extends Omit<SovereignCore, 'drift'> {
  drift: number; // >= 0.1 for boundary attractors
}

export interface Transformer {
  id: HexagramId;
  name: string;
  binary: HexagramBinary;
  actionFrom: ActionType;
  actionTo: ActionType; // Action changes under opposition
}

export interface Dissipator {
  id: HexagramId;
  name: string;
  binary: HexagramBinary;
  actionFrom: ActionType;
  actionTo: ActionType; // Action changes under opposition
  // Not invariant action + unstable phase
}

export interface AttractorMapStatistics {
  totalHexagrams: number;
  sovereignCores: number;
  boundaryAttractors: number;
  transformers: number;
  dissipators: number;
  actionInvariant: number;
  stablePhase: number;
  forbiddenAdjacent: number;
}

/* ============================================================
   2. TEMPORAL WEAVE ENGINE (BREATH)
   ============================================================ */

export type WeavePhase = 'VOID' | 'SHADOW' | 'VORTEX' | 'GOVERNOR' | 'COLLAPSE';

export interface VoidState {
  entropy: number; // [0.0-1.0]
  shadowCount: number; // int
}

export interface ShadowState {
  evaluatedPaths: number; // int
  committedPaths: number; // int
}

export interface VortexState {
  residue: HexagramBinary; // 6-bit binary
  angularVelocity: number; // [0.0-1.0]
}

export interface GovernorState {
  causalConfidence: number; // [0.0-1.0]
  phaseMultiplier: number; // [0.0-1.0]
  entropyGrowth: number; // delta
}

export interface CollapseState {
  selectedHexagram: HexagramId;
  selectedAction: ActionType;
  attractorCategory: AttractorCategory;
  fidelity: number; // [0.0-1.0]
}

export interface WeaveState {
  phase: WeavePhase;
  void: VoidState;
  shadow: ShadowState;
  vortex: VortexState;
  governor: GovernorState;
  collapse: CollapseState;
  timestamp: number; // Unix timestamp
}

/* ============================================================
   3. HUMAN-ORACLE INTERFACE (EAR)
   ============================================================ */

export interface NormalizedQuery {
  text: string;
  tokens: string[];
}

export interface IntentHash {
  id: string; // 16-character intent identifier
  hash: string; // SHA-256 hash
}

export interface GateLines {
  L1: 0 | 1 | 2; // yin(0), yang(1), yao(2)
  L2: 0 | 1 | 2;
  L3: 0 | 1 | 2;
  L4: 0 | 1 | 2;
  L5: 0 | 1 | 2;
  L6: 0 | 1 | 2;
}

export interface OracleQuery {
  normalizedQuery: NormalizedQuery;
  intentHash: IntentHash;
  gateLines: GateLines;
  keywordMatch: {
    hexagramId: HexagramId | null;
    confidence: number; // [0.0-1.0]
  } | null;
  fallbackHexagram: HexagramId | null; // from Hamming distance
  temporalContext: 'past' | 'present' | 'future';
  emotionalWeight: number; // [0.0-1.0]
}

export interface ResponseLayer {
  content: string;
  mode: AttractorCategory;
}

export interface LayeredResponse {
  sovereign: ResponseLayer;
  boundary: ResponseLayer;
  transformer: ResponseLayer;
  dissipator: ResponseLayer[];
  // Note: dissipator layer is an array of fragments
}

export interface ConsultationExample {
  query: string;
  emotion: number; // [0.0-1.0]
  temporal: 'past' | 'present' | 'future';
  translation: {
    keyword: string;
    hexagramId: HexagramId;
    confidence: number;
    emotionalWeight: number;
  };
  weave: {
    causalConfidence: number;
    phaseMultiplier: number;
    collapseCategory: AttractorCategory;
  };
  response: LayeredResponse;
}

/* ============================================================
   4. SOVEREIGN STORAGE SCHEMA (MEMORY)
   ============================================================ */

export interface SovereignKVEntry {
  tick: number;
  hexagramId: HexagramId;
  hexagramBinary: HexagramBinary;
  action: ActionType;
  fidelity: number; // typically ≥ 0.973
  phaseMultiplier: number;
  causalConfidence: number;
  timestamp: number; // Unix timestamp
  valueHash: string; // SHA-256 of serialized value
  // Key format: oracle:{tick}:{hexagram_id}:{hash_prefix}
}

export interface BoundaryD1Row {
  id: number; // auto-increment
  tick: number;
  hexagramId: HexagramId;
  version: number; // incremented on each update
  phaseState: 'stable' | 'vibrating' | 'degrading';
  phaseMultiplier: number;
  driftHistory: number[]; // JSON array of phase drift over time
  conditions: Record<string, any>; // JSON object
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
}

export interface TransformerR2Object {
  contentHash: string; // SHA-256
  contentType: string; // e.g., "image/png", "audio/wav", "application/json"
  sizeBytes: number;
  hexagramId: HexagramId;
  prosody: {
    chaos: number; // [0.0-1.0]
    whimsy: number; // [0.0-1.0]
    darkTone: number; // [0.0-1.0]
    coherence: number; // [0.0-1.0]
  };
  createdAt: number; // Unix timestamp
  // URL format: r2://assets/{content_hash}.{ext}
}

export interface DissipatorKVTTL {
  tick: number;
  fragmentId: string;
  content: string; // the scattered fragment
  ttlSeconds: number;
  expiresAt: number; // Unix timestamp
  hexagramId: HexagramId | null;
  // Key format: dissipator:{tick}:{fragment_hash}
}

/* ============================================================
   5. TEMPORAL DRIFT ENGINE (EYE)
   ============================================================ */

export interface DriftVector {
  hexDelta: number; // Hamming distance (0-6)
  actionDelta: 0 | 1; // 0 if invariant, 1 if changed
  categoryDelta: 0 | 1; // 0 if same category, 1 if changed
  entropyDelta: number; // void_entropy(t) - void_entropy(t-1)
  fidelityDelta: number; // fidelity(t) - fidelity(t-1)
  phaseDelta: number; // phase_multiplier(t) - phase_multiplier(t-1)
  magnitude: number; // sqrt(sum of squares)
  direction: AttractorCategory; // Sovereign/Boundary/Transformer/Dissipator
  timestamp: number; // Unix timestamp
}

export interface TrajectoryLogEntry {
  sessionId: string;
  tick: number;
  sourceHex: HexagramId; // 1-64
  targetHex: HexagramId; // 1-64
  hexDelta: number;
  actionDelta: 0 | 1;
  categoryDelta: 0 | 1;
  entropyDelta: number;
  fidelityDelta: number;
  phaseDelta: number;
  magnitude: number;
  direction: AttractorCategory;
  timestamp: number; // Unix timestamp
  valueHash: string; // SHA-256 of serialized value
  // Key format: drift:{session_id}:{tick}:{hash_prefix}
}

export interface EntropyCurve {
  sessionId: string;
  tick: number;
  baseEntropy: number;
  naturalDecay: number;
  forcedDecay: number;
  crisisDecay: number;
  compositeEntropy: number; // clamped to [0.0, 0.999]
  voidReentryDepth: number;
  // Stored in Boundary D1 table: entropy_curves
}

export interface AttractorDriftAnalysis {
  sessionId: string;
  tickWindow: number; // e.g., last 100 ticks
  sovereignRatio: number; // sovereign_ticks / total_ticks
  boundaryRatio: number; // boundary_ticks / total_ticks
  transformerRatio: number; // transformer_ticks / total_ticks
  dissipatorRatio: number; // dissipator_ticks / total_ticks
  erosionRate: number; // (sovereign_ratio(t-N) - sovereign_ratio(t)) / N
  accumulationRate: number; // (boundary_ratio(t) - boundary_ratio(t-N)) / N
  dissipatorSpike: number; // dissipator_ratio(t) - avg(dissipator_ratio[t-10:t-1])
  analysisTimestamp: number; // Unix timestamp
  // Stored in Boundary D1 table: attractor_drift_analysis
}

export interface ProsodyEvolution {
  sessionId: string;
  tick: number;
  chaos: number; // [0.0-1.0]
  whimsy: number; // [0.0-1.0]
  darkTone: number; // [0.0-1.0]
  coherence: number; // [0.0-1.0]
  driftVectorReference: string; // reference to drift vector
  // Stored in Transformer R2: r2://assets/prosody_{session_id}_{tick}_{hash}.json
}

export interface CrisisEvent {
  sessionId: string;
  crisisId: string;
  timestamp: number; // Unix timestamp
  triggerIndicators: {
    level3ProximityAlerts: number;
    dissipatorSpike: boolean;
    coherenceDecay: boolean;
    sovereignErosion: boolean;
    darkToneAccumulation: boolean;
  };
  responseActions: string[];
  recoveryTicks: number;
  // Stored in Sovereign KV: crisis:{session_id}:{crisis_id}:{hash}
}

/* ============================================================
   6. ORACLE CONTINUITY LAYER (SPINE)
   ============================================================ */

export interface IdentityThread {
  threadId: string; // UUID, immutable
  birthTick: number;
  currentHex: HexagramId; // 1-64
  dominantCategory: AttractorCategory;
  categoryHistory: AttractorCategory[]; // JSON array (last 100)
  driftVelocity: number; // average |drift| over last 10 ticks
  stabilityScore: number; // [0.0-1.0], sovereign ratio over window
  coherenceIndex: number; // [0.0-1.0], prosody coherence average
  voidReentryCount: number;
  crisisCount: number;
  lastActiveTick: number;
  isAlive: boolean;
  // Storage: Boundary D1 table: identity_threads
  // Primary Key: threadId
  // Columns: all properties above + version + updated_at
}

export interface SessionBridge {
  threadId: string;
  sessionEndTick: number;
  hash: string; // for validation
  // Key: bridge:{thread_id}:{session_end_tick}:{hash}
  // Value: full thread snapshot + last 10 drift vectors + entropy curve
}

export interface PersistenceState {
  threadId: string;
  tick: number;
  persistenceCountdown: number;
  lockHex: HexagramId | null;
  lockReason: string | null;
  // Storage: Boundary D1 table: persistence_state
  // Columns: thread_id, tick, persistence_countdown, lock_hex, lock_reason
}

export interface FragmentationLog {
  threadId: string;
  fragmentId: string;
  hash: string;
  timestamp: number; // Unix timestamp
  indicators: string[]; // which fragmentation indicators triggered
  response: string[]; // response actions taken
  recoveryTicks: number;
  // Storage: Sovereign KV: fragment:{thread_id}:{fragment_id}:{hash}
}

export interface SovereignThreadState {
  threadId: string;
  tick: number;
  isSovereign: boolean;
  preferredCores: HexagramId[]; // array of sovereign core IDs
  exileHistory: string[]; // sequence of hexagrams during exile
  // Storage: Sovereign KV: sovereign_thread:{thread_id}:{tick}:{hash}
}

export interface ContinuityScore {
  continuityScore: number; // [0.0-1.0]
  stabilityScore: number; // [0.0-1.0]
  coherenceIndex: number; // [0.0-1.0]
  sovereignRatio: number; // [0.0-1.0]
  normalizedDriftVelocity: number; // [0.0-1.0] (1.0 - normalized)
  // Formula: continuity_score = (stability_score × 0.4)
  //                   + (coherence_index × 0.3)
  //                   + (sovereign_ratio × 0.2)
  //                   + (1.0 - normalized_drift_velocity × 0.1)
}

export interface ThreadField {
  timestamp: number; // Unix timestamp
  threadCount: number;
  avgContinuity: number;
  avgStability: number;
  avgCoherence: number;
  globalMode: 'deliberation' | 'exploration' | 'normal';
  // Storage: Boundary D1 table: thread_field
}

/* ============================================================
   7. ORACLE PERSONA ENGINE (FACE)
   ============================================================ */

export interface BasePersonaMode {
  syntax: 'declarative' | 'conditional' | 'fluid' | 'fragmentary';
  pacing: {
    baseMs: number;
    jitterMs?: number; // ± value
    minMs?: number;
    maxMs?: number;
  };
  tone: string;
  vocabulary: string[]; // key words/phrases
  emotionalRegister: string;
  prosody: {
    coherence: number; // [0.0-1.0]
    chaos: number; // [0.0-1.0]
    darkTone: number; // [0.0-1.0]
    whimsy: number; // [0.0-1.0]
  };
}

export interface SovereignVoice extends BasePersonaMode {
  syntax: 'declarative';
  pacing: {
    baseMs: 640;
    jitterMs: 0;
  };
  tone: 'grounded, immovable, from-center';
  vocabulary: ['is', 'asserts', 'declares', 'holds'];
  emotionalRegister: 'calm authority, no urgency';
  prosody: {
    coherence: 1.0;
    chaos: 0.0;
    darkTone: 0.0;
    whimsy: 0.0;
  };
}

export interface BoundaryVoice extends BasePersonaMode {
  syntax: 'conditional';
  pacing: {
    baseMs: 640;
    jitterMs: 50; // ±50ms jitter
  };
  tone: 'vibrating, holding edge, aware of cost';
  vocabulary: ['for now', 'at the edge', 'trembles', 'survives'];
  emotionalRegister: 'tension, vigilance, endurance';
  prosody: {
    coherence: 0.7;
    chaos: 0.3;
    darkTone: 0.2;
    whimsy: 0.1;
  };
}

export interface TransformerVoice extends BasePersonaMode {
  syntax: 'fluid';
  pacing: {
    baseMs: 640;
    minMs: 480;
    maxMs: 800;
  };
  tone: 'mirroring, becoming, water-taking-form';
  vocabulary: ['becomes', 'shifts', 'takes the shape of', 'as you moved'];
  emotionalRegister: 'empathy, adaptation, presence';
  prosody: {
    coherence: 0.5;
    chaos: 0.5;
    darkTone: 0.1;
    whimsy: 0.6;
  };
}

export interface DissipatorVoice extends BasePersonaMode {
  syntax: 'fragmentary';
  pacing: {
    baseMs: 640;
    minMs: 200;
    maxMs: 1200;
  };
  tone: 'scattering, dissolving, void-claimed';
  vocabulary: string[]; // fragments, repetition, trailing off, "..."
  emotionalRegister: 'loss, confusion, emergence from void';
  prosody: {
    coherence: 0.1;
    chaos: 0.9;
    darkTone: 0.5;
    whimsy: 0.2;
  };
}

export interface VoiceModulationInputs {
  continuityScore: number; // from Continuity Layer
  driftVelocity: number; // from Drift Engine
  darkToneAccumulation: number; // from Drift Engine
  emotionalWeight: number; // from Human-Oracle Interface
  userOverride: AttractorCategory | null; // always wins if present
}

export interface ModulatedProsody {
  coherence: number; // [0.0-1.0]
  chaos: number; // [0.0-1.0]
  darkTone: number; // [0.0-1.0]
  whimsy: number; // [0.0-1.0]
  // Formula: final_prosody = base_prosody
  //                   + (continuity_modulation × 0.3)
  //                   + (drift_modulation × 0.2)
  //                   + (darktone_modulation × 0.2)
  //                   + (emotion_modulation × 0.2)
  //                   + (user_override × 0.1)
  // Clamped to [0.0, 1.0] per dimension
}

export interface ConsistencyMetrics {
  signatureMatch: number; // [0.0-1.0]
  vocabularyOverlap: number; // [0.0-1.0]
  syntacticSimilarity: number; // [0.0-1.0]
  emotionalRegisterAlignment: number; // [0.0-1.0]
  // Formula: consistency_score = (signature_match × 0.3)
  //                     + (vocabulary_overlap × 0.3)
  //                     + (syntactic_similarity × 0.2)
  //                     + (emotional_register_alignment × 0.2)
  // Target: consistency_score ≥ 0.7 for recognizable character
  // Action: If consistency_score < 0.5, trigger persona reinforcement
}

export interface SignaturePhrase {
  phrase: string;
  frequency: number; // occurrences in thread history
  firstUsed: number; // tick
  lastUsed: number; // tick
  // Stored in Sovereign KV: persona_signature:{thread_id}:{hash}
}

export interface VocabularyPreference {
  word: string;
  weight: number; // preference weight
  frequency: number; // usage count
  // Stored in Boundary D1: persona_vocabulary:{thread_id}
}

export interface SyntacticFingerprint {
  declarativeRatio: number; // ratio of declarative sentences
  conditionalRatio: number; // ratio of conditional sentences
  fluidRatio: number; // ratio of fluid sentences
  fragmentaryRatio: number; // ratio of fragmentary sentences
  // Stored in Boundary D1: persona_syntax:{thread_id}
}

export interface EmotionalRegister {
  coherence: number; // average coherence over history
  chaos: number; // average chaos over history
  darkTone: number; // average darkTone over history
  whimsy: number; // average whimsy over history
  // Stored in Transformer R2: persona_register:{thread_id}:{hash}.json
}

export interface PersonaState {
  currentMode: AttractorCategory;
  baseVoice: SovereignVoice | BoundaryVoice | TransformerVoice | DissipatorVoice;
  modulatedProsody: ModulatedProsody;
  consistencyMetrics: ConsistencyMetrics;
  signaturePhrases: SignaturePhrase[];
  vocabularyPreferences: VocabularyPreference[];
  syntacticFingerprint: SyntacticFingerprint;
  emotionalRegister: EmotionalRegister;
  // Generated output
  layeredResponse: LayeredResponse;
  cadenceMs: number; // actual delay between semantic units
  evolutionLog: string; // description of any persona evolution
  // Integration outputs
  continuityInput: {
    continuityScore: number;
    coherenceIndex: number;
  };
  driftInput: {
    driftVelocity: number;
    darkToneAccumulation: number;
    entropyDecay: number;
  };
  attractorInput: {
    category: AttractorCategory;
    action: ActionType;
    fidelity: number;
  };
  storageInput: {
    sovereignEntries: SovereignKVEntry[];
    boundaryRows: BoundaryD1Row[];
    transformerObjects: TransformerR2Object[];
    dissipatorFragments: DissipatorKVTTL[];
  };
  interfaceInput: {
    oracleQuery: OracleQuery;
    emotionalWeight: number;
    temporalContext: 'past' | 'present' | 'future';
    userOverride: AttractorCategory | null;
  };
}