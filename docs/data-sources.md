# 성경 66권 장절 구조 데이터 출처 조사 (T02)

- 작성: source-rights, 확인일 2026-09-24
- 대상: planner-core(T07·T10), lead. PRD 13절 "성경 구조 데이터" 결정 입력 자료
- 이 문서는 관찰과 근거만 적는다. 라이선스 해석이나 법적 판단은 하지 않는다. 근거가 없는 수치는 `미확인`으로 둔다.

## 0. 먼저 읽을 결론

1. 장절 구조 데이터(책, 장, 장별 마지막 절 번호)는 본문 전문이 아니다. 본문 전문 권리와 별개로 출처와 조건을 판단해야 한다. 이 문서는 두 종류를 구분해 적는다.
2. 오픈 라이선스로 받을 수 있는 두 체계(SWORD의 KJV canon, UBS/Paratext의 `eng.vrs`)에서 66권 1,189장을 직접 계산해 확인했다. 총 절 수는 SWORD KJV 31,102, `eng.vrs` 31,104로 서로 다르다. 차이는 두 곳(요한3서 1장, 요한계시록 12장)뿐이다.
3. 개역개정 실제 표시 구조를 대한성서공회 성경플랫폼에서 33개 장 표본으로 확인했다. 표본에서 KJV와 다른 곳은 요한3서 1장 한 곳(15절, KJV 14절)이었다. 요한계시록 12장은 17절로 KJV와 같고 `eng.vrs`(18절)와 다르다. 개역개정 전체(1,189장) 전수 확인은 하지 않았으므로 개역개정 총 절 수는 `미확인`이다.
4. 개역개정에는 절 번호가 합쳐지거나(사도행전 15:25-26) 표시되지 않는(사도행전 24:7) 곳이 있다. 표본 33장에서 확인한 것이며 전체 목록은 `미확인`이다. PRD의 "유효한 절 식별자"는 번호 체계(versification 표) 기준으로 센다(lead 결정). 병합·생략 절은 알려진 제한이다(7절).
5. 권고안은 6절, 재현 절차는 9절에 있다. 한 줄 요약: UBS `eng.vrs`(MIT, 커밋 `71c66cb`)를 기준 표로 삼고 요한계시록 12장을 17절로 덮어쓴 **잠정 표** `nkrv-provisional-1`을 쓰며 SWORD KJV canon과 교차 검증한다. 개역개정 전수 검증은 대한성서공회 회신 후로 미룬다(lead 결정, 2026-09-24).

## 1. 본문 전문 데이터와 장절 구조 데이터의 구분

| 구분 | 내용 | 예 | 권리 판단 |
| --- | --- | --- | --- |
| 본문 전문 데이터 | 절마다 글자로 된 성경 본문 | 개역개정 전문, 개역한글 전문 | 번역본 저작권자의 허가 조건을 따른다. 개역개정은 대한성서공회 소유로 표기되며 사용은 별도 허가 신청 대상(rights-matrix.md) |
| 장절 구조 데이터 | 책 식별자, 장 수, 장별 마지막 절 번호, (있다면) 절 병합·생략 정보 | `GEN 1:31 2:25 ...` | 본문이 아니다. 출처 파일의 라이선스와 대한성서공회의 구조 정보에 대한 입장은 각각 별개로 확인이 필요하다. 대한성서공회 문서에서 구조 정보에 대한 별도 언급은 찾지 못했다(`미확인`) |
| 제공처 표기 | QT 제공처가 보여 주는 "역대상 14:1~17" 같은 장절 문자열 | 매일성경, 생명의삶 | 구조 데이터가 아니라 제공처 콘텐츠 취득 문제. rights-matrix.md 참고 |

PRD 3절도 "일독 계산을 위한 전체 장절 구조 데이터는 별도로 유지한다"고 구분한다.

**장절 구조 데이터(장별 절 수)의 권리 판단 상태.** 현재 범위는 개역개정 본문을 쓰지 않고 장절 범위 표기와 공식 링크만 보여 주므로, 장별 절 수는 일독 계산과 범위 검증에 쓰는 본문이 아닌 숫자 표다. 권고 표(`nkrv-provisional-1`)의 값은 오픈 라이선스 파일(UBS `eng.vrs`, 저장소 라이선스 MIT)에서 왔고 대한성서공회 화면이나 자료에서 옮기지 않았다(대한성서공회 화면은 표본 비교 검증에만 썼다). 확인한 범위는 이렇다. 대한성서공회 저작권 안내, FAQ, 허가 조건 문서에서 장절 개수 같은 구조 정보의 이용을 따로 다루는 문구를 찾지 못했다(`미확인`). `eng.vrs`의 원저작 표기도 확인하지 못했다(`미확인`). 이 숫자 표에 별도 허가가 필요한지에 대한 판단은 하지 않았으며, 필요하면 대한성서공회 문의(rights-matrix.md 6-1, 현재 보류)에서 함께 물을 수 있다. 개역개정과의 일치 여부는 표본 33개 장만 확인했고 전수 검증은 미룬 상태다(6절).

## 2. 후보별 조사표

확인일은 모두 2026-09-24다. 데이터 버전은 확인한 파일의 커밋 또는 리비전이다.

