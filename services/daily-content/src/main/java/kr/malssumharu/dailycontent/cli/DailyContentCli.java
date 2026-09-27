package kr.malssumharu.dailycontent.cli;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import kr.malssumharu.dailycontent.catalog.CatalogLoader;
import kr.malssumharu.dailycontent.publish.DailyContentPublisher;
import kr.malssumharu.dailycontent.publish.PublishRequest;

/** Local-only generator. Existing files are never silently replaced. */
public final class DailyContentCli {
    private DailyContentCli() {}

    public static void run(String[] args) {
        try {
            execute(args);
        } catch (Exception exception) {
            throw new IllegalStateException(exception.getMessage(), exception);
        }
    }

    private static void execute(String[] args) throws Exception {
        Map<String, String> options = parse(args);
        if (options.containsKey("help")) {
            System.out.println("Usage: DailyContentCli --date=YYYY-MM-DD [--days=1..30] [--catalog=path] [--output=path | --output-dir=path]");
            return;
        }
        if (!options.containsKey("date")) throw new IllegalArgumentException("--date=YYYY-MM-DD is required");
        LocalDate date = LocalDate.parse(options.get("date"));
        int days = Integer.parseInt(options.getOrDefault("days", "1"));
        if (days < 1 || days > 30) throw new IllegalArgumentException("--days must be between 1 and 30");
        if (days > 1 && options.containsKey("output")) {
            throw new IllegalArgumentException("Use --output-dir for multiple days");
        }
        if (options.containsKey("output") && options.containsKey("output-dir")) {
            throw new IllegalArgumentException("Choose --output or --output-dir");
        }
        Path catalogPath = Path.of(options.getOrDefault("catalog", "src/main/resources/catalog/candidate-catalog-v1.json"));
        Path outputDir = Path.of(options.getOrDefault("output-dir", "target/generated-daily-word"));

        var mapper = new ObjectMapper().findAndRegisterModules().enable(SerializationFeature.INDENT_OUTPUT);
        var catalog = new CatalogLoader(mapper).load(catalogPath);
        var publisher = new DailyContentPublisher(catalog, mapper);
        var planned = new LinkedHashMap<Path, kr.malssumharu.dailycontent.publish.PublishedContent>();
        // Validate every day and preflight all conflicts before writing the first file.
        for (int index = 0; index < days; index++) {
            LocalDate targetDate = date.plusDays(index);
            Path output = options.containsKey("output") ? Path.of(options.get("output"))
                    : outputDir.resolve(targetDate + ".json");
            var published = publisher.render(new PublishRequest(targetDate));
            if (Files.exists(output) && !Files.readString(output).equals(published.json())) {
                throw new IllegalStateException("Refusing to overwrite different content at " + output
                        + "; use an explicit correction workflow");
            }
            planned.put(output, published);
        }
        for (var entry : planned.entrySet()) {
            Path output = entry.getKey();
            var published = entry.getValue();
            Files.createDirectories(output.toAbsolutePath().getParent());
            try {
                Files.writeString(output, published.json(), java.nio.file.StandardOpenOption.CREATE_NEW);
                System.out.println("Created " + output + " (" + published.contentVersion() + ")");
            } catch (java.nio.file.FileAlreadyExistsException exists) {
                if (!Files.readString(output).equals(published.json())) {
                    throw new IllegalStateException("Concurrent conflicting content at " + output, exists);
                }
                System.out.println("Already exists with identical content: " + output);
            }
        }
    }

    private static Map<String, String> parse(String[] args) {
        Map<String, String> options = new HashMap<>();
        for (String arg : args) {
            if ("--help".equals(arg)) {
                options.put("help", "");
            } else if (arg.startsWith("--") && arg.contains("=")) {
                int separator = arg.indexOf('=');
                String key = arg.substring(2, separator);
                String value = arg.substring(separator + 1);
                if (!SetOfOptions.ALLOWED.contains(key) || value.isBlank()) {
                    throw new IllegalArgumentException("Invalid option: " + arg);
                }
                if (options.putIfAbsent(key, value) != null) throw new IllegalArgumentException("Duplicate option: --" + key);
            } else {
                throw new IllegalArgumentException("Invalid option: " + arg);
            }
        }
        return options;
    }

    private static final class SetOfOptions {
        private static final java.util.Set<String> ALLOWED = java.util.Set.of("date", "days", "catalog", "output", "output-dir");
    }
}
