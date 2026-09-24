package kr.malssumharu.qt.support;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Map;

/** src/test/resources/fixtures 의 구조 조각을 읽어 자리표시자를 채운다. */
public final class Fixtures {

    public static final Charset EUC_KR = Charset.forName("x-windows-949");

    private Fixtures() {
    }

    public static String load(String name) {
        try (InputStream in = Fixtures.class.getResourceAsStream("/fixtures/" + name)) {
            if (in == null) {
                throw new IllegalArgumentException("missing fixture " + name);
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    public static String render(String name, Map<String, String> values) {
        String text = load(name);
        for (Map.Entry<String, String> e : values.entrySet()) {
            text = text.replace("{{" + e.getKey() + "}}", e.getValue());
        }
        return text;
    }

    public static String displayDate(LocalDate d) {
        return "%04d.%02d.%02d".formatted(d.getYear(), d.getMonthValue(), d.getDayOfMonth());
    }

    public static String maeilPage(LocalDate date, String reference) {
        return render("maeil-today.html", Map.of(
                "DATE", date.toString(), "DISPLAY_DATE", displayDate(date), "REFERENCE", reference));
    }

    public static String maeilDetailJson(LocalDate date, String book, String chapter) {
        return render("maeil-detail.json", Map.of("DATE", date.toString(), "BOOK", book, "CHAPTER", chapter));
    }

    public static String durannoPage(LocalDate date, String reference) {
        return render("duranno-bible.html", Map.of(
                "DATE", date.toString(),
                "DISPLAY_DATE", displayDate(date),
                "PREV", "%02d.%02d".formatted(date.minusDays(1).getMonthValue(), date.minusDays(1).getDayOfMonth()),
                "NEXT", "%02d.%02d".formatted(date.plusDays(1).getMonthValue(), date.plusDays(1).getDayOfMonth()),
                "REFERENCE", reference));
    }

    public static byte[] eucKr(String html) {
        return html.getBytes(EUC_KR);
    }
}