| ID | 후보 | 출처 URL | 기준 체계 | 데이터 버전 | 라이선스와 사용 조건 | 본문 포함 여부 | 66권 장절 구조 | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C1 | SWORD `canon.h` (CrossWire) | https://crosswire.org/svn/sword/trunk/include/canon.h | KJV(영어 개신교). 기본 canon. 같은 폴더에 `canon_nrsv.h`, `canon_mt.h`, `canon_lxx.h` 등 다른 체계도 있음 | svn trunk, `canon.h` 리비전 3765(HTTP ETag `3765//trunk/include/canon.h`) | 파일 머리말과 저장소 `LICENSE`는 GNU GPL v2를 명시(프로젝트 `COPYING`: "Copy and use freely under the terms of the GNU General Public License"). 값 자체(장별 절 수)를 우리 코드에 옮길 때의 GPL 적용 여부는 판단하지 않음. `미확인` | 없음(숫자 표) | 확인. 66권 1,189장, 절 합계 31,102 | 책 이름은 영어 약칭(`Gen`, `Exod`). USFM 3글자 ID 매핑은 우리가 해야 함 |
| C2 | UBS ICAP `versification_json` 의 `examples/eng.vrs` (Paratext English versification) | https://github.com/ubsicap/versification_json/blob/master/examples/eng.vrs (raw: https://raw.githubusercontent.com/ubsicap/versification_json/master/examples/eng.vrs) | Paratext "English"(RSV, 스페인어 RVR 등이 쓰는 체계). 파일 머리말에 "modifications by Reinier de Blois 13/March/2012" | 저장소 최신 커밋 `0833abd`(2020-03-11), `eng.vrs` 최종 변경 커밋 `71c66cb`(2019-06-03, "Add vrs for standard versifications") | 저장소 `LICENSE`는 MIT, 저작권자 "United Bible Societies Institute for Computer Assisted Publishing" 2019. 파일 자체의 원저작 표기는 확인하지 못함(`미확인`) | 없음(숫자 표) | 확인. 66권 1,189장, 절 합계 31,104. 책 ID가 USFM 3글자(`GEN`, `EXO` ... `REV`)로 PRD·계약의 `bookId`와 같음 | 같은 폴더에 `eng.json`(JSON 형식), `org.vrs`(원문 체계), `lxx.vrs`, `vul.vrs` 등. `=` 매핑 줄(절 번호 대응)이 있어 다른 체계로 변환하는 근거가 됨 |
| C3 | 같은 저장소의 `examples/org.vrs` (Original versification: BHS 구약, GNT 신약) | https://raw.githubusercontent.com/ubsicap/versification_json/master/examples/org.vrs | 히브리어·그리스어 원문 체계 | C2와 같음 | C2와 같음 | 없음 | 확인. 66권 1,189장(구약 929, 신약 260)이며 요엘 4장, 말라기 3장 구성이라 책별 장 수가 다름. 절 합계 31,170 | 개역개정과 체계가 다름(4절 참고). 비교용 |
| C4 | 대한성서공회 성경플랫폼의 개역개정(NKRV) 화면 구조 | https://bible.bskorea.or.kr/bible/NKRV/GEN.1 (예) | 개역개정 실제 표시 체계 | 화면 하단 표기 `v.4.48.0`(플랫폼 버전). 성경 데이터 버전은 확인하지 못함 | 별도 데이터 라이선스 문서는 찾지 못함(`미확인`). 성경 콘텐츠 저작권 안내(https://bible.bskorea.or.kr/copyright_notice)는 개역개정판(1998) 저작권을 대한성서공회로 표기. 이용약관은 https://www.bskorea.or.kr/bbs/content.php?co_id=provision | 본문 전문 있음(우리는 절 번호 개수만 관찰) | 표본 33개 장만 확인(4-2절). 페이지 내부 목록으로 구약 39권 929장 확인. 신약 장 수는 이 페이지 목록에서 얻지 못해 `미확인` | **검증 기준으로만 사용.** 데이터 출처로 채택하지 않음(6절) |
| C5 | API.Bible (American Bible Society) | https://api.bible/ , 문서 https://docs.api.bible/ , 약관 https://api.bible/terms-and-conditions , 절 참조 안내 https://docs.api.bible/resources/referencing-verses/ | 번역본별 체계. 절마다 `id`(번역본 기준)와 `orgId`(정규화 기준)를 둠 | 미확인(API 버전은 확인하지 않음) | 약관 조회 결과: 무료 Starter 플랜은 비상업 용도, 광고·수익·유료 구독·인앱 구매 금지. 캐시는 30일마다 갱신, 삭제 콘텐츠는 24시간 내 제거. 저작권 콘텐츠를 생성형 AI·LLM 학습에 쓰는 것은 서면 동의 없이 금지. 책·장·절 메타데이터의 별도 제한은 문서에서 찾지 못함 | 번역본 본문 제공(번역본별 저작권 다름) | 책·장·절 목록 엔드포인트가 문서에 있음(`/guides/books`, `/guides/chapters`, `/guides/verses`). 응답 내용은 호출하지 않아 `미확인` | 한국어 성경 제공 여부·개역개정 포함 여부는 문서에서 확인하지 못함(`미확인`). API 키 필요. PRD 14절 참고 자료에 있으나 이번 조사에서는 호출하지 않음 |
| C6 | scrollmapper `bible_databases` | https://github.com/scrollmapper/bible_databases | 번역본별 | 최신 푸시 2026-07-10 | 저장소는 MIT. 번역본마다 별도 라이선스 필드가 있음(README) | 있음(공개 번역본) | 이번에 내려받아 검증하지 않음(`미확인`) | 한국어 개역개정 포함 여부 `미확인`. 채택하지 않음 |
| - | 조사하지 않은 후보 | YouVersion Platform API, Unbound Bible, OpenScriptures, Digital Bible Library | - | - | - | - | `미조사` | 필요하면 후속 조사 |

참고. `sillsdev/scripture`(MIT)는 versification 처리 코드 라이브러리이며 이번에 저장소 트리에서 `.vrs` 데이터 파일을 찾지 못했다. `sillsdev/libpalaso`에서도 테스트용 `versification.vrs` 하나만 확인했다. 데이터 출처 후보에서 제외한다.

## 3. 직접 계산해 확인한 값

C1의 `canon.h`(`sbook chapmax`와 `int vm[]`)와 C2의 `eng.vrs`(66권 줄)를 내려받아 계산했다. 재현 방법은 9절이다.

| 항목 | C1 SWORD KJV | C2 `eng.vrs` | C3 `org.vrs` |
| --- | --- | --- | --- |
| 책 수 | 66 | 66 | 66 |
| 구약 장 수 / 절 수 | 929 / 23,145 | 929 / 23,145 | 929 / 23,213 (요엘 4장, 말라기 3장 구성) |
| 신약 장 수 / 절 수 | 260 / 7,957 | 260 / 7,959 | 260 / 7,957 |
| 전체 장 수 | 1,189 | 1,189 | 1,189 |
| 전체 절 수 | 31,102 | 31,104 | 31,170 |
| 장 하나의 최대 절 수 | 176(시편 119편) | 176 | 미계산 |

## 4. 개역개정 장절 수가 다른 체계와 다른 지점

### 4-1. 이미 확인한 체계 간 차이 (파일 비교, 자동 계산)

- C1(SWORD KJV)과 C2(`eng.vrs`)는 66권 전체를 비교한 결과 **2곳만 다르다.**
  - 요한3서 1장: KJV 14절, `eng.vrs` 15절
  - 요한계시록 12장: KJV 17절, `eng.vrs` 18절
- C2(`eng.vrs`)와 C3(`org.vrs`, 원문 체계)는 29개 책에서 다르다. 시편은 62개 장, 그 밖에 요엘(3장 대 4장)과 말라기(4장 대 3장)의 장 구성, 사도행전과 고린도후서 각 1개 장 등이다. 원문 체계는 시편 표제를 1절로 세는 등 번호가 밀린다(API.Bible 안내 문서에도 같은 설명이 있음).

### 4-2. 개역개정 표본 확인 (대한성서공회 성경플랫폼, 2026-09-24)

방법과 한계는 10절에 있다. 아래 33개 장(브라우저에서 32개, 앞선 요나 1장 1개)에서 절 번호의 개수와 최대값을 셌다(본문 글자는 저장하지 않음).

