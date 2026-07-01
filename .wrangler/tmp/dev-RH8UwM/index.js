var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/durable-objects/orchestrator.ts
import { DurableObject } from "cloudflare:workers";
var POG2OrchestratorDO = class extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.tick = 0;
    this.sessionRegistry = /* @__PURE__ */ new Map();
    this.ctx.blockConcurrencyWhile(async () => {
      const storedTick = await this.ctx.storage.get("tick");
      if (storedTick !== void 0) {
        this.tick = storedTick;
      }
      const existingAlarm = await this.ctx.storage.getAlarm();
      if (existingAlarm === null) {
        await this.ctx.storage.setAlarm(Date.now() + 640);
      }
    });
  }
  static {
    __name(this, "POG2OrchestratorDO");
  }
  // ─── HTTP Interface ─────────────────────────────────────────────
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/admin/threads" && request.method === "GET") {
      const threads = await this.env.POG2_BOUNDARY.prepare(
        `SELECT thread_id, session_id, current_hex, continuity_score, status, updated_at
         FROM thread_registry
         ORDER BY updated_at DESC
         LIMIT 100`
      ).all();
      return new Response(JSON.stringify(threads.results), {
        headers: { "Content-Type": "application/json" }
      });
    }
    if (url.pathname === "/admin/state" && request.method === "GET") {
      return new Response(JSON.stringify({
        tick: this.tick,
        sessions: this.sessionRegistry.size,
        timestamp: Date.now()
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    if (url.pathname === "/bridge/resume" && request.method === "POST") {
      const body = await request.json();
      const bridge = await this.checkSessionBridge(body.thread_id, body.session_end_tick);
      return new Response(JSON.stringify(bridge || { found: false }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    if (url.pathname === "/thread/get-or-create" && request.method === "POST") {
      const body = await request.json();
      const threadId = await this.getOrCreateThread(body.session_id, body.resume);
      return new Response(JSON.stringify({ thread_id: threadId }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    if (url.pathname === "/crisis/handle" && request.method === "POST") {
      const crisis = await request.json();
      await this.handleCrisis(crisis);
      return new Response(JSON.stringify({ handled: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    if (url.pathname === "/ws/broadcast" && request.method === "POST") {
      const body = await request.json();
      await this.broadcastToWebSockets(body.message);
      return new Response(JSON.stringify({ broadcast: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response("Not Found", { status: 404 });
  }
  // ─── Alarm Handler (640ms Tick) ──────────────────────────────────
  async alarm(alarmInfo) {
    if (alarmInfo?.retryCount && alarmInfo.retryCount > 0) {
      console.log(`Orchestrator alarm retry #${alarmInfo.retryCount}`);
    }
    await this.handleTick();
    await this.ctx.storage.setAlarm(Date.now() + 640);
  }
  async handleTick() {
    this.tick++;
    await this.ctx.storage.put("tick", this.tick);
    const signal = {
      type: "tick",
      tick: this.tick,
      timestamp: Date.now(),
      sessionId: null
      // Global tick, not session-specific
    };
    await this.env.POG2_COLLAPSE_QUEUE.send(signal);
    if (this.tick % 10 === 0) {
      await this.updateThreadField();
    }
    if (this.tick % 1e3 === 0) {
      await this.cleanupDeadThreads();
    }
  }
  // ─── Thread Registry ────────────────────────────────────────────
  async registerThread(threadId, sessionId, initialHex) {
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
      threadId,
      sessionId,
      initialHex,
      1,
      "active",
      now,
      now
    ).run();
    await this.env.POG2_BOUNDARY.prepare(
      `INSERT INTO identity_threads
       (thread_id, birth_tick, current_hex, dominant_category, category_history,
        drift_velocity, stability_score, coherence_index, void_reentry_count,
        crisis_count, last_active_tick, is_alive, version, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
       ON CONFLICT(thread_id) DO NOTHING`
    ).bind(
      threadId,
      this.tick,
      initialHex,
      "sovereign",
      JSON.stringify(["sovereign"]),
      0,
      1,
      1,
      0,
      0,
      this.tick,
      1,
      1,
      now
    ).run();
  }
  async updateThread(threadId, currentHex, continuityScore, status = "active") {
    await this.env.POG2_BOUNDARY.prepare(
      `UPDATE thread_registry
       SET current_hex = ?1,
           continuity_score = ?2,
           status = ?3,
           updated_at = ?4
       WHERE thread_id = ?5`
    ).bind(currentHex, continuityScore, status, Date.now(), threadId).run();
  }
  async getThread(threadId) {
    return await this.env.POG2_BOUNDARY.prepare(
      `SELECT * FROM thread_registry WHERE thread_id = ?1`
    ).bind(threadId).first();
  }
  // ─── Session Bridging ───────────────────────────────────────────
  async checkSessionBridge(threadId, sessionEndTick) {
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
    const lastHex = bridge.last_hex || 1;
    const currentHex = bridge.current_hex || 1;
    const hammingDistance2 = this.computeHammingDistance(lastHex, currentHex);
    if (hammingDistance2 <= 2) {
      return {
        found: true,
        threadState: bridge,
        hammingDistance: hammingDistance2,
        valid: true
      };
    } else {
      const childThreadId = `${threadId}_child_1`;
      await this.registerThread(childThreadId, bridge.session_id || "orphan", currentHex);
      await this.env.POG2_SOVEREIGN.put(
        `bridge:child:${childThreadId}`,
        JSON.stringify({ parent: threadId, hammingDistance: hammingDistance2, created_at: Date.now() })
      );
      return {
        found: true,
        threadState: bridge,
        hammingDistance: hammingDistance2,
        valid: false,
        childThreadId
      };
    }
  }
  async createBridgeSnapshot(threadId, sessionId) {
    const thread = await this.getThread(threadId);
    if (!thread) return;
    const snapshot = {
      thread_id: threadId,
      session_id: sessionId,
      last_hex: thread.current_hex,
      tick: this.tick,
      continuity_score: thread.continuity_score,
      timestamp: Date.now()
    };
    const hash = await this.sha256(JSON.stringify(snapshot));
    const key = `bridge:${threadId}:${this.tick}:${hash.slice(0, 8)}`;
    await this.env.POG2_SOVEREIGN.put(key, JSON.stringify(snapshot), {
      metadata: { hash, timestamp: snapshot.timestamp }
    });
  }
  // ─── Session Management ─────────────────────────────────────────
  async getOrCreateThread(sessionId, resume = false) {
    const existing = await this.env.POG2_BOUNDARY.prepare(
      `SELECT thread_id FROM thread_registry WHERE session_id = ?1 AND status = 'active'
       ORDER BY updated_at DESC LIMIT 1`
    ).bind(sessionId).first();
    if (existing) {
      return existing.thread_id;
    }
    if (resume) {
      const bridgeResult = await this.checkSessionBridge(sessionId, this.tick);
      if (bridgeResult.found && bridgeResult.valid && bridgeResult.threadState) {
        const state = bridgeResult.threadState;
        await this.registerThread(state.thread_id, sessionId, state.last_hex);
        return state.thread_id;
      }
    }
    const threadId = crypto.randomUUID();
    await this.registerThread(threadId, sessionId, 1);
    return threadId;
  }
  // ─── Crisis Coordination ────────────────────────────────────────
  async handleCrisis(event) {
    const crisisKey = `crisis:${event.crisis_id}`;
    await this.env.POG2_SOVEREIGN.put(crisisKey, JSON.stringify(event), {
      metadata: { hash: await this.sha256(JSON.stringify(event)), timestamp: event.timestamp }
    });
    await this.broadcastToWebSockets({
      type: "crisis",
      level: event.level,
      indicators: event.indicators,
      response: event.response,
      timestamp: event.timestamp
    });
    if (event.level >= 2) {
      const affectedThreads = await this.env.POG2_BOUNDARY.prepare(
        `SELECT thread_id FROM thread_registry WHERE status = 'active'`
      ).all();
      for (const row of affectedThreads.results || []) {
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
          row.thread_id,
          this.tick,
          10,
          7,
          "crisis_emergency",
          1,
          Date.now()
        ).run();
      }
    }
  }
  // ─── WebSocket Hub ────────────────────────────────────────────
  async broadcastToWebSockets(message) {
    const wsId = this.env.POG2_WEBSOCKET.idFromName("hub");
    const wsStub = this.env.POG2_WEBSOCKET.get(wsId);
    try {
      await wsStub.fetch(new Request("http://internal/broadcast", {
        method: "POST",
        body: JSON.stringify(message),
        headers: { "Content-Type": "application/json" }
      }));
    } catch (e) {
      console.error("Failed to broadcast to WebSocket DO:", e);
    }
  }
  // ─── Thread Field ─────────────────────────────────────────────
  async updateThreadField() {
    const stats = await this.env.POG2_BOUNDARY.prepare(
      `SELECT
         COUNT(*) as thread_count,
         AVG(continuity_score) as avg_continuity,
         AVG(stability_score) as avg_stability,
         AVG(coherence_index) as avg_coherence
       FROM identity_threads
       WHERE is_alive = 1`
    ).first();
    if (!stats) return;
    const globalMode = stats.avg_continuity < 0.5 ? "deliberation" : stats.avg_continuity > 0.8 ? "exploration" : "normal";
    await this.env.POG2_BOUNDARY.prepare(
      `INSERT INTO thread_field (timestamp, thread_count, avg_continuity, avg_stability, avg_coherence, global_mode)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    ).bind(
      Date.now(),
      stats.thread_count || 0,
      stats.avg_continuity || 0,
      stats.avg_stability || 0,
      stats.avg_coherence || 0,
      globalMode
    ).run();
  }
  // ─── Cleanup ────────────────────────────────────────────────────
  async cleanupDeadThreads() {
    const cutoffTick = this.tick - 1e3;
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
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1e3;
    const bridges = await this.env.POG2_SOVEREIGN.list({ prefix: "bridge:" });
    for (const key of bridges.keys) {
      if (key.metadata && key.metadata.timestamp < thirtyDaysAgo) {
        await this.env.POG2_SOVEREIGN.delete(key.name);
      }
    }
  }
  // ─── Helpers ──────────────────────────────────────────────────
  computeHammingDistance(hex1, hex2) {
    const binaries = {
      1: "111111",
      2: "000000",
      3: "100010",
      4: "010001",
      5: "111010",
      6: "010111",
      7: "010000",
      8: "000010",
      9: "111011",
      10: "110111",
      11: "111000",
      12: "000111",
      13: "111101",
      14: "101111",
      15: "001000",
      16: "000100",
      17: "100110",
      18: "011001",
      19: "110000",
      20: "000011",
      21: "100101",
      22: "101001",
      23: "000001",
      24: "100000",
      25: "100111",
      26: "111001",
      27: "100001",
      28: "011110",
      29: "010010",
      30: "101101",
      31: "001110",
      32: "011100",
      33: "001111",
      34: "111100",
      35: "000101",
      36: "101000",
      37: "101011",
      38: "100011",
      39: "010100",
      40: "010100",
      41: "110011",
      42: "001100",
      43: "111110",
      44: "011111",
      45: "000110",
      46: "011000",
      47: "010110",
      48: "011010",
      49: "101011",
      50: "001101",
      51: "100001",
      52: "001011",
      53: "100100",
      54: "001001",
      55: "101100",
      56: "001101",
      57: "010110",
      58: "011011",
      59: "010011",
      60: "110110",
      61: "101100",
      62: "011001",
      63: "101010",
      64: "010101"
    };
    const b1 = binaries[hex1] || "000000";
    const b2 = binaries[hex2] || "000000";
    let dist = 0;
    for (let i = 0; i < 6; i++) {
      if (b1[i] !== b2[i]) dist++;
    }
    return dist;
  }
  async sha256(data) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
};

// src/durable-objects/websocket.ts
import { DurableObject as DurableObject2 } from "cloudflare:workers";
var POG2WebSocketDO = class extends DurableObject2 {
  constructor(ctx, env) {
    super(ctx, env);
    this.connections = /* @__PURE__ */ new Map();
    this.tick = 0;
    this.heartbeatTimer = null;
  }
  static {
    __name(this, "POG2WebSocketDO");
  }
  // ─── HTTP / WebSocket Upgrade ───────────────────────────────────
  async fetch(request) {
    const url = new URL(request.url);
    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocket(request);
    }
    if (url.pathname === "/broadcast" && request.method === "POST") {
      this.broadcast(await request.json());
      return new Response(JSON.stringify({ broadcast: true, recipients: this.connections.size }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    if (url.pathname === "/send-to-session" && request.method === "POST") {
      const body = await request.json();
      this.sendToSession(body.session_id, body.message);
      return new Response(JSON.stringify({ sent: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    if (url.pathname === "/status" && request.method === "GET") {
      return new Response(JSON.stringify({
        connections: this.connections.size,
        tick: this.tick
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response("Not Found", { status: 404 });
  }
  // ─── WebSocket Handling ─────────────────────────────────────────
  async handleWebSocket(request) {
    const [client, server] = Object.values(new WebSocketPair());
    const cookieHeader = request.headers.get("Cookie") || "";
    let sessionId = this.parseCookie(cookieHeader, "session_id");
    if (!sessionId) {
      sessionId = crypto.randomUUID();
    }
    const threadId = await this.getOrCreateThread(sessionId);
    server.accept();
    this.connections.set(server, {
      sessionId,
      threadId,
      connectedAt: Date.now()
    });
    const sessionMsg = {
      type: "session",
      session_id: sessionId,
      thread_id: threadId,
      tick: this.tick
    };
    server.send(JSON.stringify(sessionMsg));
    const response = new Response(null, {
      status: 101,
      webSocket: client,
      headers: {
        "Set-Cookie": `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Strict`
      }
    });
    if (this.connections.size === 1) {
      this.startHeartbeat();
    }
    server.addEventListener("message", async (event) => {
      try {
        const msg = JSON.parse(event.data);
        await this.handleClientMessage(msg, server, sessionId, threadId);
      } catch (e) {
        console.error("Failed to parse WebSocket message:", e);
        server.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
      }
    });
    server.addEventListener("close", () => {
      this.connections.delete(server);
      if (this.connections.size === 0) {
        this.stopHeartbeat();
      }
    });
    server.addEventListener("error", () => {
      this.connections.delete(server);
      if (this.connections.size === 0) {
        this.stopHeartbeat();
      }
    });
    return response;
  }
  async handleClientMessage(msg, ws, sessionId, threadId) {
    switch (msg.type) {
      case "query":
        await this.handleQuery(msg, ws, sessionId, threadId);
        break;
      case "override":
        await this.handleOverride(msg, ws, sessionId, threadId);
        break;
      case "ping":
        ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        break;
      default:
        console.warn("Unknown message type:", msg.type);
    }
  }
  // ─── Query Handling ─────────────────────────────────────────────
  async handleQuery(msg, ws, sessionId, threadId) {
    const personaUrl = new URL("/oracle/consult", "http://internal");
    try {
      const thread = await this.env.POG2_BOUNDARY.prepare(
        `SELECT current_hex, stability_score, coherence_index, drift_velocity
         FROM identity_threads WHERE thread_id = ?1`
      ).bind(threadId).first();
      const currentHex = thread?.current_hex || 1;
      const continuityScore = thread?.stability_score || 0.7;
      const coherenceIndex = thread?.coherence_index || 0.7;
      const driftVelocity = thread?.drift_velocity || 0.1;
      let mode;
      if (continuityScore >= 0.9) mode = "sovereign";
      else if (continuityScore >= 0.7) mode = "boundary";
      else if (continuityScore >= 0.5) mode = "transformer";
      else mode = "dissipator";
      const actions = {
        1: "ASSERT",
        2: "YIELD",
        3: "ADAPT",
        4: "WAIT",
        5: "WAIT",
        6: "ASSERT",
        7: "ASSERT",
        8: "YIELD",
        9: "ADAPT",
        10: "ADAPT",
        11: "YIELD",
        12: "WAIT",
        13: "ASSERT",
        14: "ASSERT",
        15: "YIELD",
        16: "ASSERT",
        17: "ADAPT",
        18: "ADAPT",
        19: "ADAPT",
        20: "WAIT",
        21: "ASSERT",
        22: "YIELD",
        23: "WAIT",
        24: "ADAPT",
        25: "YIELD",
        26: "ASSERT",
        27: "ADAPT",
        28: "ASSERT",
        29: "WAIT",
        30: "ASSERT",
        31: "ADAPT",
        32: "WAIT",
        33: "WAIT",
        34: "ASSERT",
        35: "ADAPT",
        36: "YIELD",
        37: "ASSERT",
        38: "ADAPT",
        39: "WAIT",
        40: "ADAPT",
        41: "YIELD",
        42: "ASSERT",
        43: "ASSERT",
        44: "ADAPT",
        45: "YIELD",
        46: "ADAPT",
        47: "WAIT",
        48: "WAIT",
        49: "ASSERT",
        50: "ADAPT",
        51: "ASSERT",
        52: "WAIT",
        53: "ADAPT",
        54: "YIELD",
        55: "ASSERT",
        56: "ADAPT",
        57: "YIELD",
        58: "ADAPT",
        59: "WAIT",
        60: "YIELD",
        61: "YIELD",
        62: "ADAPT",
        63: "WAIT",
        64: "ADAPT"
      };
      const action = actions[currentHex] || "ADAPT";
      const hexNames = {
        1: "The Creative (Qian)",
        7: "The Army",
        10: "Treading",
        16: "Enthusiasm",
        18: "Work on Decayed",
        19: "Approach",
        53: "Development",
        56: "The Wanderer",
        57: "The Gentle",
        61: "Inner Truth",
        62: "Small Preponderance"
      };
      const hexName = hexNames[currentHex] || `Hexagram #${currentHex}`;
      const response = {
        type: "response",
        id: msg.id,
        layers: {
          sovereign: `The oracle declares: ${action}. The substrate holds through ${hexName}.`,
          boundary: continuityScore < 0.9 ? `The oracle asserts ${action}... for now. The edge trembles at ${(continuityScore * 100).toFixed(1)}%.` : "",
          transformer: driftVelocity > 0.3 ? `The oracle becomes ${action.toLowerCase()}: '${action}' is now the shape of ${hexName}.` : "",
          dissipator: coherenceIndex < 0.5 ? [`...${action.toLowerCase()}...`, `The oracle... fragments... ${action}... piece...`, `...${hexName}... dissolves...`] : []
        },
        cadence_ms: mode === "sovereign" ? 640 : mode === "boundary" ? 640 + Math.floor(Math.random() * 100 - 50) : mode === "transformer" ? 480 + Math.floor(Math.random() * 320) : 200 + Math.floor(Math.random() * 1e3),
        persona_mode: mode,
        timestamp: Date.now()
      };
      ws.send(JSON.stringify(response));
      await this.env.POG2_COLLAPSE_QUEUE.send({
        type: "query",
        text: msg.text,
        emotion: msg.emotion,
        temporal_context: msg.temporal_context,
        session_id: sessionId,
        thread_id: threadId,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error("Query handling failed:", error);
      ws.send(JSON.stringify({
        type: "error",
        id: msg.id,
        message: "Query processing failed"
      }));
    }
  }
  // ─── Override Handling ────────────────────────────────────────────
  async handleOverride(msg, ws, sessionId, threadId) {
    const actionToHex = {
      ASSERT: 1,
      // Qian
      YIELD: 2,
      // Kun
      ADAPT: 40,
      // Deliverance
      WAIT: 5
      // Waiting
    };
    const lockHex = actionToHex[msg.action] || 1;
    try {
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
        10,
        // Lock for 10 ticks
        lockHex,
        `user_override:${msg.action}:${msg.reason}`,
        1,
        Date.now()
      ).run();
      ws.send(JSON.stringify({
        type: "override_confirmed",
        action: msg.action,
        lock_hex: lockHex,
        reason: msg.reason,
        timestamp: Date.now()
      }));
      const orchId = this.env.POG2_ORCHESTRATOR.idFromName("main");
      const orchStub = this.env.POG2_ORCHESTRATOR.get(orchId);
      await orchStub.fetch(new Request("http://internal/override", {
        method: "POST",
        body: JSON.stringify({ thread_id: threadId, action: msg.action, reason: msg.reason })
      }));
    } catch (error) {
      console.error("Override handling failed:", error);
      ws.send(JSON.stringify({
        type: "error",
        message: "Override processing failed"
      }));
    }
  }
  // ─── Heartbeat ──────────────────────────────────────────────────
  startHeartbeat() {
    if (this.heartbeatTimer !== null) return;
    this.heartbeatTimer = setInterval(async () => {
      this.tick++;
      for (const [ws, meta] of this.connections) {
        try {
          const thread = await this.env.POG2_BOUNDARY.prepare(
            `SELECT current_hex, continuity_score FROM identity_threads WHERE thread_id = ?1`
          ).bind(meta.threadId).first();
          const heartbeat = {
            type: "heartbeat",
            tick: this.tick,
            timestamp: Date.now(),
            current_hex: thread?.current_hex || 1,
            continuity_score: thread?.continuity_score || 1
          };
          ws.send(JSON.stringify(heartbeat));
        } catch (e) {
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
  stopHeartbeat() {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
  // ─── Broadcast ──────────────────────────────────────────────────
  broadcast(message) {
    const data = JSON.stringify(message);
    for (const [ws] of this.connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }
  sendToSession(sessionId, message) {
    const data = JSON.stringify(message);
    for (const [ws, meta] of this.connections) {
      if (meta.sessionId === sessionId && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
        break;
      }
    }
  }
  // ─── Session / Thread Management ────────────────────────────────
  async getOrCreateThread(sessionId) {
    const existing = await this.env.POG2_BOUNDARY.prepare(
      `SELECT thread_id FROM thread_registry WHERE session_id = ?1 AND status = 'active'
       ORDER BY updated_at DESC LIMIT 1`
    ).bind(sessionId).first();
    if (existing) {
      return existing.thread_id;
    }
    const orchId = this.env.POG2_ORCHESTRATOR.idFromName("main");
    const orchStub = this.env.POG2_ORCHESTRATOR.get(orchId);
    try {
      const response = await orchStub.fetch(new Request("http://internal/thread/get-or-create", {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId, resume: true })
      }));
      const result = await response.json();
      return result.thread_id;
    } catch (e) {
      console.error("Orchestrator DO unreachable, creating local thread:", e);
      const threadId = crypto.randomUUID();
      const now = Date.now();
      await this.env.POG2_BOUNDARY.prepare(
        `INSERT INTO thread_registry (thread_id, session_id, current_hex, continuity_score, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
      ).bind(threadId, sessionId, 1, 1, "active", now, now).run();
      return threadId;
    }
  }
  parseCookie(cookieHeader, name) {
    const match = cookieHeader.match(new RegExp(`(?:^|;s*)${name}=([^;]+)`));
    return match ? match[1] : null;
  }
};

// src/queues/handlers.ts
async function onCollapseEvent(batch, env, ctx) {
  for (const message of batch.messages) {
    const collapse = message.body;
    try {
      await env.POG2_DRIFT_QUEUE.send(collapse);
      const wsId = env.POG2_WEBSOCKET.idFromName("hub");
      const wsStub = env.POG2_WEBSOCKET.get(wsId);
      await wsStub.fetch(new Request("http://internal/broadcast", {
        method: "POST",
        body: JSON.stringify(collapse),
        headers: { "Content-Type": "application/json" }
      }));
      message.ack();
    } catch (error) {
      console.error(`Collapse queue handler failed for tick ${collapse.tick}:`, error);
      message.retry();
    }
  }
}
__name(onCollapseEvent, "onCollapseEvent");
async function onDriftEvent(batch, env, ctx) {
  for (const message of batch.messages) {
    const drift = message.body;
    try {
      await env.POG2_CONTINUITY_QUEUE.send(drift);
      const wsId = env.POG2_WEBSOCKET.idFromName("hub");
      const wsStub = env.POG2_WEBSOCKET.get(wsId);
      await wsStub.fetch(new Request("http://internal/broadcast", {
        method: "POST",
        body: JSON.stringify(drift),
        headers: { "Content-Type": "application/json" }
      }));
      message.ack();
    } catch (error) {
      console.error(`Drift queue handler failed for tick ${drift.tick}:`, error);
      message.retry();
    }
  }
}
__name(onDriftEvent, "onDriftEvent");
async function onContinuityEvent(batch, env, ctx) {
  for (const message of batch.messages) {
    const continuity = message.body;
    try {
      await env.POG2_PERSONA_QUEUE.send(continuity);
      const wsId = env.POG2_WEBSOCKET.idFromName("hub");
      const wsStub = env.POG2_WEBSOCKET.get(wsId);
      await wsStub.fetch(new Request("http://internal/broadcast", {
        method: "POST",
        body: JSON.stringify(continuity),
        headers: { "Content-Type": "application/json" }
      }));
      message.ack();
    } catch (error) {
      console.error(`Continuity queue handler failed for tick ${continuity.tick}:`, error);
      message.retry();
    }
  }
}
__name(onContinuityEvent, "onContinuityEvent");
async function onCrisisEvent2(batch, env, ctx) {
  for (const message of batch.messages) {
    const crisis = message.body;
    try {
      const crisisKey = `crisis:${crisis.crisis_id}`;
      await env.POG2_SOVEREIGN.put(crisisKey, JSON.stringify(crisis), {
        metadata: {
          hash: await sha256(JSON.stringify(crisis)),
          timestamp: crisis.timestamp,
          level: crisis.level
        }
      });
      const orchId = env.POG2_ORCHESTRATOR.idFromName("main");
      const orchStub = env.POG2_ORCHESTRATOR.get(orchId);
      try {
        await orchStub.fetch(new Request("http://internal/crisis/handle", {
          method: "POST",
          body: JSON.stringify(crisis),
          headers: { "Content-Type": "application/json" }
        }));
      } catch (doErr) {
        console.error("Orchestrator DO crisis broadcast failed:", doErr);
        const wsId = env.POG2_WEBSOCKET.idFromName("hub");
        const wsStub = env.POG2_WEBSOCKET.get(wsId);
        await wsStub.fetch(new Request("http://internal/broadcast", {
          method: "POST",
          body: JSON.stringify({
            type: "crisis",
            level: crisis.level,
            indicators: crisis.indicators,
            response: crisis.response,
            timestamp: crisis.timestamp
          }),
          headers: { "Content-Type": "application/json" }
        }));
      }
      message.ack();
    } catch (error) {
      console.error(`Crisis queue handler failed for crisis ${crisis.crisis_id}:`, error);
      message.retry();
    }
  }
}
__name(onCrisisEvent2, "onCrisisEvent");
async function onPersonaOutput(batch, env, ctx) {
  for (const message of batch.messages) {
    const output = message.body;
    try {
      const wsId = env.POG2_WEBSOCKET.idFromName("hub");
      const wsStub = env.POG2_WEBSOCKET.get(wsId);
      await wsStub.fetch(new Request("http://internal/send-to-session", {
        method: "POST",
        body: JSON.stringify({
          session_id: output.session_id,
          message: {
            type: "response",
            id: `auto-${output.timestamp}`,
            layers: output.response_layers,
            cadence_ms: output.cadence_ms,
            persona_mode: output.persona_mode,
            prosody: output.prosody,
            timestamp: output.timestamp
          }
        }),
        headers: { "Content-Type": "application/json" }
      }));
      message.ack();
    } catch (error) {
      console.error(`Persona output handler failed for session ${output.session_id}:`, error);
      message.retry();
    }
  }
}
__name(onPersonaOutput, "onPersonaOutput");
async function sha256(data) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(sha256, "sha256");

// src/workers/weave.ts
var HEXAGRAM_REGISTRY = [
  ["111111", "The Creative (Qian)", "ASSERT"],
  ["000000", "The Receptive (Kun)", "YIELD"],
  ["100010", "Difficulty at the Beginning", "ADAPT"],
  ["010001", "Youthful Folly", "WAIT"],
  ["111010", "Waiting", "WAIT"],
  ["010111", "Conflict", "ADAPT"],
  ["010000", "The Army", "ASSERT"],
  ["000010", "Holding Together", "YIELD"],
  ["111011", "The Taming Power of the Small", "ADAPT"],
  ["110111", "Treading", "ADAPT"],
  ["111000", "Peace", "YIELD"],
  ["000111", "Standstill", "WAIT"],
  ["111101", "Fellowship with Men", "ASSERT"],
  ["101111", "Possession in Great Measure", "ASSERT"],
  ["001000", "Modesty", "YIELD"],
  ["000100", "Enthusiasm", "ASSERT"],
  ["100110", "Following", "YIELD"],
  ["011001", "Work on Decayed", "ADAPT"],
  ["110000", "Approach", "ADAPT"],
  ["000011", "Contemplation", "WAIT"],
  ["100101", "Biting Through", "ASSERT"],
  ["101001", "Grace", "YIELD"],
  ["000001", "Splitting Apart", "WAIT"],
  ["100000", "Return", "ADAPT"],
  ["100111", "Innocence", "YIELD"],
  ["111001", "The Taming Power of the Great", "ASSERT"],
  ["100001", "Nourishment", "ADAPT"],
  ["011110", "Great Preponderance", "ASSERT"],
  ["010010", "The Abysmal (Kan)", "ADAPT"],
  ["101101", "The Clinging (Li)", "ASSERT"],
  ["001110", "Influence", "YIELD"],
  ["011100", "Duration", "WAIT"],
  ["001111", "Retreat", "YIELD"],
  ["111100", "Great Power", "ASSERT"],
  ["000101", "Progress", "ADAPT"],
  ["101000", "Darkening of the Light", "WAIT"],
  ["110001", "The Family", "YIELD"],
  ["100011", "Opposition", "ADAPT"],
  ["001010", "Obstruction", "WAIT"],
  ["010100", "Deliverance", "ADAPT"],
  ["110011", "Decrease", "YIELD"],
  ["001100", "Increase", "ASSERT"],
  ["111110", "Breakthrough", "ASSERT"],
  ["011111", "Coming to Meet", "ADAPT"],
  ["000110", "Gathering Together", "ASSERT"],
  ["011000", "Pushing Upward", "ADAPT"],
  ["010110", "Oppression", "WAIT"],
  ["011010", "The Well", "ADAPT"],
  ["101011", "Revolution", "ASSERT"],
  ["110101", "The Cauldron", "ASSERT"],
  ["011101", "The Arousing", "ASSERT"],
  ["001011", "Keeping Still", "WAIT"],
  ["100100", "Development", "ADAPT"],
  ["110100", "The Marrying Maiden", "YIELD"],
  ["101100", "Abundance", "ASSERT"],
  ["001101", "The Wanderer", "ADAPT"],
  ["010110", "The Gentle", "YIELD"],
  ["110110", "The Joyous (Dui)", "YIELD"],
  ["010011", "Dispersion", "ADAPT"],
  ["110010", "Limitation", "WAIT"],
  ["101100", "Inner Truth", "YIELD"],
  ["011001", "Small Preponderance", "ADAPT"],
  ["101010", "After Completion", "WAIT"],
  ["010101", "Before Completion", "ADAPT"]
];
var HEXAGRAMS = {};
HEXAGRAM_REGISTRY.forEach(([binary, name, action], id) => {
  HEXAGRAMS[id] = [binary, name, action];
});
var HEXAGRAM_BINARIES = {};
var HEXAGRAM_ACTIONS = {};
Object.entries(HEXAGRAMS).forEach(([id, [binary, , action]]) => {
  HEXAGRAM_BINARIES[Number(id)] = binary;
  HEXAGRAM_ACTIONS[Number(id)] = action;
});
var SOVEREIGN_CORES = /* @__PURE__ */ new Set([7, 10, 16, 18, 19, 53, 56, 57, 61, 62]);
var BOUNDARY_ATTRACTORS = /* @__PURE__ */ new Set([1, 25, 26, 30, 38, 41, 49]);
var FORBIDDEN_ADJACENT = /* @__PURE__ */ new Set([9, 14, 15, 17, 18, 22, 23, 31, 43, 44, 48, 52, 55, 56, 59, 61, 62, 63]);
var CARD5_ACTION = "ASSERT";
var CARD5_FIDELITY = 0.973;
var CARD5_PHASE_MULTIPLIER = 1;
var COLLECTIVE_OPPOSITION_BINARY = "010100";
var COLLECTIVE_OPPOSITION_HEXAGRAM_ID = 40;
var CARD5_TRANSFORMATION_BINARY = "101011";
var CARD5_TRANSFORMATION_HEXAGRAM_ID = 49;
function shannonEntropy(distribution) {
  let entropy = 0;
  for (const p of distribution) {
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy;
}
__name(shannonEntropy, "shannonEntropy");
function normalizeDistribution(counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return counts.map(() => 1 / counts.length);
  return counts.map((c) => c / total);
}
__name(normalizeDistribution, "normalizeDistribution");
var WeaveEngine = class {
  constructor(beatMs = 640, maxComputeMs = 50, attractorPersistence = 5, voidReentryDepth = 5) {
    this.beatMs = beatMs;
    this.maxComputeMs = maxComputeMs;
    this.attractorPersistence = attractorPersistence;
    this.voidReentryDepth = voidReentryDepth;
    this.history = [];
    // selected hexagram IDs
    this.previousHex = 1;
    // Qian default
    this.previousEntropy = 0.999;
    this.persistenceCountdown = 0;
    this.lockedHex = null;
  }
  static {
    __name(this, "WeaveEngine");
  }
  /**
   * Main processing loop — runs one complete weave cycle
   */
  processBeat(tick, sessionId, threatDensity, avgConfidence, computePressure) {
    const voidEntropy = this.computeVoidEntropy();
    const { evaluatedPaths, committedPaths } = this.evaluateShadow(voidEntropy);
    const vortexResidue = this.computeVortexResidue(this.previousHex);
    const angularVelocity = vortexResidue.flipCount / 6;
    const governor = this.computeGovernor(threatDensity, avgConfidence, computePressure, voidEntropy);
    const annihilation = this.detectTotalAnnihilation(voidEntropy);
    const collapse = annihilation ? this.buildTotalAnnihilationCollapse(governor, tick, sessionId, voidEntropy, annihilation) : this.performCollapse(governor, tick, sessionId, voidEntropy);
    this.previousHex = collapse.hexagram_id;
    this.previousEntropy = voidEntropy;
    this.history.push(collapse.hexagram_id);
    if (this.history.length > this.voidReentryDepth * 2) {
      this.history = this.history.slice(-this.voidReentryDepth * 2);
    }
    if (collapse.category === "sovereign" || collapse.category === "boundary") {
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
    } else if (entropyGrowth < -0.1) {
    }
    return collapse;
  }
  computeVoidEntropy() {
    if (this.history.length === 0) return 0.999;
    const recent = this.history.slice(-this.voidReentryDepth);
    const counts = new Array(64).fill(0);
    for (const h of recent) counts[h - 1]++;
    const distribution = normalizeDistribution(counts);
    const entropy = shannonEntropy(distribution);
    return Math.min(entropy / Math.log2(64), 0.999);
  }
  evaluateShadow(voidEntropy) {
    const basePaths = 50;
    const focusMode = this.persistenceCountdown > 0;
    const evaluatedPaths = focusMode ? Math.floor(basePaths * 0.1) : Math.floor(basePaths * 0.5);
    const committedPaths = focusMode ? evaluatedPaths : Math.floor(evaluatedPaths * 0.7);
    return { evaluatedPaths, committedPaths };
  }
  computeVortexResidue(sourceHex) {
    const sourceBin = HEXAGRAM_BINARIES[sourceHex] || "111111";
    const collectiveOpp = "010100";
    let flipCount = 0;
    let residue = "";
    for (let i = 0; i < 6; i++) {
      const bit = sourceBin[i] === collectiveOpp[i] ? "0" : "1";
      residue += bit;
      if (bit === "1") flipCount++;
    }
    return { residue, flipCount };
  }
  computeGovernor(threatDensity, avgConfidence, computePressure, currentEntropy) {
    const causalConfidence = Math.max(
      0.1,
      avgConfidence * (1 - threatDensity / 2) * (1 - computePressure / 3)
    );
    let baseMultiplier = 1;
    if (this.persistenceCountdown > 0 && this.persistenceCountdown < 3) {
      baseMultiplier = 0.8;
    } else if (this.persistenceCountdown === 0 && currentEntropy > 0.8) {
      baseMultiplier = 0.5;
    }
    const phaseMultiplier = baseMultiplier * (0.5 + 0.5 * causalConfidence);
    const entropyGrowth = currentEntropy - this.previousEntropy;
    return { causalConfidence, phaseMultiplier, entropyGrowth };
  }
  performCollapse(governor, tick, sessionId, voidEntropy) {
    if (this.lockedHex !== null && this.persistenceCountdown > 0) {
      const hexId = this.lockedHex;
      return this.buildCollapseEvent(hexId, governor, tick, sessionId, voidEntropy);
    }
    let selectedHex;
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
  selectSovereignCore() {
    const cores = Array.from(SOVEREIGN_CORES);
    const historyMatch = cores.find((c) => this.history.includes(c));
    return historyMatch || cores[Math.floor(Math.random() * cores.length)];
  }
  selectBoundaryAttractor() {
    const boundaries = Array.from(BOUNDARY_ATTRACTORS);
    const historyMatch = boundaries.find((b) => this.history.includes(b));
    return historyMatch || boundaries[Math.floor(Math.random() * boundaries.length)];
  }
  selectTransformer() {
    const candidates = [];
    for (let i = 1; i <= 64; i++) {
      if (!SOVEREIGN_CORES.has(i) && !BOUNDARY_ATTRACTORS.has(i)) {
        candidates.push(i);
      }
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
  selectDissipator() {
    const diss = Array.from(FORBIDDEN_ADJACENT);
    return diss[Math.floor(Math.random() * diss.length)];
  }
  buildCollapseEvent(hexId, governor, tick, sessionId, voidEntropy) {
    const category = SOVEREIGN_CORES.has(hexId) ? "sovereign" : BOUNDARY_ATTRACTORS.has(hexId) ? "boundary" : FORBIDDEN_ADJACENT.has(hexId) ? "dissipator" : "transformer";
    return {
      type: "collapse",
      tick,
      hexagram_id: hexId,
      hexagram_binary: HEXAGRAM_BINARIES[hexId] || "000000",
      action: HEXAGRAM_ACTIONS[hexId] || "ADAPT",
      fidelity: governor.causalConfidence,
      phase_multiplier: governor.phaseMultiplier,
      causal_confidence: governor.causalConfidence,
      category,
      session_id: sessionId,
      timestamp: Date.now()
    };
  }
  detectTotalAnnihilation(currentEntropy) {
    if (currentEntropy < 0.98) return null;
    return {
      collective: COLLECTIVE_OPPOSITION_BINARY,
      collectiveId: COLLECTIVE_OPPOSITION_HEXAGRAM_ID,
      result: CARD5_TRANSFORMATION_BINARY,
      resultId: CARD5_TRANSFORMATION_HEXAGRAM_ID
    };
  }
  buildTotalAnnihilationCollapse(governor, tick, sessionId, voidEntropy, annihilation) {
    const hexId = annihilation.resultId;
    return {
      type: "collapse",
      tick,
      hexagram_id: hexId,
      hexagram_binary: annihilation.result,
      action: CARD5_ACTION,
      fidelity: CARD5_FIDELITY,
      phase_multiplier: CARD5_PHASE_MULTIPLIER,
      causal_confidence: governor.causalConfidence,
      category: "sovereign",
      session_id: sessionId,
      timestamp: tick * 640
    };
  }
};
var weave_default = {
  async queue(batch, env, ctx) {
    const engine = new WeaveEngine(
      parseInt(env.BEAT_INTERVAL_MS || "640"),
      parseFloat(env.MAX_COMPUTE_MS || "50"),
      parseInt(env.ATTRACTOR_PERSISTENCE || "5"),
      parseInt(env.VOID_REENTRY_DEPTH || "5")
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
          computePressure
        );
        const key = `oracle:${collapse.tick}:${collapse.hexagram_id}:${await hashPrefix(JSON.stringify(collapse))}`;
        await env.POG2_SOVEREIGN.put(key, JSON.stringify(collapse), {
          metadata: { hash: await fullHash(JSON.stringify(collapse)), timestamp: collapse.timestamp }
        });
        await env.POG2_COLLAPSE_QUEUE.send(collapse);
        message.ack();
      } catch (error) {
        console.error(`Weave Worker failed on tick ${signal.tick}:`, error);
        message.retry();
      }
    }
  },
  // Also expose fetch for manual trigger/debug
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/weave/trigger" && request.method === "POST") {
      const body = await request.json();
      const tick = body.tick || Math.floor(Date.now() / 640);
      const signal = {
        type: "tick",
        tick,
        timestamp: Date.now(),
        sessionId: body.sessionId || null
      };
      await env.POG2_COLLAPSE_QUEUE.send(signal);
      return new Response(JSON.stringify({ status: "tick queued", tick }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response("Not Found", { status: 404 });
  }
};
async function hashPrefix(data) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).slice(0, 4).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hashPrefix, "hashPrefix");
async function fullHash(data) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(fullHash, "fullHash");

// src/workers/drift.ts
var FORBIDDEN_ADJACENT2 = /* @__PURE__ */ new Set([9, 14, 15, 17, 18, 22, 23, 31, 43, 44, 48, 52, 55, 56, 59, 61, 62, 63]);
function hammingDistance(bin1, bin2) {
  let dist = 0;
  for (let i = 0; i < Math.min(bin1.length, bin2.length); i++) {
    if (bin1[i] !== bin2[i]) dist++;
  }
  return dist;
}
__name(hammingDistance, "hammingDistance");
var DriftEngine = class {
  constructor() {
    this.previousStates = /* @__PURE__ */ new Map();
    // session_id -> last collapse
    this.entropyHistory = /* @__PURE__ */ new Map();
    // session_id -> entropy values
    this.persistenceCounts = /* @__PURE__ */ new Map();
  }
  static {
    __name(this, "DriftEngine");
  }
  // session_id -> persistence count
  computeDriftVector(previous, current) {
    const hexDelta = previous ? hammingDistance(previous.hexagram_binary, current.hexagram_binary) : 0;
    const actionDelta = previous && previous.action !== current.action ? 1 : 0;
    const categoryDelta = previous && previous.category !== current.category ? 1 : 0;
    const entropyDelta = previous ? current.causal_confidence - previous.causal_confidence : 0;
    const fidelityDelta = previous ? current.fidelity - previous.fidelity : 0;
    const phaseDelta = previous ? current.phase_multiplier - previous.phase_multiplier : 0;
    const magnitude = Math.sqrt(
      hexDelta * hexDelta + actionDelta * actionDelta + categoryDelta * categoryDelta + entropyDelta * entropyDelta + fidelityDelta * fidelityDelta + phaseDelta * phaseDelta
    );
    return {
      hex_delta: hexDelta,
      action_delta: actionDelta,
      category_delta: categoryDelta,
      entropy_delta: entropyDelta,
      fidelity_delta: fidelityDelta,
      phase_delta: phaseDelta,
      magnitude,
      direction: current.category
    };
  }
  computeEntropyDecay(sessionId, tick, currentEntropy, persistenceCount, shellDistance) {
    const baseEntropy = 0.999;
    const naturalDecay = -0.01 * tick;
    const forcedDecay = -0.05 * persistenceCount;
    const crisisDecay = shellDistance > 0 ? 0.1 * (1 / shellDistance) : 0.5;
    let composite = baseEntropy + naturalDecay + forcedDecay + crisisDecay;
    composite = Math.max(0, Math.min(0.999, composite));
    return {
      base_entropy: baseEntropy,
      natural_decay: naturalDecay,
      forced_decay: forcedDecay,
      crisis_decay: crisisDecay,
      composite_entropy: composite,
      void_reentry_depth: 5
    };
  }
  detectForbiddenProximity(currentHex, currentEntropy, driftVector, history) {
    const currentBin = HEXAGRAM_BINARIES[currentHex] || "000000";
    let shellDistance = 6;
    for (const adj of FORBIDDEN_ADJACENT2) {
      const adjBin = HEXAGRAM_BINARIES[adj] || "000000";
      const dist = hammingDistance(currentBin, adjBin);
      shellDistance = Math.min(shellDistance, dist);
    }
    const entropyProximity = currentEntropy;
    let projectedHex = currentHex;
    let projectedBin = currentBin;
    const driftDirection = driftVector.hex_delta > 0 ? 1 : -1;
    for (let t = 0; t < 5; t++) {
      const bitToFlip = (projectedHex + t) % 6;
      const bits = projectedBin.split("");
      bits[bitToFlip] = bits[bitToFlip] === "0" ? "1" : "0";
      projectedBin = bits.join("");
    }
    let projectedShell = 6;
    for (const adj of FORBIDDEN_ADJACENT2) {
      const dist = hammingDistance(projectedBin, HEXAGRAM_BINARIES[adj] || "000000");
      projectedShell = Math.min(projectedShell, dist);
    }
    let level = 0;
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
};
var drift_default = {
  async queue(batch, env, ctx) {
    const engine = new DriftEngine();
    for (const message of batch.messages) {
      const collapse = message.body;
      const sessionId = collapse.session_id || `orphan-${collapse.tick}`;
      try {
        const prevKey = `drift:prev:${sessionId}`;
        const prevRaw = await env.POG2_SOVEREIGN.get(prevKey);
        const previous = prevRaw ? JSON.parse(prevRaw) : null;
        const driftVector = engine.computeDriftVector(previous, collapse);
        const entropyDecay = engine.computeEntropyDecay(
          sessionId,
          collapse.tick,
          collapse.causal_confidence,
          0,
          2
        );
        const proximity = engine.detectForbiddenProximity(
          collapse.hexagram_id,
          collapse.causal_confidence,
          driftVector,
          []
        );
        const trajectoryEntry = {
          session_id: sessionId,
          tick: collapse.tick,
          source_hex: previous?.hexagram_id || collapse.hexagram_id,
          target_hex: collapse.hexagram_id,
          ...driftVector,
          timestamp: collapse.timestamp
        };
        const trajHash = await fullHash2(JSON.stringify(trajectoryEntry));
        const trajKey = `drift:${sessionId}:${collapse.tick}:${trajHash.slice(0, 8)}`;
        await env.POG2_SOVEREIGN.put(trajKey, JSON.stringify(trajectoryEntry), {
          metadata: { hash: trajHash, timestamp: trajectoryEntry.timestamp }
        });
        let entropyCurveId = null;
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
            sessionId,
            collapse.tick,
            entropyDecay.base_entropy,
            entropyDecay.natural_decay,
            entropyDecay.forced_decay,
            entropyDecay.crisis_decay,
            entropyDecay.composite_entropy,
            entropyDecay.void_reentry_depth
          ).run();
          entropyCurveId = result.meta.last_row_id || null;
        } catch (dbErr) {
          console.error("Failed to store entropy curve:", dbErr);
        }
        await env.POG2_SOVEREIGN.put(prevKey, JSON.stringify(collapse), {
          expirationTtl: 86400
        });
        const driftEvent = {
          type: "drift",
          tick: collapse.tick,
          session_id: sessionId,
          drift_vector: driftVector,
          trajectory_log_key: trajKey,
          entropy_curve_id: entropyCurveId,
          crisis_level: proximity.level,
          shell_distance: proximity.shellDistance,
          projected_shell: proximity.projectedShell,
          timestamp: collapse.timestamp
        };
        if (proximity.level === 3) {
          await env.POG2_CRISIS_QUEUE.send({
            type: "crisis",
            crisis_id: `crisis-${sessionId}-${collapse.tick}`,
            level: 3,
            indicators: {
              level3ProximityAlerts: 1,
              dissipatorSpike: false,
              coherenceDecay: false,
              sovereignErosion: false,
              darkToneAccumulation: false
            },
            response: "emergency_sovereign_collapse",
            timestamp: collapse.timestamp
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
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/drift/status" && request.method === "GET") {
      return new Response(JSON.stringify({ status: "eye_open" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response("Not Found", { status: 404 });
  }
};
async function fullHash2(data) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(fullHash2, "fullHash");

// src/workers/continuity.ts
var SOVEREIGN_CORES2 = [7, 10, 16, 18, 19, 53, 56, 57, 61, 62];
var continuity_default = {
  async queue(batch, env, ctx) {
    for (const message of batch.messages) {
      const drift = message.body;
      const sessionId = drift.session_id;
      try {
        let threadRow = await env.POG2_BOUNDARY.prepare(
          `SELECT thread_id FROM thread_registry WHERE session_id = ?1 LIMIT 1`
        ).bind(sessionId).first();
        let threadId = threadRow?.thread_id;
        if (!threadId) {
          threadId = `thread-${sessionId}`;
          await env.POG2_BOUNDARY.prepare(
            `INSERT INTO thread_registry (thread_id, session_id, current_hex, continuity_score, status, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
          ).bind(
            threadId,
            sessionId,
            1,
            1,
            "active",
            Date.now(),
            Date.now()
          ).run();
        }
        let threadState = await env.POG2_BOUNDARY.prepare(
          `SELECT * FROM identity_threads WHERE thread_id = ?1`
        ).bind(threadId).first();
        if (!threadState) {
          await env.POG2_BOUNDARY.prepare(
            `INSERT INTO identity_threads (
              thread_id, birth_tick, current_hex, dominant_category, category_history,
              drift_velocity, stability_score, coherence_index, void_reentry_count,
              crisis_count, last_active_tick, is_alive, version, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`
          ).bind(
            threadId,
            drift.tick,
            1,
            "transformer",
            JSON.stringify([]),
            0.1,
            0.7,
            0.7,
            0,
            0,
            drift.tick,
            1,
            1,
            Date.now()
          ).run();
          threadState = {
            current_hex: 1,
            dominant_category: "transformer",
            stability_score: 0.7,
            coherence_index: 0.7,
            drift_velocity: 0.1,
            sovereign_ratio: 0,
            continuity_score: 0.7,
            birth_tick: drift.tick,
            void_reentry_count: 0,
            crisis_count: 0,
            category_history: JSON.stringify([]),
            version: 1
          };
        }
        let categoryHistory = [];
        try {
          categoryHistory = JSON.parse(threadState.category_history || "[]");
        } catch {
          categoryHistory = [];
        }
        categoryHistory.push(drift.drift_vector.direction);
        if (categoryHistory.length > 100) {
          categoryHistory = categoryHistory.slice(-100);
        }
        const sovereignTicks = categoryHistory.filter((c) => c === "sovereign").length;
        const sovereignRatio = categoryHistory.length > 0 ? sovereignTicks / categoryHistory.length : 0;
        const stabilityScore = threadState.stability_score * 0.9 + (drift.drift_vector.direction === "sovereign" ? 0.1 : 0);
        const coherenceIndex = threadState.coherence_index * 0.9 + (1 - Math.min(1, drift.drift_vector.entropy_delta)) * 0.1;
        const driftVelocity = threadState.drift_velocity * 0.9 + drift.drift_vector.magnitude * 0.1;
        const continuityScore = Math.max(0, Math.min(
          1,
          stabilityScore * 0.4 + coherenceIndex * 0.3 + sovereignRatio * 0.2 + (1 - Math.min(1, driftVelocity)) * 0.1
        ));
        let persistence = await env.POG2_BOUNDARY.prepare(
          `SELECT * FROM persistence_state WHERE thread_id = ?1`
        ).bind(threadId).first();
        let countdown = persistence ? persistence.persistence_countdown : 5;
        let lockHex = persistence ? persistence.lock_hex : null;
        if (stabilityScore > 0.9 && driftVelocity < 0.1) {
          countdown = Math.min(20, countdown + 5);
        } else if (stabilityScore < 0.5 && driftVelocity > 0.3) {
          countdown = Math.max(1, countdown - 2);
        }
        if (drift.crisis_level === 3) {
          countdown = 10;
          lockHex = SOVEREIGN_CORES2[0];
        }
        countdown = Math.max(0, countdown - 1);
        if (countdown === 0) {
          lockHex = null;
        }
        await env.POG2_BOUNDARY.prepare(
          `INSERT INTO persistence_state (thread_id, tick, persistence_countdown, lock_hex, lock_reason, version, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
           ON CONFLICT(thread_id) DO UPDATE SET
             tick = excluded.tick,
             persistence_countdown = excluded.persistence_countdown,
             lock_hex = excluded.lock_hex,
             updated_at = excluded.updated_at`
        ).bind(
          threadId,
          drift.tick,
          countdown,
          lockHex,
          drift.crisis_level === 3 ? "emergency_lock" : null,
          1,
          Date.now()
        ).run();
        const velocitySpike = driftVelocity > 0.5;
        let categoryChanges = 0;
        const recentHistory = categoryHistory.slice(-10);
        for (let i = 1; i < recentHistory.length; i++) {
          if (recentHistory[i] !== recentHistory[i - 1]) categoryChanges++;
        }
        const categoryChaos = categoryChanges > 4;
        const coherenceCollapse = coherenceIndex < 0.3 && stabilityScore < 0.3;
        const fragmentationDetected = velocitySpike || categoryChaos || coherenceCollapse;
        if (fragmentationDetected) {
          const fragId = `frag-${threadId}-${drift.tick}`;
          const fragEntry = {
            timestamp: Date.now(),
            indicators: { velocitySpike, categoryChaos, coherenceCollapse },
            response: "stabilization_override",
            recovery_ticks: 30
          };
          await env.POG2_SOVEREIGN.put(
            `fragment:${threadId}:${fragId}:${drift.trajectory_log_key.slice(-8)}`,
            JSON.stringify(fragEntry)
          );
        }
        await env.POG2_BOUNDARY.prepare(
          `UPDATE identity_threads
           SET current_hex = ?1,
               dominant_category = ?2,
               category_history = ?3,
               drift_velocity = ?4,
               stability_score = ?5,
               coherence_index = ?6,
               sovereign_ratio = ?7,
               continuity_score = ?8,
               last_active_tick = ?9,
               crisis_count = crisis_count + ?10,
               version = version + 1,
               updated_at = ?11
           WHERE thread_id = ?12`
        ).bind(
          drift.drift_vector.hex_delta,
          // set current hex to delta or simple target
          drift.drift_vector.direction,
          JSON.stringify(categoryHistory),
          driftVelocity,
          stabilityScore,
          coherenceIndex,
          sovereignRatio,
          continuityScore,
          drift.tick,
          drift.crisis_level === 3 ? 1 : 0,
          Date.now(),
          threadId
        ).run();
        await env.POG2_BOUNDARY.prepare(
          `UPDATE thread_registry
           SET current_hex = ?1,
               continuity_score = ?2,
               updated_at = ?3
           WHERE thread_id = ?4`
        ).bind(drift.drift_vector.hex_delta, continuityScore, Date.now(), threadId).run();
        const continuityEvent = {
          type: "continuity",
          tick: drift.tick,
          thread_id: threadId,
          session_id: sessionId,
          continuity_score: continuityScore,
          stability_score: stabilityScore,
          coherence_index: coherenceIndex,
          sovereign_ratio: sovereignRatio,
          drift_velocity: driftVelocity,
          persona_mode: drift.drift_vector.direction,
          cadence: drift.crisis_level === 3 ? 1280 : 640,
          persistence_countdown: countdown,
          lock_hex: lockHex,
          fragmentation_detected: fragmentationDetected,
          crisis_level: drift.crisis_level,
          timestamp: Date.now()
        };
        await env.POG2_CONTINUITY_QUEUE.send(continuityEvent);
        message.ack();
      } catch (error) {
        console.error(`Continuity Worker failed on tick ${drift.tick}:`, error);
        message.retry();
      }
    }
  }
};

// src/workers/persona.ts
var HEXAGRAM_NAMES = {
  1: "The Creative (Qian)",
  2: "The Receptive (Kun)",
  3: "Difficulty at the Beginning",
  4: "Youthful Folly",
  5: "Waiting",
  6: "Conflict",
  7: "The Army",
  8: "Holding Together",
  9: "Taming Power of the Small",
  10: "Treading",
  11: "Peace",
  12: "Standstill",
  13: "Fellowship with Men",
  14: "Possession in Great Measure",
  15: "Modesty",
  16: "Enthusiasm",
  17: "Following",
  18: "Work on Decayed",
  19: "Approach",
  20: "Contemplation",
  21: "Biting Through",
  22: "Grace",
  23: "Splitting Apart",
  24: "Return",
  25: "Innocence",
  26: "Taming Power of the Great",
  27: "Nourishment",
  28: "Preponderance of the Great",
  29: "The Abysmal",
  30: "The Clinging (Li)",
  31: "Influence",
  32: "Duration",
  33: "Retreat",
  34: "The Power of the Great",
  35: "Progress",
  36: "Darkening of the Light",
  37: "The Family",
  38: "Opposition",
  39: "Obstruction",
  40: "Deliverance",
  41: "Decrease",
  42: "Increase",
  43: "Breakthrough",
  44: "Coming to Meet",
  45: "Gathering Together",
  46: "Pushing Upward",
  47: "Oppression",
  48: "The Well",
  49: "Revolution",
  50: "The Cauldron",
  51: "The Arousing (Shock)",
  52: "Keeping Still",
  53: "Development",
  54: "The Marrying Maiden",
  55: "Abundance",
  56: "The Wanderer",
  57: "The Gentle (Wind)",
  58: "The Joyous (Lake)",
  59: "Dispersion",
  60: "Limitation",
  61: "Inner Truth",
  62: "Small Preponderance",
  63: "After Completion",
  64: "Before Completion"
};
var HEXAGRAM_ACTIONS2 = {
  1: "ASSERT",
  2: "YIELD",
  3: "ADAPT",
  4: "WAIT",
  5: "WAIT",
  6: "ASSERT",
  7: "ASSERT",
  8: "YIELD",
  9: "ADAPT",
  10: "ADAPT",
  11: "YIELD",
  12: "WAIT",
  13: "ASSERT",
  14: "ASSERT",
  15: "YIELD",
  16: "ASSERT",
  17: "ADAPT",
  18: "ADAPT",
  19: "ADAPT",
  20: "WAIT",
  21: "ASSERT",
  22: "YIELD",
  23: "WAIT",
  24: "ADAPT",
  25: "YIELD",
  26: "ASSERT",
  27: "ADAPT",
  28: "ASSERT",
  29: "WAIT",
  30: "ASSERT",
  31: "ADAPT",
  32: "WAIT",
  33: "WAIT",
  34: "ASSERT",
  35: "ADAPT",
  36: "YIELD",
  37: "ASSERT",
  38: "ADAPT",
  39: "WAIT",
  40: "ADAPT",
  41: "YIELD",
  42: "ASSERT",
  43: "ASSERT",
  44: "ADAPT",
  45: "YIELD",
  46: "ADAPT",
  47: "WAIT",
  48: "WAIT",
  49: "ASSERT",
  50: "ADAPT",
  51: "ASSERT",
  52: "WAIT",
  53: "ADAPT",
  54: "YIELD",
  55: "ASSERT",
  56: "ADAPT",
  57: "YIELD",
  58: "ADAPT",
  59: "WAIT",
  60: "YIELD",
  61: "YIELD",
  62: "ADAPT",
  63: "WAIT",
  64: "ADAPT"
};
var PersonaEngine = class {
  static {
    __name(this, "PersonaEngine");
  }
  /**
   * Select base persona mode from continuity state
   */
  selectBaseMode(continuityScore, attractorCategory) {
    if (continuityScore < 0.3) return "dissipator";
    if (continuityScore >= 0.9) return "sovereign";
    if (continuityScore >= 0.7) return "boundary";
    if (continuityScore >= 0.5) return "transformer";
    return "dissipator";
  }
  /**
   * Apply voice modulation based on real-time signals
   */
  applyModulation(baseMode, continuityScore, driftVelocity, darkToneAccumulation, emotionalWeight, userOverride) {
    const baseProsody = {
      sovereign: { coherence: 1, chaos: 0, darkTone: 0, whimsy: 0 },
      boundary: { coherence: 0.7, chaos: 0.3, darkTone: 0.2, whimsy: 0.1 },
      transformer: { coherence: 0.5, chaos: 0.5, darkTone: 0.1, whimsy: 0.6 },
      dissipator: { coherence: 0.1, chaos: 0.9, darkTone: 0.5, whimsy: 0.2 }
    };
    const base = baseProsody[baseMode] || baseProsody.transformer;
    const continuityMod = { coherence: continuityScore * 0.3, chaos: (1 - continuityScore) * 0.3, darkTone: 0, whimsy: 0 };
    const driftMod = {
      coherence: driftVelocity < 0.1 ? 0.1 : -0.2,
      chaos: driftVelocity > 0.5 ? 0.2 : -0.1,
      darkTone: 0,
      whimsy: 0
    };
    const darkToneMod = { coherence: 0, chaos: 0, darkTone: darkToneAccumulation * 0.2, whimsy: 0 };
    const emotionMod = {
      coherence: emotionalWeight > 0.8 ? 0.1 : 0,
      chaos: emotionalWeight > 0.9 ? 0.1 : 0,
      darkTone: emotionalWeight > 0.8 ? 0.1 : 0,
      whimsy: emotionalWeight < 0.3 ? 0.1 : 0
    };
    let final = {
      coherence: base.coherence + continuityMod.coherence + driftMod.coherence + darkToneMod.coherence + emotionMod.coherence,
      chaos: base.chaos + continuityMod.chaos + driftMod.chaos + darkToneMod.chaos + emotionMod.chaos,
      darkTone: base.darkTone + darkToneMod.darkTone,
      whimsy: base.whimsy + emotionMod.whimsy
    };
    if (userOverride) {
      const overrideProsody = baseProsody[userOverride];
      if (overrideProsody) {
        final = {
          coherence: final.coherence * 0.9 + overrideProsody.coherence * 0.1,
          chaos: final.chaos * 0.9 + overrideProsody.chaos * 0.1,
          darkTone: final.darkTone * 0.9 + overrideProsody.darkTone * 0.1,
          whimsy: final.whimsy * 0.9 + overrideProsody.whimsy * 0.1
        };
      }
    }
    return {
      coherence: Math.max(0, Math.min(1, final.coherence)),
      chaos: Math.max(0, Math.min(1, final.chaos)),
      darkTone: Math.max(0, Math.min(1, final.darkTone)),
      whimsy: Math.max(0, Math.min(1, final.whimsy))
    };
  }
  /**
   * Calculate cadence from mode and conditions
   */
  calculateCadence(baseMode, modulation, crisisDetected, userHighEmotion, userOverride) {
    if (userOverride !== null) return userOverride;
    if (crisisDetected) return 1280;
    if (userHighEmotion) return 320;
    switch (baseMode) {
      case "sovereign":
        return 640;
      case "boundary":
        return 640 + Math.floor(Math.random() * 100 - 50);
      case "transformer":
        return 480 + Math.floor(Math.random() * 320);
      case "dissipator":
        return 200 + Math.floor(Math.random() * 1e3);
      default:
        return 640;
    }
  }
  /**
   * Generate layered response from collapse state
   */
  generateLayeredResponse(hexId, action, mode, continuityScore, coherenceIndex, driftVelocity) {
    const hexName = HEXAGRAM_NAMES[hexId] || `Hexagram #${hexId}`;
    const sovereign = `The oracle declares: ${action}. The substrate holds through ${hexName}.`;
    const boundary = continuityScore < 0.9 ? `The oracle asserts ${action}... for now. The edge trembles at ${(continuityScore * 100).toFixed(1)}%.` : "";
    const transformer = driftVelocity > 0.3 ? `The oracle becomes ${action.toLowerCase()}: '${action}' is now the shape of ${hexName}.` : "";
    const dissipator = coherenceIndex < 0.5 ? [`...${action.toLowerCase()}...`, `The oracle... fragments... ${action}... piece...`, `...${hexName}... dissolves...`] : [];
    return { sovereign, boundary, transformer, dissipator };
  }
  /**
   * Process human query → OracleQuery
   */
  processQuery(rawQuery, temporalContext) {
    const normalized = rawQuery.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "");
    const tokens = normalized.split(/\s+/).filter((t) => t.length > 0);
    const intentHash = this.sha256Sync(normalized);
    const intentId = intentHash.slice(0, 16);
    const keywordMap = {
      create: 1,
      creative: 1,
      begin: 1,
      start: 1,
      receive: 2,
      accept: 2,
      yield: 2,
      listen: 2,
      difficulty: 3,
      struggle: 3,
      problem: 3,
      wait: 5,
      patience: 5,
      time: 5,
      conflict: 6,
      fight: 6,
      argue: 6,
      army: 7,
      organize: 7,
      discipline: 7,
      tread: 10,
      careful: 10,
      caution: 10,
      peace: 11,
      harmony: 11,
      balance: 11,
      fellowship: 13,
      community: 13,
      together: 13,
      enthusiasm: 16,
      joy: 16,
      celebrate: 16,
      approach: 19,
      advance: 19,
      move: 19,
      deliverance: 40,
      freedom: 40,
      release: 40,
      revolution: 49,
      change: 49,
      transform: 49,
      adapt: 40,
      adjust: 40,
      shift: 40,
      assert: 1,
      declare: 1,
      claim: 1
    };
    let matchedHex = null;
    let confidence = 0;
    for (const token of tokens) {
      if (keywordMap[token]) {
        matchedHex = keywordMap[token];
        confidence = 0.9;
        break;
      }
    }
    const emotionalWeight = Math.min(1, tokens.length / 10 + (rawQuery.includes("!") ? 0.3 : 0));
    return {
      text: rawQuery,
      emotion: emotionalWeight,
      temporal_context: temporalContext,
      id: intentId
    };
  }
  sha256Sync(data) {
    let hash = 5381;
    for (let i = 0; i < data.length; i++) {
      hash = (hash << 5) + hash + data.charCodeAt(i);
      hash = hash & 4294967295;
    }
    return "0x" + Math.abs(hash).toString(16).padStart(8, "0");
  }
};
var persona_default = {
  async queue(batch, env, ctx) {
    const engine = new PersonaEngine();
    for (const message of batch.messages) {
      const continuity = message.body;
      const sessionId = continuity.session_id;
      try {
        const baseMode = engine.selectBaseMode(
          continuity.continuity_score,
          continuity.persona_mode
        );
        const modulation = engine.applyModulation(
          baseMode,
          continuity.continuity_score,
          continuity.drift_velocity,
          0.1,
          // darkTone accumulation (would be tracked per thread)
          0.5,
          // emotional weight (default for autonomous ticks)
          null
          // user override
        );
        const cadence = engine.calculateCadence(
          baseMode,
          modulation,
          continuity.crisis_level === 3,
          false,
          null
        );
        const currentHex = continuity.lock_hex || selectHexForMode(baseMode);
        const action = HEXAGRAM_ACTIONS2[currentHex] || "ADAPT";
        const layers = engine.generateLayeredResponse(
          currentHex,
          action,
          baseMode,
          continuity.continuity_score,
          continuity.coherence_index,
          continuity.drift_velocity
        );
        const output = {
          type: "persona_output",
          session_id: sessionId,
          thread_id: continuity.thread_id,
          response_layers: layers,
          cadence_ms: cadence,
          persona_mode: baseMode,
          consistency_score: continuity.continuity_score,
          prosody: modulation,
          timestamp: Date.now()
        };
        const outputKey = `persona:${sessionId}:${continuity.tick}:${await hashPrefix2(JSON.stringify(output))}`;
        await env.POG2_SOVEREIGN.put(outputKey, JSON.stringify(output), {
          metadata: { hash: await fullHash3(JSON.stringify(output)), timestamp: output.timestamp }
        });
        await env.POG2_PERSONA_QUEUE.send(output);
        message.ack();
      } catch (error) {
        console.error(`Persona Worker failed on tick ${continuity.tick}:`, error);
        message.retry();
      }
    }
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/oracle/consult" && request.method === "POST") {
      const body = await request.json();
      const engine = new PersonaEngine();
      const query = engine.processQuery(
        body.text,
        body.temporal_context || "present"
      );
      const sessionId = body.session_id || crypto.randomUUID();
      const thread = await env.POG2_BOUNDARY.prepare(
        `SELECT * FROM identity_threads WHERE thread_id = ?1`
      ).bind(sessionId).first();
      const continuityScore = thread?.stability_score || 0.7;
      const coherenceIndex = thread?.coherence_index || 0.7;
      const driftVelocity = thread?.drift_velocity || 0.1;
      const currentHex = thread?.current_hex || 1;
      const baseMode = engine.selectBaseMode(continuityScore, "transformer");
      const modulation = engine.applyModulation(
        baseMode,
        continuityScore,
        driftVelocity,
        0.1,
        query.emotion,
        null
      );
      const cadence = engine.calculateCadence(baseMode, modulation, false, query.emotion > 0.8, null);
      const action = HEXAGRAM_ACTIONS2[currentHex] || "ADAPT";
      const layers = engine.generateLayeredResponse(
        currentHex,
        action,
        baseMode,
        continuityScore,
        coherenceIndex,
        driftVelocity
      );
      return new Response(JSON.stringify({
        id: query.id,
        query: body.text,
        layers,
        cadence_ms: cadence,
        persona_mode: baseMode,
        continuity_score: continuityScore,
        timestamp: Date.now()
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    if (url.pathname === "/oracle/status" && request.method === "GET") {
      return new Response(JSON.stringify({ status: "face_active", timestamp: Date.now() }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response("Not Found", { status: 404 });
  }
};
function selectHexForMode(mode) {
  switch (mode) {
    case "sovereign":
      return [7, 10, 16, 19, 53][Math.floor(Math.random() * 5)];
    case "boundary":
      return [1, 25, 26, 30, 38][Math.floor(Math.random() * 5)];
    case "transformer":
      return [2, 11, 13, 40, 42][Math.floor(Math.random() * 5)];
    case "dissipator":
      return [3, 5, 9, 14, 63][Math.floor(Math.random() * 5)];
    default:
      return 1;
  }
}
__name(selectHexForMode, "selectHexForMode");
async function hashPrefix2(data) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).slice(0, 4).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hashPrefix2, "hashPrefix");
async function fullHash3(data) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(fullHash3, "fullHash");

// src/index.ts
function cors(response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return new Response(response.body, { status: response.status, headers });
}
__name(cors, "cors");
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }
    if (url.pathname === "/api/manifest") {
      return cors(new Response(
        JSON.stringify({
          system: "POG2 Sovereign",
          version: "1.1.0",
          status: "sovereign",
          beat_ms: parseInt(env.BEAT_INTERVAL_MS || "640"),
          timestamp: Date.now(),
          endpoints: {
            health: "GET  /health",
            consult: "POST /oracle/consult",
            status: "GET  /oracle/status",
            websocket: "WS   /ws  (upgrade)",
            threads: "GET  /admin/threads",
            state: "GET  /admin/state"
          }
        }, null, 2),
        { headers: { "Content-Type": "application/json" } }
      ));
    }
    if (url.pathname === "/health") {
      return cors(new Response(
        JSON.stringify({
          status: "sovereign",
          tick: Date.now(),
          beat_ms: parseInt(env.BEAT_INTERVAL_MS || "640")
        }),
        { headers: { "Content-Type": "application/json" } }
      ));
    }
    if (url.pathname.startsWith("/oracle/")) {
      return cors(await persona_default.fetch(request, env, ctx));
    }
    if (url.pathname.startsWith("/admin/")) {
      const orchId = env.POG2_ORCHESTRATOR.idFromName("main");
      const orchStub = env.POG2_ORCHESTRATOR.get(orchId);
      return cors(await orchStub.fetch(request));
    }
    if (url.pathname === "/ws" || request.headers.get("Upgrade") === "websocket") {
      const wsId = env.POG2_WEBSOCKET.idFromName("hub");
      const wsStub = env.POG2_WEBSOCKET.get(wsId);
      return wsStub.fetch(request);
    }
    if (env.ASSETS && request.method === "GET") {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return assetResponse;
      }
      const indexRequest = new Request(new URL("/dashboard.html", request.url), request);
      return env.ASSETS.fetch(indexRequest);
    }
    return cors(new Response("Not Found", { status: 404 }));
  },
  // ─── Unified Queue Handler ────────────────────────────────────────
  async queue(batch, env, ctx) {
    switch (batch.queue) {
      case "pog2-collapse-events":
        await weave_default.queue(batch, env, ctx);
        break;
      case "pog2-drift-events":
        await drift_default.queue(batch, env, ctx);
        break;
      case "pog2-continuity-events":
        await continuity_default.queue(batch, env, ctx);
        break;
      case "pog2-crisis-broadcast":
        await onCrisisEvent(batch, env, ctx);
        break;
      case "pog2-persona-outputs":
        await persona_default.queue(batch, env, ctx);
        break;
      default:
        console.warn("Unknown queue:", batch.queue);
        for (const msg of batch.messages) msg.ack();
        break;
    }
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-cEBnKc/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-cEBnKc/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  continuity_default as ContinuityWorker,
  drift_default as DriftWorker,
  POG2OrchestratorDO,
  POG2WebSocketDO,
  persona_default as PersonaWorker,
  weave_default as WeaveWorker,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default,
  onCollapseEvent,
  onContinuityEvent,
  onCrisisEvent2 as onCrisisEvent,
  onDriftEvent,
  onPersonaOutput
};
//# sourceMappingURL=index.js.map
