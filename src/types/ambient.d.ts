// Ambient module declarations for external/third-party and missing POG2 substrate modules.
// These only make the TypeScript compiler stop complaining; real implementations live in POG2.

// Satisfy any named import from BabylonJS for now.
declare module '@babylonjs/core' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const any: any;
}

// Logger helper moved into a local shim in GhostSplatLimb.ts; keep mapping for any other imports.
declare module '../utils/logger.js' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const any: any;
}

// POG2 models used by queue/routing code.
declare module '../core/models.js' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const any: any;
}

// Satisfy any named import from TernaryRouter.
declare module '../routers/TernaryRouter' {
  export interface TernaryRouter {
    getCurrentTemporalMode(): 'PAST' | 'PRESENT' | 'FUTURE';
    getPolarity(): number;
  }
}