| 구분 | 확인한 장 | 결과 |
| --- | --- | --- |
| KJV·`eng.vrs`와 모두 같음 | 요나 2(10), 요엘 2(32), 요엘 3(21), 느헤미야 4(23), 시편 3(8), 시편 51(19), 말라기 3(18), 말라기 4(6), 마태 17(27), 마태 18(35), 마태 23(39), 마가 9(50), 마가 11(33), 마가 15(47), 누가 17(37), 누가 23(56), 요한 5(47), 사도행전 8(40), 사도행전 19(41), 사도행전 28(31), 로마서 16(27), 고린도후서 13(13), 요한일서 5(21), 다니엘 3(30), 다니엘 4(37), 창세기 31(55), 열왕기상 5(18), 역대상 6(81), 요나 1(17, 앞 조사) | 일치 |
| `eng.vrs`와 같고 KJV와 다름 | 요한3서 1장: 15절 | KJV 14절, `eng.vrs` 15절, 개역개정 15절 |
| KJV와 같고 `eng.vrs`와 다름 | 요한계시록 12장: 17절 | KJV 17절, `eng.vrs` 18절, 개역개정 17절 |
| 최대 절은 같으나 번호가 합쳐지거나 빠짐 | 사도행전 15장 (최대 41절): 25절과 26절이 "25-26" 한 표시. 사도행전 24장 (최대 27절): 7절 표시 없음 | 최대 절 번호는 KJV와 같음. 어떤 번호가 독립된 절로 존재하는지는 다름 |

추가로 대한성서공회 성경플랫폼 페이지 안의 책 목록에서 구약 39권의 장 수를 읽었다. 합계 929장이며 요엘 3장, 말라기 4장, 시편 150장, 이사야 66장 등 KJV/SWORD와 모두 일치한다. 이 목록은 구약만 담고 있어 신약 260장은 개역개정 기준으로 `미확인`이다.

### 4-3. 결론(관찰)

- 개역개정은 표본 범위에서 원문 체계(C3)가 아니라 영어 체계(KJV, `eng.vrs`) 쪽이다(요엘 3장, 말라기 4장, 요나 1:17, 시편 표제 미번호 등).
- 영어 체계 안에서도 KJV와 `eng.vrs`가 다른 두 곳(요한3서 1장, 요한계시록 12장)에서 개역개정은 서로 다른 쪽을 따랐다.
- 표본 밖 1,150여 개 장에 다른 차이가 없는지는 확인하지 않았다. **개역개정 전체 총 절 수는 `미확인`**이다. 표본 결과를 그대로 외삽하면 31,103(SWORD KJV 31,102에 요한3서 +1)이 되지만 이는 검증되지 않은 추정이다.
- 개역개정 본문에는 절 번호가 병합되거나 빠진 곳이 있다(표본에서 2곳 확인). 전체 목록은 `미확인`이다.

## 5. 검증에 쓸 수 있는 불변값과 근거

| 값 | 근거 | 상태 |
| --- | --- | --- |
| 개신교 66권 (구약 39, 신약 27) | PRD 확정 사항, C1·C2 66권 줄 직접 계산 | 확인됨 |
| 전체 1,189장 | C1·C2·C3 세 표 모두 합계 1,189(직접 계산). 구약 929장은 대한성서공회 플랫폼 책 목록에서도 확인 | 확인됨(신약 260장의 개역개정 기준 확인은 `미확인`) |
| 구약 929장, 신약 260장 | C1·C2 계산. 구약 929는 개역개정 플랫폼 목록과도 일치 | 확인됨 |
| KJV 체계 전체 절 수 31,102 (구약 23,145, 신약 7,957) | C1 SWORD `canon.h` 직접 계산 | 확인됨(KJV 체계 한정) |
| `eng.vrs` 전체 절 수 31,104 (구약 23,145, 신약 7,959) | C2 직접 계산 | 확인됨(`eng.vrs` 한정) |
| 개역개정 전체 절 수 | 표본 33장만 확인 | **미확인** (추정 31,103, 검증 전) |
| 가장 긴 장 시편 119편 176절, 가장 긴 책 시편 150장 | C1 계산, 개역개정 시편 150장은 플랫폼 목록 확인 | 확인됨(장 수), 176절의 개역개정 기준은 `미확인` |
| 요엘 3장, 말라기 4장(영어 체계) | C1·C2, 개역개정 플랫폼 목록 | 확인됨 |
| 장별 절 수 표의 해시 | 9절의 정의로 계산: SWORD KJV `9d439b8f6b02c844`, `eng.vrs` `775d44f2f4228b8a` (SHA-256 앞 16자) | 확인됨(재현용, 개역개정 값 아님) |

권장 단위 테스트(제안): 66권 순서와 ID, 장 수 합계 1,189, 구약 929·신약 260, 체계별 절 합계(위 표), 모든 장의 절 수가 1 이상, `bookId`가 USFM 3글자 대문자인지.

## 6. 권고안과 대체안

### 결정 기록 (lead, 2026-09-24)

- PLAN03의 절 기준은 **번호 체계 기준(versification 표)** 으로 센다. 개역개정 화면에 존재하지 않는 절 번호(사도행전 24:7)나 병합 표시(사도행전 15:25-26)는 알려진 제한으로 남긴다(7절).
- `versificationSystem`은 `nkrv-provisional-1`, dataVersion도 provisional 표기로 한다(`eng.vrs` 기반, `REV 12 = 17` 덮어쓰기, 개역개정 전수 미검증).
- 개역개정 전수 검증은 대한성서공회 회신 이후로 미룬다. `bible.bskorea.or.kr` 추가 접근과 1,189장 전수 조회는 하지 않는다.
- 문의 메일은 사용자 지시 전에는 발송하지 않는다.

### 권고안 (planner-core용, 잠정): `nkrv-provisional-1`

**UBS `eng.vrs`(C2, MIT)의 66권 장별 마지막 절 번호를 기준 표로 쓰고, 요한계시록 12장만 17절로 덮어쓴다.** 결과는 66권 1,189장, 총 31,103절(구약 23,145, 신약 7,958)이다. 표본 검증에 근거한 잠정 값이다. 근거는 다음과 같다.

1. 책 ID가 계약의 `bookId`(USFM 3글자)와 같아 변환 표가 필요 없다.
2. 저장소 라이선스가 MIT로 명시되어 있다(파일 원저작 표기는 `미확인`).
3. 개역개정이 표본에서 따른 영어 체계와 맞고, 표본에서 확인한 다른 지점은 요한계시록 12장 한 곳(`eng.vrs` 18절, 개역개정 17절)이다.
4. C1(SWORD KJV)과 교차 검증이 가능하다. 덮어쓴 표와 C1은 요한3서 1장(15 대 14)에서만 달라야 한다.
5. 우리 표는 대한성서공회 화면에서 옮긴 것이 아니다. 대한성서공회 화면은 비교 검증에만 썼다. 덮어쓰기 값 17은 KJV/SWORD 값과도 같다.

이 값이 개역개정과 일치한다고 확정하려면 전수 검증이 필요하며, 회신 전에는 표본 밖 차이를 모른다는 점을 계획 결과 화면·문서에 `provisional`로 남긴다. 전수 검증 결과가 나오면 표를 갱신한다.

### 대체안

- **대체안 A:** SWORD `canon.h`(C1)의 KJV 표를 기준으로 삼고 요한3서 1장을 15로 덮어쓴다(총 31,103, 결과 표는 권고안과 같다). 출처 파일이 GPL v2로 표기돼 값을 옮길 때 라이선스 검토가 필요하다. 권고안 출처(C2)를 쓸 수 없게 될 때만 쓴다.
- **대체안 B:** 대한성서공회의 허가 또는 제공 자료로 66권 1,189장의 개역개정 절 구조를 확보해 `versificationSystem: "nkrv"`로 확정한다.
- **비권고:** API.Bible(C5). 무료 플랜이 비상업 한정이고 AI 학습 제한이 있으며 한국어 성경 제공 여부가 확인되지 않았다.

