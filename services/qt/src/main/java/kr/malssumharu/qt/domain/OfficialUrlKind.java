package kr.malssumharu.qt.domain;

public enum OfficialUrlKind {
    DATE_SPECIFIC("date-specific"),
    TODAY_PAGE("today-page");

    private final String wire;

    OfficialUrlKind(String wire) {
        this.wire = wire;
    }

    public String wire() {
        return wire;
    }
}
