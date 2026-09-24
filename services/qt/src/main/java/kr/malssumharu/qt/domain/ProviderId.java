package kr.malssumharu.qt.domain;

/** 첫 출시 제공처. 365QT는 v1에 없다. 선언 순서가 응답 순서다. */
public enum ProviderId {
    MAEIL_SEONGYEONG("maeil-seongyeong", "매일성경", "Maeil Seongyeong (Daily Bible)"),
    SAENGMYEONG_UI_SAM("saengmyeong-ui-sam", "생명의삶", "Saengmyeong-ui-sam (Life Application QT)");

    private final String id;
    private final String nameKo;
    private final String nameEn;

    ProviderId(String id, String nameKo, String nameEn) {
        this.id = id;
        this.nameKo = nameKo;
        this.nameEn = nameEn;
    }

    public String id() {
        return id;
    }

    public String nameKo() {
        return nameKo;
    }

    public String nameEn() {
        return nameEn;
    }
}
