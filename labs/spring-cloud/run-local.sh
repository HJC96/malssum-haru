#!/usr/bin/env bash
set -euo pipefail

LAB_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$LAB_DIR"
mkdir -p .run

if [[ ! -f gateway/target/gateway-0.1.0-SNAPSHOT.jar ]]; then
  mvn -q package
fi

start_app() {
  local name="$1"
  local jar="$2"
  if [[ -f ".run/$name.pid" ]] && kill -0 "$(<".run/$name.pid")" 2>/dev/null; then
    echo "$name already running (PID $(<".run/$name.pid"))"
    return
  fi
  java -jar "$jar" >".run/$name.log" 2>&1 &
  echo "$!" > ".run/$name.pid"
  echo "started $name (PID $(<".run/$name.pid"))"
}

wait_http() {
  local url="$1"
  local label="$2"
  for _ in $(seq 1 60); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "$label ready"
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for $label. Check .run/*.log" >&2
  return 1
}

start_app config-server config-server/target/config-server-0.1.0-SNAPSHOT.jar
wait_http http://localhost:8888/gateway/default "Config Server"
start_app discovery discovery/target/discovery-0.1.0-SNAPSHOT.jar
wait_http http://localhost:8761/ "Eureka"
start_app daily-content daily-content/target/daily-content-0.1.0-SNAPSHOT.jar
start_app explanation explanation/target/explanation-0.1.0-SNAPSHOT.jar
start_app gateway gateway/target/gateway-0.1.0-SNAPSHOT.jar
wait_http http://localhost:8080/api/official-qt-links "Gateway"
wait_http http://localhost:8080/api/daily-content "Gateway -> Eureka -> daily-content"
wait_http http://localhost:8080/api/explanations "Gateway -> Eureka -> explanation"
echo "Lab ready: http://localhost:8080/api/daily-content"
