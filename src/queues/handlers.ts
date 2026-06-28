/**
 * POG2 Queue Handlers — All Five Queue Consumers
 * Real implementations, no mock data
 * Aligned with CloudflareImplementation_Spec.txt § QUEUE ARCHITECTURE
 */

import type { Env } from '../index';

// ─── Collapse Event (Weave → Drift) ──────────────────────────────

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

// ─── Drift Event (Drift → Continuity) ────────────────────────────

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

// ─── Continuity Event (Continuity → Persona) ────────────────────

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
  timestamp: number;
}

// ─── Crisis Event (Drift → All Workers + WebSocket DO) ──────────

export interface CrisisEvent {
  type: 'crisis';
  crisis_id: string;
  level: number;
  indicators: {
    level3ProximityAlerts: number;
    dissipatorSpike: boolean;
    coherenceDecay: boolean;
    sovereignErosion: boolean;
    darkToneAccumulation: boolean;
  };
  response: string;
  timestamp: number;
}

// ─── Persona Output (Persona → WebSocket DO) ────────────────────

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

// ─── Handler 1: Collapse → Drift ─────────────────────────────────

export async function onCollapseEvent(
  batch: MessageBatch<CollapseEvent>,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  for (const message of batch.messages) {
    const collapse = message.body;
    try {
      // The Drift Worker performs the actual drift computation
      // This handler just acknowledges — the real work is in drift.ts queue handler
      // We keep this as a passthrough for architectural clarity
      await env.POG2_DRIFT_QUEUE.send(collapse);

      // Broadcast to WebSocket DO for UI
      const wsId = env.POG2_WEBSOCKET.idFromName('hub');
      const wsStub = env.POG2_WEBSOCKET.get(wsId);
      await wsStub.fetch(new Request('http://internal/broadcast', {
        method: 'POST',
        body: JSON.stringify(collapse),
        headers: { 'Content-Type': 'application/json' },
      }));

      message.ack();
    } catch (error) {
      console.error(`Collapse queue handler failed for tick ${collapse.tick}:`, error);
      message.retry();
    }
  }
}

// ─── Handler 2: Drift → Continuity ──────────────────────────────

export async function onDriftEvent(
  batch: MessageBatch<DriftEvent>,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  for (const message of batch.messages) {
    const drift = message.body;
    try {
      // Passthrough to Continuity Worker
      await env.POG2_CONTINUITY_QUEUE.send(drift);

      // Broadcast to WebSocket DO for UI
      const wsId = env.POG2_WEBSOCKET.idFromName('hub');
      const wsStub = env.POG2_WEBSOCKET.get(wsId);
      await wsStub.fetch(new Request('http://internal/broadcast', {
        method: 'POST',
        body: JSON.stringify(drift),
        headers: { 'Content-Type': 'application/json' },
      }));

      message.ack();
    } catch (error) {
      console.error(`Drift queue handler failed for tick ${drift.tick}:`, error);
      message.retry();
    }
  }
}

// ─── Handler 3: Continuity → Persona ────────────────────────────

export async function onContinuityEvent(
  batch: MessageBatch<ContinuityEvent>,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  for (const message of batch.messages) {
    const continuity = message.body;
    try {
      // Passthrough to Persona Worker
      await env.POG2_PERSONA_QUEUE.send(continuity);

      // Broadcast to WebSocket DO for UI
      const wsId = env.POG2_WEBSOCKET.idFromName('hub');
      const wsStub = env.POG2_WEBSOCKET.get(wsId);
      await wsStub.fetch(new Request('http://internal/broadcast', {
        method: 'POST',
        body: JSON.stringify(continuity),
        headers: { 'Content-Type': 'application/json' },
      }));

      message.ack();
    } catch (error) {
      console.error(`Continuity queue handler failed for tick ${continuity.tick}:`, error);
      message.retry();
    }
  }
}

// ─── Handler 4: Crisis Broadcast ─────────────────────────────────

export async function onCrisisEvent(
  batch: MessageBatch<CrisisEvent>,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  for (const message of batch.messages) {
    const crisis = message.body;
    try {
      // Log to Sovereign KV
      const crisisKey = `crisis:${crisis.crisis_id}`;
      await env.POG2_SOVEREIGN.put(crisisKey, JSON.stringify(crisis), {
        metadata: {
          hash: await sha256(JSON.stringify(crisis)),
          timestamp: crisis.timestamp,
          level: crisis.level,
        },
      });

      // Broadcast via Orchestrator DO → WebSocket DO
      const orchId = env.POG2_ORCHESTRATOR.idFromName('main');
      const orchStub = env.POG2_ORCHESTRATOR.get(orchId);

      try {
        await orchStub.fetch(new Request('http://internal/crisis/handle', {
          method: 'POST',
          body: JSON.stringify(crisis),
          headers: { 'Content-Type': 'application/json' },
        }));
      } catch (doErr) {
        console.error('Orchestrator DO crisis broadcast failed:', doErr);
        // Fallback: broadcast directly via WebSocket DO
        const wsId = env.POG2_WEBSOCKET.idFromName('hub');
        const wsStub = env.POG2_WEBSOCKET.get(wsId);
        await wsStub.fetch(new Request('http://internal/broadcast', {
          method: 'POST',
          body: JSON.stringify({
            type: 'crisis',
            level: crisis.level,
            indicators: crisis.indicators,
            response: crisis.response,
            timestamp: crisis.timestamp,
          }),
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      message.ack();
    } catch (error) {
      console.error(`Crisis queue handler failed for crisis ${crisis.crisis_id}:`, error);
      message.retry();
    }
  }
}

// ─── Handler 5: Persona Output → WebSocket Delivery ─────────────

export async function onPersonaOutput(
  batch: MessageBatch<PersonaOutput>,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  for (const message of batch.messages) {
    const output = message.body;
    try {
      // Deliver to WebSocket DO for client delivery
      const wsId = env.POG2_WEBSOCKET.idFromName('hub');
      const wsStub = env.POG2_WEBSOCKET.get(wsId);

      await wsStub.fetch(new Request('http://internal/send-to-session', {
        method: 'POST',
        body: JSON.stringify({
          session_id: output.session_id,
          message: {
            type: 'response',
            id: `auto-${output.timestamp}`,
            layers: output.response_layers,
            cadence_ms: output.cadence_ms,
            persona_mode: output.persona_mode,
            timestamp: output.timestamp,
          },
        }),
        headers: { 'Content-Type': 'application/json' },
      }));

      message.ack();
    } catch (error) {
      console.error(`Persona output handler failed for session ${output.session_id}:`, error);
      message.retry();
    }
  }
}

// ─── Hash Helper ─────────────────────────────────────────────────

async function sha256(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}