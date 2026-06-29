export interface SovereignAvatarState {
  id: string;
  name: string;
  role: 'oracle';
  hexagramId: string;
  emotionalState: 'calm' | 'agitated' | 'decisive' | 'pensive';
  lastConsultation: number;
  telemetry: Record<string, number>;
}

export class SovereignAvatar {
  public state: SovereignAvatarState;

  constructor() {
    this.state = {
      id: 'oracle-core',
      name: 'Shadow Oracle',
      role: 'oracle',
      hexagramId: '111111',
      emotionalState: 'calm',
      lastConsultation: 0,
      telemetry: {
        entropicPressure: 0,
        consultationCount: 0,
        driftVariance: 0,
        temporalDrift: 0,
      },
    };
  }

  public updateHexagram(binary: string): void {
    this.state.hexagramId = binary;
  }

  public setEmotional(state: SovereignAvatarState['emotionalState']): void {
    this.state.emotionalState = state;
  }

  public bumpTelemetry(key: string, delta: number): void {
    this.state.telemetry[key] = (this.state.telemetry[key] || 0) + delta;
  }

  public serializeState(): string {
    return JSON.stringify(this.state);
  }

  public hydrate(data: any): void {
    if (data?.state) {
      this.state = { ...this.state, ...data.state };
    }
  }
}
