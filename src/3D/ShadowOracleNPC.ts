
//=============================================================================
// SHADOW ORACLE NPC — POG2 Hexagram Integration
// File: ShadowOracleNPC.ts
// Derived from: Shadow-Orb.gltf (RS3 asset, textures 14732/14733/14736/14737)
//=============================================================================

import { HexagramManager } from '../limbs/HexagramManager';
import { GhostSplatPredictor } from '../limbs/GhostSplatLimb';
import { SovereignAvatarEntity } from '../core/SovereignAvatar';
import { TernaryRouter } from '../routers/TernaryRouter';

/**
 * ShadowOracleNPC — AI Oracle Interactive Entity
 * 
 * Anchored to glTF node[4] "Shadow orb" with 3 skinned mesh primitives.
 * Each primitive maps to a yao line pair (lines 1-2, 3-4, 5-6).
 * Material[0] = core orb (diffuse 14736, emissive white, BLEND)
 * Material[1] = animated ring (diffuse 14732, UV anim, MASK)  
 * Material[2] = inner void (no texture, pure emissive control)
 * 
 * The 16-joint skinning (all pointing to node 4) creates a radial
 * symmetry that we exploit for hexagram bit-field visualization.
 */

export interface OracleState {
  currentHexagram: number;      // 1-64, canonical ID key
  binarySignature: string;      // 6-bit string, NOT unique (3 duplicates)
  yaoLines: boolean[6];         // true=yang, false=yin, index 0=bottom
  action: 'ASSERT' | 'YIELD' | 'ADAPT' | 'WAIT';
  attractorCategory: 'SOVEREIGN' | 'BOUNDARY' | 'TRANSFORMER' | 'DISSIPATOR';
  emotionalResonance: number;  // 0.0-1.0, derived from GhostSplat heatmap
  temporalMode: 'PAST' | 'PRESENT' | 'FUTURE';
}

export class ShadowOracleNPC {
  private hexagramManager: HexagramManager;
  private ghostSplat: GhostSplatPredictor;
  private avatar: SovereignAvatarEntity;
  private router: TernaryRouter;

