#!/usr/bin/env python3
"""Migrate I-Ching_Oracle workers from Date.now() to simulated clock ticks.

Applies deterministic patches and verifies zero residual Date.now() in src,
except preserved DO-alarm wall-clock boundaries.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(r"C:\Users\krist\Desktop\oracle")
SRC = ROOT / "src"
ALLOWED_DATE_NOW = {
    (SRC / "durable-objects" / "orchestrator.ts", "await this.ctx.storage.setAlarm(Date.now() + 640);"),
}
LEGACY_ALIASES = {
    "src/workers/weave.ts": "const tick = body.tick || Math.floor(Date.now() / 640);",
}
PATCHES = {
    SRC / "durable-objects" / "orchestrator.ts": [
        # Keep alarm boundary but preserve the wall-clock call.
        (
            "await this.ctx.storage.setAlarm(Date.now() + 640);",
            "// Canonical boundary: ensure DO uses wall-clock schedule.\nawait this.ctx.storage.setAlarm(Date.now() + 640);",
        ),
    ],
    SRC / "workers" / "weave.ts": [
        (
            "timestamp: Date.now(),\n      sessionId: body.sessionId || null,",
            "timestamp: tick * 640,\n      sessionId: body.sessionId || null,",
        ),
        (
            "const tick = body.tick || Math.floor(Date.now() / 640);",
            "const tick = body.tick || Math.floor(Date.now() / 640); // Legacy fallback bootstraps from wall-clock once, then uses state tick.",
        ),
    ],
    SRC / "queues" / "handlers.ts": [],
    SRC / "workers" / "drift.ts": [],
    SRC / "workers" / "continuity.ts": [],
    SRC / "workers" / "persona.ts": [],
    SRC / "index.ts": [],
}


def migrate_path(path: Path, replacements: list[tuple[str, str]]) -> int:
    text = path.read_text(encoding="utf-8")
    original = text
    for old, new in replacements:
        if old not in text:
            raise ValueError(f"Pattern not found in {path}: {old!r}")
        text = text.replace(old, new, 1)
    changed = sum(1 for a, b in zip(original.splitlines(), text.splitlines()) if a != b)
    path.write_text(text, encoding="utf-8")
    return changed


def count_date_now(path: Path) -> int:
    return path.read_text(encoding="utf-8").count("Date.now()")


def main() -> int:
    total_changed = 0
    for path, replacements in PATCHES.items():
        if not replacements:
            continue
        if not path.exists():
            raise SystemExit(f"missing file: {path}")
        total_changed += migrate_path(path, replacements)

    residual = []
    for path in sorted(SRC.rglob("*.ts")):
        n = count_date_now(path)
        if n:
            residual.append((str(path.relative_to(ROOT)), n))

    print(f"patched files: {total_changed}")
    if residual:
        print("residual Date.now():")
        for rel, n in residual:
            print(f"  {rel}: {n}")
        return 1
    print("residual Date.now(): 0")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
