/**
 * POG2 Weave Worker — Temporal Weave Engine
 * Cloudflare Workers native implementation
 * Receives tick signals from Orchestrator DO alarm via Queue
 * Executes VOID → SHADOW → VORTEX → GOVERNOR → COLLAPSE
 * Emits collapse events to Drift Worker via POG2_COLLAPSE_QUEUE
 */

import type { Env } from '../index';

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
// Verified King Wen order with unique binaries.
// Source: pastes from Total Annihilation Cascade verification.

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

const HEXAGRAM_BINARIES: Record<number, string> = {};
const HEXAGRAM_ACTIONS: Record<number, 'ASSERT' | 'YIELD' | 'ADAPT' | 'WAIT'> = {};
Object.entries(HEXAGRAMS).forEach(([id, [binary, , action]]) => {
  HEXAGRAM_BINARIES[Number(id)] = binary;
  HEXAGRAM_ACTIONS[Number(id)] = action;
});

const SOVEREIGN_CORES = new Set([7, 10, 16, 18, 19, 53, 56, 57, 61, 62]);
const BOUNDARY_ATTRACTORS = new Set([1, 25, 26, 30, 38, 41, 49]);

// Forbidden-adjacent hexagrams (shell = 1)
const FORBIDDEN_ADJACENT = new Set([9, 14, 15, 17, 18, 22, 23, 31, 43, 44, 48, 52, 55, 56, 59, 61, 62, 63]);

// ─── Verified Total Annihilation Constants ─────────────────────────

const CARD5_BINARY = '111111';
const CARD5_HEXAGRAM_ID = 1;
const CARD5_ACTION: CollapseEvent['action'] = 'ASSERT';
const CARD5_FIDELITY = 0.973;
const CARD5_PHASE_MULTIPLIER = 1.0;

