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

import {
  onCollapseEvent,
  onDriftEvent,
  onContinuityEvent,
  onCrisisEvent,
  onPersonaOutput,
} from './queues/handlers';

export {
  onCollapseEvent,
  onDriftEvent,
  onContinuityEvent,
  onCrisisEvent,
  onPersonaOutput,
};

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
  // Static Assets
  ASSETS: Fetcher;

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

    // API manifest (JSON metadata for /api/manifest)
    if (url.pathname === '/api/manifest') {
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

    // ─── Serve static assets (Dashboard) ───────────────────────
    // Fallback: serve dashboard.html from ASSETS binding for any other GET
    if (env.ASSETS && request.method === 'GET') {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return assetResponse;
      }
      // If asset not found, serve dashboard.html (SPA-style fallback)
      const indexRequest = new Request(new URL('/dashboard.html', request.url), request);
      return env.ASSETS.fetch(indexRequest);
    }

    return cors(new Response('Not Found', { status: 404 }));
  },

  // ─── Unified Queue Handler ────────────────────────────────────────
  async queue(batch: MessageBatch<any>, env: Env, ctx: ExecutionContext): Promise<void> {
    const tickMessages: Message<any>[] = [];
    const collapseMessages: Message<any>[] = [];
    const driftMessages: Message<any>[] = [];
    const continuityMessages: Message<any>[] = [];
    const crisisMessages: Message<any>[] = [];
    const personaOutputMessages: Message<any>[] = [];

    for (const msg of batch.messages) {
      const body = msg.body;
      const type = body?.type;

      if (type === 'tick') {
        tickMessages.push(msg);
      } else if (type === 'collapse') {
        collapseMessages.push(msg);
      } else if (type === 'drift') {
        driftMessages.push(msg);
      } else if (type === 'continuity') {
        continuityMessages.push(msg);
      } else if (type === 'crisis') {
        crisisMessages.push(msg);
      } else if (type === 'persona_output' || body?.response_layers) {
        if (body && !body.type) body.type = 'persona_output';
        personaOutputMessages.push(msg);
      } else {
        // Fallback to queue-name based routing if type is missing
        console.warn(`Queue message missing type property on ${batch.queue}. Falling back to queue routing.`);
        if (batch.queue === 'pog2-collapse-events') {
          tickMessages.push(msg);
        } else if (batch.queue === 'pog2-drift-events') {
          collapseMessages.push(msg);
        } else if (batch.queue === 'pog2-continuity-events') {
          driftMessages.push(msg);
        } else if (batch.queue === 'pog2-crisis-broadcast') {
          crisisMessages.push(msg);
        } else if (batch.queue === 'pog2-persona-outputs') {
          personaOutputMessages.push(msg);
        } else {
          msg.ack();
        }
      }
    }

    // Process grouped messages
    if (tickMessages.length > 0) {
      await WeaveWorker.queue({ ...batch, messages: tickMessages } as any, env, ctx);
    }
    if (collapseMessages.length > 0) {
      if (batch.queue === 'pog2-collapse-events') {
        await onCollapseEvent({ ...batch, messages: collapseMessages } as any, env, ctx);
      } else {
        await DriftWorker.queue({ ...batch, messages: collapseMessages } as any, env, ctx);
      }
    }
    if (driftMessages.length > 0) {
      if (batch.queue === 'pog2-drift-events') {
        await onDriftEvent({ ...batch, messages: driftMessages } as any, env, ctx);
      } else {
        await ContinuityWorker.queue({ ...batch, messages: driftMessages } as any, env, ctx);
      }
    }
    if (continuityMessages.length > 0) {
      if (batch.queue === 'pog2-continuity-events') {
        await onContinuityEvent({ ...batch, messages: continuityMessages } as any, env, ctx);
      } else {
        await PersonaWorker.queue({ ...batch, messages: continuityMessages } as any, env, ctx);
      }
    }
    if (crisisMessages.length > 0) {
      await onCrisisEvent({ ...batch, messages: crisisMessages } as any, env, ctx);
    }
    if (personaOutputMessages.length > 0) {
      if (batch.queue === 'pog2-persona-outputs') {
        await onPersonaOutput({ ...batch, messages: personaOutputMessages } as any, env, ctx);
      } else {
        for (const msg of personaOutputMessages) msg.ack();
      }
    }
  },
};