/**
 * POG2 Sovereign System — Main Entry Point
 * Cloudflare Workers deployment
 * Exports Durable Object classes and Queue handlers for wrangler.toml bindings
 */

import { DurableObject } from 'cloudflare:workers';

// ─── Durable Object Exports ─────────────────────────────────────────

import { POG2OrchestratorDO } from './durable-objects/orchestrator';
import { POG2WebSocketDO } from './durable-objects/websocket';
export { POG2OrchestratorDO } from './durable-objects/orchestrator';
export { POG2WebSocketDO } from './durable-objects/websocket';

// ─── Queue Handler Exports ──────────────────────────────────────────

export {
  onCollapseEvent,
  onDriftEvent,
  onContinuityEvent,
  onCrisisEvent,
  onPersonaOutput,
} from './queues/handlers';

// ─── Worker Fetch Handlers ────────────────────────────────────────

import WeaveWorker from './workers/weave';
import DriftWorker from './workers/drift';
import ContinuityWorker from './workers/continuity';
import PersonaWorker from './workers/persona';
export { default as WeaveWorker } from './workers/weave';
export { default as DriftWorker } from './workers/drift';
export { default as ContinuityWorker } from './workers/continuity';
export { default as PersonaWorker } from './workers/persona';

// ─── Environment Interface ────────────────────────────────────────

export interface Env {
  // KV Namespaces
  POG2_SOVEREIGN: KVNamespace;
  POG2_DISSIPATOR: KVNamespace;

  // D1 Database
  POG2_BOUNDARY: D1Database;

  // R2 Bucket
  POG2_TRANSFORMER: R2Bucket;

  // Durable Objects
  POG2_ORCHESTRATOR: DurableObjectNamespace<POG2OrchestratorDO>;
  POG2_WEBSOCKET: DurableObjectNamespace<POG2WebSocketDO>;

  // Queues
  POG2_COLLAPSE_QUEUE: Queue;
  POG2_DRIFT_QUEUE: Queue;
  POG2_CONTINUITY_QUEUE: Queue;
  POG2_CRISIS_QUEUE: Queue;
  POG2_PERSONA_QUEUE: Queue;

  // Optional: Workers AI
  AI?: Ai;

  // Environment variables
  BEAT_INTERVAL_MS: string;
  ATTRACTOR_PERSISTENCE: string;
  VOID_REENTRY_DEPTH: string;
  MAX_COMPUTE_MS: string;
  BASE_ENTROPY_FIRST_TICK: string;
}

// ─── CORS Helper ─────────────────────────────────────────────────

function cors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return new Response(response.body, { status: response.status, headers });
}

// ─── Main Entry Point ─────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (url.pathname === '/') {
      return cors(new Response(
        JSON.stringify({
          system: 'POG2 Sovereign',
          version: '1.1.0',
          status: 'sovereign',
          beat_ms: parseInt(env.BEAT_INTERVAL_MS || '640'),
          timestamp: Date.now(),
          endpoints: {
            health:    'GET  /health',
            consult:   'POST /oracle/consult',
            status:    'GET  /oracle/status',
            websocket: 'WS   /ws  (upgrade)',
            threads:   'GET  /admin/threads',
            state:     'GET  /admin/state',
          },
        }, null, 2),
        { headers: { 'Content-Type': 'application/json' } }
      ));
    }

    if (url.pathname === '/health') {
      return cors(new Response(
        JSON.stringify({
          status: 'sovereign',
          tick: Date.now(),
          beat_ms: parseInt(env.BEAT_INTERVAL_MS || '640'),
        }),
        { headers: { 'Content-Type': 'application/json' } }
      ));
    }

    // Route /oracle/* → Persona Worker fetch handler
    if (url.pathname.startsWith('/oracle/')) {
      return cors(await PersonaWorker.fetch(request, env, ctx));
    }

    // Route /admin/* → Orchestrator DO
    if (url.pathname.startsWith('/admin/')) {
      const orchId = env.POG2_ORCHESTRATOR.idFromName('main');
      const orchStub = env.POG2_ORCHESTRATOR.get(orchId);
      return cors(await orchStub.fetch(request));
    }

    // Route /ws and WebSocket upgrades → WebSocket DO
    if (url.pathname === '/ws' || request.headers.get('Upgrade') === 'websocket') {
      const wsId = env.POG2_WEBSOCKET.idFromName('hub');
      const wsStub = env.POG2_WEBSOCKET.get(wsId);
      return wsStub.fetch(request);
    }

    return cors(new Response('Not Found', { status: 404 }));
  },

  // ─── Unified Queue Handler ────────────────────────────────────────
  async queue(batch: MessageBatch<any>, env: Env, ctx: ExecutionContext): Promise<void> {
    switch (batch.queue) {
      case 'pog2-collapse-events':
        await WeaveWorker.queue(batch, env, ctx);
        break;
      case 'pog2-drift-events':
        await DriftWorker.queue(batch, env, ctx);
        break;
      case 'pog2-continuity-events':
        await ContinuityWorker.queue(batch, env, ctx);
        break;
      case 'pog2-crisis-broadcast':
        await onCrisisEvent(batch, env, ctx);
        break;
      case 'pog2-persona-outputs':
        await PersonaWorker.queue(batch, env, ctx);
        break;
      default:
        console.warn('Unknown queue:', batch.queue);
        for (const msg of batch.messages) msg.ack();
        break;
    }
  },
};