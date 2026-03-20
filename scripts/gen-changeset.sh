#!/bin/bash
# Generate a changeset from commits since the latest git tag.
# Usage: bun run changeset:gen [patch|minor|major]
#
# Defaults to "minor" if any "feat:" commits exist, "patch" otherwise.
# Override by passing an argument: bun run changeset:gen major

set -euo pipefail

LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -z "$LATEST_TAG" ]; then
  RANGE="HEAD"
else
  RANGE="${LATEST_TAG}..HEAD"
fi

# Collect commits (skip merge commits and Co-Authored-By lines)
COMMITS=$(git log "$RANGE" --pretty=format:"%s" --no-merges | grep -v "^$" || true)

if [ -z "$COMMITS" ]; then
  echo "No new commits since ${LATEST_TAG:-initial commit}."
  exit 0
fi

# Auto-detect bump type from commit prefixes
if [ -n "${1:-}" ]; then
  BUMP="$1"
elif echo "$COMMITS" | grep -q "^feat"; then
  BUMP="minor"
else
  BUMP="patch"
fi

# Build summary as bullet list grouped by type
FEATS=$(echo "$COMMITS" | grep "^feat" | sed 's/^/- /' || true)
FIXES=$(echo "$COMMITS" | grep "^fix" | sed 's/^/- /' || true)
DOCS=$(echo "$COMMITS" | grep "^docs" | sed 's/^/- /' || true)
CHORES=$(echo "$COMMITS" | grep "^chore" | sed 's/^/- /' || true)
OTHER=$(echo "$COMMITS" | grep -v "^feat\|^fix\|^docs\|^chore" | sed 's/^/- /' || true)

BODY=""
[ -n "$FEATS" ]  && BODY="${BODY}\n### Features\n\n${FEATS}\n"
[ -n "$FIXES" ]  && BODY="${BODY}\n### Bug Fixes\n\n${FIXES}\n"
[ -n "$DOCS" ]   && BODY="${BODY}\n### Documentation\n\n${DOCS}\n"
[ -n "$CHORES" ] && BODY="${BODY}\n### Chores\n\n${CHORES}\n"
[ -n "$OTHER" ]  && BODY="${BODY}\n### Other\n\n${OTHER}\n"

# Generate random filename
RANDOM_NAME=$(date +%s | shasum | head -c 16)
CHANGESET_FILE=".changeset/${RANDOM_NAME}.md"

printf -- '---\n"react.vim": %s\n---\n%b' "$BUMP" "$BODY" > "$CHANGESET_FILE"

echo "Created ${CHANGESET_FILE} (${BUMP})"
echo ""
cat "$CHANGESET_FILE"
