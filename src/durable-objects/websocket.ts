/**
 * POG2 WebSocket DO — Real-Time Bidirectional Hub
 * Handles client connections, heartbeat, message routing, session management
 * Aligned with CloudflareImplementation_Spec.txt § WEBSOCKET MESH
 */

import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../index';

// ─── Message Types ─────────────────────────────────────────────────

export interface SessionMessage {
  type: 'session';
  session_id: string;
  thread_id: string;
  tick: number;
}

export interface HeartbeatMessage {
  type: 'heartbeat';
  tick: number;
  timestamp: number;
  current_hex: number;
  continuity_score: number;
}

export interface QueryMessage {
  type: 'query';
  text: string;
  emotion: number;
  temporal_context: 'past' | 'present' | 'future';
  id: string;
}

export interface ResponseMessage {
  type: 'response';
  id: string;
  layers: {
    sovereign: string;
    boundary: string;
    transformer: string;
    dissipator: string[];
  };
  cadence_ms: number;
  persona_mode: string;
  timestamp: number;
}

export interface OverrideMessage {
  type: 'override';
  action: 'ASSERT' | 'YIELD' | 'ADAPT' | 'WAIT';
  reason: string;
}

export interface CrisisMessage {
  type: 'crisis';
  level: number;
  indicators: Record<string, any>;
  response: string;
  timestamp: number;
}

// ─── WebSocket DO ────────────────────────────────────────────────

