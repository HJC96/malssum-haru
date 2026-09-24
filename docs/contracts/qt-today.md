# 계약: QT 오늘 응답 (`GET /api/qt/today`)

- 계약 버전: `1` (2026-09-24, v1.2: NOT_COLLECTED_YET 추가. v1.1: 같은 책 다중 범위 허용·INTERNAL_ERROR 추가·실패 매핑 합의. lead 작성 v1-draft. 변경은 lead만 하며 qt-backend·web-experience에 메시지로 알린다)
- 관련: PRD QT01·QT04, AC01·AC11·AC18·AC21, 구현 계획 M1
- 상태: **초안 v1**. qt-backend가 조사 결과로 수정을 제안할 수 있고, lead가 반영한다.

## 원칙

1. 한 제공처의 실패가 다른 제공처를 막지 않는다. 제공처별 실패는 HTTP 200 안의 `availabilityStatus`로 표현한다. 5xx는 서버 자체 오류에만 쓴다.
2. 제공처 기준 오늘이 아닌 자료는 절대 오늘로 반환하지 않는다. 날짜가 어긋나면 `RANGE_UNAVAILABLE` + `reasonCode: DATE_MISMATCH`이고 `passage`는 `null`이다.
3. 권한이 확인되지 않은 성경 본문·제공처 해설은 응답에 넣지 않는다. v1에는 본문 필드가 **없다**. 본문 제공은 권한 확인 뒤 `bodyStatus`를 확장하는 v2에서 다룬다.
4. `officialUrl`은 항상 비어 있지 않은 https URL이다. 장절을 못 얻어도 링크는 나간다.
5. 개인 계획·읽은 범위·진도는 이 API의 요청·응답 어디에도 없다. QT 열람은 계획에 영향을 주지 않는다.
6. 성경 책은 언어와 무관한 `bookId`(USFM 3글자 대문자: `GEN`, `EXO` … `REV`)로 식별한다.

## 응답 예시

```json
{
  "schemaVersion": "1",
  "generatedAt": "2026-09-24T01:02:03Z",
  "providers": [
    {
      "providerId": "maeil-seongyeong",
      "providerName": { "ko": "매일성경", "en": "Maeil Seongyeong (Daily Bible)" },
      "providerTimeZone": "Asia/Seoul",
      "providerDate": "2026-09-24",
      "availabilityStatus": "RANGE_CONFIRMED",
      "reasonCode": null,
      "passage": {
        "ranges": [
          { "bookId": "JHN", "start": { "chapter": 3, "verse": 1 }, "end": { "chapter": 3, "verse": 21 } }
        ]
      },
      "displayReference": "요한복음 3:1-21",
      "officialUrl": "https://sum.su.or.kr:8888/bible/today",
      "officialUrlKind": "today-page",
      "verifiedAt": "2026-09-24T01:02:02Z",
      "sourceVersion": "maeil-seongyeong-adapter/1",
      "bodyStatus": "NOT_PROVIDED",
      "notice": { "ko": "본문은 공식 페이지에서 읽을 수 있습니다.", "en": "Read the text on the official page. The source is Korean only." }
    },
    {
      "providerId": "saengmyeong-ui-sam",
      "providerName": { "ko": "생명의삶", "en": "Saengmyeong-ui-sam (Life Application QT)" },
      "providerTimeZone": "Asia/Seoul",
      "providerDate": null,
      "availabilityStatus": "RANGE_UNAVAILABLE",
      "reasonCode": "PARSE_FAILED",
      "passage": null,
      "displayReference": null,
      "officialUrl": "https://www.duranno.com/qt/view/bible.asp?qtDate=2026-09-24",
      "officialUrlKind": "date-specific",
      "verifiedAt": null,
      "sourceVersion": "saengmyeong-ui-sam-adapter/1",
      "bodyStatus": "NOT_PROVIDED",
      "notice": null
    }
  ]
}
```

## 필드

| 필드 | 형식 | 규칙 |
| --- | --- | --- |
| `schemaVersion` | `"1"` | 하위 호환이 깨지면 올린다 |
| `generatedAt` | ISO-8601 UTC | 응답 생성 시각 |
| `providers[]` | 배열 | 항상 두 제공처를 모두, 이 순서(`maeil-seongyeong`, `saengmyeong-ui-sam`)로 |
| `providerId` | 열거 | `maeil-seongyeong` \| `saengmyeong-ui-sam`. 365QT는 v1에 없다 |
| `providerName` | `{ko, en}` | 표시명 |
| `providerTimeZone` | IANA | 제공처 날짜 기준. 현재 `Asia/Seoul` |
| `providerDate` | `YYYY-MM-DD` \| null | **제공처가 그 자료를 오늘 것으로 표시한 날짜**. 확인 못 하면 null |
| `availabilityStatus` | 열거 | 아래 표 |
| `reasonCode` | 열거 \| null | 아래 표. `RANGE_CONFIRMED`이면 null |
| `passage` | `{ranges}` \| null | `RANGE_CONFIRMED`일 때만 값이 있다. `ranges`는 1개 이상. 같은 책 안의 비연속 범위(예: 시 23:1-3, 5-6)는 겹치지 않는 오름차순 여러 개로 허용(v1.1). 성경 순서 |
| `passage.ranges[]` | `{bookId, start:{chapter,verse}, end:{chapter,verse}}` | 같은 책 안의 연속 범위. 장 전체를 읽는 경우도 절 번호를 채운다(끝 절 = 그 장의 마지막 절). 절 수 표를 못 쓰는 어댑터는 `verse: null`을 허용하지 않고 `RANGE_UNAVAILABLE`로 처리한다 |
| `displayReference` | string \| null | 제공처가 보여 준 한국어 표기. 화면은 이 값이 아니라 `passage`+i18n으로 렌더링하고, 이 값은 검증·디버그용이다 |
| `officialUrl` | https URL | 항상 존재 |
| `officialUrlKind` | 열거 | `date-specific`(날짜가 URL에 들어감) \| `today-page`(오늘 페이지). 후자는 화면에 "제공처의 오늘 페이지"임을 표시한다 |
| `verifiedAt` | ISO-8601 UTC \| null | 장절을 실제로 확인한 시각 |
| `sourceVersion` | string | 어댑터 이름/버전. HTML 구조 변경 추적용 |
| `bodyStatus` | `"NOT_PROVIDED"` | v1은 고정값. 본문 필드는 없다 |
| `notice` | `{ko,en}` \| null | 사용자에게 보일 수 있는 짧은 안내. 제공처 원문 문장을 복사하지 않는다 |