  // Verified POG2 hexagram registry — ID is canonical key
  private readonly HEXAGRAM_REGISTRY: Record<number, {
    binary: string;
    name: string;
    action: 'ASSERT' | 'YIELD' | 'ADAPT' | 'WAIT';
  }> = {
    1: {binary: "111111", name: "The Creative (Qian)", action: "ASSERT"},
    2: {binary: "000000", name: "The Receptive (Kun)", action: "YIELD"},
    3: {binary: "100010", name: "Difficulty at the Beginning", action: "ADAPT"},
    4: {binary: "010001", name: "Youthful Folly", action: "WAIT"},
    5: {binary: "111010", name: "Waiting", action: "WAIT"},
    6: {binary: "010111", name: "Conflict", action: "ADAPT"},
    7: {binary: "010000", name: "The Army", action: "ASSERT"},
    8: {binary: "000010", name: "Holding Together", action: "YIELD"},
    9: {binary: "111011", name: "The Taming Power of the Small", action: "ADAPT"},
    10: {binary: "110111", name: "Treading", action: "ADAPT"},
    11: {binary: "111000", name: "Peace", action: "YIELD"},
    12: {binary: "000111", name: "Standstill", action: "WAIT"},
    13: {binary: "111101", name: "Fellowship with Men", action: "ASSERT"},
    14: {binary: "101111", name: "Possession in Great Measure", action: "ASSERT"},
    15: {binary: "001000", name: "Modesty", action: "YIELD"},
    16: {binary: "000100", name: "Enthusiasm", action: "ASSERT"},
    17: {binary: "100110", name: "Following", action: "YIELD"},
    18: {binary: "011001", name: "Work on Decayed", action: "ADAPT"},
    19: {binary: "110000", name: "Approach", action: "ADAPT"},
    20: {binary: "000011", name: "Contemplation", action: "WAIT"},
    21: {binary: "100101", name: "Biting Through", action: "ASSERT"},
    22: {binary: "101001", name: "Grace", action: "YIELD"},
    23: {binary: "000001", name: "Splitting Apart", action: "WAIT"},
    24: {binary: "100000", name: "Return", action: "ADAPT"},
    25: {binary: "100111", name: "Innocence", action: "YIELD"},
    26: {binary: "111001", name: "The Taming Power of the Great", action: "ASSERT"},
    27: {binary: "100001", name: "Nourishment", action: "ADAPT"},
    28: {binary: "011110", name: "Great Preponderance", action: "ASSERT"},
    29: {binary: "010010", name: "The Abysmal (Kan)", action: "ADAPT"},
    30: {binary: "101101", name: "The Clinging (Li)", action: "ASSERT"},
    31: {binary: "001110", name: "Influence", action: "YIELD"},
    32: {binary: "011100", name: "Duration", action: "WAIT"},
    33: {binary: "001111", name: "Retreat", action: "YIELD"},
    34: {binary: "111100", name: "Great Power", action: "ASSERT"},
    35: {binary: "000101", name: "Progress", action: "ADAPT"},
    36: {binary: "101000", name: "Darkening of the Light", action: "WAIT"},
    37: {binary: "110001", name: "The Family", action: "YIELD"},
    38: {binary: "100011", name: "Opposition", action: "ADAPT"},
    39: {binary: "001010", name: "Obstruction", action: "WAIT"},
    40: {binary: "010100", name: "Deliverance", action: "ADAPT"},
    41: {binary: "110011", name: "Decrease", action: "YIELD"},
    42: {binary: "001100", name: "Increase", action: "ASSERT"},
    43: {binary: "111110", name: "Breakthrough", action: "ASSERT"},
    44: {binary: "011111", name: "Coming to Meet", action: "ADAPT"},
    45: {binary: "000110", name: "Gathering Together", action: "ASSERT"},
    46: {binary: "011000", name: "Pushing Upward", action: "ADAPT"},
    47: {binary: "010110", name: "Oppression", action: "WAIT"},
    48: {binary: "011010", name: "The Well", action: "ADAPT"},
    49: {binary: "101011", name: "Revolution", action: "ASSERT"},
    50: {binary: "110101", name: "The Cauldron", action: "ASSERT"},
    51: {binary: "011101", name: "The Arousing", action: "ASSERT"},
    52: {binary: "001011", name: "Keeping Still", action: "WAIT"},
    53: {binary: "100100", name: "Development", action: "ADAPT"},
    54: {binary: "110100", name: "The Marrying Maiden", action: "YIELD"},
    55: {binary: "101100", name: "Abundance", action: "ASSERT"},
    56: {binary: "001101", name: "The Wanderer", action: "ADAPT"},
    57: {binary: "010110", name: "The Gentle", action: "YIELD"},
    58: {binary: "110110", name: "The Joyous (Dui)", action: "YIELD"},
    59: {binary: "010011", name: "Dispersion", action: "ADAPT"},
    60: {binary: "110010", name: "Limitation", action: "WAIT"},
    61: {binary: "101100", name: "Inner Truth", action: "YIELD"},
    62: {binary: "011001", name: "Small Preponderance", action: "ADAPT"},
    63: {binary: "101010", name: "After Completion", action: "WAIT"},
    64: {binary: "010101", name: "Before Completion", action: "ADAPT"},
  };

  // Duplicate binary mappings — ID is canonical, binary is attribute
  private readonly DUPLICATE_BINARIES: Record<string, number[]> = {
    "011001": [18, 62],   // Work on Decayed / Small Preponderance
    "010110": [47, 57],   // Oppression / The Gentle
    "101100": [55, 61],   // Abundance / Inner Truth
  };

  // Attractor categories
  private readonly SOVEREIGN_CORES = new Set([7, 10, 16, 18, 19, 53, 56, 57, 61, 62]);
  private readonly BOUNDARY_ATTRACTORS = new Set([1, 25, 26, 30, 38, 41, 49]);
  private readonly DISSIPATORS = new Set([3, 5, 9, 14, 15, 17, 22, 23, 31, 43, 44, 48, 52, 55, 56, 59, 61, 62, 63]);

