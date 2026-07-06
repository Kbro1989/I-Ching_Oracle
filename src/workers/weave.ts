/**
 * POG2 Weave Worker — Temporal Weave Engine
 * Cloudflare Workers native implementation
 * Receives tick signals from Orchestrator DO alarm via Queue
 * Executes VOID → SHADOW → VORTEX → GOVERNOR → COLLAPSE
 * Emits collapse events to Drift Worker via POG2_COLLAPSE_QUEUE
 */

import type { Env } from '../index';

// ─── Emotional Weights Sidecar ─────────────────────────────────────

interface HexEmotionWeights {
  name: string;
  category: string;
  action: string;
  voiceWeights: {
    chaos: number;
    whimsy: number;
    darkTone: number;
    coherence: number;
    voiceWeight: number;
  };
  trainingNotes: string;
}

interface EmotionalWeightsFile {
  version: string;
  description: string;
  hexagrams: Record<string, HexEmotionWeights>;
  meta: {
    source: string;
    license: string;
    notes: string;
  };
}

let cachedWeights: EmotionalWeightsFile | null = null;

async function loadEmotionalWeights(env: Env): Promise<EmotionalWeightsFile> {
  if (cachedWeights) return cachedWeights;

  try {
    const raw = await env.POG2_SOVEREIGN.get('oracle:emotional-weights');
    if (raw) {
      cachedWeights = JSON.parse(raw) as EmotionalWeightsFile;
      return cachedWeights!;
    }
  } catch {
    // fall back to empty bundled data
  }

  const bundled: EmotionalWeightsFile = {
    version: '1.0.0',
    description: 'Bundled fallback emotional weights',
    hexagrams: {},
    meta: { source: 'bundled', license: 'internal', notes: 'Fallback weights' },
  };

  cachedWeights = bundled;
  return cachedWeights;
}

// ─── Message Types ─────────────────────────────────────────────────

export interface TickSignal {
  type: 'tick';
  tick: number;
  timestamp: number;
  sessionId: string | null;
}

export interface CollapseEvent {
  type: 'collapse';
  tick: number;
  hexagram_id: number;
  hexagram_binary: string;
  action: 'ASSERT' | 'YIELD' | 'ADAPT' | 'WAIT';
  fidelity: number;
  phase_multiplier: number;
  causal_confidence: number;
  category: 'sovereign' | 'boundary' | 'transformer' | 'dissipator';
  session_id: string | null;
  timestamp: number;
}

// ─── Hexagram Registry ─────────────────────────────────────────────
const HEXAGRAM_REGISTRY: Array<[string, string, 'ASSERT' | 'YIELD' | 'ADAPT' | 'WAIT']> = [
  ['111111', 'The Creative (Qian)', 'ASSERT'],
  ['000000', 'The Receptive (Kun)', 'YIELD'],
  ['100010', 'Difficulty at the Beginning', 'ADAPT'],
  ['010001', 'Youthful Folly', 'WAIT'],
  ['111010', 'Waiting', 'WAIT'],
  ['010111', 'Conflict', 'ADAPT'],
  ['010000', 'The Army', 'ASSERT'],
  ['000010', 'Holding Together', 'YIELD'],
  ['111011', 'The Taming Power of the Small', 'ADAPT'],
  ['110111', 'Treading', 'ADAPT'],
  ['111000', 'Peace', 'YIELD'],
  ['000111', 'Standstill', 'WAIT'],
  ['111101', 'Fellowship with Men', 'ASSERT'],
  ['101111', 'Possession in Great Measure', 'ASSERT'],
  ['001000', 'Modesty', 'YIELD'],
  ['000100', 'Enthusiasm', 'ASSERT'],
  ['100110', 'Following', 'YIELD'],
  ['011001', 'Work on Decayed', 'ADAPT'],
  ['110000', 'Approach', 'ADAPT'],
  ['000011', 'Contemplation', 'WAIT'],
  ['100101', 'Biting Through', 'ASSERT'],
  ['101001', 'Grace', 'YIELD'],
  ['000001', 'Splitting Apart', 'WAIT'],
  ['100000', 'Return', 'ADAPT'],
  ['100111', 'Innocence', 'YIELD'],
  ['111001', 'The Taming Power of the Great', 'ASSERT'],
  ['100001', 'Nourishment', 'ADAPT'],
  ['011110', 'Great Preponderance', 'ASSERT'],
  ['010010', 'The Abysmal (Kan)', 'ADAPT'],
  ['101101', 'The Clinging (Li)', 'ASSERT'],
  ['001110', 'Influence', 'YIELD'],
  ['011100', 'Duration', 'WAIT'],
  ['001111', 'Retreat', 'YIELD'],
  ['111100', 'Great Power', 'ASSERT'],
  ['000101', 'Progress', 'ADAPT'],
  ['101000', 'Darkening of the Light', 'WAIT'],
  ['110001', 'The Family', 'YIELD'],
  ['100011', 'Opposition', 'ADAPT'],
  ['001010', 'Obstruction', 'WAIT'],
  ['010100', 'Deliverance', 'ADAPT'],
  ['110011', 'Decrease', 'YIELD'],
  ['001100', 'Increase', 'ASSERT'],
  ['111110', 'Breakthrough', 'ASSERT'],
  ['011111', 'Coming to Meet', 'ADAPT'],
  ['000110', 'Gathering Together', 'ASSERT'],
  ['011000', 'Pushing Upward', 'ADAPT'],
  ['010110', 'Oppression', 'WAIT'],
  ['011010', 'The Well', 'ADAPT'],
  ['101011', 'Revolution', 'ASSERT'],
  ['110101', 'The Cauldron', 'ASSERT'],
  ['011101', 'The Arousing', 'ASSERT'],
  ['001011', 'Keeping Still', 'WAIT'],
  ['100100', 'Development', 'ADAPT'],
  ['110100', 'The Marrying Maiden', 'YIELD'],
  ['101100', 'Abundance', 'ASSERT'],
  ['001101', 'The Wanderer', 'ADAPT'],
  ['010110', 'The Gentle', 'YIELD'],
  ['110110', 'The Joyous (Dui)', 'YIELD'],
  ['010011', 'Dispersion', 'ADAPT'],
  ['110010', 'Limitation', 'WAIT'],
  ['101100', 'Inner Truth', 'YIELD'],
  ['011001', 'Small Preponderance', 'ADAPT'],
  ['101010', 'After Completion', 'WAIT'],
  ['010101', 'Before Completion', 'ADAPT'],
];

