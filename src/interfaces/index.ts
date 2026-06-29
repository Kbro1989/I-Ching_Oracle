export interface OracleConsultPayload {
  query: string;
  context?: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
}

export interface OracleConsultResponse {
  status: 'ok' | 'queued' | 'error';
  hexagramId?: string;
  hexagramName?: string;
  action?: string;
  prophecy?: string;
  entropy?: number;
  avatarState?: Record<string, unknown>;
  timestamp: number;
}

export interface PipelineStageResult {
  stage: 'drift' | 'continuity' | 'persona' | 'render';
  status: 'ok' | 'error' | 'skipped';
  output?: unknown;
  error?: string;
}

export interface OracleDialogueEngine {
  generateProphecy(hexagramId: string, query: string): Promise<string>;
  getHexagramName(binary: string): string;
}

export interface OracleVisualMapper {
  setMaterialEmissive(hex: string, intensity: number): void;
  setUVAnimation(speed: number): void;
  setAlphaCutoff(value: number): void;
  setBaseColorTint(color: { r: number; g: number; b: number }): void;
}

export interface OracleTelemetry {
  recordReading(hexagramId: string, entropy: number): void;
  getRecentReadings(limit?: number): Array<{ hexagramId: string; entropy: number; timestamp: number }>;
}
