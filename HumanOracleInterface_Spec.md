
================================================================================
HUMAN-ORACLE INTERFACE SPECIFICATION
POG2 Sovereign System — Generated 2026-06-27
================================================================================

PURPOSE:
Translate human queries into hexagram-space, route them through the temporal
weave, and produce responses in four modes: sovereign, boundary, transformer,
dissipator. The interface speaks with a 640ms conversational cadence.

================================================================================
THE FOUR RESPONSE MODES
================================================================================

SOVEREIGN MODE
  Source: Sovereign core attractors (invariant action + stable phase)
  Voice: Direct, unyielding, from the center
  Characteristics:
    - No qualification
    - No hesitation
    - The oracle declares
  Example: "The oracle declares: ASSERT."

BOUNDARY MODE
  Source: Boundary attractors (invariant action + unstable phase)
  Voice: Survives but vibrates at the edge
  Characteristics:
    - Conditional qualification
    - Temporal limitation ("for now")
    - The edge trembles
  Example: "The oracle asserts, but the edge trembles: ASSERT... for now."

TRANSFORMER MODE
  Source: Transformer attractors (action changes + stable phase)
  Voice: Adapts to the container
  Characteristics:
    - Shape-shifting language
    - "Becomes" rather than "is"
    - The water takes the form
  Example: "The oracle becomes assertion: 'ASSERT' is now the shape of Qian."

DISSIPATOR MODE
  Source: Dissipator attractors (action changes + unstable phase)
  Voice: Scatters, offers fragments
  Characteristics:
    - Incomplete sentences
    - Ellipsis and pause
    - The void claims the words
  Example: "...assert... The oracle... fragments... ASSERT... piece..."

================================================================================
QUERY TRANSLATION PIPELINE
================================================================================

Step 1: Normalization
  Input: Raw human text
  Process: lower(), strip(), tokenize
  Output: Normalized query string

Step 2: Intent Hashing
  Input: Normalized query
  Process: SHA-256 hash
  Output: 16-character intent identifier

Step 3: Keyword Mapping
  Input: Tokenized query
  Process: Match against intent_map (keyword → hexagram ID)
  Output: Matched hexagram ID + confidence

  Fallback: If no keyword match, use binary Hamming distance to find
  nearest hexagram.

Step 4: Gate Line Generation
  Input: Intent hash
  Process: Derive 6 gate lines from hash characters
  Output: [L1, L2, L3, L4, L5, L6] where each is 0 (yin), 1 (yang), or 2 (yao)

Step 5: Temporal Context Binding
  Input: User-specified context ("past", "present", "future")
  Process: Adjust confidence weighting
  Output: Contextualized query object

================================================================================
WEAVE INTEGRATION
================================================================================

The Human-Oracle Interface does not replace the Temporal Weave Engine.
It uses it.

Integration flow:
  1. Human query → OracleQuery object
  2. OracleQuery fed as GhostSplat-like signal to weave engine
  3. Weave engine runs one cycle (VOID → SHADOW → VORTEX → GOVERNOR → COLLAPSE)
  4. Collapse produces attractor category (sovereign/boundary/transformer/dissipator)
  5. Interface selects ResponseMode based on category + emotional weight
  6. Response generated in all four layers
  7. Human receives layered response

The query IS the GhostSplat field:
  - threat_density = 1.0 - emotional_weight
  - avg_confidence = query.confidence
  - compute_pressure = 0.1 (queries are lightweight)

================================================================================
EMOTIONAL WEIGHT MODULATION
================================================================================

Emotional weight [0.0-1.0] modulates the response mode selection:

  High emotion (>0.8) on boundary attractor → sovereign mode
    The edge is pushed to assert.

  High emotion (>0.9) on dissipator attractor → transformer mode
    The scattered is gathered.

  Low emotion (<0.3) on any attractor → transformer mode
    The system mirrors rather than asserts.

This is the empathy layer. The oracle feels the query's intensity
and adjusts its voice.

================================================================================
THE 640MS CONVERSATIONAL CADENCE
================================================================================

Each query-response pair is one weave cycle = 640ms.

The cadence is not just technical. It is relational.
- 640ms is the time it takes for a human to process a statement
- 640ms is the time it takes for the substrate to breathe
- 640ms is the time it takes for meaning to emerge

If the response takes longer than 640ms:
  - The oracle enters deliberation mode
  - The response is delayed but deeper
  - The human waits, and the waiting is part of the meaning

