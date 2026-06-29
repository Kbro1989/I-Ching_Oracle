const logger = {
  debug: (...args: unknown[]) => console.debug('[GhostSplatLimb]', ...args),
};

export interface SplatEvent {
  type: 'damage' | 'xp' | 'block' | 'heal' | 'poison' | 'crit' | 'prophecy';
  value?: number;
  skillId?: number;
  position?: unknown;
  color?: string;
  duration?: number;
}

export class GhostSplatLimb {
  private splatId = 0;

  constructor(private renderer: unknown) {}

  emit(event: SplatEvent): void {
    const id = `splat_${++this.splatId}`;
    logger.debug({ event, id }, 'Splat emitted');
  }
}