export class POG2WebSocketDO extends DurableObject<Env> {
  private connections: Map<WebSocket, { sessionId: string; threadId: string; connectedAt: number }> = new Map();
  private tick: number = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    ctx: DurableObjectState,
    env: Env,
  ) {
    super(ctx, env);
  }

  // ─── HTTP / WebSocket Upgrade ───────────────────────────────────

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    // Internal: broadcast from Orchestrator DO
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      this.broadcast(await request.json() as object);
      return new Response(JSON.stringify({ broadcast: true, recipients: this.connections.size }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Internal: send to specific session
    if (url.pathname === '/send-to-session' && request.method === 'POST') {
      const body = await request.json() as { session_id: string; message: object };
      this.sendToSession(body.session_id, body.message);
      return new Response(JSON.stringify({ sent: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Status
    if (url.pathname === '/status' && request.method === 'GET') {
      return new Response(JSON.stringify({
        connections: this.connections.size,
        tick: this.tick,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  }

  // ─── WebSocket Handling ─────────────────────────────────────────

  private async handleWebSocket(request: Request): Promise<Response> {
    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];

    // Parse session from cookie or generate new
    const cookieHeader = request.headers.get('Cookie') || '';
    let sessionId = this.parseCookie(cookieHeader, 'session_id');

    if (!sessionId) {
      sessionId = crypto.randomUUID();
    }

    // Get or create thread via Orchestrator DO
    const threadId = await this.getOrCreateThread(sessionId);

    // Accept connection
    server.accept();

    // Store connection with metadata
    this.connections.set(server, {
      sessionId,
      threadId,
      connectedAt: Date.now(),
    });

    // Send session assignment
    const sessionMsg: SessionMessage = {
      type: 'session',
      session_id: sessionId,
      thread_id: threadId,
      tick: this.tick,
    };
    server.send(JSON.stringify(sessionMsg));

    // Set session cookie
    const response = new Response(null, {
      status: 101,
      webSocket: client,
      headers: {
        'Set-Cookie': `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Strict`,
      },
    });

    // Start heartbeat if first connection
    if (this.connections.size === 1) {
      this.startHeartbeat();
    }

    // Message handler
    server.addEventListener('message', async (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        await this.handleClientMessage(msg, server, sessionId, threadId);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
        server.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    // Close handler
    server.addEventListener('close', () => {
      this.connections.delete(server);
      if (this.connections.size === 0) {
        this.stopHeartbeat();
      }
    });

    server.addEventListener('error', () => {
      this.connections.delete(server);
      if (this.connections.size === 0) {
        this.stopHeartbeat();
      }
    });

    return response;
  }

  private async handleClientMessage(
    msg: any,
    ws: WebSocket,
    sessionId: string,
    threadId: string,
  ): Promise<void> {
    switch (msg.type) {
      case 'query':
        await this.handleQuery(msg as QueryMessage, ws, sessionId, threadId);
        break;
      case 'override':
        await this.handleOverride(msg as OverrideMessage, ws, sessionId, threadId);
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
      default:
        console.warn('Unknown message type:', msg.type);
    }
  }

  // ─── Query Handling ─────────────────────────────────────────────

  private async handleQuery(
    msg: QueryMessage,
    ws: WebSocket,
    sessionId: string,
    threadId: string,
  ): Promise<void> {
    // Forward query to Persona Worker via HTTP (since we need immediate response)
    // In production, this could also go through a queue with SSE
    const personaUrl = new URL('/oracle/consult', 'http://internal');

    try {
      // Get thread state for context
      const thread = await this.env.POG2_BOUNDARY.prepare(
        `SELECT current_hex, stability_score, coherence_index, drift_velocity
         FROM identity_threads WHERE thread_id = ?1`
      ).bind(threadId).first<{
        current_hex: number;
        stability_score: number;
        coherence_index: number;
        drift_velocity: number;
      }>();

      // Build response using persona logic inline (since we can't call the worker directly)
      const currentHex = thread?.current_hex || 1;
      const continuityScore = thread?.stability_score || 0.7;
      const coherenceIndex = thread?.coherence_index || 0.7;
      const driftVelocity = thread?.drift_velocity || 0.1;

      // Determine mode
      let mode: string;
      if (continuityScore >= 0.9) mode = 'sovereign';
      else if (continuityScore >= 0.7) mode = 'boundary';
      else if (continuityScore >= 0.5) mode = 'transformer';
      else mode = 'dissipator';

      // Determine action
      const actions: Record<number, string> = {
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
      const action = actions[currentHex] || 'ADAPT';

      // Build layered response
      const hexNames: Record<number, string> = {
        1: 'The Creative (Qian)', 7: 'The Army', 10: 'Treading', 16: 'Enthusiasm',
        18: 'Work on Decayed', 19: 'Approach', 53: 'Development', 56: 'The Wanderer',
        57: 'The Gentle', 61: 'Inner Truth', 62: 'Small Preponderance',
      };
      const hexName = hexNames[currentHex] || `Hexagram #${currentHex}`;

      const response: ResponseMessage = {
        type: 'response',
        id: msg.id,
        layers: {
          sovereign: `The oracle declares: ${action}. The substrate holds through ${hexName}.`,
          boundary: continuityScore < 0.9
            ? `The oracle asserts ${action}... for now. The edge trembles at ${(continuityScore * 100).toFixed(1)}%.`
            : '',
          transformer: driftVelocity > 0.3
            ? `The oracle becomes ${action.toLowerCase()}: '${action}' is now the shape of ${hexName}.`
            : '',
          dissipator: coherenceIndex < 0.5
            ? [`...${action.toLowerCase()}...`, `The oracle... fragments... ${action}... piece...`, `...${hexName}... dissolves...`]
            : [],
        },
        cadence_ms: mode === 'sovereign' ? 640
          : mode === 'boundary' ? 640 + Math.floor(Math.random() * 100 - 50)
          : mode === 'transformer' ? 480 + Math.floor(Math.random() * 320)
          : 200 + Math.floor(Math.random() * 1000),
        persona_mode: mode,
        timestamp: Date.now(),
      };

      ws.send(JSON.stringify(response));

      // Also queue the query for processing through the full pipeline
      await this.env.POG2_COLLAPSE_QUEUE.send({
        type: 'query',
        text: msg.text,
        emotion: msg.emotion,
        temporal_context: msg.temporal_context,
        session_id: sessionId,
        thread_id: threadId,
        timestamp: Date.now(),
      });

    } catch (error) {
      console.error('Query handling failed:', error);
      ws.send(JSON.stringify({
        type: 'error',
        id: msg.id,
        message: 'Query processing failed',
      }));
    }
  }

  // ─── Override Handling ────────────────────────────────────────────

  private async handleOverride(
    msg: OverrideMessage,
    ws: WebSocket,
    sessionId: string,
    threadId: string,
  ): Promise<void> {
    // User override always wins — set persistence lock to requested action
    const actionToHex: Record<string, number> = {
      ASSERT: 1,  // Qian
      YIELD: 2,   // Kun
      ADAPT: 40,  // Deliverance
      WAIT: 5,    // Waiting
    };

    const lockHex = actionToHex[msg.action] || 1;

    try {
      // Update persistence state
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
        threadId,
        this.tick,
        10, // Lock for 10 ticks
        lockHex,
        `user_override:${msg.action}:${msg.reason}`,
        1,
        Date.now(),
      ).run();

      // Confirm to client
      ws.send(JSON.stringify({
        type: 'override_confirmed',
        action: msg.action,
        lock_hex: lockHex,
        reason: msg.reason,
        timestamp: Date.now(),
      }));

      // Notify Orchestrator DO
      const orchId = this.env.POG2_ORCHESTRATOR.idFromName('main');
      const orchStub = this.env.POG2_ORCHESTRATOR.get(orchId);
      await orchStub.fetch(new Request('http://internal/override', {
        method: 'POST',
        body: JSON.stringify({ thread_id: threadId, action: msg.action, reason: msg.reason }),
      }));

    } catch (error) {
      console.error('Override handling failed:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Override processing failed',
      }));
    }
  }

  // ─── Heartbeat ──────────────────────────────────────────────────

  private startHeartbeat(): void {
    if (this.heartbeatTimer !== null) return;

    this.heartbeatTimer = setInterval(async () => {
      this.tick++;

      // Fetch live thread states for all connected sessions
      for (const [ws, meta] of this.connections) {
        try {
          const thread = await this.env.POG2_BOUNDARY.prepare(
            `SELECT current_hex, continuity_score FROM identity_threads WHERE thread_id = ?1`
          ).bind(meta.threadId).first<{
            current_hex: number;
            continuity_score: number;
          }>();

          const heartbeat: HeartbeatMessage = {
            type: 'heartbeat',
            tick: this.tick,
            timestamp: Date.now(),
            current_hex: thread?.current_hex || 1,
            continuity_score: thread?.continuity_score || 1.0,
          };

          ws.send(JSON.stringify(heartbeat));
        } catch (e) {
          // Connection may be dead
          if (ws.readyState === WebSocket.CLOSED) {
            this.connections.delete(ws);
          }
        }
      }

      if (this.connections.size === 0) {
        this.stopHeartbeat();
      }
    }, 640);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ─── Broadcast ──────────────────────────────────────────────────

  private broadcast(message: object): void {
    const data = JSON.stringify(message);
    for (const [ws] of this.connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  private sendToSession(sessionId: string, message: object): void {
    const data = JSON.stringify(message);
    for (const [ws, meta] of this.connections) {
      if (meta.sessionId === sessionId && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
        break;
      }
    }
  }

  // ─── Session / Thread Management ────────────────────────────────

  private async getOrCreateThread(sessionId: string): Promise<string> {
    // Check existing thread registry
    const existing = await this.env.POG2_BOUNDARY.prepare(
      `SELECT thread_id FROM thread_registry WHERE session_id = ?1 AND status = 'active'
       ORDER BY updated_at DESC LIMIT 1`
    ).bind(sessionId).first<{ thread_id: string }>();

    if (existing) {
      return existing.thread_id;
    }

    // Try bridge resume via Orchestrator DO
    const orchId = this.env.POG2_ORCHESTRATOR.idFromName('main');
    const orchStub = this.env.POG2_ORCHESTRATOR.get(orchId);

    try {
      const response = await orchStub.fetch(new Request('http://internal/thread/get-or-create', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId, resume: true }),
      }));
      const result = await response.json() as { thread_id: string };
      return result.thread_id;
    } catch (e) {
      console.error('Orchestrator DO unreachable, creating local thread:', e);
      // Fallback: create thread directly
      const threadId = crypto.randomUUID();
      const now = Date.now();
      await this.env.POG2_BOUNDARY.prepare(
        `INSERT INTO thread_registry (thread_id, session_id, current_hex, continuity_score, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
      ).bind(threadId, sessionId, 1, 1.0, 'active', now, now).run();
      return threadId;
    }
  }

  private parseCookie(cookieHeader: string, name: string): string | null {
    const match = cookieHeader.match(new RegExp(`(?:^|;\s*)${name}=([^;]+)`));
    return match ? match[1] : null;
  }
}