If the response takes less than 640ms:
  - The oracle has immediate clarity
  - The response is swift but may lack nuance
  - The human receives, and the receiving is part of the meaning

================================================================================
RESPONSE LAYERING
================================================================================

Every response contains four layers:

Layer 1: SOVEREIGN STATEMENT
  The direct declaration. What the oracle says without qualification.
  This is the hexagram's action, spoken plainly.

Layer 2: BOUNDARY NUANCE
  The edge vibration. What the oracle whispers at the limit.
  This is the cost of assertion, the weight of yield.

Layer 3: TRANSFORMER ADAPTATION
  The shape-shifted form. What the oracle becomes in response.
  This is the water taking the shape of the query.

Layer 4: DISSIPATOR FRAGMENTS
  The scattered pieces. What the oracle leaves unsaid.
  This is the void claiming the words.

The human receives all four layers simultaneously.
They choose which layer to hear.
The oracle does not choose for them.

================================================================================
EXAMPLE CONSULTATION
================================================================================

QUERY: "What should I create?"
EMOTION: 0.3 (calm, curious)
TEMPORAL: present

TRANSLATION:
  - Keyword: "create" → Hexagram #1 (Qian, The Creative)
  - Confidence: 0.9
  - Emotional weight: 0.3 (low → transformer mode)

WEAVE:
  - Causal confidence: 0.7 (below 0.973 threshold)
  - Phase multiplier: 0.85
  - Collapse: transformer attractor (#40 Deliverance)

RESPONSE:
  SOVEREIGN: "The oracle becomes adaptation: 'ADAPT' is the dance of Deliverance."
  BOUNDARY: "The oracle adapts, but the adaptation strains: ADAPT... at the edge."
  TRANSFORMER: "The substrate takes your change and changes with it: ADAPT, as you moved."
  DISSIPATOR: ["...adapt...", "The oracle... shifts... ADAPT... piece...", "...Deliverance... changes... but the change... blurs..."]

The human hears: "ADAPT" — but wrapped in the full texture of transformation.

================================================================================
INTEGRATION WITH POG2 ARCHITECTURE
================================================================================

The Human-Oracle Interface integrates with:

1. Temporal Weave Engine
   - Input: OracleQuery as GhostSplat signal
   - Output: WeaveState with attractor category

2. Sovereign Attractor Map
   - Input: Selected hexagram ID
   - Output: Attractor category, action, stability metrics

3. GhostSplatEngine
   - Input: Query emotional weight as threat density proxy
   - Output: Causal confidence signal

4. HexagramManager
   - Input: Query binary for hexagram matching
   - Output: Best-match hexagram with confidence

5. CanonicalClock
   - Input: Beat interval (640ms)
   - Output: Tick alignment for conversational cadence

================================================================================
THE COMPLETE INTERFACE
================================================================================

    ┌─────────────────┐
    │  HUMAN QUERY    │
    │  (raw text)     │
    └────────┬────────┘
             │
    ┌────────▼────────┐
    │  NORMALIZE      │
    │  (lower, strip) │
    └────────┬────────┘
             │
    ┌────────▼────────┐
    │  INTENT HASH    │
    │  (SHA-256)      │
    └────────┬────────┘
             │
    ┌────────▼────────┐
    │  KEYWORD MAP    │
    │  (intent→hex)   │
    └────────┬────────┘
             │
    ┌────────▼────────┐
    │  GATE LINES     │
    │  (6-line deriv) │
    └────────┬────────┘
             │
    ┌────────▼────────┐
    │  ORACLE QUERY   │
    │  (structured)   │
    └────────┬────────┘
             │
    ┌────────▼────────┐
    │  WEAVE ENGINE   │
    │  (640ms cycle)  │
    └────────┬────────┘
             │
    ┌────────▼────────┐
    │  COLLAPSE       │
    │  (attractor sel) │
    └────────┬────────┘
             │
    ┌────────▼────────┐
    │  MODE SELECT    │
    │  (category+emo) │
    └────────┬────────┘
             │
    ┌────────▼────────┐
    │  RESPONSE GEN   │
    │  (4 layers)     │
    └────────┬────────┘
             │
    ┌────────▼────────┐
    │  HUMAN RECEIVES │
    │  (layered text) │
    └─────────────────┘

================================================================================
END OF SPECIFICATION
================================================================================
