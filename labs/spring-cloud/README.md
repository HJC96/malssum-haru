# Spring Cloud local learning lab

This is an isolated, non-production T20 exercise. It demonstrates service discovery, centralized configuration, API-gateway routing, and an explanation-only circuit breaker around the proposed daily-content/explanation boundary. It does not modify or replace `services/qt`, `services/ai`, the public React app, or the deployed infrastructure.

## Safety and content boundaries

- The daily-content endpoint returns a clearly marked `NO_SCRIPTURE_CONTENT` architecture fixture. There are no Bible verses, Bible artifacts, provider requests, model calls, API keys, or AWS resources in this project.
- Explanation is a mock boundary. `?fail=true` deliberately returns HTTP 503 to exercise the circuit breaker.
- The official QT link catalog is owned by the gateway in this lab and is independent of both downstream services. The production React UI links directly to providers; it does not need this gateway.
- Everything binds to localhost by default. Do not deploy this lab or treat its toy routes, links, configuration, or failure thresholds as production-ready.

## Stack

Java 21, Spring Boot 4.0.8, Spring Cloud BOM 2025.1.3 (matching the repository baseline). Modules are separate Maven applications:

| App | Port | Role |
| --- | ---: | --- |
| `discovery` | 8761 | Local Eureka server |
| `config-server` | 8888 | Native config server reading `config-repo/` |
| `daily-content` | 8083 | Static no-Scripture fixture, registered in Eureka |
| `explanation` | 8084 | Mock explanation boundary; supports intentional 503 mode |
| `gateway` | 8080 | Gateway routes, explanation circuit breaker, direct-link catalog |

The Spring Cloud Gateway WebFlux server is used as documented for the current Cloud generation. Routing is configured centrally in `config-repo/gateway.yml`; service URLs use Eureka (`lb://...`) rather than fixed ports. Client apps import Config Server settings at startup.

## Run it

From this directory:

```sh
mvn test
mvn package
bash run-local.sh
```

`run-local.sh` builds the jars if missing, then starts the five processes and writes only local process IDs/logs beneath the ignored `.run/` directory. Startup can take up to a minute while Eureka and Config Server settle. Open `http://localhost:8761` for the registry dashboard.

Try the gateway routes:

```sh
curl -i http://localhost:8080/api/daily-content
curl -i http://localhost:8080/api/explanations
curl -i 'http://localhost:8080/api/explanations?fail=true'
curl -i http://localhost:8080/api/official-qt-links
```

The failure route should return a structured `EXPLANATION_UNAVAILABLE` fallback with HTTP 503. Repeat the failure request to exercise the configured breaker threshold; after the breaker opens, explanation continues to use the fallback. `/api/daily-content` and `/api/official-qt-links` should still return HTTP 200.

Run the end-to-end smoke after starting the lab:

```sh
bash smoke.sh
bash stop-local.sh
```

To stop processes manually, use `bash stop-local.sh`; logs are in `.run/*.log`. `bash smoke.sh` does not start or stop the services.

## Local ownership and boundaries

```text
browser/curl
    └── Gateway :8080
         ├── Eureka discovery ── daily-content :8083
         ├── Eureka discovery ── explanation :8084 (CircuitBreaker + fallback)
         └── /api/official-qt-links (local response; no downstream dependency)

Config Server :8888 ── config-repo/*.yml
Eureka Server :8761 ── service registry
```

To demonstrate an actual process outage instead of the mock HTTP 503, stop the explanation process using the PID recorded in `.run/explanation.pid`, call the explanation route (expect fallback), and then verify content and links again. Restart with `bash run-local.sh` after stopping the other processes first. This is a local learning setup, not a resilience, security, or load test.

## Sources

- [Spring Cloud Gateway reference](https://docs.spring.io/spring-cloud-gateway/reference/), including the [WebFlux starter](https://docs.spring.io/spring-cloud-gateway/reference/spring-cloud-gateway-server-webflux/starter.html) and [CircuitBreaker filter](https://docs.spring.io/spring-cloud-gateway/reference/spring-cloud-gateway-server-webflux/gatewayfilter-factories/circuitbreaker-filter-factory.html).
- [Spring Cloud Config Server reference](https://docs.spring.io/spring-cloud-config/reference/server.html).
- [Spring Cloud Netflix/Eureka reference](https://docs.spring.io/spring-cloud-netflix/reference/spring-cloud-netflix.html).
- [Spring Cloud CircuitBreaker reference](https://docs.spring.io/spring-cloud-circuitbreaker/reference/).

The dependency versions are pinned to `docs/team/TASKS.md` and the sibling QT/AI Maven projects. Nothing here establishes a production architecture decision; the static public daily-content path remains independent as required by `docs/plans/DAILY_WORD_MAIN_PLAN.md`.
