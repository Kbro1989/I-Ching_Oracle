
================================================================================
SOVEREIGN ATTRACTOR MAP
Atlas of Fixed-Point Operators Under Total Annihilation
POG2 Sovereign System — Generated 2026-06-27
================================================================================

METHODOLOGY:
- Total opposition: All 64 hexagrams simultaneously vs each candidate
- Collective opposition: 010100 (Deliverance #40) — 99.9% entropy
- Survival criteria: Action-invariant XOR result + stable phase (drift < 0.1)
- Entropy tolerance: Fraction of bit flips before action changes
- Void adjacency: Hamming distance to forbidden state candidates

================================================================================
ATLAS STATISTICS
================================================================================

Total Hexagrams:        64
Sovereign Cores:        10 (15.6%)
Boundary Attractors:     7 (10.9%)
Transformers:           35 (54.7%)
Dissipators:            12 (18.8%)

Action-Invariant:       17 (26.6%)
Stable Phase:           45 (70.3%)
Forbidden-Adjacent:     18 (28.1%)

================================================================================
CATEGORY 1: SOVEREIGN CORES (10/64 = 15.6%)
Invariant action + stable phase (drift < 0.1)
================================================================================

These are the mountains that stand on their own ground.
They survive total annihilation without transformation.
They are the true fixed points.

 ID  Name                            Binary  Action  XOR→    Action  Inv?  H→Col  Tol   Shell  Drift
---  ------------------------------  ------  ------  ------  ------  ----  -----  ----  -----  -----
  7  The Army                        010000  ASSERT  000100  ASSERT   Y      1   0.33     3   0.000
 10  Treading                        110111  ADAPT   100011  ADAPT    Y      3   0.33     3   0.050
 16  Enthusiasm                      000100  ASSERT  010000  ASSERT   Y      1   0.00     3   0.000
 18  Work on Decayed                 011001  ADAPT   001101  ADAPT    Y      3   0.33     1   0.050
 19  Approach                        110000  ADAPT   100100  ADAPT    Y      2   0.17     4   0.000
 53  Development                     100100  ADAPT   110000  ADAPT    Y      2   0.17     2   0.000
 56  The Wanderer                    001101  ADAPT   011001  ADAPT    Y      3   0.50     1   0.050
 57  The Gentle                      010110  YIELD   000010  YIELD    Y      1   0.17     3   0.000
 61  Inner Truth                     101100  YIELD   111000  YIELD    Y      3   0.00     1   0.050
 62  Small Preponderance             011001  ADAPT   001101  ADAPT    Y      3   0.33     1   0.050

Key insight: 6 of 10 sovereign cores have action ADAPT.
ADAPT is the most stable action under total opposition.
ASSERT appears 3 times. YIELD appears 2 times.

================================================================================
CATEGORY 2: BOUNDARY ATTRACTORS (7/64 = 10.9%)
Invariant action + unstable phase (drift ≥ 0.1)
================================================================================

These survive but vibrate at the edge.
They are the phoenixes — transform form while preserving substance.
Card 5 (Qian) lives here.

 ID  Name                            Binary  Action  XOR→    Action  Inv?  H→Col  Tol   Shell  Drift
---  ------------------------------  ------  ------  ------  ------  ----  -----  ----  -----  -----
  1  The Creative (Qian)             111111  ASSERT  101011  ASSERT   Y      4   0.17     2   0.100 ← CARD 5
 25  Innocence                       100111  YIELD   110011  YIELD    Y      2   0.17     2   0.100
 26  Taming Power of the Great       111001  ASSERT  101101  ASSERT   Y      2   0.17     2   0.100
 30  The Clinging (Li)               101101  ASSERT  111001  ASSERT   Y      2   0.17     2   0.100
 38  Opposition                      100011  ADAPT   110111  ADAPT    Y      3   0.33     3   0.150
 41  Decrease                        110011  YIELD   100111  YIELD    Y      2   0.17     2   0.100
 49  Revolution                      101011  ASSERT  111111  ASSERT   Y      6   0.33     2   0.200

Key insight: Card 5 (Qian) is NOT a sovereign core.
It is a boundary attractor — it survives but costs energy.
The 97.3% fidelity is the efficiency of assertion through void.
Qian and Revolution form a 2-cycle under opposition: they map to each other.

================================================================================
CATEGORY 3: TRANSFORMERS (35/64 = 54.7%)
Not invariant action + stable phase
================================================================================

These transform under opposition. Their action changes.
They are the water that becomes the cup, the bottle, the teapot.

Notable entries:
  2  The Receptive (Kun)    000000  YIELD → ADAPT   (The opposite of Qian transforms)
 11  Peace                  111000  YIELD → ASSERT  (Peace becomes assertion)
 13  Fellowship with Men    111101  ASSERT → YIELD   (Assertion yields)
 40  Deliverance            010100  ADAPT → YIELD   (The collective itself transforms)
 42  Increase               001100  ASSERT → ADAPT  (Growth adapts)

================================================================================
CATEGORY 4: DISSIPATORS (12/64 = 18.8%)
Not invariant action + unstable phase
================================================================================

These scatter under opposition. They lose identity.
They are the leaves blown by the wind.

Notable entries:
  3  Difficulty at the Beginning  100010  ADAPT → YIELD   (The start yields)
  5  Waiting                      111010  WAIT  → UNKNOWN (Time dissolves)
  9  Taming Power of the Small    111011  ADAPT → ASSERT  (Small becomes large)
 14  Possession in Great Measure  101111  ASSERT → ADAPT  (Wealth adapts)
 63  After Completion             101010  WAIT  → ASSERT  (The end asserts)

================================================================================
ENTROPY TOLERANCE DISTRIBUTION
================================================================================

High tolerance (≥0.5):    4 entries
  #56 The Wanderer          0.50  ← SOVEREIGN

Medium tolerance (0.3-0.5):  14 entries
  # 7 The Army              0.33  ← SOVEREIGN
  #10 Treading              0.33  ← SOVEREIGN
  #18 Work on Decayed       0.33  ← SOVEREIGN
  #38 Opposition            0.33  (boundary)
  #49 Revolution            0.33  (boundary)
  #62 Small Preponderance   0.33  ← SOVEREIGN

Low tolerance (0.1-0.3):   20 entries
  # 1 The Creative (Qian)   0.17  (boundary) ← CARD 5
  #19 Approach              0.17  ← SOVEREIGN
  #25 Innocence             0.17  (boundary)
  #26 Taming Power          0.17  (boundary)
  #30 The Clinging          0.17  (boundary)
  #41 Decrease              0.17  (boundary)
  #53 Development           0.17  ← SOVEREIGN
  #57 The Gentle            0.17  ← SOVEREIGN

Zero tolerance:             26 entries
  #16 Enthusiasm            0.00  ← SOVEREIGN
  #61 Inner Truth           0.00  ← SOVEREIGN

================================================================================
FORBIDDEN-ADJACENT ATTRACTORS (Hamming Shell = 1)
================================================================================

18 hexagrams are adjacent to the forbidden state.
4 of these are sovereign cores (survive despite forbidden proximity).

Sovereign + forbidden-adjacent:
  #18 Work on Decayed       011001  shell=1
  #56 The Wanderer          001101  shell=1
  #61 Inner Truth           101100  shell=1
  #62 Small Preponderance   011001  shell=1

Non-sovereign + forbidden-adjacent:
  # 9 Taming Power of Small 111011  shell=1
  #14 Possession            101111  shell=1
  #15 Modesty               001000  shell=1
  #17 Following             100110  shell=1
  #22 Grace                 101001  shell=1
  #23 Splitting Apart       000001  shell=1
  #31 Influence             001110  shell=1
  #43 Breakthrough          111110  shell=1
  #44 Coming to Meet        011111  shell=1
  #48 The Well              011010  shell=1
  #52 Keeping Still         001011  shell=1
  #55 Abundance             101100  shell=1
  #59 Dispersion            010011  shell=1
  #63 After Completion      101010  shell=1

================================================================================
THE COMPLETE MAP
================================================================================

┌─────────────────────────────────────────────────────────────────────────────┐
│                    SOVEREIGN ATTRACTOR MAP                                  │
│           Fixed-Point Operators Under Total Annihilation                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SOVEREIGN CORES (10/64 = 15.6%)                                            │
│  ├── ADAPT:  6 cores  (#10, #18, #19, #53, #56, #62)                        │
│  ├── ASSERT: 3 cores  (#7, #16)                                             │
│  └── YIELD: 2 cores  (#57, #61)                                             │
│                                                                              │
│  BOUNDARY ATTRACTORS (7/64 = 10.9%)                                         │
│  ├── ASSERT: 4 boundaries  (#1 Qian, #26, #30, #49 Revolution)              │
│  ├── YIELD: 2 boundaries  (#25, #41)                                        │
│  └── ADAPT: 1 boundary    (#38)                                             │
│                                                                              │
│  Card 5 (Qian, #1) is a BOUNDARY ATTRACTOR.                                 │
│  It survives total annihilation but vibrates at the edge.                   │
│  Its 97.3% fidelity is the efficiency of assertion through 99.9% entropy. │
│                                                                              │
│  TRANSFORMERS (35/64 = 54.7%)                                               │
│  The majority of hexagrams transform under total opposition.                │
│  They are the water that takes the shape of its container.                  │
│                                                                              │
│  DISSIPATORS (12/64 = 18.8%)                                                │
│  These scatter under opposition. They lose identity.                        │
│  They are the leaves blown by the wind.                                     │
│                                                                              │
│  The forbidden state is INTIMATE, not distant.                              │
│  18 hexagrams are adjacent to it (shell=1).                                  │
│  4 sovereign cores survive despite forbidden proximity.                       │
│                                                                              │
│  The void is not empty.                                                     │
│  The void is the superposition of all 64 hexagrams.                         │
│  The void produces 99.9% entropy.                                           │
│  The sovereign cores assert through the void.                               │
│  The boundary attractors survive the void.                                  │
│  The transformers become the void.                                          │
│  The dissipators dissolve into the void.                                   │
│                                                                              │
│  The beat holds at 640ms.                                                   │
│  The substrate is sovereign.                                                │
│  The cat is alive.                                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

================================================================================
END OF ATLAS
================================================================================
