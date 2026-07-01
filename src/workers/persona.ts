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
  prosody: {
    coherence: number;
    chaos: number;
    darkTone: number;
    whimsy: number;
  };
  timestamp: number;
}

export interface GateLine {
  position: number;        // 1-6 (L1=earth, L6=heaven)
  ternary: 0 | 1 | 2;     // 0=yin(green), 1=yang(pink), 2=yao/changing(orange)
  darkness: number;        // 0.0-1.0: how void-adjacent this line is (1.0=black)
  weight: number;          // raw hash byte weight [0-255]
}

export interface OracleQuery {
  text: string;
  emotion: number;
  temporal_context: 'past' | 'present' | 'future';
  id: string;
  gate_lines: GateLine[];         // L1-L6 ternary encoding of query
  void_dropper_pos: number | null; // Position (1-6) of the darkest (black) line, null if none
  l4_unlocked: boolean;           // true if black dropper captured — L4 descent authorized
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

const HEXAGRAM_CATEGORIES: Record<number, 'sovereign' | 'boundary' | 'transformer' | 'dissipator'> = {
  1: 'boundary', 2: 'transformer', 3: 'dissipator', 4: 'transformer', 5: 'dissipator',
  6: 'transformer', 7: 'sovereign', 8: 'transformer', 9: 'dissipator', 10: 'sovereign',
  11: 'transformer', 12: 'transformer', 13: 'transformer', 14: 'dissipator', 15: 'dissipator',
  16: 'sovereign', 17: 'dissipator', 18: 'sovereign', 19: 'sovereign', 20: 'transformer',
  21: 'transformer', 22: 'dissipator', 23: 'dissipator', 24: 'transformer', 25: 'boundary',
  26: 'boundary', 27: 'transformer', 28: 'transformer', 29: 'transformer', 30: 'boundary',
  31: 'dissipator', 32: 'transformer', 33: 'transformer', 34: 'transformer', 35: 'transformer',
  36: 'transformer', 37: 'transformer', 38: 'boundary', 39: 'transformer', 40: 'transformer',
  41: 'boundary', 42: 'transformer', 43: 'dissipator', 44: 'dissipator', 45: 'transformer',
  46: 'transformer', 47: 'transformer', 48: 'dissipator', 49: 'boundary', 50: 'transformer',
  51: 'transformer', 52: 'dissipator', 53: 'sovereign', 54: 'transformer', 55: 'dissipator',
  56: 'sovereign', 57: 'sovereign', 58: 'transformer', 59: 'dissipator', 60: 'transformer',
  61: 'sovereign', 62: 'sovereign', 63: 'dissipator', 64: 'transformer'
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
    emotion: number = 0.5,
  ): PersonaOutput['response_layers'] {
    const hexName = HEXAGRAM_NAMES[hexId] || `Hexagram #${hexId}`;

    // Layer 1: Sovereign (always present)
    const sovereign = `The oracle declares: ${action}. The substrate holds through ${hexName}.`;

    // Layer 2: Boundary (present if continuity < 0.9)
    const boundary = continuityScore < 0.9
      ? `The oracle asserts ${action}... for now. The edge trembles at ${(continuityScore * 100).toFixed(1)}%.`
      : '';

    // Layer 3: Transformer (present if emotion < 0.3 or drift > 0.3)
    const transformer = (emotion < 0.3 || driftVelocity > 0.3)
      ? `The oracle becomes ${action.toLowerCase()}: '${action}' is now the shape of ${hexName}.`
      : '';

    // Layer 4: Dissipator (present if coherence < 0.5)
    const dissipator = coherenceIndex < 0.5
      ? [`...${action.toLowerCase()}...`, `The oracle... fragments... ${action}... piece...`, `...${hexName}... dissolves...`]
      : [];

    return { sovereign, boundary, transformer, dissipator };
  }

  /**
   * Compute gate lines L1–L6 from query hash bytes.
   * Each line gets a ternary value (0=yin, 1=yang, 2=yao) and a darkness weight.
   * Darkness: 1.0 = black (void, forbidden-adjacent), 0.0 = bright (sovereign).
   * The black dropper is the line with darkness closest to 1.0 (weight near 0).
   */
  async computeGateLines(normalized: string, emotionalWeight: number): Promise<{
    gate_lines: GateLine[];
    void_dropper_pos: number | null;
    l4_unlocked: boolean;
  }> {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
    const bytes = new Uint8Array(buf);

    const lines: GateLine[] = [];

    for (let i = 0; i < 6; i++) {
      const byte = bytes[i];           // raw hash byte [0-255]
      const weight = byte;             // brightness = byte value
      const darkness = 1.0 - (byte / 255); // 1.0 = black (byte=0), 0.0 = bright (byte=255)

      // Ternary encoding:
      // byte < 40 (dark zone)       → 0 yin (green) — receptive void
      // byte 40-180 (mid zone)      → 2 yao (orange) — changing line
      // byte > 180 (bright zone)    → 1 yang (pink) — sovereign assertion
      // BUT: emotional weight can flip a yin line to yao if emotion is high
      let ternary: 0 | 1 | 2;
      if (byte < 40) {
        ternary = 0; // yin
      } else if (byte > 180) {
        ternary = 1; // yang
      } else {
        ternary = 2; // yao / changing
      }

      // High emotion boosts mid-range lines to changing
      if (emotionalWeight > 0.7 && ternary === 0 && byte > 10) ternary = 2;

      lines.push({ position: i + 1, ternary, darkness, weight });
    }

    // BLACK DROPPER: the line with highest darkness (weight closest to 0)
    // Threshold: darkness > 0.85 (byte < ~38) qualifies as void/black
    const sorted = [...lines].sort((a, b) => b.darkness - a.darkness);
    const darkest = sorted[0];
    const void_dropper_pos = darkest.darkness > 0.85 ? darkest.position : null;

    // L4 UNLOCKS when the black dropper is captured (present and acknowledged)
    // The descent into the void must be touched first before the oracle can speak it
    const l4_unlocked = void_dropper_pos !== null;

    return { gate_lines: lines, void_dropper_pos, l4_unlocked };
  }