const HEXAGRAMS: Record<number, [string, string, 'ASSERT' | 'YIELD' | 'ADAPT' | 'WAIT']> = {};
HEXAGRAM_REGISTRY.forEach(([binary, name, action], id) => {
  HEXAGRAMS[id] = [binary, name, action];
});

export const HEXAGRAM_BINARIES: Record<number, string> = {};
const HEXAGRAM_ACTIONS: Record<number, 'ASSERT' | 'YIELD' | 'ADAPT' | 'WAIT'> = {};
Object.entries(HEXAGRAMS).forEach(([id, [binary, , action]]) => {
  HEXAGRAM_BINARIES[Number(id)] = binary;
  HEXAGRAM_ACTIONS[Number(id)] = action;
});

export interface OracleState {
  tick: number;
  sessionId: string | null;
  hexagramId: number;
  action: 'ASSERT' | 'YIELD' | 'ADAPT' | 'WAIT';
  category: 'sovereign' | 'boundary' | 'transformer' | 'dissipator';
  emotionalWeight: number;
  emotion: number;
  timestamp: number;
  temporalContext: 'past' | 'present' | 'future';
  position: number | null;
  gateLines: {
    position: number;
    ternary: 0 | 1 | 2;
    darkness: number;
    weight: number;
  }[];
  voidDropperPos: number | null;
  l4Unlocked: boolean;
  fidelity: number;
  phaseMultiplier: number;
  continuityScore: number;
  driftVelocity: number;
  evaluatedPaths: EvaluatedHexPath[];
  emotionalPool: EmotionalPool;
}

export interface EmotionalPool {
  sessionId: string;
  tick: number;
  queryHash: string;
  emotions: Record<number, {
    chaos: number;
    whimsy: number;
    darkTone: number;
    coherence: number;
    voiceWeight: number;
  }>;
  source: 'r2' | 'kv' | 'd1' | 'deterministic';
}

export interface EvaluatedHexPath {
  hexagramId: number;
  category: 'sovereign' | 'boundary' | 'transformer' | 'dissipator';
  action: 'ASSERT' | 'YIELD' | 'ADAPT' | 'WAIT';
  emotion: number;
  fidelity: number;
  stability: number;
  voiceWeight: number;
  temporalFit: {
    past: number;
    present: number;
    future: number;
  };
  prosody: {
    chaos: number;
    whimsy: number;
    darkTone: number;
    coherence: number;
  };
}

export interface ConsoleResolve {
  temporalContexts: {
    past: {
      reflection: string;
      hexagramId: number;
      action: string;
      emotionalWeight: number;
      fidelity: number;
    };
    present: {
      reflection: string;
      hexagramId: number;
      action: string;
      emotionalWeight: number;
      fidelity: number;
    };
    future: {
      reflection: string;
      hexagramId: number;
      action: string;
      emotionalWeight: number;
      fidelity: number;
    };
  };
  unifiedAnswer: string;
  resolvedEmotion: number;
  categorySubset: {
    sovereign: number[];
    boundary: number[];
    transformer: number[];
    dissipator: number[];
  };
}

export function serializeOracleState(state: OracleState): string {
  const payload = [
    state.tick,
    state.sessionId ?? '',
    state.hexagramId,
    state.emotionalWeight,
    state.emotion,
    state.timestamp,
    state.temporalContext,
    state.position ?? -1,
    state.voidDropperPos ?? -1,
    state.l4Unlocked ? 1 : 0,
    state.fidelity,
    state.phaseMultiplier,
    state.continuityScore,
    state.driftVelocity,
    state.category,
    state.action,
  ];

  const gateLineIndicator = state.gateLines.reduce<string>((acc, line, index) => {
    const p = String(index + 1);
    const t = String(line.ternary);
    const d = String(Math.round(line.darkness * 255));
    const w = String(line.weight);
    return `${acc}${p}${t}${d}${w}`;
  }, '');

  const meta = `${state.voidDropperPos ?? '0'}|${state.l4Unlocked ? '1' : '0'}|${gateLineIndicator || '0'}`;
  return `${JSON.stringify(payload)}:::${meta}`;
}