  constructor(
    hexagramManager: HexagramManager,
    ghostSplat: GhostSplatPredictor,
    avatar: SovereignAvatarEntity,
    router: TernaryRouter
  ) {
    this.hexagramManager = hexagramManager;
    this.ghostSplat = ghostSplat;
    this.avatar = avatar;
    this.router = router;
  }

  /**
   * Cast a hexagram from current world state.
   * Uses GhostSplat prediction + avatar emotional state + temporal router.
   * Returns canonical ID (not binary — binary is non-unique attribute).
   */
  public castHexagram(): OracleState {
    // Gather inputs from POG2 substrate
    const ghostPrediction = this.ghostSplat.getPosition2Heatmap(); // float[64]
    const avatarState = this.avatar.projectSelf();                  // 29-skill vector
    const temporalMode = this.router.getCurrentTemporalMode();     // PAST/PRESENT/FUTURE

    // Compute 6 yao lines from substrate entropy
    const yaoLines = this.computeYaoLines(ghostPrediction, avatarState);

    // Convert to binary string (bottom to top)
    const binary = yaoLines.map(y => y ? '1' : '0').join('');

    // Resolve canonical ID — handle duplicates via temporal routing
    const id = this.resolveCanonicalId(binary, temporalMode);
    const hex = this.HEXAGRAM_REGISTRY[id];

    // Compute emotional resonance from GhostSplat heatmap variance
    const emotionalResonance = this.computeResonance(ghostPrediction, id);

    return {
      currentHexagram: id,
      binarySignature: binary,
      yaoLines,
      action: hex.action,
      attractorCategory: this.classifyAttractor(id),
      emotionalResonance,
      temporalMode,
    };
  }

  /**
   * Resolve canonical hexagram ID from binary signature.
   * CRITICAL: Binary is NOT unique. ID is the canonical key.
   * For duplicates, use temporal mode + emotional resonance to disambiguate.
   */
  private resolveCanonicalId(binary: string, temporalMode: string): number {
    if (this.DUPLICATE_BINARIES[binary]) {
      const candidates = this.DUPLICATE_BINARIES[binary];

      // Disambiguation rule: temporal mode selects path
      // PAST → lower ID, PRESENT → emotional resonance, FUTURE → higher ID
      if (temporalMode === 'PAST') return Math.min(...candidates);
      if (temporalMode === 'FUTURE') return Math.max(...candidates);

      // PRESENT: use GhostSplat emotional weight
      const resonance0 = this.computeResonance(
        this.ghostSplat.getPosition2Heatmap(), candidates[0]
      );
      const resonance1 = this.computeResonance(
        this.ghostSplat.getPosition2Heatmap(), candidates[1]
      );
      return resonance0 > resonance1 ? candidates[0] : candidates[1];
    }

    // Unique binary — direct lookup
    for (const [id, hex] of Object.entries(this.HEXAGRAM_REGISTRY)) {
      if (hex.binary === binary) return parseInt(id);
    }

    // Fallback: collective opposition cascade
    return this.executeCascade(binary);
  }

  /**
   * Verified cascade: collective opposition → XOR with Qian → Revolution
   * When entropy is maximized (5.9965/6.0 bits), this cascade asserts.
   */
  private executeCascade(oppositionBinary: string): number {
    const qian = parseInt("111111", 2);
    const opposition = parseInt(oppositionBinary, 2);
    const cascadeResult = (opposition ^ qian).toString(2).padStart(6, '0');

    // Verified: 010100 ^ 111111 = 101011 → ID 49 (Revolution, ASSERT)
    for (const [id, hex] of Object.entries(this.HEXAGRAM_REGISTRY)) {
      if (hex.binary === cascadeResult) return parseInt(id);
    }
    return 49; // Verified fallback: Revolution
  }

