/**
 * POG2 Drift Worker — Temporal Drift Engine
 * Cloudflare Workers native implementation
 * Consumes collapse events from Weave Worker via POG2_COLLAPSE_QUEUE
 * Computes 6-component drift vectors, entropy decay, forbidden-state proximity
 * Emits drift events to Continuity Worker via POG2_DRIFT_QUEUE
 */

import type { Env } from '../index';

// ─── Message Types ─────────────────────────────────────────────────

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

export interface DriftEvent {
  type: 'drift';
  tick: number;
  session_id: string;
  drift_vector: {
    hex_delta: number;
    action_delta: 0 | 1;
    category_delta: 0 | 1;
    entropy_delta: number;
    fidelity_delta: number;
    phase_delta: number;
    magnitude: number;
    direction: 'sovereign' | 'boundary' | 'transformer' | 'dissipator';
  };
  trajectory_log_key: string;
  entropy_curve_id: number | null;
  crisis_level: 0 | 1 | 2 | 3;
  shell_distance: number;
  projected_shell: number;
  timestamp: number;
}

// ─── Hexagram Data ─────────────────────────────────────────────────

const HEXAGRAM_ACTIONS: Record<number, 'ASSERT' | 'YIELD' | 'ADAPT' | 'WAIT'> = {
  1: 'ASSERT', 2: 'YIELD', 3: 'ADAPT', 4: 'WAIT', 5: 'WAIT', 6: 'ASSERT',
  7: 'ASSERT', 8: 'YIELD', 9: 'ADAPT', 10: 'ADAPT', 11: 'YIELD', 12: 'WAIT',
  13: 'ASSERT', 14: 'ASSERT', 15: 'YIELD', 16: 'ASSERT', 17: 'ADAPT', 18: 'ADAPT',
  19: 'ADAPT', 20: 'WAIT', 21: 'ASSERT', 22: 'YIELD', 23: 'WAIT', 24: 'ADAPT',
  25: 'YIELD', 26: 'ASSERT', 27: 'ADAPT', 28: 'ASSERT', 29: 'WAIT', 30: 'ASSERT',
  31: 'ADAPT', 32: 'WAIT', 33: 'WAIT', 34: 'ASSERT', 35: 'ADAPT', 36: 'YIELD',
  37: 'ASSERT', 38: 'ADAPT', 39: 'WAIT', 40: 'ADAPT', 41: 'YIELD', 42: 'ASSERT',
  43: 'ASSERT', 44: 'ADAPT', 45: 'YIELD', 46: 'ADAPT', 47: 'WAIT', 48: 'WAIT',
  49: 'ASSERT', 50: 'ADAPT', 51: 'ASSERT', 52: 'WAIT', 53: 'ADAPT', 54: 'YIELD',
  55: 'ASSERT', 56: 'ADAPT', 57: 'YIELD', 58: 'ADAPT', 59: 'WAIT', 60: 'YIELD',
  61: 'YIELD', 62: 'ADAPT', 63: 'WAIT', 64: 'ADAPT',
};

const SOVEREIGN_CORES = new Set([7, 10, 16, 18, 19, 53, 56, 57, 61, 62]);
const BOUNDARY_ATTRACTORS = new Set([1, 25, 26, 30, 38, 41, 49]);
const FORBIDDEN_ADJACENT = new Set([9, 14, 15, 17, 18, 22, 23, 31, 43, 44, 48, 52, 55, 56, 59, 61, 62, 63]);

// ─── Hamming Distance ──────────────────────────────────────────────

function hammingDistance(bin1: string, bin2: string): number {
  let dist = 0;
  for (let i = 0; i < Math.min(bin1.length, bin2.length); i++) {
    if (bin1[i] !== bin2[i]) dist++;
  }
  return dist;
}

function getCategory(hexId: number): 'sovereign' | 'boundary' | 'transformer' | 'dissipator' {
  if (SOVEREIGN_CORES.has(hexId)) return 'sovereign';
  if (BOUNDARY_ATTRACTORS.has(hexId)) return 'boundary';
  if (FORBIDDEN_ADJACENT.has(hexId)) return 'dissipator';
  return 'transformer';
}

// ─── Drift Engine ────────────────────────────────────────────────

class DriftEngine {
  private previousStates: Map<string, CollapseEvent> = new Map(); // session_id -> last collapse
  private entropyHistory: Map<string, number[]> = new Map(); // session_id -> entropy values
  private persistenceCounts: Map<string, number> = new Map(); // session_id -> persistence count

