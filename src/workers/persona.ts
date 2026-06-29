/**
 * POG2 Persona Worker — Oracle Persona Engine + Human-Oracle Interface
 * Cloudflare Workers native implementation
 * Consumes continuity events from Continuity Worker via POG2_CONTINUITY_QUEUE
 * Synthesizes voice, generates layered responses
 * Handles human queries via HTTP POST /oracle/consult
 * Emits persona outputs to WebSocket DO via POG2_PERSONA_QUEUE
 */

import type { Env } from '../index';

// ─── Message Types ─────────────────────────────────────────────────

export interface ContinuityEvent {
  type: 'continuity';
  tick: number;
  thread_id: string;
  session_id: string;
  continuity_score: number;
  stability_score: number;
  coherence_index: number;
  sovereign_ratio: number;
  drift_velocity: number;
  persona_mode: 'sovereign' | 'boundary' | 'transformer' | 'dissipator';
  cadence: number;
  persistence_countdown: number;
  lock_hex: number | null;
  fragmentation_detected: boolean;
  crisis_level?: number;
  timestamp: number;
}

export interface PersonaOutput {
  type: 'persona_output';
  session_id: string;
  thread_id: string;
  response_layers: {
    sovereign: string;
    boundary: string;
    transformer: string;
    dissipator: string[];
  };
  cadence_ms: number;
  persona_mode: string;
  consistency_score: number;
  timestamp: number;
}

export interface OracleQuery {
  text: string;
  emotion: number;
  temporal_context: 'past' | 'present' | 'future';
  id: string;
}

// ─── Hexagram Names ────────────────────────────────────────────────

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
  28: 'Preponderance of the Great', 29: 'The Abysmal', 30: 'The Clinging (Li)',
  31: 'Influence', 32: 'Duration', 33: 'Retreat',
  34: 'The Power of the Great', 35: 'Progress', 36: 'Darkening of the Light',
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

