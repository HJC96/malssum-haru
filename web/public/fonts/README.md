# 한글 PDF 폰트 (Noto Sans KR 서브셋)

- 원본: https://github.com/google/fonts/tree/main/ofl/notosanskr (`NotoSansKR[wght].ttf`, OFL.txt), 2026-09-24 내려받음
- 라이선스: SIL Open Font License 1.1 (`OFL.txt`). 원저작권: Copyright 2014-2021 Adobe (Reserved Font Name 'Source')
- 가공: fonttools 4.66.0으로 가변 폰트를 wght 400/700 정적 인스턴스로 고정하고 KS X 1001 한글 2,350자 + ASCII + 일부 기호만 남긴 서브셋(힌팅 제거). 글리프 외형은 수정하지 않았다.
- 용도: 브라우저에서 PDF를 만들 때 pdf-lib에 임베드. 화면 초기 로드에는 포함하지 않고 내보내기 시점에 지연 로드한다.
- 재현: docs/team/font-subset.py 참고
