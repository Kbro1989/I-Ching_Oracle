/**
 * POG2 Drift Worker — Temporal Drift Engine
 * Cloudflare Workers native implementation
 *
 * NOTE: Hexagram binary mapping is imported from weave.ts registry
 * to guarantee uniqueness. Do not add a second local binary map.
 */

import type { Env } from '../index';
import { HEXAGRAM_BINARIES } from './weave';

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
//
// Binary map removed. Consumers must use HEXAGRAM_BINARIES from weave.ts.
// This eliminates the duplicate-entry failure mode.

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
    const currentBin = HEXAGRAM_BINARIES[currentHex] || '000000';
    let shellDistance = 6;
    for (const adj of FORBIDDEN_ADJACENT) {
      const adjBin = HEXAGRAM_BINARIES[adj] || '000000';
      const dist = hammingDistance(currentBin, adjBin);
      shellDistance = Math.min(shellDistance, dist);
    }

    const entropyProximity = currentEntropy;

    let projectedHex = currentHex;
    let projectedBin = currentBin;
    const driftDirection = driftVector.hex_delta > 0 ? 1 : -1;
    for (let t = 0; t < 5; t++) {
      const bitToFlip = (projectedHex + t) % 6;
      const bits = projectedBin.split('');
      bits[bitToFlip] = bits[bitToFlip] === '0' ? '1' : '0';
      projectedBin = bits.join('');
    }
    let projectedShell = 6;
    for (const adj of FORBIDDEN_ADJACENT) {
      const dist = hammingDistance(projectedBin, HEXAGRAM_BINARIES[adj] || '000000');
      projectedShell = Math.min(projectedShell, dist);
    }

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
}

// ─── Worker Export ─────────────────────────────────────────────────

export default {
  async queue(batch: MessageBatch<CollapseEvent>, env: Env, ctx: ExecutionContext): Promise<void> {
    const engine = new DriftEngine();

    for (const message of batch.messages) {
      const collapse = message.body;
      const sessionId = collapse.session_id || `orphan-${collapse.tick}`;

      try {
        const prevKey = `drift:prev:${sessionId}`;
        const prevRaw = await env.POG2_SOVEREIGN.get(prevKey);
        const previous: CollapseEvent | null = prevRaw ? JSON.parse(prevRaw) : null;

        const driftVector = engine.computeDriftVector(previous, collapse);

        const entropyDecay = engine.computeEntropyDecay(
          sessionId,
          collapse.tick,
          collapse.causal_confidence,
          0,
          2,
        );

        const proximity = engine.detectForbiddenProximity(
          collapse.hexagram_id,
          collapse.causal_confidence,
          driftVector,
          [],
        );

        const trajectoryEntry = {
          session_id: sessionId,
          tick: collapse.tick,
          source_hex: previous?.hexagram_id || collapse.hexagram_id,
          target_hex: collapse.hexagram_id,
          ...driftVector,
          timestamp: collapse.timestamp,
        };
        const trajHash = await fullHash(JSON.stringify(trajectoryEntry));
        const trajKey = `drift:${sessionId}:${collapse.tick}:${trajHash.slice(0, 8)}`;
        await env.POG2_SOVEREIGN.put(trajKey, JSON.stringify(trajectoryEntry), {
          metadata: { hash: trajHash, timestamp: trajectoryEntry.timestamp },
        });

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

        await env.POG2_SOVEREIGN.put(prevKey, JSON.stringify(collapse), {
          expirationTtl: 86400,
        });

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
          timestamp: collapse.timestamp,
        };

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
            timestamp: collapse.timestamp,
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
      return new Response(JSON.stringify({ status: 'eye_open' }), {
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
