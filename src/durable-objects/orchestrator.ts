/**
 * POG2 Orchestrator DO — Central Nervous System
 * Tick dispatch, thread registry, session management, crisis coordination, WebSocket hub
 * Aligned with CloudflareImplementation_Spec.txt § DURABLE OBJECT: ORCHESTRATOR
 */

import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../index';

// ─── Message Types ─────────────────────────────────────────────────

export interface TickSignal {
  type: 'tick';
  tick: number;
  timestamp: number;
  sessionId: string | null;
}

export interface CrisisEvent {
  type: 'crisis';
  crisis_id: string;
  level: number;
  indicators: Record<string, any>;
  response: string;
  timestamp: number;
}

// ─── Orchestrator DO ───────────────────────────────────────────────

export class POG2OrchestratorDO extends DurableObject<Env> {
  private tick: number = 0;
  private sessionRegistry: Map<string, { threadId: string; connectedAt: number }> = new Map();

  constructor(
    ctx: DurableObjectState,
    env: Env,
  ) {
    super(ctx, env);

    // Initialize: restore tick from storage, schedule alarm if needed
    this.ctx.blockConcurrencyWhile(async () => {
      const storedTick = await this.ctx.storage.get<number>('tick');
      if (storedTick !== undefined) {
        this.tick = storedTick;
      }

      const existingAlarm = await this.ctx.storage.getAlarm();
      if (existingAlarm === null) {
        await this.ctx.storage.setAlarm(Date.now() + 640);
      }
    });
  }

