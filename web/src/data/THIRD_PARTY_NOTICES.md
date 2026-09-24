# 제3자 고지 (Third-party notices)

## 성경 장절 구조 데이터 (`nkrvProvisional.ts`)

Chapter/verse counts derived from `examples/eng.vrs` (Paratext English versification) in https://github.com/ubsicap/versification_json at commit 71c66cb6ddfa6158919bc9798d124141a8168b14. Modified: REV 12 set to 17.

- 원본: 18,787 바이트, SHA-256 `003981c7f43c69b73b60d40a3f35f72e7ee017a686a6fb206f19a1b721157541`
- 이 저장소에는 장마다 마지막 절 번호(숫자)만 옮겼고 성경 본문은 포함하지 않는다.
- 이 데이터는 **잠정(provisional)** 이며 개역개정 전수 검증을 하지 않았다. 개역개정과 일치한다고 보증하지 않는다(docs/data-sources.md 6절).
- `eng.vrs` 파일 머리말의 원저작 표기(Paratext/SIL 등)는 확인하지 못했다.
- 재현: `python3 web/src/data/tools/generate_nkrv_provisional.py` (네트워크는 이 스크립트를 실행할 때만 쓰며 원본 파일은 저장소에 두지 않는다).

### MIT License (ubsicap/versification_json)

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

## 교차 검증 (저장소에 포함하지 않음)

SWORD `canon.h`의 KJV 표(GPL v2 표기)와 대조해 차이가 요한3서 1장(15 대 14) 한 곳뿐임을 확인했다. 그 파일의 값이나 코드는 이 저장소에 복사하지 않았다. 테스트에 쓰는 책별 장 수·절 합계는 docs/data-sources.md의 참고 표에서 온 것이다.
