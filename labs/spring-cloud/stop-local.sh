#!/usr/bin/env bash
set -euo pipefail

LAB_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$LAB_DIR"

for name in gateway explanation daily-content discovery config-server; do
  pid_file=".run/$name.pid"
  if [[ -f "$pid_file" ]]; then
    pid="$(<"$pid_file")"
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid"
      echo "stopped $name (PID $pid)"
    fi
    rm -f "$pid_file"
  fi
done
