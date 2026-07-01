/**
 * POG2 Continuity Worker — Oracle Continuity Layer
 * Cloudflare Workers native implementation
 * Consumes drift events from Drift Worker via POG2_DRIFT_QUEUE
 * Updates thread state, manages persistence countdown, calculates continuity score
 * Emits continuity events to Persona Worker via POG2_CONTINUITY_QUEUE
 */

import type { Env } from '../index';

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

const SOVEREIGN_CORES = [7, 10, 16, 18, 19, 53, 56, 57, 61, 62];

export default {
  async queue(batch: MessageBatch<DriftEvent>, env: Env, ctx: ExecutionContext): Promise<void> {
    for (const message of batch.messages) {
      const drift = message.body;
      const sessionId = drift.session_id;

      try {
        // 1. Resolve thread ID from registry
        let threadRow = await env.POG2_BOUNDARY.prepare(
          `SELECT thread_id FROM thread_registry WHERE session_id = ?1 LIMIT 1`
        ).bind(sessionId).first<{ thread_id: string }>();

        let threadId = threadRow?.thread_id;
        if (!threadId) {
          threadId = `thread-${sessionId}`;
          // Register thread
          await env.POG2_BOUNDARY.prepare(
            `INSERT INTO thread_registry (thread_id, session_id, current_hex, continuity_score, status, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
          ).bind(
            threadId, sessionId, 1, 1.0, 'active', Date.now(), Date.now()
          ).run();
        }

        // 2. Load current thread state from identity_threads
        let threadState = await env.POG2_BOUNDARY.prepare(
          `SELECT * FROM identity_threads WHERE thread_id = ?1`
        ).bind(threadId).first<{
          current_hex: number;
          dominant_category: 'sovereign' | 'boundary' | 'transformer' | 'dissipator';
          stability_score: number;
          coherence_index: number;
          drift_velocity: number;
          sovereign_ratio: number;
          continuity_score: number;
          birth_tick: number | null;
          void_reentry_count: number;
          crisis_count: number;
          category_history: string;
          version: number;
        }>();

        if (!threadState) {
          // Initialize thread state
          await env.POG2_BOUNDARY.prepare(
            `INSERT INTO identity_threads (
              thread_id, birth_tick, current_hex, dominant_category, category_history,
              drift_velocity, stability_score, coherence_index, void_reentry_count,
              crisis_count, last_active_tick, is_alive, version, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`
          ).bind(
            threadId, drift.tick, 1, 'transformer', JSON.stringify([]),
            0.1, 0.7, 0.7, 0, 0, drift.tick, 1, 1, Date.now()
          ).run();

          threadState = {
            current_hex: 1,
            dominant_category: 'transformer',
            stability_score: 0.7,
            coherence_index: 0.7,
            drift_velocity: 0.1,
            sovereign_ratio: 0.0,
            continuity_score: 0.7,
            birth_tick: drift.tick,
            void_reentry_count: 0,
            crisis_count: 0,
            category_history: JSON.stringify([]),
            version: 1,
          };
        }

        // 3. Update category history
        let categoryHistory: string[] = [];
        try {
          categoryHistory = JSON.parse(threadState.category_history || '[]');
        } catch {
          categoryHistory = [];
        }
        categoryHistory.push(drift.drift_vector.direction);
        if (categoryHistory.length > 100) {
          categoryHistory = categoryHistory.slice(-100);
        }

        // 4. Calculate metrics
        const sovereignTicks = categoryHistory.filter(c => c === 'sovereign').length;
        const sovereignRatio = categoryHistory.length > 0 ? sovereignTicks / categoryHistory.length : 0.0;

        // Exponential moving averages for smooth progression
        const stabilityScore = threadState.stability_score * 0.9 + (drift.drift_vector.direction === 'sovereign' ? 0.1 : 0.0);
        const coherenceIndex = threadState.coherence_index * 0.9 + (1.0 - Math.min(1.0, drift.drift_vector.entropy_delta)) * 0.1;
        const driftVelocity = threadState.drift_velocity * 0.9 + drift.drift_vector.magnitude * 0.1;

        // Continuity Score formula from specification:
        // continuity_score = stability_score * 0.4 + coherence_index * 0.3 + sovereign_ratio * 0.2 + (1.0 - drift_velocity) * 0.1
        const continuityScore = Math.max(0.0, Math.min(1.0,
          (stabilityScore * 0.4) +
          (coherenceIndex * 0.3) +
          (sovereignRatio * 0.2) +
          ((1.0 - Math.min(1.0, driftVelocity)) * 0.1)
        ));

        // 5. Manage persistence state
        let persistence = await env.POG2_BOUNDARY.prepare(
          `SELECT * FROM persistence_state WHERE thread_id = ?1`
        ).bind(threadId).first<{
          persistence_countdown: number;
          lock_hex: number | null;
        }>();

        let countdown = persistence ? persistence.persistence_countdown : 5;
        let lockHex = persistence ? persistence.lock_hex : null;

        // Reinforce/relax rules
        if (stabilityScore > 0.9 && driftVelocity < 0.1) {
          countdown = Math.min(20, countdown + 5);
        } else if (stabilityScore < 0.5 && driftVelocity > 0.3) {
          countdown = Math.max(1, countdown - 2);
        }

        // Emergency lock on crisis
        if (drift.crisis_level === 3) {
          countdown = 10;
          // Find nearest sovereign core as lock hex
          lockHex = SOVEREIGN_CORES[0]; // fallback
        }

        // Natural decay
        countdown = Math.max(0, countdown - 1);
        if (countdown === 0) {
          lockHex = null;
        }

        // Store updated persistence
        await env.POG2_BOUNDARY.prepare(
          `INSERT INTO persistence_state (thread_id, tick, persistence_countdown, lock_hex, lock_reason, version, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
           ON CONFLICT(thread_id) DO UPDATE SET
             tick = excluded.tick,
             persistence_countdown = excluded.persistence_countdown,
             lock_hex = excluded.lock_hex,
             updated_at = excluded.updated_at`
        ).bind(
          threadId, drift.tick, countdown, lockHex, drift.crisis_level === 3 ? 'emergency_lock' : null, 1, Date.now()
        ).run();

        // 6. Fragmentation detection
        // Velocity spike: velocity > 0.5
        const velocitySpike = driftVelocity > 0.5;
        // Category chaos: > 4 changes in last 10 ticks
        let categoryChanges = 0;
        const recentHistory = categoryHistory.slice(-10);
        for (let i = 1; i < recentHistory.length; i++) {
          if (recentHistory[i] !== recentHistory[i - 1]) categoryChanges++;
        }
        const categoryChaos = categoryChanges > 4;
        // Coherence collapse
        const coherenceCollapse = coherenceIndex < 0.3 && stabilityScore < 0.3;

        const fragmentationDetected = velocitySpike || categoryChaos || coherenceCollapse;

        if (fragmentationDetected) {
          // Log fragmentation event
          const fragId = `frag-${threadId}-${drift.tick}`;
          const fragEntry = {
            timestamp: Date.now(),
            indicators: { velocitySpike, categoryChaos, coherenceCollapse },
            response: 'stabilization_override',
            recovery_ticks: 30,
          };
          await env.POG2_SOVEREIGN.put(
            `fragment:${threadId}:${fragId}:${drift.trajectory_log_key.slice(-8)}`,
            JSON.stringify(fragEntry)
          );
        }

        // 7. Update database tables
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
          drift.drift_vector.hex_delta, // set current hex to delta or simple target
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

        // 8. Build ContinuityEvent
        const continuityEvent: ContinuityEvent = {
          type: 'continuity',
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
          timestamp: Date.now(),
        };

        // Emit to Persona queue
        await env.POG2_CONTINUITY_QUEUE.send(continuityEvent);
        message.ack();
      } catch (error) {
        console.error(`Continuity Worker failed on tick ${drift.tick}:`, error);
        message.retry();
      }
    }
  },
} satisfies ExportedHandler<Env, DriftEvent>;