export function hydrateOracleState(raw: string): OracleState | null {
  try {
    const [payloadStr, meta] = raw.split(':::');

    const evaluatedPaths = parseEvaluatedPaths(raw);
    const emotionalPool = parseEmotionalPool(raw);

    const payload = JSON.parse(payloadStr) as number[];
    if (!Array.isArray(payload) || payload.length < 16) return null;

    const [
      tick,
      sessionId,
      hexagramId,
      emotionalWeight,
      emotion,
      timestamp,
      temporalContext,
      position,
      voidDropperPos,
      l4Unlocked,
      fidelity,
      phaseMultiplier,
      continuityScore,
      driftVelocity,
      category,
      action,
    ] = payload;

    const [vdPosRaw, l4Raw, gateLineIndicator] = meta.split('|');

    const gateLines = parseGateLineIndicator(gateLineIndicator);
    const voidDropperPosResolved = vdPosRaw === '0' ? null : Number(vdPosRaw);

    return {
      tick: Number(tick),
      sessionId: sessionId ? String(sessionId) : null,
      hexagramId: Number(hexagramId),
      emotionalWeight: Number(emotionalWeight),
      emotion: Number(emotion),
      timestamp: Number(timestamp),
      temporalContext: ['past', 'present', 'future'].includes(String(temporalContext))
        ? (String(temporalContext) as OracleState['temporalContext'])
        : 'present',
      position: Number(position) > 0 ? Number(position) : null,
      gateLines,
      voidDropperPos: voidDropperPosResolved,
      l4Unlocked: String(l4Unlocked) === '1',
      fidelity: Number(fidelity),
      phaseMultiplier: Number(phaseMultiplier),
      continuityScore: Number(continuityScore),
      driftVelocity: Number(driftVelocity),
      category: ['sovereign', 'boundary', 'transformer', 'dissipator'].includes(String(category))
        ? (String(category) as OracleState['category'])
        : 'transformer',
      action: ['ASSERT', 'YIELD', 'ADAPT', 'WAIT'].includes(String(action))
        ? (String(action) as OracleState['action'])
        : 'ADAPT',
      evaluatedPaths,
      emotionalPool,
    };
  } catch {
    return null;
  }
}

export function parseGateLineIndicator(indicator: string): OracleState['gateLines'] {
  if (!indicator || indicator === '0') return [];

  const lines: OracleState['gateLines'] = [];
  const chunkSize = 4;
  for (let i = 0; i < indicator.length; i += chunkSize) {
    const chunk = indicator.slice(i, i + chunkSize);
    if (chunk.length < chunkSize) break;

    const pos = Number(chunk[0]);
    const ternary = Number(chunk[1]) as 0 | 1 | 2;
    const darkness = Number(chunk.slice(2, 4)) / 255;

    if (pos >= 1 && pos <= 6 && [0, 1, 2].includes(ternary)) {
      lines.push({ position: pos, ternary, darkness, weight: Math.round(darkness * 255) });
    }
  }

  return lines.slice(0, 6);
}

export function parseEvaluatedPaths(raw: string): EvaluatedHexPath[] {
  try {
    const [payloadStr] = raw.split(':::');
    const marker = ':::paths:::';
    const idx = payloadStr.indexOf(marker);
    if (idx < 0) return [];
    const parsed = JSON.parse(payloadStr.slice(idx + marker.length));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((p: any) => ({
      hexagramId: Number(p.hexagramId),
      category: ['sovereign', 'boundary', 'transformer', 'dissipator'].includes(String(p.category))
        ? (p.category as EvaluatedHexPath['category'])
        : 'transformer',
      action: ['ASSERT', 'YIELD', 'ADAPT', 'WAIT'].includes(String(p.action))
        ? (p.action as EvaluatedHexPath['action'])
        : 'ADAPT',
      emotion: Number(p.emotion ?? 0.5),
      fidelity: Number(p.fidelity ?? 0.5),
      stability: Number(p.stability ?? 0.5),
      voiceWeight: Number(p.voiceWeight ?? 0.5),
      temporalFit: {
        past: Number(p.temporalFit?.past ?? 0.3),
        present: Number(p.temporalFit?.present ?? 0.5),
        future: Number(p.temporalFit?.future ?? 0.2),
      },
      prosody: {
        chaos: Number(p.prosody?.chaos ?? 0.2),
        whimsy: Number(p.prosody?.whimsy ?? 0.3),
        darkTone: Number(p.prosody?.darkTone ?? 0.2),
        coherence: Number(p.prosody?.coherence ?? 0.7),
      },
    }));
  } catch {
    return [];
  }
}

export function parseEmotionalPool(raw: string): EmotionalPool {
  try {
    const payloadStr = raw.split(':::')[0];
    const marker = ':::pool:::';
    const idx = payloadStr.indexOf(marker);
    if (idx < 0) {
      return {
        sessionId: '',
        tick: 0,
        queryHash: '',
        emotions: {},
        source: 'deterministic',
      };
    }
    const data = JSON.parse(payloadStr.slice(idx + marker.length));
    if (!data || typeof data !== 'object' || !data.emotions) {
      return {
        sessionId: '',
        tick: 0,
        queryHash: '',
        emotions: {},
        source: 'deterministic',
      };
    }

    return {
      sessionId: String(data.sessionId ?? ''),
      tick: Number(data.tick ?? 0),
      queryHash: String(data.queryHash ?? ''),
      emotions: Object.fromEntries(
        Object.entries(data.emotions).map(([k, v]: any) => [
          Number(k),
          {
            chaos: Number(v.chaos ?? 0.2),
            whimsy: Number(v.whimsy ?? 0.3),
            darkTone: Number(v.darkTone ?? 0.2),
            coherence: Number(v.coherence ?? 0.7),
            voiceWeight: Number(v.voiceWeight ?? 0.5),
          },
        ]),
      ),
      source: ['r2', 'kv', 'd1', 'deterministic'].includes(String(data.source))
        ? (data.source as EmotionalPool['source'])
        : 'deterministic',
    };
  } catch {
    return {
      sessionId: '',
      tick: 0,
      queryHash: '',
      emotions: {},
      source: 'deterministic',
    };
  }
}

