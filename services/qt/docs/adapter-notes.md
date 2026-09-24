# QT 어댑터 조사 메모 (매일성경 · 생명의삶)

- 조사일: 2026-09-24 (KST 10:47~11:00). 서울 오늘 = 2026-09-24.
- 방법(조사는 종료됨, 권리 확인 전 추가 요청 중단): `curl`로 GET/POST 각 1~2회씩, 총 약 20회, 요청 간 1초 이상 간격, 사람이 읽을 수 있는 User-Agent 명시. 반복 호출·캐시 없는 폴링은 하지 않았다.
- **이 문서는 기술 관찰이다. 자동 취득·재게시·AI 입력 권한을 뜻하지 않는다.** 권한은 `docs/rights-matrix.md`(source-rights)에서 따로 판단한다.
- 성경 본문 전문·제공처 해설·묵상 질문은 저장소에 복사하지 않았다. 아래에 인용한 것은 장절 표기와 날짜 형식뿐이다.

## 한눈에 보기

| | 매일성경 | 생명의삶 |
| --- | --- | --- |
| 공식 링크 | `https://sum.su.or.kr:8888/bible/today` | `https://www.duranno.com/qt/view/bible.asp?qtDate=YYYY-MM-DD` |
| 링크 종류 | `today-page` (날짜 지정 불가) | `date-specific` |
| 인코딩 | UTF-8 | EUC-KR (`Content-Type: text/html;charset=EUC-KR; Charset=EUC-KR`, meta도 euc-kr) |
| 날짜·장절 위치 | **첫 HTML에 서버 렌더링** (JSON 보조 경로도 있음) | 첫 HTML에 서버 렌더링 (추가 XHR 불필요) |
| 취득 요청 수 | GET 1회 (보조 JSON POST 1회) | GET 1회 |
| 날짜 기준 | 서버의 오늘(KST). 날짜 파라미터 무시 | 서버의 오늘(KST) 한 날짜만 내용이 나옴 |

## 매일성경

### 요청 형태
- `GET https://sum.su.or.kr:8888/bible/today` → 200, `text/html; charset=utf-8`, 약 86KB. 세션 쿠키(`ASP.NET_SessionId`)를 내려 주지만 필요하지 않다.
- 첫 HTML 뒤에 페이지의 JS가 추가 요청을 하는 구조는 맞다(jQuery `$.ajax` POST, `application/json; charset=utf-8`). 그러나 **오늘 날짜와 장절은 첫 HTML에 이미 서버가 채워 넣는다.**
  - 스크립트 안: `$("#base_de").val("YYYY-MM-DD");`
  - `<div id="dailybible_info">매일성경  YYYY.MM.DD (요일)</div>`
  - `<div id="bibleinfo_box">본문 : {책이름(English)} {장:절 - 장:절} 찬송가 N장</div>` (예: `사사기(Judges) 11:1 - 11:11`; 같은 블록이 `bibleinfo_box_3`로 한 번 더 있다)
- 페이지 JS가 쓰는 JSON 경로 (POST, 본문은 작은따옴표 JSON: `{ 'qt_ty' : 'QT1' , 'Base_de' : 'YYYY-MM-DD'}`):

| 경로 | 응답 | 우리가 쓰는가 |
| --- | --- | --- |
| `/Ajax/Bible/Calendar` | 월 달력 | 아니오 |
| `/Ajax/Bible/BodyTop` | `BibleDay`(YYYY.MM.DD), `BibleDay_yyyyMMdd`, `PreviousDay`, `NextDay` 등 (장절 없음, `Front_book_nm`은 "매일성경") | 아니오 |
| `/Ajax/Bible/BodyMatterDetail` | `Base_de`, `Bible_name`("사사기(Judges)"), `Bible_chapter`("11:1 - 11:11"), 그리고 제공처 제목·해설·질문 필드(`Qt_sj`, `Qt_Brf`, `Qt_a1..4` 등) | **보조 경로**: 첫 HTML에 날짜·장절이 없을 때만. `Base_de`, `Bible_name`, `Bible_chapter` 세 필드만 읽고 나머지는 버린다 |
| `/Ajax/Bible/BodyBible`, `BodyBibleCont` | 본문 절 목록, 해설 | **호출하지 않는다** (본문·해설) |

### 날짜
- 서버가 정하는 오늘만 나온다. `?base_de=2026-09-23` GET, `base_de=2026-09-23` POST 폼 모두 무시되고 오늘이 렌더링된다 → 날짜 지정 공식 링크는 만들 수 없다(`today-page`).
- 페이지의 이전/다음 날 버튼은 AJAX로 다른 날짜를 불러오는 것으로 코드상 보이나, 다른 날짜 요청은 실제로 시험하지 않았다(사용자에게 보여 줄 링크가 없고 과거 날짜 탐색은 제품 범위 밖). 어댑터는 서울 오늘만 요청한다.
- 어댑터는 JSON의 `Base_de`를 페이지 날짜로 취급하고 서울 오늘과 비교한다(불일치 → `DATE_MISMATCH`).