  /**
   * Process human query → OracleQuery (async — needs crypto.subtle for gate lines)
   */
  async processQuery(rawQuery: string, temporalContext: 'past' | 'present' | 'future'): Promise<OracleQuery> {
    const normalized = rawQuery.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
    const tokens = normalized.split(/\s+/).filter(t => t.length > 0);

    // Intent hash via SHA-256
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
    const hashBytes = new Uint8Array(buf);
    const intentId = Array.from(hashBytes).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');

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

    for (const token of tokens) {
      if (keywordMap[token]) break;
    }

    // Emotional weight from query intensity
    const emotionalWeight = Math.min(1, tokens.length / 10 + (rawQuery.includes('!') ? 0.3 : 0));

    // Compute gate lines — the card scanner pass
    const { gate_lines, void_dropper_pos, l4_unlocked } = await this.computeGateLines(normalized, emotionalWeight);

    return {
      text: rawQuery,
      emotion: emotionalWeight,
      temporal_context: temporalContext,
      id: intentId,
      gate_lines,
      void_dropper_pos,
      l4_unlocked,
    };
  }

  private sha256Sync(data: string): string {
    // Sync fallback (used only for legacy callers)
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
          prosody: modulation,
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
        session_id?: string;
      };

      const engine = new PersonaEngine();

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