## `availabilityStatus`

| 값 | 의미 | `passage` | 화면 동작 |
| --- | --- | --- | --- |
| `RANGE_CONFIRMED` | 오늘 장절을 확인했고 `providerDate`가 제공처 기준 오늘과 일치 | 있음 | 장절 + 공식 링크 버튼("공식 페이지로 이동") |
| `RANGE_UNAVAILABLE` | 링크는 유효하나 장절을 얻지 못했다 | null | "오늘 범위를 확인하지 못했습니다" + 공식 링크 |
| `RANGE_NOT_PERMITTED` | 자동 취득 조건이 미확인/불허라 취득하지 않았다 | null | 공식 링크만 |
| `LINK_ERROR` | 공식 링크 자체가 응답하지 않거나 오류다 | null | 상태 안내 + 링크는 그대로 제시(사용자가 직접 확인) |
| `DISABLED` | 운영자가 이 제공처 연동을 껐다 | null | 공식 링크만 |

## `reasonCode` (개방형 열거, 아래 값으로 시작)

`PARSE_FAILED`, `DATE_MISMATCH`, `UPSTREAM_TIMEOUT`, `UPSTREAM_HTTP_ERROR`, `DYNAMIC_CONTENT_UNAVAILABLE`, `UNKNOWN_BOOK`, `INVALID_REFERENCE`, `NOT_COLLECTED_YET`(저장소 조회형 배포에서 오늘 항목이 아직 수집되지 않음. 어제 항목으로 대체 금지, v1.2), `INTERNAL_ERROR`(어댑터 예기치 못한 예외 격리, v1.1), `PERMISSION_UNCONFIRMED`, `OPERATOR_DISABLED`, `LINK_UNREACHABLE`

클라이언트는 모르는 `reasonCode`를 만나도 `availabilityStatus`만으로 동작해야 한다.

## 날짜 규칙 (AC11, AC18)

- 서버는 `Asia/Seoul` 기준 오늘을 계산해 제공처에 요청한다. 제공처가 반환한 날짜와 다르면 `DATE_MISMATCH`다.
- 사용자의 현지 날짜와 제공처 날짜가 다를 수 있다. 화면은 `providerDate`와 "제공처 기준(한국 시간)"을 표시한다.
- 재수집은 `(providerId, providerDate)`가 키다. 같은 키의 재수집은 항목을 늘리지 않는다.

## 테스트 가능한 기준 (qt-backend)

1. 두 제공처 모두 성공 → 두 항목 `RANGE_CONFIRMED`.
2. 한쪽 파싱 실패 → 그 항목만 `RANGE_UNAVAILABLE`, 다른 쪽은 정상, HTTP 200.
3. 제공처 날짜 ≠ 서울 오늘 → `RANGE_UNAVAILABLE`/`DATE_MISMATCH`, `passage` null.
4. 링크 오류 → `LINK_ERROR`.
5. 응답 JSON에 성경 본문·해설 텍스트 필드가 없다.
6. 모든 항목에서 `officialUrl`이 https이고 비어 있지 않다.
7. 테스트 fixture에는 성경 본문 전문·제공처 해설을 복사하지 않는다(장절 표기 정도의 구조 정보만).

## 실패 매핑 합의 (qt-backend 제안 승인, 2026-09-24)

- 공식 페이지 GET이 곧 링크 확인이다. 연결 실패/DNS → `LINK_ERROR`+`LINK_UNREACHABLE`, 타임아웃 → `LINK_ERROR`+`UPSTREAM_TIMEOUT`, HTTP 4xx/5xx → `LINK_ERROR`+`UPSTREAM_HTTP_ERROR`.
- 페이지에 날짜가 없는 껍데기 페이지 → `RANGE_UNAVAILABLE`+`PARSE_FAILED`. 표시 날짜 ≠ 서울 오늘 → `RANGE_UNAVAILABLE`+`DATE_MISMATCH`.
- 장 전체만 표기하고 절 번호가 없는 경우 → `RANGE_UNAVAILABLE`+`INVALID_REFERENCE`(절 수 표 연결은 66권 데이터 확정 후 재논의).
- 취득 설정 `qt.acquisition.enabled` 기본 false → `RANGE_NOT_PERMITTED`+`PERMISSION_UNCONFIRMED`. 공개 배포에서는 권리 매트릭스가 허용을 확인하기 전까지 false.
- 관찰(qt-backend, 2026-09-24): 매일성경은 날짜 지정 URL이 없어 `today-page`, 생명의삶은 `qtDate` 지정 가능해 `date-specific`.

- 생명의삶 `qtDate` 링크는 서버 '오늘'이 지나면 껍데기 페이지가 될 수 있다(qt-backend 관찰). 화면은 date-specific 링크도 '제공처가 그 날짜에 게시한 페이지'로 안내하고 오래된 응답을 오늘 것으로 두지 않는다(providerDate·generatedAt 표시).