### 표기 형식
- `책이름(English) 장:절 - 장:절`. 공백·괄호 병기를 파서가 무시한다. 관찰한 것은 한 장 안의 한 범위뿐이다. 여러 범위·장 넘김은 방어적으로 지원한다.
- `robots.txt`: 없음(오류 HTML 페이지가 200으로 옴).

### 실패 가능성
- HTML 구조 변경(요소 id 변경, 표기 형식 변경) → 첫 HTML에서 못 찾음 → JSON 보조 경로 → 그것도 실패하면 `RANGE_UNAVAILABLE / DYNAMIC_CONTENT_UNAVAILABLE`. 표기를 읽었으나 해석 불가면 `UNKNOWN_BOOK`/`INVALID_REFERENCE`.
- 정상 응답이지만 이미지 QT 등 다른 유형(`Bible_type != 1`)인 날: 표기가 없을 수 있음 → 위와 같이 처리.
- 포트 8888 사용, 인증서는 정상(curl 기본 검증 통과). 서버가 느리면 `UPSTREAM_TIMEOUT`(LINK_ERROR).

## 생명의삶

### 요청 형태
- `GET https://www.duranno.com/qt/view/bible.asp?qtDate=YYYY-MM-DD` → 200, HTTP/2, **EUC-KR**, 약 26KB. `qtDate=`(빈 값)이면 서버 오늘.
- 어댑터는 `x-windows-949`(EUC-KR 상위집합)로 해독한다. 선언 문자셋과 실제가 어긋난 경우를 위해 다른 문자셋으로 한 번 더 시도한다.
- 날짜: `<ul class="date">` 안 가운데 `<li>2026.09.24 <span>(목)</span></li>` (양옆 `li.left`/`li.right`는 전날/다음날 링크).
- 장절: `<div class="font-size"><h1><span>역대상  14 : 1~17</span><em>{제목}</em></h1>`. 책 이름 뒤 공백 2칸, 콜론 앞뒤 공백, 범위 구분자 `~`. 하위 소제목(`<p class="title">… 14:1~7</p>`)에도 절 범위가 있으나 어댑터는 h1의 표기만 쓴다.
- 오늘의 찬송, 본문, 해설, 묵상 영역은 같은 페이지에 있으나 읽지 않는다.

### 날짜 동작(중요)
- 서버 기준 오늘의 `qtDate`만 내용이 나온다. **과거·미래 `qtDate`(2025-12-24, 2026-01-01, 2026-03-16, 2026-09-10, 2026-09-25, 2026-09-30, 2026-10-05, 2026-12-30 확인)는 모두 HTTP 200인데 날짜·장절이 없는 껍데기 페이지(14,519B)**가 온다. 어제 자료가 오늘로 섞일 일은 없지만 "200 = 성공"으로 보면 안 되므로, 날짜·장절 요소가 없으면 `PARSE_FAILED`로 처리한다.
- 어댑터는 서울 오늘 날짜로 `qtDate`를 요청하고, 페이지에 표시된 날짜가 서울 오늘과 다르면 `DATE_MISMATCH`.
- 공식 링크는 `qtDate=서울오늘`이 들어간 URL(`date-specific`)이다. 사용자가 자정 이후 링크를 열면 그 날짜가 이미 "오늘"이 아닐 수 있다는 점(껍데기 페이지)은 web-experience가 "제공처의 오늘 페이지" 안내를 고려할 만하다. 상단 메뉴의 "오늘의 QT"는 `bible.asp?qtDate=`(빈 값) 링크를 쓴다.
- `robots.txt`: `User-agent: *` / `Disallow: /admin/`.

### 실패 가능성
- EUC-KR 오해독(깨진 글자) → 책 이름을 못 찾음 → 다른 문자셋 재시도 → 그래도 안 되면 `PARSE_FAILED`/`UNKNOWN_BOOK`.
- 껍데기 페이지, 로그인 유도 페이지 → 날짜·h1 없음 → `PARSE_FAILED`.
- 장 전체만 표기하는 날(예: 시편 1편 전체)이 있으면 절 수 표가 필요하다. 지금까지 관찰한 두 제공처의 표기는 모두 절을 명시했다. 표가 없을 때는 `INVALID_REFERENCE`로 처리해 추정하지 않는다(`VerseCountTable` 인터페이스로 나중에 연결).

## 두 제공처 공통 결론

1. 두 곳 모두 오늘 장절이 서버 렌더링된 첫 HTML에 있어 GET 1회로 취득 가능하다(기술적으로). 매일성경 JSON 경로는 보조.
2. 날짜 지정 링크는 생명의삶만 가능. 매일성경은 today-page.
3. 계약 v1의 `RANGE_CONFIRMED`는 날짜(서울 오늘) 일치 + 장절 정규화 성공일 때만 나간다.
4. 취득 권한은 별도 문제다. 구현은 기본 off 설정 플래그(`qt.acquisition.enabled=false`)로 두고, off이면 제공처에 요청하지 않는다.
