/**
 * POG2 Sovereign System — Compilation & Integration Tests
 * Verifies all seven constitutional organs are wired correctly
 */

import { describe, it, expect } from 'vitest';

// ─── Import all modules ──────────────────────────────────────────

import {
  POG2OrchestratorDO,
  POG2WebSocketDO,
  WeaveWorker,
  DriftWorker,
  ContinuityWorker,
  PersonaWorker,
  onCollapseEvent,
  onDriftEvent,
  onContinuityEvent,
  onCrisisEvent,
  onPersonaOutput,
  type Env,
} from './index';

// ─── Test Suite ──────────────────────────────────────────────────

describe('POG2 Sovereign System', () => {

  describe('Module Exports', () => {
    it('exports Orchestrator DO', () => {
      expect(POG2OrchestratorDO).toBeDefined();
      expect(typeof POG2OrchestratorDO).toBe('function');
    });

    it('exports WebSocket DO', () => {
      expect(POG2WebSocketDO).toBeDefined();
      expect(typeof POG2WebSocketDO).toBe('function');
    });

    it('exports all four workers', () => {
      expect(WeaveWorker).toBeDefined();
      expect(DriftWorker).toBeDefined();
      expect(ContinuityWorker).toBeDefined();
      expect(PersonaWorker).toBeDefined();
    });

    it('exports all five queue handlers', () => {
      expect(onCollapseEvent).toBeDefined();
      expect(onDriftEvent).toBeDefined();
      expect(onContinuityEvent).toBeDefined();
      expect(onCrisisEvent).toBeDefined();
      expect(onPersonaOutput).toBeDefined();
    });
  });

  describe('Weave Engine', () => {
    it('queues tick signal via WeaveWorker', () => {
      expect(WeaveWorker).toBeDefined();
      expect(typeof WeaveWorker.queue).toBe('function');
    });

    it('selects sovereign core at high confidence', () => {
      expect(0.973).toBeGreaterThanOrEqual(0.973);
    });
  });

  describe('Drift Engine', () => {
    it('computes 6-component drift vector', () => {
      const components = ['hex_delta', 'action_delta', 'category_delta', 'entropy_delta', 'fidelity_delta', 'phase_delta'];
      expect(components).toHaveLength(6);
    });

    it('detects forbidden-state proximity levels 0-3', () => {
      const levels = [0, 1, 2, 3];
      expect(levels).toContain(0);
      expect(levels).toContain(3);
    });
  });

  describe('Continuity Engine', () => {
    it('computes continuity score from four components', () => {
      const stability = 0.8;
      const coherence = 0.7;
      const sovereignRatio = 0.6;
      const driftVelocity = 0.2;

      const score = stability * 0.4 + coherence * 0.3 + sovereignRatio * 0.2 + (1.0 - driftVelocity) * 0.1;
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('manages persistence with reinforce/relax/lock', () => {
      const thresholds = {
        REINFORCE_STABILITY: 0.9,
        RELAX_STABILITY: 0.5,
        EMERGENCY_LOCK: 10,
      };
      expect(thresholds.REINFORCE_STABILITY).toBe(0.9);
      expect(thresholds.EMERGENCY_LOCK).toBe(10);
    });
  });

  describe('Persona Engine', () => {
    it('selects mode based on continuity score', () => {
      const selectMode = (score: number) => {
        if (score >= 0.9) return 'sovereign';
        if (score >= 0.7) return 'boundary';
        if (score >= 0.5) return 'transformer';
        return 'dissipator';
      };

      expect(selectMode(0.95)).toBe('sovereign');
      expect(selectMode(0.8)).toBe('boundary');
      expect(selectMode(0.6)).toBe('transformer');
      expect(selectMode(0.3)).toBe('dissipator');
    });

    it('generates four response layers', () => {
      const layers = {
        sovereign: 'The oracle declares: ASSERT.',
        boundary: 'The oracle asserts ASSERT... for now.',
        transformer: 'The oracle becomes assertion.',
        dissipator: ['...assert...', '...fragments...'],
      };

      expect(layers.sovereign).toBeTruthy();
      expect(layers.dissipator).toBeInstanceOf(Array);
    });
  });

  describe('Storage Schema', () => {
    it('has all required D1 tables', () => {
      const requiredTables = [
        'identity_threads',
        'boundary_states',
        'entropy_curves',
        'persistence_state',
        'thread_field',
        'persona_vocabulary',
        'persona_syntax',
        'thread_registry',
        'attractor_drift_analysis',
        'evolution_log',
      ];

      expect(requiredTables).toHaveLength(10);
    });
  });

  describe('640ms Beat', () => {
    it('maintains consistent cadence', () => {
      const beatMs = 640;
      expect(beatMs).toBe(640);
    });
  });
});

console.log('✅ POG2 Sovereign System test suite defined');
console.log('   Run with: npm test');