  // ─── HTTP Interface ─────────────────────────────────────────────

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Admin: get thread registry
    if (url.pathname === '/admin/threads' && request.method === 'GET') {
      const threads = await this.env.POG2_BOUNDARY.prepare(
        `SELECT thread_id, session_id, current_hex, continuity_score, status, updated_at
         FROM thread_registry
         ORDER BY updated_at DESC
         LIMIT 100`
      ).all();
      return new Response(JSON.stringify(threads.results), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Admin: get system state
    if (url.pathname === '/admin/state' && request.method === 'GET') {
      return new Response(JSON.stringify({
        tick: this.tick,
        sessions: this.sessionRegistry.size,
        timestamp: Date.now(),
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Session bridge: resume session
    if (url.pathname === '/bridge/resume' && request.method === 'POST') {
      const body = await request.json() as { thread_id: string; session_end_tick: number };
      const bridge = await this.checkSessionBridge(body.thread_id, body.session_end_tick);
      return new Response(JSON.stringify(bridge || { found: false }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Thread management: get or create thread for session
    if (url.pathname === '/thread/get-or-create' && request.method === 'POST') {
      const body = await request.json() as { session_id: string; resume?: boolean };
      const threadId = await this.getOrCreateThread(body.session_id, body.resume);
      return new Response(JSON.stringify({ thread_id: threadId }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Crisis handler (called via DO stub from queue handlers)
    if (url.pathname === '/crisis/handle' && request.method === 'POST') {
      const crisis = await request.json() as CrisisEvent;
      await this.handleCrisis(crisis);
      return new Response(JSON.stringify({ handled: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // WebSocket broadcast (called from queue handlers)
    if (url.pathname === '/ws/broadcast' && request.method === 'POST') {
      const body = await request.json() as { message: object };
      await this.broadcastToWebSockets(body.message);
      return new Response(JSON.stringify({ broadcast: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  }

  // ─── Alarm Handler (640ms Tick) ──────────────────────────────────

  async alarm(alarmInfo?: { retryCount: number; isRetry: boolean }): Promise<void> {
    if (alarmInfo?.retryCount && alarmInfo.retryCount > 0) {
      console.log(`Orchestrator alarm retry #${alarmInfo.retryCount}`);
    }

    await this.handleTick();

    // Schedule next alarm
    await this.ctx.storage.setAlarm(Date.now() + 640);
  }

  private async handleTick(): Promise<void> {
    this.tick++;
    await this.ctx.storage.put('tick', this.tick);

    // Dispatch tick signal to Weave Worker via queue
    const signal: TickSignal = {
      type: 'tick',
      tick: this.tick,
      timestamp: Date.now(),
      sessionId: null, // Global tick, not session-specific
    };

    await this.env.POG2_COLLAPSE_QUEUE.send(signal);

    // Update thread field metrics every 10 ticks
    if (this.tick % 10 === 0) {
      await this.updateThreadField();
    }

    // Thread cleanup every 1000 ticks (≈10.6 minutes)
    if (this.tick % 1000 === 0) {
      await this.cleanupDeadThreads();
    }
  }

  // ─── Thread Registry ────────────────────────────────────────────

  async registerThread(threadId: string, sessionId: string, initialHex: number): Promise<void> {
    const now = Date.now();
    await this.env.POG2_BOUNDARY.prepare(
      `INSERT INTO thread_registry (thread_id, session_id, current_hex, continuity_score, status, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
       ON CONFLICT(thread_id) DO UPDATE SET
         session_id = excluded.session_id,
         current_hex = excluded.current_hex,
         continuity_score = excluded.continuity_score,
         status = excluded.status,
         updated_at = excluded.updated_at`
    ).bind(
      threadId, sessionId, initialHex,
      1.0, 'active', now, now
    ).run();

    // Also create identity_threads entry
    await this.env.POG2_BOUNDARY.prepare(
      `INSERT INTO identity_threads
       (thread_id, birth_tick, current_hex, dominant_category, category_history,
        drift_velocity, stability_score, coherence_index, void_reentry_count,
        crisis_count, last_active_tick, is_alive, version, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
       ON CONFLICT(thread_id) DO NOTHING`
    ).bind(
      threadId, this.tick, initialHex, 'sovereign', JSON.stringify(['sovereign']),
      0, 1.0, 1.0, 0, 0, this.tick, 1, 1, now
    ).run();
  }

  async updateThread(
    threadId: string,
    currentHex: number,
    continuityScore: number,
    status: string = 'active',
  ): Promise<void> {
    await this.env.POG2_BOUNDARY.prepare(
      `UPDATE thread_registry
       SET current_hex = ?1,
           continuity_score = ?2,
           status = ?3,
           updated_at = ?4
       WHERE thread_id = ?5`
    ).bind(currentHex, continuityScore, status, Date.now(), threadId).run();
  }

  async getThread(threadId: string) {
    return await this.env.POG2_BOUNDARY.prepare(
      `SELECT * FROM thread_registry WHERE thread_id = ?1`
    ).bind(threadId).first();
  }

  // ─── Session Bridging ───────────────────────────────────────────

  async checkSessionBridge(threadId: string, sessionEndTick: number): Promise<{
    found: boolean;
    threadState?: object;
    hammingDistance?: number;
    valid?: boolean;
    childThreadId?: string;
  }> {
    // Look up bridge snapshot in Sovereign KV
    const bridgePrefix = `bridge:${threadId}:`;
    const keys = await this.env.POG2_SOVEREIGN.list({ prefix: bridgePrefix, limit: 1 });

    if (keys.keys.length === 0) {
      return { found: false };
    }

    const bridgeData = await this.env.POG2_SOVEREIGN.get(keys.keys[0].name);
    if (!bridgeData) {
      return { found: false };
    }

    const bridge = JSON.parse(bridgeData);

    // Validate: compare last_hex with current session first collapse
    // Hamming distance ≤ 2 = valid bridge
    const lastHex = bridge.last_hex || 1;
    const currentHex = bridge.current_hex || 1;
    const hammingDistance = this.computeHammingDistance(lastHex, currentHex);

    if (hammingDistance <= 2) {
      return {
        found: true,
        threadState: bridge,
        hammingDistance,
        valid: true,
      };
    } else {
      // Bridge fractured — spawn child thread
      const childThreadId = `${threadId}_child_1`;
      await this.registerThread(childThreadId, bridge.session_id || 'orphan', currentHex);

      // Store child relationship
      await this.env.POG2_SOVEREIGN.put(
        `bridge:child:${childThreadId}`,
        JSON.stringify({ parent: threadId, hammingDistance, created_at: Date.now() })
      );

      return {
        found: true,
        threadState: bridge,
        hammingDistance,
        valid: false,
        childThreadId,
      };
    }
  }

  async createBridgeSnapshot(threadId: string, sessionId: string): Promise<void> {
    const thread = await this.getThread(threadId);
    if (!thread) return;

    const snapshot = {
      thread_id: threadId,
      session_id: sessionId,
      last_hex: thread.current_hex,
      tick: this.tick,
      continuity_score: thread.continuity_score,
      timestamp: Date.now(),
    };

    const hash = await this.sha256(JSON.stringify(snapshot));
    const key = `bridge:${threadId}:${this.tick}:${hash.slice(0, 8)}`;

    await this.env.POG2_SOVEREIGN.put(key, JSON.stringify(snapshot), {
      metadata: { hash, timestamp: snapshot.timestamp },
    });
  }

  // ─── Session Management ─────────────────────────────────────────

  async getOrCreateThread(sessionId: string, resume: boolean = false): Promise<string> {
    // Check if session already has a thread
    const existing = await this.env.POG2_BOUNDARY.prepare(
      `SELECT thread_id FROM thread_registry WHERE session_id = ?1 AND status = 'active'
       ORDER BY updated_at DESC LIMIT 1`
    ).bind(sessionId).first<{ thread_id: string }>();

    if (existing) {
      return existing.thread_id;
    }

    // Try to resume from bridge
    if (resume) {
      const bridgeResult = await this.checkSessionBridge(sessionId, this.tick);
      if (bridgeResult.found && bridgeResult.valid && bridgeResult.threadState) {
        const state = bridgeResult.threadState as { thread_id: string; last_hex: number };
        await this.registerThread(state.thread_id, sessionId, state.last_hex);
        return state.thread_id;
      }
    }

    // Birth new thread
    const threadId = crypto.randomUUID();
    await this.registerThread(threadId, sessionId, 1); // Default to Qian
    return threadId;
  }

  // ─── Crisis Coordination ────────────────────────────────────────

  async handleCrisis(event: CrisisEvent): Promise<void> {
    // Log to Sovereign KV
    const crisisKey = `crisis:${event.crisis_id}`;
    await this.env.POG2_SOVEREIGN.put(crisisKey, JSON.stringify(event), {
      metadata: { hash: await this.sha256(JSON.stringify(event)), timestamp: event.timestamp },
    });

    // Broadcast to all WebSocket DOs
    await this.broadcastToWebSockets({
      type: 'crisis',
      level: event.level,
      indicators: event.indicators,
      response: event.response,
      timestamp: event.timestamp,
    });

    // Trigger emergency sovereign collapse for affected threads
    if (event.level >= 2) {
      const affectedThreads = await this.env.POG2_BOUNDARY.prepare(
        `SELECT thread_id FROM thread_registry WHERE status = 'active'`
      ).all<{ thread_id: string }>();

      for (const row of affectedThreads.results || []) {
        // Set emergency persistence lock
        await this.env.POG2_BOUNDARY.prepare(
          `INSERT INTO persistence_state (thread_id, tick, persistence_countdown, lock_hex, lock_reason, version, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
           ON CONFLICT(thread_id) DO UPDATE SET
             tick = excluded.tick,
             persistence_countdown = excluded.persistence_countdown,
             lock_hex = excluded.lock_hex,
             lock_reason = excluded.lock_reason,
             version = version + 1,
             updated_at = excluded.updated_at`
        ).bind(
          row.thread_id, this.tick, 10, 7, 'crisis_emergency', 1, Date.now()
        ).run();
      }
    }
  }

  // ─── WebSocket Hub ────────────────────────────────────────────

  async broadcastToWebSockets(message: object): Promise<void> {
    // Send to WebSocket DO for broadcast
    // We use a named DO instance for the WebSocket hub
    const wsId = this.env.POG2_WEBSOCKET.idFromName('hub');
    const wsStub = this.env.POG2_WEBSOCKET.get(wsId);

    try {
      await wsStub.fetch(new Request('http://internal/broadcast', {
        method: 'POST',
        body: JSON.stringify(message),
        headers: { 'Content-Type': 'application/json' },
      }));
    } catch (e) {
      console.error('Failed to broadcast to WebSocket DO:', e);
    }
  }

  // ─── Thread Field ─────────────────────────────────────────────

  private async updateThreadField(): Promise<void> {
    const stats = await this.env.POG2_BOUNDARY.prepare(
      `SELECT
         COUNT(*) as thread_count,
         AVG(continuity_score) as avg_continuity,
         AVG(stability_score) as avg_stability,
         AVG(coherence_index) as avg_coherence
       FROM identity_threads
       WHERE is_alive = 1`
    ).first<{
      thread_count: number;
      avg_continuity: number;
      avg_stability: number;
      avg_coherence: number;
    }>();

    if (!stats) return;

    const globalMode = stats.avg_continuity < 0.5 ? 'deliberation'
      : stats.avg_continuity > 0.8 ? 'exploration'
      : 'normal';

    await this.env.POG2_BOUNDARY.prepare(
      `INSERT INTO thread_field (timestamp, thread_count, avg_continuity, avg_stability, avg_coherence, global_mode)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    ).bind(
      Date.now(),
      stats.thread_count || 0,
      stats.avg_continuity || 0,
      stats.avg_stability || 0,
      stats.avg_coherence || 0,
      globalMode,
    ).run();
  }

  // ─── Cleanup ────────────────────────────────────────────────────

  private async cleanupDeadThreads(): Promise<void> {
    const cutoffTick = this.tick - 1000;

    // Mark threads dead after 1000 ticks inactive
    await this.env.POG2_BOUNDARY.prepare(
      `UPDATE identity_threads
       SET is_alive = 0
       WHERE last_active_tick < ?1 AND is_alive = 1`
    ).bind(cutoffTick).run();

    await this.env.POG2_BOUNDARY.prepare(
      `UPDATE thread_registry
       SET status = 'dead'
       WHERE thread_id IN (
         SELECT thread_id FROM identity_threads WHERE is_alive = 0
       )`
    ).run();

    // Archive bridge snapshots older than 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const bridges = await this.env.POG2_SOVEREIGN.list({ prefix: 'bridge:' });
    for (const key of bridges.keys) {
      if (key.metadata && (key.metadata as any).timestamp < thirtyDaysAgo) {
        await this.env.POG2_SOVEREIGN.delete(key.name);
      }
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private computeHammingDistance(hex1: number, hex2: number): number {
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
    const b1 = binaries[hex1] || '000000';
    const b2 = binaries[hex2] || '000000';
    let dist = 0;
    for (let i = 0; i < 6; i++) {
      if (b1[i] !== b2[i]) dist++;
    }
    return dist;
  }

  private async sha256(data: string): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}