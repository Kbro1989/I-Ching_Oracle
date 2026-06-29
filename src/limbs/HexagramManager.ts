import { EventEmitter } from 'events';
import { YaoState, ContextCard } from '../core/models.js';

/**
 * Oracle Hexagram Manager — mirrors POG2's line-card topology
 * but scoped to a dungeon oracle context (6-line divination state).
 */
export interface MovingLine {
  position: number;        // 1-6, bottom=1, top=6
  fromState: 'YANG' | 'YIN';
  toState: 'YANG' | 'YIN';
  confidence: number;      // 0-1
  source: string;
  timestamp: number;
}

export interface TransitionalState {
  primary: string;         // binary key '111111'
  future: string;
  movingLines: MovingLine[];
  transitionProgress: number; // 0-1
  energyFlow: 'ASCENDING' | 'DESCENDING' | 'STABLE';
  falseStability: boolean;
}

export class HexagramManager extends EventEmitter {
  private static instance: HexagramManager | undefined;
  private lines: ContextCard[] = [];

  public static getInstance(): HexagramManager {
    if (!HexagramManager.instance) {
      HexagramManager.instance = new HexagramManager();
    }
    return HexagramManager.instance;
  }

  public static resetInstance(): void {
    HexagramManager.instance = undefined;
  }

  public pushLine(card: ContextCard): void {
    this.lines[card.lineIndex - 1] = card;
    this.emit('change', this.lines);
  }

  public getLines(): ContextCard[] {
    return [...this.lines];
  }

  public getCurrentHexagram(): string {
    const bits = this.lines
      .slice(0, 6)
      .map(l => (l.state === 2 /* OldYang */ || l.state === 3 /* OldMixed */) ? '1' : '0')
      .join('');
    return bits.padEnd(6, '0').slice(0, 6) || '111111';
  }

  public getTransitionalState(): TransitionalState {
    const movingLines: MovingLine[] = this.lines
      .filter(l => l.lineIndex >= 1 && l.lineIndex <= 6)
      .map(l => ({
        position: l.lineIndex,
        fromState: (l.state === 2 || l.state === 3) ? 'YANG' : 'YIN',
        toState: (l.state === 0 || l.state === 3) ? 'YANG' : 'YIN',
        confidence: Math.min(1, l.importance / 5),
        source: l.title || 'unknown',
        timestamp: Date.now(),
      }));
    return {
      primary: this.getCurrentHexagram(),
      future: this.getCurrentHexagram(),
      movingLines,
      transitionProgress: movingLines.length / 6,
      energyFlow: 'STABLE',
      falseStability: movingLines.length === 0,
    };
  }

  public decide(current: YaoState, intent: YaoState): string {
    const states = [YaoState.YoungYang, YaoState.YoungYin, YaoState.OldYang, YaoState.OldYin, YaoState.OldMixed, YaoState.YoungMixed];
    const c = states.indexOf(current) >= 0 ? current : YaoState.YoungYang;
    const i = states.indexOf(intent) >= 0 ? intent : YaoState.YoungYang;
    if (c === YaoState.OldYang || i === YaoState.OldYang) return 'EXPAND_SECURE';
    if (c === YaoState.OldYin || i === YaoState.OldYin) return 'CONTRACT_BUILD';
    if (c === YaoState.OldMixed || i === YaoState.OldMixed) return 'CHAOTIC_FLUX';
    return 'STEADY_FLOW';
  }

  public setYaoState(state: YaoState): void {
    this.pushLine({
      lineIndex: (this.lines.length % 6) + 1,
      title: 'Substrate Health Pulse',
      content: `Pulse-driven transformation. State: ${state}`,
      state,
      importance: 5.0,
    });
  }

  public healthCheck(): { online: boolean; details: string } {
    return { online: true, details: 'Oracle Hexagram Manager online' };
  }
}