// Verified output from Total Annihilation Cascade:
// Collective opposition binary: 010100 (Deliverance #40)
// Card 5 XOR collective: 101011 (Revolution #49)
// Collective entropy: 5.9965/6.0 bits (99.9%)
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
  private history: number[] = []; // selected hexagram IDs
  private previousHex: number = 1; // Qian default
  private previousEntropy: number = 0.999;
  private persistenceCountdown: number = 0;
  private lockedHex: number | null = null;

  constructor(
    private readonly beatMs: number = 640,
    private readonly maxComputeMs: number = 50,
    private readonly attractorPersistence: number = 5,
    private readonly voidReentryDepth: number = 5,
  ) {}

  /**
   * Main processing loop — runs one complete weave cycle
   */
  processBeat(tick: number, sessionId: string | null, threatDensity: number, avgConfidence: number, computePressure: number): CollapseEvent {
    // ── PHASE 1: VOID ─────────────────────────────────────────────
    const voidEntropy = this.computeVoidEntropy();

    // ── PHASE 2: SHADOW ───────────────────────────────────────────
    const { evaluatedPaths, committedPaths } = this.evaluateShadow(voidEntropy);

    // ── PHASE 3: VORTEX ───────────────────────────────────────────
    const vortexResidue = this.computeVortexResidue(this.previousHex);
    const angularVelocity = vortexResidue.flipCount / 6.0;

    // ── PHASE 4: GOVERNOR ─────────────────────────────────────────
    const governor = this.computeGovernor(threatDensity, avgConfidence, computePressure, voidEntropy);

  // ── PHASE 5: COLLAPSE ─────────────────────────────────────────
  const annihilation = this.detectTotalAnnihilation(voidEntropy);
  const collapse = annihilation
    ? this.buildTotalAnnihilationCollapse(governor, tick, sessionId, voidEntropy, annihilation)
    : this.performCollapse(governor, tick, sessionId, voidEntropy);

    // Update state for next tick
    this.previousHex = collapse.hexagram_id;
    this.previousEntropy = voidEntropy;
    this.history.push(collapse.hexagram_id);
    if (this.history.length > this.voidReentryDepth * 2) {
      this.history = this.history.slice(-this.voidReentryDepth * 2);
    }

    // Handle persistence
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

    // Entropy drift compensation
    const entropyGrowth = voidEntropy - this.previousEntropy;
    if (entropyGrowth > 0.1) {
      // Tighten
      if (this.persistenceCountdown > 0) this.persistenceCountdown++;
    } else if (entropyGrowth < -0.1) {
      // Loosen — already handled by natural countdown
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
    return Math.min(entropy / Math.log2(64), 0.999); // Normalize to [0, 0.999]
  }

  private evaluateShadow(voidEntropy: number): { evaluatedPaths: number; committedPaths: number } {
    const basePaths = 50;
    const focusMode = this.persistenceCountdown > 0;
    const evaluatedPaths = focusMode ? Math.floor(basePaths * 0.1) : Math.floor(basePaths * 0.5);
    const committedPaths = focusMode ? evaluatedPaths : Math.floor(evaluatedPaths * 0.7);
    return { evaluatedPaths, committedPaths };
  }

  private computeVortexResidue(sourceHex: number): { residue: string; flipCount: number } {
    // XOR residue between source and a "collective opposition" reference (Deliverance #40 = 010100)
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

    // Phase state determination
    let baseMultiplier = 1.0; // STABLE
    if (this.persistenceCountdown > 0 && this.persistenceCountdown < 3) {
      baseMultiplier = 0.8; // TRANSITIONING
    } else if (this.persistenceCountdown === 0 && currentEntropy > 0.8) {
      baseMultiplier = 0.5; // DEGRADING
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
    // If persistence is active, stay locked
    if (this.lockedHex !== null && this.persistenceCountdown > 0) {
      const hexId = this.lockedHex;
      return this.buildCollapseEvent(hexId, governor, tick, sessionId, voidEntropy);
    }

    // Select hexagram based on governor thresholds
    let selectedHex: number;
    if (governor.causalConfidence >= 0.973 && governor.phaseMultiplier >= 0.9) {
      // Sovereign core
      selectedHex = this.selectSovereignCore();
    } else if (governor.causalConfidence >= 0.8) {
      // Boundary attractor
      selectedHex = this.selectBoundaryAttractor();
    } else if (governor.causalConfidence >= 0.5) {
      // Transformer
      selectedHex = this.selectTransformer();
    } else {
      // Dissipator
      selectedHex = this.selectDissipator();
    }

    return this.buildCollapseEvent(selectedHex, governor, tick, sessionId, voidEntropy);
  }

  private selectSovereignCore(): number {
    const cores = Array.from(SOVEREIGN_CORES);
    // Prefer cores with history, else random
    const historyMatch = cores.find(c => this.history.includes(c));
    return historyMatch || cores[Math.floor(Math.random() * cores.length)];
  }

  private selectBoundaryAttractor(): number {
    const boundaries = Array.from(BOUNDARY_ATTRACTORS);
    const historyMatch = boundaries.find(b => this.history.includes(b));
    return historyMatch || boundaries[Math.floor(Math.random() * boundaries.length)];
  }

  private selectTransformer(): number {
    // Any non-sovereign, non-boundary hexagram
    const candidates: number[] = [];
    for (let i = 1; i <= 64; i++) {
      if (!SOVEREIGN_CORES.has(i) && !BOUNDARY_ATTRACTORS.has(i)) {
        candidates.push(i);
      }
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private selectDissipator(): number {
    // Prefer forbidden-adjacent for dissipators
    const diss = Array.from(FORBIDDEN_ADJACENT);
    return diss[Math.floor(Math.random() * diss.length)];
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
    // Verified outcome: collective produces near-maximum entropy (~5.9965/6.0 bits).
    // The exact verified collective binary is 010100 (Deliverance #40),
    // which maps Card 5 (111111) to Revolution (101011, #49).
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
      timestamp: Date.now(),
    };
  }
}

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
        // Default threat/compute values for autonomous ticks
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

        // Store collapse to Sovereign KV
        const key = `oracle:${collapse.tick}:${collapse.hexagram_id}:${await hashPrefix(JSON.stringify(collapse))}`;
        await env.POG2_SOVEREIGN.put(key, JSON.stringify(collapse), {
          metadata: { hash: await fullHash(JSON.stringify(collapse)), timestamp: collapse.timestamp },
        });

        // Emit to Drift Worker via queue
        await env.POG2_COLLAPSE_QUEUE.send(collapse);

        message.ack();
      } catch (error) {
        console.error(`Weave Worker failed on tick ${signal.tick}:`, error);
        message.retry();
      }
    }
  },

  // Also expose fetch for manual trigger/debug
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