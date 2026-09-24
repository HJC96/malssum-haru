#!/usr/bin/env bash
# 수동 스모크: 실제 두 제공처 공식 페이지에 (각 1~2회) 요청해 오늘 상태를 확인한다.
# 기본 CI/mvn test 에서는 실행되지 않는다. 로컬 실험 프로필(qt.acquisition.enabled=true)로만 동작한다.
# 사용: services/qt/scripts/smoke.sh   (PORT=18081 기본)
# 종료 코드: 0 = 두 제공처 모두 RANGE_CONFIRMED, 1 = 그 밖(사유는 출력), 2 = 서버 기동 실패, 3 = 승인 없음으로 거부
# 사용자 승인 전에는 실행 금지: 제공처별 자동 취득 권리가 확인되기 전이므로, 아래 환경 변수를 명시해야만 실행된다.
#   QT_SMOKE_APPROVED=yes services/qt/scripts/smoke.sh
set -uo pipefail
if [ "${QT_SMOKE_APPROVED:-}" != "yes" ]; then
  echo "refused: 실제 제공처 서버에 요청하는 스크립트입니다. 사용자 승인 전에는 실행하지 않습니다 (QT_SMOKE_APPROVED=yes 필요)." >&2
  exit 3
fi
cd "$(dirname "$0")/.."
PORT="${PORT:-18081}"
LOG="target/smoke.log"

mvn -q -DskipTests package || exit 2
mkdir -p target
java -jar target/qt-service-0.0.1-SNAPSHOT-exec.jar --spring.profiles.active=local-experiment --server.port="$PORT" >"$LOG" 2>&1 &
PID=$!
trap 'kill "$PID" 2>/dev/null' EXIT

# 서버가 뜰 때까지 대기(제공처에는 요청하지 않는 경로로 확인: 404면 기동된 것)
for _ in $(seq 1 60); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/__ping" 2>/dev/null || true)"
  if [ "$code" != "000" ] && [ -n "$code" ]; then break; fi
  sleep 1
done

BODY="$(curl -sS -m 40 "http://localhost:$PORT/api/qt/today")" || { echo "server did not answer; see $LOG"; exit 2; }
echo "$BODY" | python3 -c 'import json,sys; print(json.dumps(json.load(sys.stdin), ensure_ascii=False, indent=2))'

echo "--- summary"
echo "$BODY" | python3 -c '
import json, sys
d = json.load(sys.stdin)
ok = True
for p in d["providers"]:
    ref = p.get("displayReference")
    print("%-20s %-20s reason=%-28s providerDate=%s ref=%s" % (
        p["providerId"], p["availabilityStatus"], p["reasonCode"], p["providerDate"], ref))
    ok = ok and p["availabilityStatus"] == "RANGE_CONFIRMED"
sys.exit(0 if ok else 1)
'