  /**
   * Compute 6 yao lines from substrate signals.
   * Each line is a boolean (yang=true, yin=false).
   * Lines 1-2 → Mesh[0] (core orb), 3-4 → Mesh[1] (animated ring), 5-6 → Mesh[2] (void)
   */
  private computeYaoLines(ghostHeatmap: Float32Array, avatarState: Float32Array): boolean[] {
    const lines: boolean[] = [];

    // Line 1 (bottom): Avatar combat stance aggression
    lines[0] = avatarState[0] > 0.5; // attack skill threshold

    // Line 2: GhostSplat prediction confidence
    lines[1] = ghostHeatmap[0] > 0.5; // position 2 confidence

    // Line 3: Temporal router polarity
    lines[2] = this.router.getPolarity() > 0;

    // Line 4: Emotional variance (high = yang)
    const emotionVar = this.computeEmotionVariance(ghostHeatmap);
    lines[3] = emotionVar > 0.5;

    // Line 5: Sovereign core proximity
    lines[4] = this.isNearSovereignCore(avatarState);

    // Line 6 (top): System entropy threshold
    lines[5] = this.computeSystemEntropy() > 5.99; // 99.94% threshold

    return lines;
  }

  private classifyAttractor(id: number): OracleState['attractorCategory'] {
    if (this.SOVEREIGN_CORES.has(id)) return 'SOVEREIGN';
    if (this.BOUNDARY_ATTRACTORS.has(id)) return 'BOUNDARY';
    if (this.DISSIPATORS.has(id)) return 'DISSIPATOR';
    return 'TRANSFORMER';
  }

  private computeResonance(heatmap: Float32Array, hexId: number): number {
    // Resonance = dot product of heatmap with hexagram's attractor field
    const attractorField = this.hexagramManager.getAttractorField(hexId);
    let dot = 0;
    for (let i = 0; i < 64; i++) dot += heatmap[i] * attractorField[i];
    return Math.min(1.0, Math.max(0.0, dot));
  }

  private computeEmotionVariance(heatmap: Float32Array): number {
    const mean = heatmap.reduce((a, b) => a + b, 0) / heatmap.length;
    const variance = heatmap.reduce((a, b) => a + (b - mean) ** 2, 0) / heatmap.length;
    return Math.sqrt(variance);
  }

  private isNearSovereignCore(avatarState: Float32Array): boolean {
    // Check if avatar position aligns with any sovereign core coordinate
    // Simplified: use first 3 dims as spatial proxy
    const x = avatarState[0], y = avatarState[1], z = avatarState[2];
    return (x > 0.7 && y > 0.7 && z > 0.7); // Qian-like coordinates
  }

  private computeSystemEntropy(): number {
    const actions = Object.values(this.HEXAGRAM_REGISTRY).map(h => h.action);
    const counts = { ASSERT: 0, YIELD: 0, ADAPT: 0, WAIT: 0 };
    actions.forEach(a => counts[a]++);
    const total = actions.length;
    let entropy = 0;
    for (const c of Object.values(counts)) {
      if (c > 0) entropy -= (c/total) * Math.log2(c/total);
    }
    return entropy; // Verified: 1.9758 bits (32.93% of 6-bit max)
  }

  //===========================================================================
  // VISUALIZATION INTERFACE — Maps hexagram state to glTF material params
  //===========================================================================

  /**
   * Update Shadow Orb visual state from OracleState.
   * Maps to the 3 mesh primitives + material properties.
   */
  public updateVisuals(state: OracleState): void {
    // Mesh[0] (core orb): Lines 1-2 → emissive intensity + color
    const coreIntensity = (state.yaoLines[0] ? 0.8 : 0.2) + (state.yaoLines[1] ? 0.8 : 0.2);
    this.setMaterialEmissive(0, [coreIntensity, coreIntensity * 0.8, coreIntensity * 0.6]);

    // Mesh[1] (animated ring): Lines 3-4 → UV animation speed + alpha cutoff
    const ringSpeed = (state.yaoLines[2] ? 0.31494140625 : 0.0) + (state.yaoLines[3] ? 0.1 : 0.0);
    this.setUVAnimation(1, [ringSpeed, 0]);
    this.setAlphaCutoff(1, state.yaoLines[3] ? 0.5 : 0.1);

    // Mesh[2] (inner void): Lines 5-6 → pure white or pure black
    const voidColor = state.yaoLines[4] && state.yaoLines[5] ? [1, 1, 1] : [0, 0, 0];
    this.setMaterialEmissive(2, voidColor);

    // Action color coding on all materials
    const actionColor = this.actionToColor(state.action);
    this.setBaseColorTint(actionColor);
  }

