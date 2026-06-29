#!/usr/bin/env bash
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo"
for f in \
  src/orchestrator.ts \
  src/workers/weave.ts \
  src/queues/handlers.ts \
  src/workers/drift.ts \
  src/workers/continuity.ts \
  src/workers/persona.ts \
  src/index.ts; do
  if [ ! -f "$f" ]; then
    echo "missing $f" >&2
    exit 1
  fi
done
python - <<'PY'
from pathlib import Path
from textwrap import dedent
import re, os
root = Path('C:/Users/krist/Desktop/oracle')
files = {
    'src/orchestrator.ts': root / 'src/orchestrator.ts',
    'src/workers/weave.ts': root / 'src/workers/weave.ts',
    'src/queues/handlers.ts': root / 'src/queues/handlers.ts',
    'src/workers/drift.ts': root / 'src/workers/drift.ts',
    'src/workers/continuity.ts': root / 'src/workers/continuity.ts',
    'src/workers/persona.ts': root / 'src/workers/persona.ts',
    'src/index.ts': root / 'src/index.ts',
}
patch = {
    'src/orchestrator.ts': {
        'head': "import { clock } from '../utils/SimulatedTime';\n",
        'before_matches': [],
        'replacements': [
            ("await this.ctx.storage.setAlarm(Date.now() + 640);",
             "await this.ctx.storage.setAlarm(Date.now() + 640); // DO boundary: wall-clock only."),
            ("await this.ctx.storage.setAlarm(Date.now() + 640);",
             "// NOTE: Cloudflare DO alarm requires wall-clock time. Internal timestamps use simulated clock.\nawait this.ctx.storage.setAlarm(Date.now() + 640);"),
            ("const thread = await this.env.POG2_BOUNDARY.prepare(\n      `SELECT * FROM thread_registry WHERE thread_id = ?1`\n    ).bind(threadId).first<{\n      current_hex: number;\n      stability_score: number;\n      coherence_index: number;\n      drift_velocity: number;\n    }>();",
             dedent("""\
              const thread = await this.env.POG2_BOUNDARY.prepare(\n                `SELECT * FROM thread_registry WHERE thread_id = ?1`\n              ).bind(threadId).first<{\n                current_hex: number;\n                stability_score: number;\n                coherence_index: number;\n                drift_velocity: number;\n              }>();""")),
        ],
        'post_aliases': [('Date.now()', 'clock.now()')],
        'preserve': ['const now = Date.now();', 'thirtyDaysAgo = Date.now()'],
        'slow': True,
    },
}
if True:
    print('pending')
PY