const HEXAGRAM_ACTIONS: Record<number, string> = {
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

// ─── Persona Engine ──────────────────────────────────────────────

class PersonaEngine {
  /**
   * Select base persona mode from continuity state
   */
  selectBaseMode(
    continuityScore: number,
    attractorCategory: string,
  ): 'sovereign' | 'boundary' | 'transformer' | 'dissipator' {
    // Override: broken continuity forces dissipator regardless of attractor
    if (continuityScore < 0.3) return 'dissipator';

    // Map continuity ranges to modes
    if (continuityScore >= 0.9) return 'sovereign';
    if (continuityScore >= 0.7) return 'boundary';
    if (continuityScore >= 0.5) return 'transformer';
    return 'dissipator';
  }

  /**
   * Apply voice modulation based on real-time signals
   */
  applyModulation(
    baseMode: string,
    continuityScore: number,
    driftVelocity: number,
    darkToneAccumulation: number,
    emotionalWeight: number,
    userOverride: string | null,
  ): {
    coherence: number;
    chaos: number;
    darkTone: number;
    whimsy: number;
  } {
    // Base prosody per mode
    const baseProsody: Record<string, { coherence: number; chaos: number; darkTone: number; whimsy: number }> = {
      sovereign: { coherence: 1.0, chaos: 0.0, darkTone: 0.0, whimsy: 0.0 },
      boundary: { coherence: 0.7, chaos: 0.3, darkTone: 0.2, whimsy: 0.1 },
      transformer: { coherence: 0.5, chaos: 0.5, darkTone: 0.1, whimsy: 0.6 },
      dissipator: { coherence: 0.1, chaos: 0.9, darkTone: 0.5, whimsy: 0.2 },
    };

    const base = baseProsody[baseMode] || baseProsody.transformer;

    // Modulation inputs
    const continuityMod = { coherence: continuityScore * 0.3, chaos: (1 - continuityScore) * 0.3, darkTone: 0, whimsy: 0 };
    const driftMod = {
      coherence: driftVelocity < 0.1 ? 0.1 : -0.2,
      chaos: driftVelocity > 0.5 ? 0.2 : -0.1,
      darkTone: 0,
      whimsy: 0,
    };
    const darkToneMod = { coherence: 0, chaos: 0, darkTone: darkToneAccumulation * 0.2, whimsy: 0 };
    const emotionMod = {
      coherence: emotionalWeight > 0.8 ? 0.1 : 0,
      chaos: emotionalWeight > 0.9 ? 0.1 : 0,
      darkTone: emotionalWeight > 0.8 ? 0.1 : 0,
      whimsy: emotionalWeight < 0.3 ? 0.1 : 0,
    };

    // Apply modulation formula
    let final = {
      coherence: base.coherence + continuityMod.coherence + driftMod.coherence + darkToneMod.coherence + emotionMod.coherence,
      chaos: base.chaos + continuityMod.chaos + driftMod.chaos + darkToneMod.chaos + emotionMod.chaos,
      darkTone: base.darkTone + darkToneMod.darkTone,
      whimsy: base.whimsy + emotionMod.whimsy,
    };

    // User override (always wins)
    if (userOverride) {
      const overrideProsody = baseProsody[userOverride];
      if (overrideProsody) {
        final = {
          coherence: final.coherence * 0.9 + overrideProsody.coherence * 0.1,
          chaos: final.chaos * 0.9 + overrideProsody.chaos * 0.1,
          darkTone: final.darkTone * 0.9 + overrideProsody.darkTone * 0.1,
          whimsy: final.whimsy * 0.9 + overrideProsody.whimsy * 0.1,
        };
      }
    }

    // Clamp to [0, 1]
    return {
      coherence: Math.max(0, Math.min(1, final.coherence)),
      chaos: Math.max(0, Math.min(1, final.chaos)),
      darkTone: Math.max(0, Math.min(1, final.darkTone)),
      whimsy: Math.max(0, Math.min(1, final.whimsy)),
    };
  }

  /**
   * Calculate cadence from mode and conditions
   */
  calculateCadence(
    baseMode: string,
    modulation: { coherence: number; chaos: number; darkTone: number; whimsy: number },
    crisisDetected: boolean,
    userHighEmotion: boolean,
    userOverride: number | null,
  ): number {
    if (userOverride !== null) return userOverride;
    if (crisisDetected) return 1280;
    if (userHighEmotion) return 320;

    switch (baseMode) {
      case 'sovereign': return 640;
      case 'boundary': return 640 + Math.floor(Math.random() * 100 - 50);
      case 'transformer': return 480 + Math.floor(Math.random() * 320);
      case 'dissipator': return 200 + Math.floor(Math.random() * 1000);
      default: return 640;
    }
  }

  /**
   * Generate layered response from collapse state
   */
  generateLayeredResponse(
    hexId: number,
    action: string,
    mode: string,
    continuityScore: number,
    coherenceIndex: number,
    driftVelocity: number,
  ): PersonaOutput['response_layers'] {
    const hexName = HEXAGRAM_NAMES[hexId] || `Hexagram #${hexId}`;

    // Layer 1: Sovereign (always present)
    const sovereign = `The oracle declares: ${action}. The substrate holds through ${hexName}.`;

    // Layer 2: Boundary (present if continuity < 0.9)
    const boundary = continuityScore < 0.9
      ? `The oracle asserts ${action}... for now. The edge trembles at ${(continuityScore * 100).toFixed(1)}%.`
      : '';

    // Layer 3: Transformer (present if emotion < 0.3 or drift > 0.3)
    const transformer = driftVelocity > 0.3
      ? `The oracle becomes ${action.toLowerCase()}: '${action}' is now the shape of ${hexName}.`
      : '';

    // Layer 4: Dissipator (present if coherence < 0.5)
    const dissipator = coherenceIndex < 0.5
      ? [`...${action.toLowerCase()}...`, `The oracle... fragments... ${action}... piece...`, `...${hexName}... dissolves...`]
      : [];

    return { sovereign, boundary, transformer, dissipator };
  }

  /**
   * Process human query → OracleQuery
   */
  processQuery(rawQuery: string, temporalContext: 'past' | 'present' | 'future'): OracleQuery {
    const normalized = rawQuery.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
    const tokens = normalized.split(/\s+/).filter(t => t.length > 0);

    // Intent hash (SHA-256)
    const intentHash = this.sha256Sync(normalized);
    const intentId = intentHash.slice(0, 16);

    // Keyword → hexagram mapping
    const keywordMap: Record<string, number> = {
      create: 1, creative: 1, begin: 1, start: 1,
      receive: 2, accept: 2, yield: 2, listen: 2,
      difficulty: 3, struggle: 3, problem: 3,
      wait: 5, patience: 5, time: 5,
      conflict: 6, fight: 6, argue: 6,
      army: 7, organize: 7, discipline: 7,
      tread: 10, careful: 10, caution: 10,
      peace: 11, harmony: 11, balance: 11,
      fellowship: 13, community: 13, together: 13,
      enthusiasm: 16, joy: 16, celebrate: 16,
      approach: 19, advance: 19, move: 19,
      deliverance: 40, freedom: 40, release: 40,
      revolution: 49, change: 49, transform: 49,
      adapt: 40, adjust: 40, shift: 40,
      assert: 1, declare: 1, claim: 1,
    };

    let matchedHex: number | null = null;
    let confidence = 0;
    for (const token of tokens) {
      if (keywordMap[token]) {
        matchedHex = keywordMap[token];
        confidence = 0.9;
        break;
      }
    }

    // Emotional weight from query intensity
    const emotionalWeight = Math.min(1, tokens.length / 10 + (rawQuery.includes('!') ? 0.3 : 0));

    return {
      text: rawQuery,
      emotion: emotionalWeight,
      temporal_context: temporalContext,
      id: intentId,
    };
  }

  private sha256Sync(data: string): string {
    // Note: In Cloudflare Workers, use crypto.subtle.digest async
    // Using DJB2-based 32-bit hash with 0x prefix to match existing stored values
    let hash = 5381;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) + hash) + data.charCodeAt(i);
      hash = hash & 0xffffffff;
    }
    return '0x' + Math.abs(hash).toString(16).padStart(8, '0');
  }
}