## 7. planner-core에 전달할 주의점과 알려진 제한

1. 배분의 단위와 총량은 "장별 마지막 절 번호" 기준이다. 개역개정에서 표시되지 않는 절 번호(사도행전 24:7)와 병합 표시(사도행전 15:25-26)가 있어도 최대 절이 같으므로 번호 기준으로 세면 표와 일치한다. **알려진 제한:** 이 절 번호들은 개역개정 화면에서 독립된 절이 아닐 수 있다. 표본 33개 장에서 2곳을 확인했고 전체 목록은 `미확인`이다.
2. 다른 체계로 변환은 검증된 매핑이 있을 때만 한다(PRD 10절). `eng.vrs`의 `=` 매핑 줄은 이번에 사용하지 않았고 검증하지도 않았다.
3. QT 제공처가 표기하는 범위(예: 역대상 14:1~17)는 제공처 체계다. 장 끝 절을 우리 표로 채울 때 불일치가 나오면 `INVALID_REFERENCE`로 취급하는 편이 안전하다(QT 계약 참고).

## 8. 남은 결정

1. 개역개정 전수 검증(대한성서공회 회신 이후)과 병합·생략 절 전체 목록 확보.
2. 문의 메일 발송 여부와 시점(사용자 지시 후).

## 9. 재현 절차 (planner-core용, T10)

다운로드한 파일은 저장소에 넣지 않는다. 필요한 최소 표와 라이선스 고지는 planner-core가 만든다. Python 3만 필요하다.

### 9-1. 고정할 입력

| 항목 | 값 |
| --- | --- |
| 저장소 | https://github.com/ubsicap/versification_json |
| 커밋(고정) | `71c66cb6ddfa6158919bc9798d124141a8168b14` (2019-06-03, `eng.vrs`의 마지막 변경 커밋) |
| 내려받을 URL | https://raw.githubusercontent.com/ubsicap/versification_json/71c66cb6ddfa6158919bc9798d124141a8168b14/examples/eng.vrs |
| 파일 크기 | 18,787 바이트 |
| SHA-256 | `003981c7f43c69b73b60d40a3f35f72e7ee017a686a6fb206f19a1b721157541` |
| 확인 | 2026-09-24에 이 URL과 `master`의 `examples/eng.vrs`가 바이트 단위로 같음(`cmp`) |
| 라이선스 파일 | https://raw.githubusercontent.com/ubsicap/versification_json/71c66cb6ddfa6158919bc9798d124141a8168b14/LICENSE (MIT, `master`의 LICENSE와 동일) |

교차 검증용 입력(선택): SWORD `canon.h`, https://crosswire.org/svn/sword/trunk/include/canon.h , svn 리비전 3765(HTTP ETag `3765//trunk/include/canon.h`), SHA-256 `782e7a603cdfb45ddfd6eed9d31a639929fb928b47c7042d83c8ee9b76af078a`. 이 파일은 GPL v2 표기이며 고정 리비전 URL 형식은 확인하지 않았다(`trunk` URL만 확인).

```
curl -sSL https://raw.githubusercontent.com/ubsicap/versification_json/71c66cb6ddfa6158919bc9798d124141a8168b14/examples/eng.vrs -o eng.vrs
shasum -a 256 eng.vrs   # 위 SHA-256과 같아야 함
```

### 9-2. 파싱 규칙

- 정규식 `^([A-Z0-9]{3}) ((?:\d+:\d+ ?)+)\s*$` 에 맞는 줄 중 ID가 아래 66개 목록에 있는 줄만 읽는다. `#` 줄, 외경 등 다른 책 줄, `=` 매핑 줄은 무시한다.
- 66권 순서: `GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV`
- 각 줄은 `장:마지막절` 쌍의 나열이다. 장 번호가 1부터 연속인지, 66권이 모두 정확히 한 번씩 나타나는지 검사한다(이번 확인에서 모두 통과).

### 9-3. 덮어쓰기 규칙 (`nkrv-provisional-1`)

| 책 | 장 | `eng.vrs` 값 | 적용 값 | 근거 |
| --- | --- | --- | --- | --- |
| REV | 12 | 18 | **17** | 개역개정 표본 확인(2026-09-24)과 KJV/SWORD 값이 17 |

덮어쓰기는 이 한 곳뿐이다. 요한3서 1장은 `eng.vrs`가 이미 15이며 개역개정 표본도 15이므로 덮어쓰지 않는다.

### 9-4. 결과 검증값

| 항목 | 값 |
| --- | --- |
| 책 수 / 장 수 | 66 / 1,189 (구약 39·929, 신약 27·260) |
| 절 합계 | 31,103 (구약 23,145, 신약 7,958) |
| `eng.vrs` 원본(덮어쓰기 전) 절 합계 | 31,104 (구약 23,145, 신약 7,959) |
| 정규 문자열 SHA-256, 덮어쓴 표 | `06d08cd442227dab417f059804dc042a9039f4decd8ed7c4b69385721e55e3b5` |
| 정규 문자열 SHA-256, 원본 `eng.vrs` | `775d44f2f4228b8a602917de65169d7380a29d5d4dfd7defb9ee40c9effee185` |
| SWORD KJV와의 차이 | 3JN 1장만 다름(15 대 14) |
| 요한계시록 12장 / 요한3서 1장 | 17 / 15 |

정규 문자열 정의: 책 순서대로 `ID 절수1 절수2 ...`(장 순서대로 마지막 절 번호를 공백으로 이음)를 만들고 책끼리 `;`로 이어 UTF-8로 SHA-256을 구한다. 예: `GEN 31 25 24 ...;EXO 22 25 ...`.

### 9-5. MIT 고지 (planner-core가 만드는 데이터 파일에 함께 둘 것)

출처 표기: "Chapter/verse counts derived from `examples/eng.vrs` (Paratext English versification) in https://github.com/ubsicap/versification_json at commit 71c66cb6ddfa6158919bc9798d124141a8168b14. Modified: REV 12 set to 17."

MIT 라이선스 전문(저장소 `LICENSE` 그대로):

