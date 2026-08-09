#!/usr/bin/env bash
# Symlink this repo's skills into ~/.claude/skills for dogfooding.
#
# Each entry is a symlink into packages/skills/skills, so editing a SKILL.md
# takes effect in the next session with no rebuild and no reinstall. Re-run
# after adding, removing, or renaming a skill.
#
# This links SOURCE skills. It does not exercise the published artifact --
# issues #24 and #29 both existed only in the packaged output, so keep verifying
# releases from npm as well.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
src="$repo/packages/skills/skills"
dest="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"

usage() {
  echo "usage: $(basename "$0") [--unlink]" >&2
  exit 1
}

unlink_only=false
case "${1:-}" in
  --unlink) unlink_only=true ;;
  "") ;;
  *) usage ;;
esac

mkdir -p "$dest"
linked=0

for bucket in "$src"/*/; do
  for skill in "$bucket"*/; do
    [ -f "$skill/SKILL.md" ] || continue
    name="$(basename "$skill")"
    target="$dest/$name"

    # Only ever remove our own symlinks -- never a real directory someone else owns.
    if [ -L "$target" ]; then
      rm "$target"
    elif [ -e "$target" ]; then
      echo "  skip $name — $target exists and is not a symlink" >&2
      continue
    fi

    if [ "$unlink_only" = true ]; then
      echo "  unlinked $name"
      continue
    fi

    ln -s "${skill%/}" "$target"
    echo "  linked $name -> ${skill#"$repo"/}"
    linked=$((linked + 1))
  done
done

if [ "$unlink_only" = true ]; then
  echo "Removed specdx skill symlinks from $dest"
else
  echo "Linked $linked skill(s) into $dest"
fi