export function collapseOracleStateToDecision(state: OracleState): {
  hexagramId: number;
  action: OracleState['action'];
  category: OracleState['category'];
} {
  if (state.l4Unlocked && state.voidDropperPos !== null) {
    return {
      hexagramId: state.hexagramId,
      action: state.action,
      category: state.category,
    };
  }

  if (state.emotionalWeight > 0.8 && state.continuityScore >= 0.7) {
    return {
      hexagramId: 1,
      action: 'ASSERT',
      category: 'boundary',
    };
  }

  if (state.driftVelocity > 0.5) {
    return {
      hexagramId: 40,
      action: 'ADAPT',
      category: 'transformer',
    };
  }

  if (state.continuityScore < 0.5) {
    return {
      hexagramId: 12,
      action: 'WAIT',
      category: 'dissipator',
    };
  }

  return {
    hexagramId: state.hexagramId,
    action: state.action,
    category: state.category,
  };
}

const SOVEREIGN_CORES = new Set([7, 10, 16, 18, 19, 53, 56, 57, 61, 62]);
const BOUNDARY_ATTRACTORS = new Set([1, 25, 26, 30, 38, 41, 49]);

// Forbidden-adjacent hexagrams
const FORBIDDEN_ADJACENT = new Set([9, 14, 15, 17, 18, 22, 23, 31, 43, 44, 48, 52, 55, 56, 59, 61, 62, 63]);

const CARD5_BINARY = '111111';
const CARD5_HEXAGRAM_ID = 1;
const CARD5_ACTION: CollapseEvent['action'] = 'ASSERT';
const CARD5_FIDELITY = 0.973;
const CARD5_PHASE_MULTIPLIER = 1.0;

const COLLECTIVE_OPPOSITION_BINARY = '010100';
const COLLECTIVE_OPPOSITION_HEXAGRAM_ID = 40;
const CARD5_TRANSFORMATION_BINARY = '101011';
const CARD5_TRANSFORMATION_HEXAGRAM_ID = 49;

// ─── Shannon Entropy ───────────────────────────────────────────────