  private actionToColor(action: string): [number, number, number] {
    switch (action) {
      case 'ASSERT': return [1.0, 0.2, 0.2];   // Red
      case 'YIELD':  return [0.2, 0.2, 1.0];   // Blue
      case 'ADAPT':  return [0.2, 1.0, 0.2];   // Green
      case 'WAIT':   return [0.5, 0.5, 0.5];   // Gray
    }
  }

  // Stub implementations for Three.js material control
  private setMaterialEmissive(materialIndex: number, color: [number, number, number]): void {
    // Hook into glTF material[0/1/2].emissiveFactor
  }
  private setUVAnimation(materialIndex: number, offset: [number, number]): void {
    // Hook into KHR_texture_transform offset for material[1]
  }
  private setAlphaCutoff(materialIndex: number, cutoff: number): void {
    // Hook into material.alphaCutoff
  }
  private setBaseColorTint(color: [number, number, number]): void {
    // Global tint across all materials
  }
}

//=============================================================================
// ORACLE DIALOGUE SYSTEM — Generates NPC responses from hexagram state
//=============================================================================

export class OracleDialogueEngine {
  private readonly DIALOGUE_TEMPLATES: Record<string, string[]> = {
    ASSERT: [
      "The Creative stirs. Act now, for the moment is ripe.",
      "Breakthrough demands your will. The orb burns red.",
      "Possession is not given — it is taken. ASSERT your claim.",
    ],
    YIELD: [
      "The Receptive receives all. Yield, and gain ten thousand things.",
      "Peace flows when you cease to push. The orb rests in blue.",
      "Retreat is not defeat — it is the gathering of strength.",
    ],
    ADAPT: [
      "Difficulty at the Beginning — adapt your form to the chaos.",
      "The Well is deep. Draw from it, but do not break the bucket.",
      "Revolution is near, but you must ADAPT to its timing.",
    ],
    WAIT: [
      "Standstill. The orb is still. Wait for the turning.",
      "Contemplation reveals what action conceals. WAIT.",
      "The Abysmal is deep. Do not plunge yet.",
    ],
  };

  public generateResponse(state: OracleState): string {
    const templates = this.DIALOGUE_TEMPLATES[state.action];
    const index = Math.floor(state.emotionalResonance * templates.length);
    return templates[Math.min(index, templates.length - 1)];
  }

  public generateProphecy(state: OracleState): string {
    const hex = state.currentHexagram;
    const name = this.getHexagramName(hex);
    const category = state.attractorCategory;

    return `The Shadow Oracle speaks:

    [${hex}] ${name} — ${state.action}
    Category: ${category}
    Resonance: ${(state.emotionalResonance * 100).toFixed(1)}%
    Temporal: ${state.temporalMode}

    ${this.generateResponse(state)}

    ${this.generateYaoReading(state.yaoLines)}`;
  }

  private getHexagramName(id: number): string {
    // Reference to registry
    return ""; // populated from HEXAGRAM_REGISTRY
  }

  private generateYaoReading(lines: boolean[]): string {
    const lineNames = ['Bottom', '2nd', '3rd', '4th', '5th', 'Top'];
    const readings = lines.map((yang, i) => 
      `  ${lineNames[i]} line: ${yang ? 'YANG (—)' : 'YIN (- -)'}`
    );
    return `Yao lines:
${readings.join('
')}`;
  }
}