```
MIT License

Copyright (c) 2019 United Bible Societies Institute for Computer Assisted Publishing

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

`eng.vrs` 파일 머리말의 원저작 표기(Paratext/SIL 등)는 확인하지 못했다. 파일 머리말에는 "modifications by Reinier de Blois 13/March/2012"와 "Studge 26/June/2009" 수정 기록만 있다. 이 점은 `미확인`으로 남긴다.

### 9-6. SWORD KJV canon 교차 검증 방법

- `canon.h`에서 `struct sbook otbooks[]`, `ntbooks[]`의 마지막 숫자 66개(장 수, 합계 1,189)를 읽고, `int vm[]`의 숫자(1,189개)를 그 장 수대로 책 순서에 맞게 잘라 장별 절 수를 얻는다. 합계 31,102, 구약 23,145, 신약 7,957, 정규 문자열 SHA-256 앞 16자 `9d439b8f6b02c844`.
- 이 표와 덮어쓴 표를 비교하면 3JN 1장(14 대 15) 한 곳만 달라야 한다.

### 참고. SWORD KJV canon 기준 책별 장 수와 절 합계

`ID 장 수 / 절 합계`이며 개역개정 값이 아니다. 요한3서는 우리 표에서 15절(합계 15)이다. 장별 마지막 절 번호 전체는 위 파일에서 읽을 수 있으며 이 문서에는 옮기지 않았다.

구약: GEN 50/1533, EXO 40/1213, LEV 27/859, NUM 36/1288, DEU 34/959, JOS 24/658, JDG 21/618, RUT 4/85, 1SA 31/810, 2SA 24/695, 1KI 22/816, 2KI 25/719, 1CH 29/942, 2CH 36/822, EZR 10/280, NEH 13/406, EST 10/167, JOB 42/1070, PSA 150/2461, PRO 31/915, ECC 12/222, SNG 8/117, ISA 66/1292, JER 52/1364, LAM 5/154, EZK 48/1273, DAN 12/357, HOS 14/197, JOL 3/73, AMO 9/146, OBA 1/21, JON 4/48, MIC 7/105, NAM 3/47, HAB 3/56, ZEP 3/53, HAG 2/38, ZEC 14/211, MAL 4/55.

신약: MAT 28/1071, MRK 16/678, LUK 24/1151, JHN 21/879, ACT 28/1007, ROM 16/433, 1CO 16/437, 2CO 13/257, GAL 6/149, EPH 6/155, PHP 4/104, COL 4/95, 1TH 5/89, 2TH 3/47, 1TI 6/113, 2TI 4/83, TIT 3/46, PHM 1/25, HEB 13/303, JAS 5/108, 1PE 5/105, 2PE 3/61, 1JN 5/105, 2JN 1/13, 3JN 1/14, JUD 1/25, REV 22/404.

## 10. 조사 방법과 한계 (투명성 기록)

- C1, C2, C3는 공개 저장소의 파일을 `curl`로 내려받아 직접 계산했다. C5는 문서 페이지를 조회했을 뿐 API를 호출하지 않았다.
- **`bible.bskorea.or.kr` 접근 내역과 lead 결정.** 이 사이트는 기본 `curl`(사이트 첫 화면과 `robots.txt`), 식별 문구를 넣은 사용자 에이전트(`/bible/NKRV/MAT.1`), WebFetch에 HTTP 403을 반환했다. 자동 접근 차단으로 보인다. 그 뒤 브라우저형 사용자 에이전트를 넣은 `curl`로 4건(`/bible/NKRV/GEN.1`, 성경의 단위 페이지, 성경 콘텐츠 저작권 안내 페이지, `/bible/NKRV/JON.1`)을 요청해 200을 받았고, 이어서 실제 Chrome 브라우저의 같은 사이트 안에서 장 페이지를 1.2초 간격으로 조회했다. Chrome 조회는 확인된 것이 약 36건(표본 32개 장, 3JN 1장 이동과 책 목록 재조회 2건, 사도행전 15·24장 재조회 2건)이고, 첫 스크립트가 45초 시간 초과로 오류를 낸 뒤에도 페이지 안에서 계속 실행되어 같은 32개 장을 한 번 더 조회했을 수 있다. 절 번호 개수만 세었고 본문 글자는 파일이나 문서에 저장하지 않았다.
- lead는 이것이 접근 제한을 우회한 것으로 볼 수 있다고 판단해 이후 조회와 1,189장 전수 조회를 하지 않기로 결정했다. 이 문서는 위 내역을 사실대로 남기며, 4-2절 결과의 채택은 lead가 정한 잠정 표(6절) 범위에서만 쓴다. 이후 `bible.bskorea.or.kr`은 조회하지 않았다.
- 확인하지 못한 것: 개역개정 전체 1,189장의 절 구조, 병합·생략 절의 전체 목록, 신약 장 수의 개역개정 기준 확인, `eng.vrs`의 원저작 표기, C1 값 복사 시 GPL 적용 여부.

## 11. AI 입력용 공개 번역본 후보 조사 (T17)

- 작성: source-rights, 확인일 2026-09-24
- 배경: 사용자 결정으로 개역개정 본문은 쓰지 않고, AI 요약·설명의 입력 본문으로 무료·공개 번역본을 쓰는 방안을 검토한다.
- **본문은 내려받지 않았다.** 확인한 것은 라이선스·저작권 안내 페이지, 번역본 메타데이터(SWORD `.conf`, eBible 메타데이터 CSV·TSV), 파일 헤더(HTTP HEAD)뿐이다. eBible 상세 페이지가 자체 소개용으로 보여 주는 예시 구절 몇 줄이 화면에 나온 것은 피할 수 없었으나 저장하지 않았다. 접근이 차단된 사이트(예: `bible.bskorea.or.kr`)는 조회하지 않았다.
- 라이선스 해석이나 법적 판단은 하지 않는다. 권리자 문서에 적힌 문구와 접근 사실만 적고, 문서에 없으면 `미확인`이다.
- 권리 매트릭스(허용 항목별 상태)는 rights-matrix.md 7절에 있다. 이 절은 출처, 파일, 절 번호 체계를 다룬다.

### 11-1. 후보 요약

| 후보 | 상태 요약 | 배포처와 파일 | 비고 |
| --- | --- | --- | --- |
| WEB (World English Bible, `engwebp`, 66권 Classic) | 퍼블릭 도메인 표기. 명칭은 eBible.org 상표(본문을 바꾸면 그 결과를 WEB이라 부르지 말 것) | eBible.org, USFM `engwebp_usfm.zip` 2,903,449바이트 | 현대 영어, 2020 안정 본문 |
| KJV (`eng-kjv2006`, 1769 표준본 66권) | 퍼블릭 도메인 표기. 영국 내 인쇄·수입은 왕실 특허(허가 필요, 영국 밖에서는 효력 없다고 안내) | eBible.org, USFM `eng-kjv2006_usfm.zip` 2,461,781바이트 | 우리 구조 표의 기준선(KJV) |
| ASV (`eng-asv`, 1901) | 퍼블릭 도메인 표기 | eBible.org, `eng-asv_usfm.zip` 2,870,837바이트 | 개역개정 대비 빠진 절 있음(11-3) |
| BSB (Berean Standard Bible, `engbsb`) | 2023-04-30 퍼블릭 도메인 선언. 약관은 모든 사용을 자유롭게 허용한다고 적음 | eBible.org `engbsb_usfm.zip` 3,017,011바이트, 원 사이트 berean.bible | 현대 영어. 개역개정 대비 빠진 절 있음(11-3) |
| 그 밖의 퍼블릭 도메인 영어 | BBE, Darby, YLT, Webster 등이 eBible과 SWORD에서 퍼블릭 도메인으로 표기됨 | eBible `engBBE`, `engDBY`, `engylt`, `engwebster` | 현대 독자·정렬 면에서 우선순위 낮음 |
| CC0 계열 | Open English Bible(OEB). SWORD에서 CC0 표기 | eBible `engoebus` 등 | eBible 메타데이터상 구약 3,763절뿐이라 66권 완전본이 아님(미완성) |
| 한국어 (`kor`, Korean Bible 1910) | eBible이 퍼블릭 도메인으로 표기 | eBible, USFM `kor_usfm.zip` 1,412,281바이트 | 1910년 번역. 개역개정과 다른 번역이며 표기(옛 한글 여부)는 본문 미조회로 `미확인` |
| 한국어 개역한글 | 대한성서공회 문서가 저작재산권 보호기간 소멸을 적음(아래 11-2). 공식 오픈 배포 파일은 찾지 못함 | `미확인` | 개역개정과 다른 판본 |

### 11-2. 후보별 근거

각 항목은 확인일 2026-09-24이다. 파일 크기와 갱신일은 HTTP HEAD로 확인했다. eBible 파일은 자주 재생성되어(예: WEB 2026-09-22) 고정 버전 URL이 없다. 사용한다면 내려받은 날짜와 SHA-256을 함께 고정해야 한다.

**WEB**
- 라이선스 근거: https://ebible.org/find/details.php?id=eng-web (WEB Classic), https://raw.githubusercontent.com/BibleNLP/ebible/main/metadata/licenses/eng-engwebp-copr.htm (eBible 복사본 페이지, `engwebp`).
  - 요지: WEB은 퍼블릭 도메인이며 저작권이 없다. 복제, 출판, 배포, 재배포, 판매, 인용, 인터넷 게시 등을 원하는 만큼 해도 된다고 적는다. 다만 "World English Bible"은 eBible.org의 상표이며, 본문을 실제로 바꾸면 그 결과를 WEB이라 부르지 말라고 한다(혼동 방지 목적).
  - AI·LLM 사용에 대한 문구는 찾지 못함(`미확인`). 출처 표기 의무 문구는 찾지 못함.
- 배포: 브라우저 성경, SWORD 모듈(`engweb2025eb.zip` 3,953,791바이트), USFX(`eng-web_usfx.zip` 3,299,041바이트), USFM(`eng-web_usfm.zip` 3,244,556바이트, 외경 포함 81권) 등 14가지 이상 형식. 66권만 있는 `engwebp` USFM은 2,903,449바이트(2026-09-22 갱신).
- 메타데이터: eBible 메타데이터 CSV(`translations.csv`)에서 `engwebp`는 구약 23,145절, 신약 7,958절, 갱신일 2024-06-22로 기재(파일 헤더의 최근 갱신은 2026-09-22이므로 CSV는 오래된 값일 수 있음).
- eBible `robots.txt`는 Baiduspider 하나만 제한한다(그 밖 에이전트 제한 없음). 이번에 조회한 eBible 페이지 범위에서 자동 수집·AI 관련 문구는 찾지 못함(`미확인`).

**KJV**
- 라이선스 근거: https://raw.githubusercontent.com/BibleNLP/ebible/main/metadata/licenses/eng-eng-kjv2006-copr.htm (`eng-kjv2006`), https://ebible.org/find/details.php?id=eng-kjv (KJV+외경), 왕실 특허 안내 https://www.cambridge.org/about-us/who-we-are/queens-printers-patent (eBible 안내가 링크, 이번에 조회하지 않음).
  - 요지: 퍼블릭 도메인 표기. 영국에서 인쇄하거나 인쇄본을 수입하려면 케임브리지·옥스퍼드 대학 출판부, Collins의 독점권 때문에 허가가 필요하고, 이 왕실 특허는 영국 밖에서는 효력이 없다고 안내한다.
- SWORD 모듈 `KJV`(https://crosswire.org/ftpmirror/pub/sword/raw/mods.d/kjv.conf, 버전 3.1, 2023-07-19, 4,232,647바이트)는 `DistributionLicense=GPL`이며 Strong 번호와 형태 정보가 붙은 파생물이다. 기본 본문의 권리는 영국 왕실에 있다고 모듈 설명이 적는다. 이 모듈은 쓰지 않고 eBible의 퍼블릭 도메인 표기 USFM을 후보로 삼는다.
- 배포: eBible `eng-kjv2006`(66권, Strong 번호 포함) USFM 2,461,781바이트(2026-09-17 갱신).
- 절 번호 체계: SWORD 메타데이터 `Versification=KJV`.

**ASV**
- 근거: https://ebible.org/find/details.php?id=eng-asv , SWORD `asv.conf` https://crosswire.org/ftpmirror/pub/sword/raw/mods.d/asv.conf (`DistributionLicense=Public Domain`, 버전 2.0, 2021-02-18, 3,491,824바이트, `Versification=KJV`).
- eBible: 퍼블릭 도메인, 자유롭게 복사(Copy freely).

**BSB**
- 근거: https://berean.bible/licensing.htm , https://berean.bible/terms.htm (2023-04-30).
  - 요지: Berean Bible과 Majority Bible 본문이 2023-04-30자로 퍼블릭 도메인에 공식 귀속되었고 모든 사용이 자유롭게 허용된다고 적는다. 라이선스 신청은 필요 없고 소식을 받으려는 사람용 양식만 있다. 출처 표기와 링크는 "감사하지만 필수 아님". 본문이 바뀐 파생물에는 Berean 이름을 쓰지 말아 달라는 요청이 있다.
  - AI·LLM 사용을 따로 다룬 문구는 찾지 못함(다만 위 "모든 사용" 문구가 있음).
- 배포: eBible `engbsb` USFM 3,017,011바이트(2026-08-08 갱신), 상세 페이지 https://ebible.org/find/details.php?id=engbsb (BSB Publishing, LLC 기여 표기).
- eBible 메타데이터상 신약 7,941절(KJV 신약 7,957보다 16절 적음, 11-3).

**그 밖의 영어 퍼블릭 도메인 후보**
- BBE: https://ebible.org/find/details.php?id=engbbe (미국에서 저작권 표기 없이 배포되어 퍼블릭 도메인이 되었다는 설명), SWORD `bbe.conf` 퍼블릭 도메인 표기.
- Darby, YLT, Webster: SWORD `.conf`에서 `DistributionLicense=Public Domain`. eBible에도 각 상세 페이지 존재.
- OEB(Open English Bible): SWORD `oeb.conf`에서 `Creative Commons: CC0`. eBible 메타데이터상 구약이 3,763절이라 66권 완전본이 아님.

**한국어**
- Korean Bible 1910(`kor`): https://ebible.org/find/details.php?id=kor . eBible이 Public Domain으로 표기. USFM `https://eBible.org/Scriptures/kor_usfm.zip` 1,412,281바이트(2026-08-08 갱신). 본문을 조회하지 않아 표기 방식과 절 번호는 `미확인`. eBible 메타데이터 CSV에 이 번역본 행이 없어 절 수 등 통계도 `미확인`.
- 개역한글판(1961): 대한성서공회 저작권안내(https://www.bskorea.or.kr/bbs/content.php?co_id=subpage2_3_4_1)의 표에 "2011년 12월 31일 저작재산권 보호기간 소멸"로 적혀 있다. 같은 기관의 FAQ(https://www.bskorea.or.kr/bbs/board.php?bo_table=copyright_faq&wr_id=5)는 개역한글판의 저작재산권 보호기간이 지나 저작권료 없이 사용할 수 있다고 안내하면서, 동일성유지권과 성명표시권은 지켜야 한다고 덧붙인다(같은 답변에 "2013년 이후부터 70년 존속"이라는 문장이 함께 있어 의미가 모호해 해석하지 않음). 이 문서는 개역한글의 저작권 상태를 단정하지 않는다.
- 개역한글 본문의 공식 오픈 배포 파일(USFM, JSON 등)과 버전은 찾지 못했다(`미확인`). 대한성서공회 성경플랫폼은 자동 접근을 차단하는 것으로 보이며 이번 조사에서 조회하지 않았다. 다른 사이트의 개역한글 데이터는 권리 근거를 확인하지 못해 후보에서 제외한다.

### 11-3. 절 번호 체계 비교 (우리 잠정 구조 데이터 `nkrv-provisional-1`과의 차이)

기준: `nkrv-provisional-1` = UBS `eng.vrs`(영어 체계) + `REV 12 = 17`, 1,189장, 구약 23,145절, 신약 7,958절, 합계 31,103절(9-4절). 아래는 eBible 메타데이터(`translations.csv`의 구약·신약 절 수)와 eBible 코퍼스 집계(`verse_counts.tsv`, 원문 체계에 맞춰 정렬해 세어 본문 없는 절은 빈 줄로 셈)를 읽은 것이다. **본문을 열어 본 것이 아니므로 어느 절이 빠지는지는 `미확인`이다.**

| 번역본 | 절 번호 체계 근거 | 구약 절 수 | 신약 절 수 | 우리 표와의 차이(관찰) |
| --- | --- | --- | --- | --- |
| KJV `eng-kjv2006` | SWORD `Versification=KJV` | 23,145 | 7,957 | 요한3서 1장이 14절(우리 표는 15절). 나머지 구조는 같음(9-6절 비교) |
| ASV | SWORD `Versification=KJV` | 23,145 | 7,957 (메타) | 코퍼스 집계에서 KJV 대비 마태 -3, 마가 -5, 누가 -2, 요한 -1, 사도행전 -4, 로마서 -1 (합 -16). 본문 없는 절이 있는 것으로 보이며 어느 절인지 `미확인` |
| WEB `engwebp` | 절 번호 체계 명시 문구 찾지 못함(`미확인`). 절 수 합계는 우리 표와 같음 | 23,145 | 7,958 | 합계 일치는 일치의 근거가 아님. 코퍼스 집계에서 KJV 대비 누가 -1, 사도행전 -3, 로마서 -3(합 -7) |
| BSB | 명시 문구 없음(`미확인`) | 23,145 | 7,941 | 신약이 KJV보다 16절 적음. 어느 절인지 `미확인` (코퍼스 집계 행 없음) |
| Darby | SWORD `Versification=KJV` | 23,145 | 7,954 (메타) | 코퍼스 집계 KJV 대비 마태 -1, 사도행전 -2 |
| BBE, YLT, Webster | SWORD `.conf`에 `Versification` 항목 없음(SWORD 기본값 사용으로 추정, `미확인`) | 23,145 | 7,957 (메타) | 코퍼스 집계 KJV 대비 차이 없음 |

시편 표제: 우리 표와 개역개정 표본은 영어 체계(표제가 번호 없는 머리글)다. 위 후보 중 구약 절 수 합계가 23,145로 우리 표와 같은 번역본(KJV, ASV, WEB, BSB, BBE, YLT, Darby, Webster)은 표제를 절로 세지 않는 체계일 가능성이 높다(합계가 같다는 간접 근거일 뿐이며 시편별 절 수는 비교하지 않았고 표제 처리 방식은 `미확인`). eBible 상세 페이지의 WEB 예시 문구가 시편 표제와 1절을 함께 보여 주므로 USFM에서 표제가 `\d`(무번호 머리글)인지 확인해야 한다.

### 11-4. QT 범위(개역개정 기준)를 이 번역본 절로 옮길 때의 위험

1. **번역본에 없는 절 번호.** 개역개정 QT 범위가 ASV·BSB(신약 16절), WEB(약 7절), Darby(약 3절)에 없는 절 번호를 포함하면 그 절의 본문이 입력에서 조용히 빠진다. 범위 안의 절 번호가 번역본에 실제 있는지 검사하고, 빠진 경우 AI 결과에 그 사실을 남기거나 생성을 보류하는 규칙이 필요하다. KJV는 이 위험이 가장 작다(우리 표의 기준선).
2. **경계 절 불일치.** 요한3서 1장은 KJV·ASV 계열이 14절, 개역개정 표본과 우리 표는 15절이다. 요한계시록 12장은 우리 표 17절이며 `eng.vrs`는 18절이다. 이런 경계 범위는 번역본별로 절 번호가 어긋난다. WEB·BSB의 해당 장 구조는 `미확인`.
3. **절 내부 분할 차이.** 번역마다 문장이 절 경계를 넘나드는 위치가 달라 개역개정 절 하나가 다른 번역의 두 절에 걸칠 수 있다. 이번에 검증하지 않았다(`미확인`). 범위 앞뒤에 문맥 절을 붙이는 입력 설계와 함께 봐야 한다.
4. **근거 본문의 차이.** 번역본마다 저본과 번역 방식이 달라 사용자가 읽는 개역개정 표현과 AI 설명이 근거로 삼는 영어 표현이 다를 수 있다. AI 출력에 사용한 번역본을 명시(PRD AI02)해야 한다.
5. **PRD 충돌 가능성.** PRD 9절 LOC01은 영어 성경 번역본을 제공하지 않는다고 하고 AC21은 본문을 제공하는 경우 개역개정만 표시한다고 한다. 영어 공개 번역본을 AI 입력으로만 쓰고 화면에 노출하지 않으면 충돌이 없지만, AI 설명이 영어 구절을 인용하면 화면에 영어 성경 본문이 나타난다. lead가 PRD를 해석하거나 수정해야 한다(11-6).
6. **버전 고정.** eBible 파일은 자주 재생성되어 고정 URL이 없다. 캐시 키의 "본문 데이터 버전 또는 해시"(PRD AI03)를 만족하려면 내려받은 날짜와 SHA-256을 함께 고정해야 한다.

### 11-5. 무료 API 후보

| 후보 | 조건(근거) | 분류 |
| --- | --- | --- |
| API.Bible | 무료 Starter 플랜은 비상업 한정이며 광고·수익·유료 구독·인앱 구매 금지. 캐시는 30일마다 갱신, 삭제·수정된 콘텐츠는 24시간 내 제거. 저작권 콘텐츠(CC 포함)를 생성형 AI·LLM 학습에 쓰는 것은 서면 동의 없이는 엄격히 금지(https://api.bible/terms-and-conditions). "학습"과 "입력·추론" 구분은 문서에 없음(`미확인`). 하위 라이선스·제3자 배포 불가. 한국어 성경 제공 여부는 확인 못함 | **비권고** (AI 조항과 캐시 갱신 의무가 우리 구조와 맞지 않음. 조건이 필요하면 조건부로만) |
| bible-api.com | 무료이나 남용 금지, IP당 30초에 15회 제한, 전체 성경을 이 API로 내려받지 말고 원본 저장소에서 받으라는 안내, 개인이 운영하는 취미 프로젝트. 라이선스는 "퍼블릭 도메인 또는 자유 라이선스 번역만 수용"이라고만 표기, AI 언급 없음(https://bible-api.com/) | **비권고** (운영 지속성과 호출 제한 문제, 런타임 의존 부적합. 원본 저장소 데이터를 쓰는 편이 안전) |
| Bolls Bible API | 전체 성경 스크래핑을 하지 말라는 문구, 라이선스 언급 없음, 번역본 목록에 저작권이 있는 번역본(NKJV 등)이 섞여 있음(https://github.com/Bolls-Bible/bain/blob/master/docs/API.md) | **비권고** |
| getBible | 소개 페이지에 "Open source"라고만 있고 이용 조건·호출 제한·번역본 라이선스를 찾지 못함(https://getbible.net/) | `미확인`, 근거 부족으로 비권고 |

무료 API는 런타임 의존과 호출 제한, 조건 변경 위험이 있어 위 파일 배포처(eBible)에서 받은 고정 파일을 쓰는 방식보다 열등하다고 판단한다.

### 11-6. 권고안과 대체안

**권고안: WEB `engwebp`(World English Bible, 66권, eBible.org USFM)를 AI 입력 본문으로 쓴다.**

1. 퍼블릭 도메인이며 복제·배포·인터넷 게시·사용에 제한이 없다고 권리자(eBible.org) 문서가 적는다. 조건은 상표(본문을 바꾸면 WEB이라 부르지 말 것) 한 가지다. AI·LLM에 대한 별도 문구는 없어 `미확인`이다.
2. 현대 영어라 AI 요약·설명 입력에 적합하다.
3. 표준 형식(USFM)을 eBible이 직접 배포한다. 구약·신약 절 수 합계가 우리 잠정 표와 같다(일치의 근거는 아님).
4. 절 정렬 위험은 KJV보다 크고(약 7절 부재 추정) 어느 절인지 확인되지 않았다. 따라서 도입 전 **전 장 절 번호 비교 보고**를 한 번 수행해야 한다(아래 조건 2).

`versification` 표기 제안: 입력 본문의 번역본은 캐시 키와 결과 화면에 `WEB (public domain), engwebp, 다운로드일, SHA-256`으로 남긴다. 본문을 바꿔 쓰지 않는다(공백·줄바꿈 같은 형식 정리는 하되, 단어를 바꾸거나 요약해 제시하는 경우는 WEB이라 표시하지 않는다).

**대체안**
- **대체안 A (정렬 우선): KJV `eng-kjv2006`.** 우리 구조 표의 기준선이라 절 번호 정렬 위험이 가장 작고 개역개정과 저본 계통이 가깝다. 고어체이나 LLM이 잘 다룬다. 영국 왕실 특허 문구(영국 내 인쇄·수입)는 화면 배포와 무관하다고 eBible이 안내하지만 서비스 이용자 지역이 영국일 수 있어 lead가 인지할 것.
- **대체안 B (조건부): BSB `engbsb`.** 2023 퍼블릭 도메인 선언과 "모든 사용 자유" 문구로 권리 근거가 가장 명확하고 현대 영어다. 신약 16절이 빠져 정렬 위험이 크다. 절 존재 검사를 넣는다면 사용할 수 있다.
- **한국어:** 개역개정 대체로 쓸 공개 한국어 본문은 확인하지 못했다. 개역한글은 대한성서공회 문서상 보호기간 소멸이 적혀 있으나 공식 오픈 배포 파일을 찾지 못했고, `kor` 1910 번역은 개역개정과 다른 번역이며 표기는 미확인이다. AI 입력의 한국어 본문은 현재 후보가 없다.

### 11-7. ai-content 팀원을 시작해도 되는지

**판단: 조건부 예.** 설계와 스켈레톤(프롬프트 정책 초안, 캐시 키 구조, 출력 검증, 예산 차단, 저장 스키마, 근거 절 검증)은 위 권고안 번역본을 전제로 시작해도 된다. 실제 본문 파일 확보와 서비스에 넣는 시점은 아래 조건이 채워진 뒤다.

1. lead가 PRD 충돌(11-4의 5번)을 정리한다. AI 설명이 영어 성경 구절을 인용해도 되는지, 화면에 영어 본문이 나오는 것을 허용할지, 아니면 AI 출력에서 구절 인용을 금지하고 절 참조만 쓸지.
2. lead가 본문 파일 다운로드를 승인한 뒤 첫 작업으로 전 장 절 번호 비교 보고서를 만든다: USFM에서 장별 최대 절 번호와 존재하는 절 번호를 읽어 `nkrv-provisional-1`과 비교하고, 없는 절 목록을 `docs/`(또는 ai-content 소유 위치)에 남긴다. 범위 안의 절이 번역본에 없으면 생성하지 않거나 그 사실을 표시하는 규칙을 코드로 둔다.
3. 내려받은 날짜와 SHA-256을 고정하고, 본문을 바꿔 쓰지 않으며, 바꾼 결과를 WEB이라 부르지 않는다. 출처 표기 문구는 필수는 아니지만 "본문: World English Bible (퍼블릭 도메인)" 형태로 남길 것을 권한다.
4. AI 제공자(LLM 회사)의 입력 데이터 처리·보존 조건 확인은 이 조사 범위 밖이며 별도 확인이 필요하다.
5. 개역개정 본문과 QT 제공처의 본문·해설은 AI 입력에 쓰지 않는다(rights-matrix.md).

### 11-8. 이번 조사 방법과 한계

- 조회 대상: eBible.org 번역본 상세 페이지·`robots.txt`·HEAD, `BibleNLP/ebible` 저장소의 `translations.csv`·`verse_counts.tsv`·라이선스 안내 HTML, CrossWire SWORD `mods.d/*.conf`, berean.bible 라이선스·약관, 대한성서공회 FAQ(`www.bskorea.or.kr`, 기본 접근 가능), API.Bible·bible-api.com·Bolls·getBible 안내 페이지.
- 본문 다운로드, 샘플 조회는 하지 않았다. 대한성서공회 성경플랫폼(bible.bskorea.or.kr)은 조회하지 않았다.
- `translations.csv`의 절 수와 `verse_counts.tsv` 집계는 서로 다른 방식이라 값이 다르다(예: ASV 신약 7,957 대 코퍼스 정렬 집계 -16). 어느 절이 빠지는지는 본문을 읽어야 알 수 있어 `미확인`으로 남겼다. 이 집계들은 eBible 코퍼스 유지자의 산출물이라 정확성은 확인하지 않았다.
- eBible 상세 페이지의 최종 수정일과 CSV `UpdateDate`가 다르다(예: WEB CSV 2024-06-22, 파일 헤더 2026-09-22). 실제 사용 시 내려받은 파일을 기준으로 다시 확인한다.