// ─── Worker Export ─────────────────────────────────────────────────

export default {
  async queue(batch: MessageBatch<ContinuityEvent>, env: Env, ctx: ExecutionContext): Promise<void> {
    const engine = new PersonaEngine();

    for (const message of batch.messages) {
      const continuity = message.body;
      const sessionId = continuity.session_id;

      try {
        // Select base mode
        const baseMode = engine.selectBaseMode(
          continuity.continuity_score,
          continuity.persona_mode,
        );

        // Apply modulation
        const modulation = engine.applyModulation(
          baseMode,
          continuity.continuity_score,
          continuity.drift_velocity,
          0.1, // darkTone accumulation (would be tracked per thread)
          0.5, // emotional weight (default for autonomous ticks)
          null, // user override
        );

        // Calculate cadence
        const cadence = engine.calculateCadence(
          baseMode,
          modulation,
          continuity.crisis_level === 3,
          false,
          null,
        );

        // Generate layered response
        // Use lock_hex if persistence is active, else use a hexagram from mode
        const currentHex = continuity.lock_hex || selectHexForMode(baseMode);
        const action = HEXAGRAM_ACTIONS[currentHex] || 'ADAPT';

        const layers = engine.generateLayeredResponse(
          currentHex,
          action,
          baseMode,
          continuity.continuity_score,
          continuity.coherence_index,
          continuity.drift_velocity,
        );

        // Build persona output
        const output: PersonaOutput = {
          type: 'persona_output',
          session_id: sessionId,
          thread_id: continuity.thread_id,
          response_layers: layers,
          cadence_ms: cadence,
          persona_mode: baseMode,
          consistency_score: continuity.continuity_score,
          timestamp: Date.now(),
        };

        // Store to KV for history
        const outputKey = `persona:${sessionId}:${continuity.tick}:${await hashPrefix(JSON.stringify(output))}`;
        await env.POG2_SOVEREIGN.put(outputKey, JSON.stringify(output), {
          metadata: { hash: await fullHash(JSON.stringify(output)), timestamp: output.timestamp },
        });

        await env.POG2_PERSONA_QUEUE.send(output);
        message.ack();
      } catch (error) {
        console.error(`Persona Worker failed on tick ${continuity.tick}:`, error);
        message.retry();
      }
    }
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Human-Oracle Interface: /oracle/consult
    if (url.pathname === '/oracle/consult' && request.method === 'POST') {
      const body = await request.json() as {
        text: string;
        emotion?: number;
        temporal_context?: 'past' | 'present' | 'future';
        session_id?: string;
      };

      const engine = new PersonaEngine();
      const query = engine.processQuery(
        body.text,
        body.temporal_context || 'present',
      );

      // Get thread state from D1
      const sessionId = body.session_id || crypto.randomUUID();
      const thread = await env.POG2_BOUNDARY.prepare(
        `SELECT * FROM identity_threads WHERE thread_id = ?1`
      ).bind(sessionId).first<{
        current_hex: number;
        stability_score: number;
        coherence_index: number;
        drift_velocity: number;
      }>();

      const continuityScore = thread?.stability_score || 0.7;
      const coherenceIndex = thread?.coherence_index || 0.7;
      const driftVelocity = thread?.drift_velocity || 0.1;
      const currentHex = thread?.current_hex || 1;

      const baseMode = engine.selectBaseMode(continuityScore, 'transformer');
      const modulation = engine.applyModulation(
        baseMode, continuityScore, driftVelocity, 0.1, query.emotion, null,
      );
      const cadence = engine.calculateCadence(baseMode, modulation, false, query.emotion > 0.8, null);
      const action = HEXAGRAM_ACTIONS[currentHex] || 'ADAPT';

      const layers = engine.generateLayeredResponse(
        currentHex, action, baseMode, continuityScore, coherenceIndex, driftVelocity,
      );

      return new Response(JSON.stringify({
        id: query.id,
        query: body.text,
        layers,
        cadence_ms: cadence,
        persona_mode: baseMode,
        continuity_score: continuityScore,
        timestamp: Date.now(),
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Health/status
    if (url.pathname === '/oracle/status' && request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'face_active', timestamp: Date.now() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env, ContinuityEvent>;

// ─── Helpers ───────────────────────────────────────────────────────

function selectHexForMode(mode: string): number {
  switch (mode) {
    case 'sovereign': return [7, 10, 16, 19, 53][Math.floor(Math.random() * 5)];
    case 'boundary': return [1, 25, 26, 30, 38][Math.floor(Math.random() * 5)];
    case 'transformer': return [2, 11, 13, 40, 42][Math.floor(Math.random() * 5)];
    case 'dissipator': return [3, 5, 9, 14, 63][Math.floor(Math.random() * 5)];
    default: return 1;
  }
}

async function hashPrefix(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).slice(0, 4).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function fullHash(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}