  /**
   * Compute drift vector between previous and current collapse
   */
  computeDriftVector(previous: CollapseEvent | null, current: CollapseEvent): DriftEvent['drift_vector'] {
    const hexDelta = previous
      ? hammingDistance(previous.hexagram_binary, current.hexagram_binary)
      : 0;

    const actionDelta: 0 | 1 = previous && previous.action !== current.action ? 1 : 0;
    const categoryDelta: 0 | 1 = previous && previous.category !== current.category ? 1 : 0;
    const entropyDelta = previous ? current.causal_confidence - previous.causal_confidence : 0;
    const fidelityDelta = previous ? current.fidelity - previous.fidelity : 0;
    const phaseDelta = previous ? current.phase_multiplier - previous.phase_multiplier : 0;

    const magnitude = Math.sqrt(
      hexDelta * hexDelta +
      actionDelta * actionDelta +
      categoryDelta * categoryDelta +
      entropyDelta * entropyDelta +
      fidelityDelta * fidelityDelta +
      phaseDelta * phaseDelta
    );

    return {
      hex_delta: hexDelta,
      action_delta: actionDelta,
      category_delta: categoryDelta,
      entropy_delta: entropyDelta,
      fidelity_delta: fidelityDelta,
      phase_delta: phaseDelta,
      magnitude,
      direction: current.category,
    };
  }

  /**
   * Compute entropy decay curves
   */
  computeEntropyDecay(
    sessionId: string,
    tick: number,
    currentEntropy: number,
    persistenceCount: number,
    shellDistance: number,
  ): {
    base_entropy: number;
    natural_decay: number;
    forced_decay: number;
    crisis_decay: number;
    composite_entropy: number;
    void_reentry_depth: number;
  } {
    const baseEntropy = 0.999;
    const naturalDecay = -0.01 * tick;
    const forcedDecay = -0.05 * persistenceCount;
    const crisisDecay = shellDistance > 0 ? 0.1 * (1 / shellDistance) : 0.5;

    let composite = baseEntropy + naturalDecay + forcedDecay + crisisDecay;
    composite = Math.max(0.0, Math.min(0.999, composite));

    return {
      base_entropy: baseEntropy,
      natural_decay: naturalDecay,
      forced_decay: forcedDecay,
      crisis_decay: crisisDecay,
      composite_entropy: composite,
      void_reentry_depth: 5,
    };
  }

  /**
   * Detect forbidden-state proximity
   */
  detectForbiddenProximity(
    currentHex: number,
    currentEntropy: number,
    driftVector: DriftEvent['drift_vector'],
    history: number[],
  ): {
    level: 0 | 1 | 2 | 3;
    shellDistance: number;
    entropyProximity: number;
    projectedShell: number;
  } {
    // Shell distance: min Hamming distance to any forbidden-adjacent hexagram
    const currentBin = this.getHexBinary(currentHex);
    let shellDistance = 6;
    for (const adj of FORBIDDEN_ADJACENT) {
      const adjBin = this.getHexBinary(adj);
      const dist = hammingDistance(currentBin, adjBin);
      shellDistance = Math.min(shellDistance, dist);
    }

    // Entropy proximity
    const entropyProximity = currentEntropy;

    // Trajectory projection: if drift continues, where do we land in 5 ticks?
    let projectedHex = currentHex;
    let projectedBin = currentBin;
    // Simple projection: flip bits in direction of drift
    const driftDirection = driftVector.hex_delta > 0 ? 1 : -1;
    for (let t = 0; t < 5; t++) {
      // Flip one bit per step in a deterministic way
      const bitToFlip = (projectedHex + t) % 6;
      const bits = projectedBin.split('');
      bits[bitToFlip] = bits[bitToFlip] === '0' ? '1' : '0';
      projectedBin = bits.join('');
    }
    let projectedShell = 6;
    for (const adj of FORBIDDEN_ADJACENT) {
      const dist = hammingDistance(projectedBin, this.getHexBinary(adj));
      projectedShell = Math.min(projectedShell, dist);
    }

    // Determine level
    let level: 0 | 1 | 2 | 3 = 0;
    if (shellDistance === 0 || projectedShell === 0) {
      level = 3;
    } else if (shellDistance === 1 && entropyProximity >= 0.9) {
      level = 2;
    } else if (shellDistance === 1 && entropyProximity < 0.9) {
      level = 1;
    } else if (entropyProximity >= 0.8) {
      level = 1;
    }

    return { level, shellDistance, entropyProximity, projectedShell };
  }

  private getHexBinary(hexId: number): string {
    const binaries: Record<number, string> = {
      1: '111111', 2: '000000', 3: '100010', 4: '010001', 5: '111010', 6: '010111',
      7: '010000', 8: '000010', 9: '111011', 10: '110111', 11: '111000', 12: '000111',
      13: '111101', 14: '101111', 15: '001000', 16: '000100', 17: '100110', 18: '011001',
      19: '110000', 20: '000011', 21: '100101', 22: '101001', 23: '000001', 24: '100000',
      25: '100111', 26: '111001', 27: '100001', 28: '011110', 29: '010010', 30: '101101',
      31: '001110', 32: '011100', 33: '001111', 34: '111100', 35: '000101', 36: '101000',
      37: '101011', 38: '100011', 39: '010100', 40: '010100', 41: '110011', 42: '001100',
      43: '111110', 44: '011111', 45: '000110', 46: '011000', 47: '010110', 48: '011010',
      49: '101011', 50: '001101', 51: '100001', 52: '001011', 53: '100100', 54: '001001',
      55: '101100', 56: '001101', 57: '010110', 58: '011011', 59: '010011', 60: '110110',
      61: '101100', 62: '011001', 63: '101010', 64: '010101',
    };
    return binaries[hexId] || '000000';
  }
}