function shannonEntropy(distribution: number[]): number {
  let entropy = 0;
  for (const p of distribution) {
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy;
}

function normalizeDistribution(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return counts.map(() => 1 / counts.length);
  return counts.map(c => c / total);
}

// ─── Weave Engine ──────────────────────────────────────────────────

class WeaveEngine {
  private history: number[] = [];
  private previousHex: number = 1;
  private previousEntropy: number = 0.999;
  private persistenceCountdown: number = 0;
  private lockedHex: number | null = null;
  private boundSessionId: string | null = null;

  constructor(
    private readonly beatMs: number = 640,
    private readonly maxComputeMs: number = 50,
    private readonly attractorPersistence: number = 5,
    private readonly voidReentryDepth: number = 5,
  ) {}

  private async sha256Digest(input: string): Promise<ArrayBuffer> {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  }

  private async deterministicPick(candidates: number[], selectorName: string): Promise<number> {
    const sessionId = this.boundSessionId ?? 'null';
    const seed = `${this.history.length}:${sessionId}:${this.previousHex}:${selectorName}`;
    const hash = await this.sha256Digest(seed);
    const view = new DataView(hash);
    const uint32 = view.getUint32(0);
    return candidates[uint32 % candidates.length];
  }

  async evaluateForConsult(
    env: Env,
    tick: number,
    sessionId: string,
    queryText: string,
    continuityScore: number,
    driftVelocity: number,
  ): Promise<{
    oracleState: OracleState;
    consoleResolve: ConsoleResolve;
  }> {
    const weights = await loadEmotionalWeights(env);
    const queryHash = (() => {
      let hash = 0;
      for (let i = 0; i < queryText.length; i++) hash = (hash * 31 + queryText.charCodeAt(i)) | 0;
      return Math.abs(hash).toString(16).padStart(8, '0');
    })();

    const pool: EmotionalPool = {
      sessionId,
      tick,
      queryHash,
      emotions: {},
      source: 'deterministic',
    };

    for (let i = 1; i <= 64; i++) {
      const entry = weights.hexagrams[String(i)];
      if (entry?.voiceWeights) {
        pool.emotions[i] = { ...entry.voiceWeights };
      } else {
        const seed = `${tick}:${sessionId}:${queryHash}:${i}`;
        let h = 0;
        for (let s = 0; s < seed.length; s++) h = (h * 31 + seed.charCodeAt(s)) | 0;
        const base = (Math.abs(h) % 1000) / 1000;
        pool.emotions[i] = {
          chaos: Number((base * 0.6 + 0.1).toFixed(3)),
          whimsy: Number(((1 - base) * 0.7 + 0.1).toFixed(3)),
          darkTone: Number((base * 0.5 + 0.05).toFixed(3)),
          coherence: Number(((1 - base) * 0.8 + 0.1).toFixed(3)),
          voiceWeight: Number((base * 0.9 + 0.1).toFixed(3)),
        };
      }
    }

    const paths = this.buildAllPaths(tick, sessionId, queryText, pool, continuityScore, driftVelocity);
    const consoleResolve = this.resolveConsole(paths);
    const best = paths.find(p => p.hexagramId === consoleResolve.temporalContexts.present.hexagramId) || paths[0];

    const oracleState: OracleState = {
      tick,
      sessionId,
      hexagramId: best.hexagramId,
      action: best.action,
      category: best.category,
      emotionalWeight: best.emotion,
      emotion: best.emotion,
      timestamp: tick * 640,
      temporalContext: 'present',
      position: null,
      gateLines: [],
      voidDropperPos: null,
      l4Unlocked: false,
      fidelity: best.fidelity,
      phaseMultiplier: 1.0,
      continuityScore,
      driftVelocity,
      evaluatedPaths: paths,
      emotionalPool: pool,
    };

    return { oracleState, consoleResolve };
  }

  private buildAllPaths(
    tick: number,
    sessionId: string | null,
    queryText: string,
    pool: EmotionalPool,
    continuityScore: number,
    driftVelocity: number,
  ): EvaluatedHexPath[] {
    const session = sessionId || 'null';
    const queryHash = (() => {
      let hash = 0;
      for (let i = 0; i < queryText.length; i++) hash = (hash * 31 + queryText.charCodeAt(i)) | 0;
      return Math.abs(hash).toString(16).padStart(8, '0');
    })();

    const paths: EvaluatedHexPath[] = [];
    for (let hexId = 1; hexId <= 64; hexId++) {
      const seed = `${tick}:${session}:${queryHash}:${hexId}`;
      let h1 = 0;
      for (let s = 0; s < seed.length; s++) h1 = (h1 * 31 + seed.charCodeAt(s)) | 0;
      const h2 = Math.abs(h1);
      const emotion = Number(((h2 % 1000) / 1000).toFixed(3));
      const stability = Number(Math.max(0.05, continuityScore - driftVelocity * 0.3).toFixed(3));
      const voiceWeight = Number((pool.emotions[hexId]?.voiceWeight ?? emotion).toFixed(3));
      const pastFit = Number((Math.max(0, 1 - Math.abs(tick - (hexId * 7 % 37)) / 37)).toFixed(3));
      const presentFit = Number((voiceWeight * 0.6 + stability * 0.4).toFixed(3));
      const futureFit = Number(((1 - driftVelocity) * presentFit).toFixed(3));
      const chaos = Number((pool.emotions[hexId]?.chaos ?? Number((emotion * 0.6).toFixed(3))).toFixed(3));
      const whimsy = Number((pool.emotions[hexId]?.whimsy ?? Number(((1 - emotion) * 0.7).toFixed(3))).toFixed(3));
      const darkTone = Number((pool.emotions[hexId]?.darkTone ?? Number((emotion * 0.5).toFixed(3))).toFixed(3));
      const coherence = Number((pool.emotions[hexId]?.coherence ?? Number(((1 - chaos) * 0.8).toFixed(3))).toFixed(3));

      paths.push({
        hexagramId: hexId,
        category: getCategory(hexId),
        action: getAction(hexId),
        emotion,
        fidelity: Number((presentFit * 0.7 + futureFit * 0.3).toFixed(3)),
        stability,
        voiceWeight,
        temporalFit: { past: pastFit, present: presentFit, future: futureFit },
        prosody: { chaos, whimsy, darkTone, coherence },
      });
    }

    return paths;
  }

  resolveConsole(paths: EvaluatedHexPath[]): ConsoleResolve {
    const byContext = (context: 'past' | 'present' | 'future') =>
      paths
        .map(p => ({ hexId: p.hexagramId, score: p.temporalFit[context], path: p }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

    const past = byContext('past');
    const present = byContext('present');
    const future = byContext('future');

    const candidates = [...present, ...future];
    const stableSubset = candidates
      .map(c => ({ hexId: c.hexId, score: c.path.stability + c.path.fidelity + c.path.voiceWeight }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);

    const unified = stableSubset.map(s => {
      const path = paths.find(p => p.hexagramId === s.hexId)!;
      return `${HEXAGRAM_NAMES[path.hexagramId] || `Hexagram #${path.hexagramId}`}: ${path.action}`;
    }).join('; ');

    const resolvedEmotion = Number(
      (stableSubset.reduce((s, cur) => s + (paths.find(p => p.hexagramId === cur.hexId)?.emotion ?? 0), 0) /
        Math.max(1, stableSubset.length)).toFixed(3),
    );

    const categorySubset = {
      sovereign: stableSubset.map(s => s.hexId).filter(id => getCategory(id) === 'sovereign'),
      boundary: stableSubset.map(s => s.hexId).filter(id => getCategory(id) === 'boundary'),
      transformer: stableSubset.map(s => s.hexId).filter(id => getCategory(id) === 'transformer'),
      dissipator: stableSubset.map(s => s.hexId).filter(id => getCategory(id) === 'dissipator'),
    };

    return {
      temporalContexts: {
        past: {
          reflection: buildReflection(past[0]?.path, 'past'),
          hexagramId: past[0]?.hexId ?? 1,
          action: past[0]?.path.action ?? 'WAIT',
          emotionalWeight: past[0]?.path.emotion ?? 0.5,
          fidelity: past[0]?.path.fidelity ?? 0.5,
        },
        present: {
          reflection: buildReflection(present[0]?.path, 'present'),
          hexagramId: present[0]?.hexId ?? 1,
          action: present[0]?.path.action ?? 'WAIT',
          emotionalWeight: present[0]?.path.emotion ?? 0.5,
          fidelity: present[0]?.path.fidelity ?? 0.5,
        },
        future: {
          reflection: buildReflection(future[0]?.path, 'future'),
          hexagramId: future[0]?.hexId ?? 1,
          action: future[0]?.path.action ?? 'WAIT',
          emotionalWeight: future[0]?.path.emotion ?? 0.5,
          fidelity: future[0]?.path.fidelity ?? 0.5,
        },
      },
      unifiedAnswer: unified || 'WAIT. The substrate holds through silence.',
      resolvedEmotion,
      categorySubset,
    };
  }

  async processBeat(
    tick: number,
    sessionId: string | null,
    threatDensity: number,
    avgConfidence: number,
    computePressure: number,
  ): Promise<CollapseEvent> {
    const voidEntropy = this.computeVoidEntropy();

    const { evaluatedPaths, committedPaths } = this.evaluateShadow(voidEntropy);

    const vortexResidue = this.computeVortexResidue(this.previousHex);
    const angularVelocity = vortexResidue.flipCount / 6.0;

    const governor = this.computeGovernor(threatDensity, avgConfidence, computePressure, voidEntropy);

    const annihilation = this.detectTotalAnnihilation(voidEntropy);
    const collapse = annihilation
      ? this.buildTotalAnnihilationCollapse(governor, tick, sessionId, voidEntropy, annihilation)
      : this.performCollapse(governor, tick, sessionId, voidEntropy);

    this.previousHex = collapse.hexagram_id;
    this.previousEntropy = voidEntropy;
    this.history.push(collapse.hexagram_id);
    if (this.history.length > this.voidReentryDepth * 2) {
      this.history = this.history.slice(-this.voidReentryDepth * 2);
    }

    if (collapse.category === 'sovereign' || collapse.category === 'boundary') {
      if (this.persistenceCountdown <= 0) {
        this.persistenceCountdown = this.attractorPersistence;
        this.lockedHex = collapse.hexagram_id;
      }
    }
    if (this.persistenceCountdown > 0) {
      this.persistenceCountdown--;
      if (this.persistenceCountdown === 0) {
        this.lockedHex = null;
      }
    }

    const entropyGrowth = voidEntropy - this.previousEntropy;
    if (entropyGrowth > 0.1) {
      if (this.persistenceCountdown > 0) this.persistenceCountdown++;
    }

    return collapse;
  }

  private computeVoidEntropy(): number {
    if (this.history.length === 0) return 0.999;

    const recent = this.history.slice(-this.voidReentryDepth);
    const counts = new Array(64).fill(0);
    for (const h of recent) counts[h - 1]++;

    const distribution = normalizeDistribution(counts);
    const entropy = shannonEntropy(distribution);
    return Math.min(entropy / Math.log2(64), 0.999);
  }

  private evaluateShadow(voidEntropy: number): { evaluatedPaths: number; committedPaths: number } {
    const basePaths = 50;
    const focusMode = this.persistenceCountdown > 0;
    const evaluatedPaths = focusMode ? Math.floor(basePaths * 0.1) : Math.floor(basePaths * 0.5);
    const committedPaths = focusMode ? evaluatedPaths : Math.floor(evaluatedPaths * 0.7);
    return { evaluatedPaths, committedPaths };
  }

  private computeVortexResidue(sourceHex: number): { residue: string; flipCount: number } {
    const sourceBin = HEXAGRAM_BINARIES[sourceHex] || '111111';
    const collectiveOpp = '010100';
    let flipCount = 0;
    let residue = '';
    for (let i = 0; i < 6; i++) {
      const bit = sourceBin[i] === collectiveOpp[i] ? '0' : '1';
      residue += bit;
      if (bit === '1') flipCount++;
    }
    return { residue, flipCount };
  }

  private computeGovernor(
    threatDensity: number,
    avgConfidence: number,
    computePressure: number,
    currentEntropy: number,
  ): { causalConfidence: number; phaseMultiplier: number; entropyGrowth: number } {
    const causalConfidence = Math.max(
      0.1,
      avgConfidence * (1 - threatDensity / 2) * (1 - computePressure / 3)
    );

    let baseMultiplier = 1.0;
    if (this.persistenceCountdown > 0 && this.persistenceCountdown < 3) {
      baseMultiplier = 0.8;
    } else if (this.persistenceCountdown === 0 && currentEntropy > 0.8) {
      baseMultiplier = 0.5;
    }

    const phaseMultiplier = baseMultiplier * (0.5 + 0.5 * causalConfidence);
    const entropyGrowth = currentEntropy - this.previousEntropy;

    return { causalConfidence, phaseMultiplier, entropyGrowth };
  }

  private performCollapse(
    governor: { causalConfidence: number; phaseMultiplier: number },
    tick: number,
    sessionId: string | null,
    voidEntropy: number,
  ): CollapseEvent {
    if (this.lockedHex !== null && this.persistenceCountdown > 0) {
      const hexId = this.lockedHex;
      return this.buildCollapseEvent(hexId, governor, tick, sessionId, voidEntropy);
    }

    let selectedHex: number;
    if (governor.causalConfidence >= 0.973 && governor.phaseMultiplier >= 0.9) {
      selectedHex = this.selectSovereignCore();
    } else if (governor.causalConfidence >= 0.8) {
      selectedHex = this.selectBoundaryAttractor();
    } else if (governor.causalConfidence >= 0.5) {
      selectedHex = this.selectTransformer();
    } else {
      selectedHex = this.selectDissipator();
    }

    return this.buildCollapseEvent(selectedHex, governor, tick, sessionId, voidEntropy);
  }

  private deterministicSelect(candidates: number[], selectorName: string): number {
    const seed = `${this.history.length}:${this.previousHex}:${selectorName}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) | 0;
    }
    return candidates[Math.abs(hash) % candidates.length];
  }

  private selectSovereignCore(): number {
    const cores = Array.from(SOVEREIGN_CORES);
    const historyMatch = cores.find(c => this.history.includes(c));
    return historyMatch ?? this.deterministicSelect(cores, 'sovereign');
  }

  private selectBoundaryAttractor(): number {
    const boundaries = Array.from(BOUNDARY_ATTRACTORS);
    const historyMatch = boundaries.find(b => this.history.includes(b));
    return historyMatch ?? this.deterministicSelect(boundaries, 'boundary');
  }

  private selectTransformer(): number {
    const candidates: number[] = [];
    for (let i = 1; i <= 64; i++) {
      if (!SOVEREIGN_CORES.has(i) && !BOUNDARY_ATTRACTORS.has(i)) {
        candidates.push(i);
      }
    }
    return this.deterministicSelect(candidates, 'transformer');
  }

  private selectDissipator(): number {
    const diss = Array.from(FORBIDDEN_ADJACENT);
    return this.deterministicSelect(diss, 'dissipator');
  }

  private buildCollapseEvent(
    hexId: number,
    governor: { causalConfidence: number; phaseMultiplier: number },
    tick: number,
    sessionId: string | null,
    voidEntropy: number,
  ): CollapseEvent {
    const category: CollapseEvent['category'] = SOVEREIGN_CORES.has(hexId)
      ? 'sovereign'
      : BOUNDARY_ATTRACTORS.has(hexId)
      ? 'boundary'
      : FORBIDDEN_ADJACENT.has(hexId)
      ? 'dissipator'
      : 'transformer';

    return {
      type: 'collapse',
      tick,
      hexagram_id: hexId,
      hexagram_binary: HEXAGRAM_BINARIES[hexId] || '000000',
      action: HEXAGRAM_ACTIONS[hexId] || 'ADAPT',
      fidelity: governor.causalConfidence,
      phase_multiplier: governor.phaseMultiplier,
      causal_confidence: governor.causalConfidence,
      category,
      session_id: sessionId,
      timestamp: Date.now(),
    };
  }

  private detectTotalAnnihilation(currentEntropy: number): { collective: string; collectiveId: number; result: string; resultId: number } | null {
    if (currentEntropy < 0.98) return null;
    return {
      collective: COLLECTIVE_OPPOSITION_BINARY,
      collectiveId: COLLECTIVE_OPPOSITION_HEXAGRAM_ID,
      result: CARD5_TRANSFORMATION_BINARY,
      resultId: CARD5_TRANSFORMATION_HEXAGRAM_ID,
    };
  }

  private buildTotalAnnihilationCollapse(
    governor: { causalConfidence: number; phaseMultiplier: number },
    tick: number,
    sessionId: string | null,
    voidEntropy: number,
    annihilation: { collective: string; collectiveId: number; result: string; resultId: number },
  ): CollapseEvent {
    const hexId = annihilation.resultId;
    return {
      type: 'collapse',
      tick,
      hexagram_id: hexId,
      hexagram_binary: annihilation.result,
      action: CARD5_ACTION,
      fidelity: CARD5_FIDELITY,
      phase_multiplier: CARD5_PHASE_MULTIPLIER,
      causal_confidence: governor.causalConfidence,
      category: 'sovereign',
      session_id: sessionId,
      timestamp: tick * 640,
    };
  }
}

// ─── Helpers ───────────────────────────────────────────────────────

function getCategory(hexId: number): 'sovereign' | 'boundary' | 'transformer' | 'dissipator' {
  if (SOVEREIGN_CORES.has(hexId)) return 'sovereign';
  if (BOUNDARY_ATTRACTORS.has(hexId)) return 'boundary';
  if (FORBIDDEN_ADJACENT.has(hexId)) return 'dissipator';
  return 'transformer';
}

function getAction(hexId: number): 'ASSERT' | 'YIELD' | 'ADAPT' | 'WAIT' {
  return HEXAGRAM_ACTIONS[hexId] || 'ADAPT';
}

function buildReflection(path: EvaluatedHexPath | undefined, context: 'past' | 'present' | 'future'): string {
  if (!path) return 'The oracle awaits clearer signals.';
  const name = HEXAGRAM_NAMES[path.hexagramId] || `Hexagram #${path.hexagramId}`;
  if (context === 'past') return `In the past, ${name} shaped prior outcomes through ${path.action.toLowerCase()}.`;
  if (context === 'present') return `Now, ${name} dominates the current field with emotional weight ${path.emotion.toFixed(2)}.`;
  return `Ahead, ${name} resolves through stable fidelity ${path.fidelity.toFixed(2)} and voice weight ${path.voiceWeight.toFixed(2)}.`;
}

const HEXAGRAM_NAMES: Record<number, string> = {
  1: 'The Creative (Qian)', 2: 'The Receptive (Kun)', 3: 'Difficulty at the Beginning',
  4: 'Youthful Folly', 5: 'Waiting', 6: 'Conflict',
  7: 'The Army', 8: 'Holding Together', 9: 'Taming Power of the Small',
  10: 'Treading', 11: 'Peace', 12: 'Standstill',
  13: 'Fellowship with Men', 14: 'Possession in Great Measure', 15: 'Modesty',
  16: 'Enthusiasm', 17: 'Following', 18: 'Work on Decayed',
  19: 'Approach', 20: 'Contemplation', 21: 'Biting Through',
  22: 'Grace', 23: 'Splitting Apart', 24: 'Return',
  25: 'Innocence', 26: 'Taming Power of the Great', 27: 'Nourishment',
  28: 'Great Preponderance', 29: 'The Abysmal', 30: 'The Clinging (Li)',
  31: 'Influence', 32: 'Duration', 33: 'Retreat',
  34: 'Great Power', 35: 'Progress', 36: 'Darkening of the Light',
  37: 'The Family', 38: 'Opposition', 39: 'Obstruction',
  40: 'Deliverance', 41: 'Decrease', 42: 'Increase',
  43: 'Breakthrough', 44: 'Coming to Meet', 45: 'Gathering Together',
  46: 'Pushing Upward', 47: 'Oppression', 48: 'The Well',
  49: 'Revolution', 50: 'The Cauldron', 51: 'The Arousing (Shock)',
  52: 'Keeping Still', 53: 'Development', 54: 'The Marrying Maiden',
  55: 'Abundance', 56: 'The Wanderer', 57: 'The Gentle (Wind)',
  58: 'The Joyous (Lake)', 59: 'Dispersion', 60: 'Limitation',
  61: 'Inner Truth', 62: 'Small Preponderance', 63: 'After Completion',
  64: 'Before Completion',
};

// ─── Worker Export ─────────────────────────────────────────────────

export default {
  async queue(batch: MessageBatch<TickSignal>, env: Env, ctx: ExecutionContext): Promise<void> {
    const engine = new WeaveEngine(
      parseInt(env.BEAT_INTERVAL_MS || '640'),
      parseFloat(env.MAX_COMPUTE_MS || '50'),
      parseInt(env.ATTRACTOR_PERSISTENCE || '5'),
      parseInt(env.VOID_REENTRY_DEPTH || '5'),
    );

    for (const message of batch.messages) {
      const signal = message.body;
      try {
        const threatDensity = 0.1;
        const avgConfidence = 0.85;
        const computePressure = 0.05;

        const collapse = engine.processBeat(
          signal.tick,
          signal.sessionId,
          threatDensity,
          avgConfidence,
          computePressure,
        );

        const key = `oracle:${collapse.tick}:${collapse.hexagram_id}:${await hashPrefix(JSON.stringify(collapse))}`;
        await env.POG2_SOVEREIGN.put(key, JSON.stringify(collapse), {
          metadata: { hash: await fullHash(JSON.stringify(collapse)), timestamp: collapse.timestamp },
        });

        await env.POG2_COLLAPSE_QUEUE.send(collapse);
        message.ack();
      } catch (error) {
        console.error(`Weave Worker failed on tick ${signal.tick}:`, error);
        message.retry();
      }
    }
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/weave/trigger' && request.method === 'POST') {
      const body = await request.json() as { tick?: number; sessionId?: string };
      const tick = body.tick || Math.floor(Date.now() / 640);
      const signal: TickSignal = {
        type: 'tick',
        tick,
        timestamp: Date.now(),
        sessionId: body.sessionId || null,
      };
      await env.POG2_COLLAPSE_QUEUE.send(signal);
      return new Response(JSON.stringify({ status: 'tick queued', tick }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/weave/consult' && request.method === 'POST') {
      const body = await request.json() as {
        text?: string;
        session_id?: string;
        state_str?: string;
        tick?: number;
      };

      const queryText = String(body.text || '').trim();
      if (!queryText) {
        return new Response(JSON.stringify({ error: 'BAD_QUERY', message: 'text is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const engine = new WeaveEngine();
      const tick = Number.isInteger(body.tick) ? (body.tick as number) : Math.floor(Date.now() / 640);
      const sessionId = body.session_id || 'anon';

      try {
        const { oracleState, consoleResolve } = await engine.evaluateForConsult(env, tick, sessionId, queryText, 0.7, 0.1);

        return new Response(JSON.stringify({
          mode: 'weave-evaluate',
          tick: oracleState.tick,
          sessionId: oracleState.sessionId,
          query: queryText,
          resolvedEmotion: consoleResolve.resolvedEmotion,
          temporalContexts: consoleResolve.temporalContexts,
          unifiedAnswer: consoleResolve.unifiedAnswer,
          categorySubset: consoleResolve.categorySubset,
          evaluatedPathCount: oracleState.evaluatedPaths.length,
          emotionalPoolSource: oracleState.emotionalPool.source,
          state_str: serializeOracleState(oracleState),
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'WEAVE_CONSULT_FAILED', message: String(err) }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env, TickSignal>;

// ─── Hash Helpers ──────────────────────────────────────────────────

async function hashPrefix(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf))
    .slice(0, 4)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function fullHash(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