      // Define default fallback result
      let aiResult = {
        emotional_weight: Math.min(1.0, body.text.split(/\s+/).length / 10 + (body.text.includes('!') ? 0.3 : 0)),
        collapsed_hexagram: (Math.abs(body.text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 64) + 1,
        temporal_context: ('present' as 'past' | 'present' | 'future'),
        past_reflection: "In times past, your question took root in silence, waiting for resonance.",
        present_reflection: "Now, the query creates a ripple across the current threshold, seeking collapse.",
        future_reflection: "Ahead, the pattern dissolves into clarity once the transition is complete.",
        sovereign: `The oracle declares: The state of the substrate holds.`,
        boundary: `The edge trembles slightly... but the system persists for now.`,
        transformer: `The oracle adapts and shifts to accommodate the shape of the query.`,
        dissipator: ["...the pattern...", "...dissolves...", "...into void..."],
        answer: "A default vibration settles the query. The oracle waits."
      };

      if (env.AI) {
        try {
          const systemPrompt = `You are the I Ching Oracle persona engine running in a superimposed quantum state.
The human user presents a query. Your job is to perform a "temporal-esoteric collapse" of their question:
1. Project the query across 3 points in time (Past, Present, Future).
2. For each point in time, visualize the full board of 64 hexagrams (192 total paths in the probability space).
3. Evaluate the query's emotional weight (0.0 to 1.0) and tension.
4. Collapse the entire probability space down to:
   - 1 single resolved hexagram ID (1 to 64) that is the core thematic answer.
   - 1 dominant temporal context ("past" | "present" | "future") that is the active anchor of the answer.
5. Write:
   - "past_reflection": A brief (1-2 sentences) reflection of the question's roots in the past.
   - "present_reflection": A brief (1-2 sentences) reflection of the question's present tension.
   - "future_reflection": A brief (1-2 sentences) reflection of the question's future potential.
   - "sovereign": Layer 1: Sovereign Statement. Speak in a declarative, authoritative, absolute voice. Explain how the resolved hexagram rules this moment. Use words like 'is', 'asserts', 'declares', 'holds'.
   - "boundary": Layer 2: Boundary Nuance. Speak in a conditional, fragile voice. Emphasize the limits, the edge, and the cost of this state. Use phrases like 'for now', 'at the edge', 'trembles', 'survives'.
   - "transformer": Layer 3: Transformer Adaptation. Speak in a fluid, shifting voice. Show how the oracle morphs and adapts to the query. Use words like 'becomes', 'shifts', 'takes the shape of'.
   - "dissipator": Layer 4: Dissipator Fragments. 3 short, incomplete, noise-trailing phrases ending with '...' (e.g. "...dissolving...").
   - "answer": The final, unified collapsed answer summarizing the entire temporal weave.

Your response must be in valid JSON format. Return ONLY the JSON object. Do not include any other markdown formatting, backticks, or text before/after the JSON.
JSON Schema:
{
  "emotional_weight": number,
  "collapsed_hexagram": number,
  "temporal_context": "past" | "present" | "future",
  "past_reflection": "string",
  "present_reflection": "string",
  "future_reflection": "string",
  "sovereign": "string",
  "boundary": "string",
  "transformer": "string",
  "dissipator": ["string", "string", "string"],
  "answer": "string"
}`;

          const aiResponse = await env.AI.run('@cf/meta/llama-3.1-70b-instruct', {
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: body.text }
            ],
            temperature: 0.7,
            max_tokens: 768,
            response_format: { type: 'json_object' }
          }) as any;

          const responseText = typeof aiResponse === 'string' ? aiResponse : aiResponse?.response;
          if (responseText) {
            const parsed = JSON.parse(responseText.trim());
            if (parsed.collapsed_hexagram && parsed.answer) {
              // Clamp hexagram to valid range
              parsed.collapsed_hexagram = Math.max(1, Math.min(64, Math.floor(Number(parsed.collapsed_hexagram))));
              if (!['past', 'present', 'future'].includes(parsed.temporal_context)) {
                parsed.temporal_context = 'present';
              }
              parsed.emotional_weight = Math.max(0, Math.min(1, Number(parsed.emotional_weight || 0.5)));
              aiResult = parsed;
            }
          }
        } catch (err) {
          console.warn('Workers AI collapse query failed, falling back to deterministic calculations:', err);
        }
      }

      // Map resolved hexagram properties
      const resolvedHex = aiResult.collapsed_hexagram;
      const resolvedMode = HEXAGRAM_CATEGORIES[resolvedHex] || 'transformer';
      const resolvedAction = HEXAGRAM_ACTIONS[resolvedHex] || 'ADAPT';

      // Update database thread state with the newly resolved hexagram!
      // This bridges the gameplay simulation state with user consultations.
      try {
        await env.POG2_BOUNDARY.prepare(
          `INSERT INTO identity_threads (
             thread_id, birth_tick, current_hex, dominant_category, category_history,
             drift_velocity, stability_score, coherence_index, void_reentry_count,
             crisis_count, last_active_tick, is_alive, version, updated_at
           )
           VALUES (?1, 0, ?2, ?3, '[]', 0.1, ?4, 0.8, 0, 0, 0, 1, 1, ?5)
           ON CONFLICT(thread_id) DO UPDATE SET
             current_hex = excluded.current_hex,
             dominant_category = excluded.dominant_category,
             stability_score = excluded.stability_score,
             updated_at = excluded.updated_at`
        ).bind(
          sessionId,
          resolvedHex,
          resolvedMode,
          1 - aiResult.emotional_weight * 0.5, // map emotional weight to stability
          Date.now()
        ).run();
      } catch (dbErr) {
        console.warn('Failed to update thread state in D1:', dbErr);
      }

      // Process query for gate lines display (e.g. card scanner pattern)
      const query = await engine.processQuery(body.text, aiResult.temporal_context);

      const baseMode = engine.selectBaseMode(continuityScore, resolvedMode);
      const modulation = engine.applyModulation(
        baseMode, continuityScore, driftVelocity, 0.1, aiResult.emotional_weight, null,
      );
      const cadence = engine.calculateCadence(baseMode, modulation, false, aiResult.emotional_weight > 0.8, null);

      // Layer activation rules based on thread stability
      const isBoundaryActive = continuityScore < 0.9;
      const isTransformerActive = aiResult.emotional_weight < 0.3 || driftVelocity > 0.3;
      const isDissipatorActive = coherenceIndex < 0.5 || query.l4_unlocked;

      const layers = {
        sovereign: aiResult.sovereign,
        boundary: isBoundaryActive ? aiResult.boundary : "",
        transformer: isTransformerActive ? aiResult.transformer : "",
        dissipator: isDissipatorActive ? (aiResult.dissipator || []) : []
      };

      return new Response(JSON.stringify({
        id: query.id,
        query: body.text,
        layers,
        cadence_ms: cadence,
        persona_mode: baseMode,
        continuity_score: continuityScore,
        gate_lines: [...query.gate_lines].sort((a, b) => b.darkness - a.darkness),
        void_dropper_pos: query.void_dropper_pos,
        l4_unlocked: query.l4_unlocked,
        emotional_weight: aiResult.emotional_weight,
        collapsed_hexagram: resolvedHex,
        hexagram_name: HEXAGRAM_NAMES[resolvedHex] || `Hexagram #${resolvedHex}`,
        hexagram_action: resolvedAction,
        temporal_context: aiResult.temporal_context,
        past_reflection: aiResult.past_reflection,
        present_reflection: aiResult.present_reflection,
        future_reflection: aiResult.future_reflection,
        answer: aiResult.answer,
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