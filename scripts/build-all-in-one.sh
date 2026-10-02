#!/usr/bin/env bash
# Regenerate WORKTRACE-ALL-IN-ONE.md by concatenating README + the full Skill package.
# Run this before every commit/push that changes any Skill file:
#   ./scripts/build-all-in-one.sh && git add WORKTRACE-ALL-IN-ONE.md
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="WORKTRACE-ALL-IN-ONE.md"
SKILL_DIR=".cline/skills/worktrace-daily-report"

{
  echo "# WORKTRACE - All-In-One Document"
  echo
  echo "> Generated file. Do not edit directly; edit the source files and regenerate via \`scripts/build-all-in-one.sh\`."
  echo
  echo "Source layout:"
  echo
  echo '```text'
  echo "README.md"
  echo "$SKILL_DIR/SKILL.md"
  for f in "$SKILL_DIR"/references/*.md "$SKILL_DIR"/assets/*.md; do
    echo "$f"
  done
  echo '```'
  echo
  echo "---"
  echo
  echo "## README.md"
  echo
  sed 's/^#/##/' README.md
  for f in "$SKILL_DIR/SKILL.md" "$SKILL_DIR"/references/*.md "$SKILL_DIR"/assets/*.md; do
    echo
    echo "---"
    echo
    echo "## $f"
    echo
    sed 's/^#/##/' "$f"
  done
} > "$OUT"

echo "Generated $OUT ($(wc -l < "$OUT") lines)."