// ─── Worker Export ─────────────────────────────────────────────────

export default {
  async queue(batch: MessageBatch<CollapseEvent>, env: Env, ctx: ExecutionContext): Promise<void> {
    const engine = new DriftEngine();

    for (const message of batch.messages) {
      const collapse = message.body;
      const sessionId = collapse.session_id || `orphan-${collapse.tick}`;

      try {
        // Retrieve previous collapse from Sovereign KV for this session
        const prevKey = `drift:prev:${sessionId}`;
        const prevRaw = await env.POG2_SOVEREIGN.get(prevKey);
        const previous: CollapseEvent | null = prevRaw ? JSON.parse(prevRaw) : null;

        // Compute drift vector
        const driftVector = engine.computeDriftVector(previous, collapse);

        // Compute entropy decay
        const entropyDecay = engine.computeEntropyDecay(
          sessionId,
          collapse.tick,
          collapse.causal_confidence,
          0, // persistence count from continuity layer
          2, // default shell distance
        );

        // Detect forbidden-state proximity
        const proximity = engine.detectForbiddenProximity(
          collapse.hexagram_id,
          collapse.causal_confidence,
          driftVector,
          [], // history would be fetched from KV
        );

        // Store trajectory log to Sovereign KV
        const trajectoryEntry = {
          session_id: sessionId,
          tick: collapse.tick,
          source_hex: previous?.hexagram_id || collapse.hexagram_id,
          target_hex: collapse.hexagram_id,
          ...driftVector,
          timestamp: Date.now(),
        };
        const trajHash = await fullHash(JSON.stringify(trajectoryEntry));
        const trajKey = `drift:${sessionId}:${collapse.tick}:${trajHash.slice(0, 8)}`;
        await env.POG2_SOVEREIGN.put(trajKey, JSON.stringify(trajectoryEntry), {
          metadata: { hash: trajHash, timestamp: trajectoryEntry.timestamp },
        });

        // Store entropy curve to Boundary D1
        let entropyCurveId: number | null = null;
        try {
          const result = await env.POG2_BOUNDARY.prepare(
            `INSERT INTO entropy_curves (session_id, tick, base_entropy, natural_decay, forced_decay, crisis_decay, composite_entropy, void_reentry_depth)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(session_id, tick) DO UPDATE SET
               base_entropy = excluded.base_entropy,
               natural_decay = excluded.natural_decay,
               forced_decay = excluded.forced_decay,
               crisis_decay = excluded.crisis_decay,
               composite_entropy = excluded.composite_entropy`
          ).bind(
            sessionId, collapse.tick,
            entropyDecay.base_entropy, entropyDecay.natural_decay,
            entropyDecay.forced_decay, entropyDecay.crisis_decay,
            entropyDecay.composite_entropy, entropyDecay.void_reentry_depth
          ).run();
          entropyCurveId = result.meta.last_row_id || null;
        } catch (dbErr) {
          console.error('Failed to store entropy curve:', dbErr);
        }

        // Store current collapse as "previous" for next tick
        await env.POG2_SOVEREIGN.put(prevKey, JSON.stringify(collapse), {
          expirationTtl: 86400, // 24 hours
        });

        // Build and emit drift event
        const driftEvent: DriftEvent = {
          type: 'drift',
          tick: collapse.tick,
          session_id: sessionId,
          drift_vector: driftVector,
          trajectory_log_key: trajKey,
          entropy_curve_id: entropyCurveId,
          crisis_level: proximity.level,
          shell_distance: proximity.shellDistance,
          projected_shell: proximity.projectedShell,
          timestamp: Date.now(),
        };

        // If crisis level 3, emit to crisis queue immediately
        if (proximity.level === 3) {
          await env.POG2_CRISIS_QUEUE.send({
            type: 'crisis',
            crisis_id: `crisis-${sessionId}-${collapse.tick}`,
            level: 3,
            indicators: {
              level3ProximityAlerts: 1,
              dissipatorSpike: false,
              coherenceDecay: false,
              sovereignErosion: false,
              darkToneAccumulation: false,
            },
            response: 'emergency_sovereign_collapse',
            timestamp: Date.now(),
          });
        }

        await env.POG2_DRIFT_QUEUE.send(driftEvent);
        message.ack();
      } catch (error) {
        console.error(`Drift Worker failed on tick ${collapse.tick}:`, error);
        message.retry();
      }
    }
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/drift/status' && request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'eye_open', timestamp: Date.now() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env, CollapseEvent>;

async function fullHash(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}