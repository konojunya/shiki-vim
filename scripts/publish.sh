#!/bin/bash
set -e

LOCAL=$(node -p "require('./package.json').version")
REMOTE=$(npm view shiki-vim version 2>/dev/null || echo "")

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "v$LOCAL already published, skipping"
else
  echo "Publishing v$LOCAL (current: ${REMOTE:-none})"
  npm publish --provenance --access public
fi
