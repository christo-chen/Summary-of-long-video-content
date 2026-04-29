# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Spring Boot 3 + Java 21 REST API backend for an AI video/article summary service. Users can save AI-generated summaries from multiple sources (YouTube, Bilibili, GitHub, articles, etc.), organize them with tags, and export to Notion, Obsidian, or Logseq.

## Build & Run Commands

```bash
# Build
mvn clean package -DskipTests

# Run locally (requires application.yml with env vars set)
mvn spring-boot:run

# Run tests
mvn test

# Run a single test class
mvn test -Dtest=ClassName

# Run the packaged JAR
java -jar target/ai-summary-server-1.0.0.jar
```

## Environment Configuration

Copy `src/main/resources/application.yml.example` to `application.yml` and set these environment variables:

- `DB_PASSWORD` — MySQL password
- `JWT_SECRET` — HMAC-SHA signing secret
- `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET` — Notion OAuth credentials

Database: MySQL 8, database name `ai_summary`. Schema is in `sql/schema.sql`.

## Architecture

**Layered Spring Boot MVC:**

```
Controller → Service → Mapper (MyBatis-Plus) → MySQL
```

- **Controllers** (`controller/`): Handle HTTP, extract `userId` from `Authentication.getPrincipal()` (injected by JWT filter), return `Result<T>` wrapper.
- **Services** (`service/`): Business logic. `NotionService` makes REST calls to `api.notion.com`.
- **Mappers** (`mapper/`): MyBatis-Plus interfaces. Complex queries with joins (e.g., summaries with tags) use XML in `resources/mapper/SummaryMapper.xml`.
- **Entities** (`entity/`): MyBatis-Plus annotated; timestamps are auto-filled via `MyBatisPlusConfig`.
- **DTOs** (`dto/`): `Result<T>` is the uniform response wrapper. `SummaryResponse` includes nested `TagInfo` list.

**Auth flow:**
1. `JwtAuthFilter` intercepts all requests, extracts `Authorization: Bearer <token>`.
2. `JwtUtil` validates and decodes the JWT → userId string.
3. userId is set as `Authentication` principal; controllers read it via `authentication.getPrincipal()`.
4. Public endpoints: `/api/auth/**`, `/api/export/notion/callback`.

**Security config** (`SecurityConfig.java`): Stateless sessions, CSRF disabled, BCrypt password encoding.

## Data Model

4 tables: `user`, `summary`, `tag`, `summary_tag` (junction table).

- `summary.summary_json` stores the AI-generated content as a JSON column.
- `summary.source_type` identifies the content origin (youtube, bilibili, github, article, etc.).
- Tags are per-user with a unique constraint on `(user_id, name)`.
- `summary_tag` is deleted on cascade when a summary or tag is removed (handled in service with `@Transactional`).

## Notion Export

`NotionService` implements Notion OAuth and page creation:
1. OAuth: `ExportController.notionCallback()` exchanges the code for a token, stored on the `User` entity.
2. Export: Parses `summary_json`, constructs Notion block objects, POSTs to Notion API.

Obsidian/Logseq export renders summary data as markdown returned as a file download.

## Key Patterns

- All API responses use `Result<T>` with `success()` / `error()` factory methods.
- `GlobalExceptionHandler` maps `RuntimeException` → 400, validation errors → 400, others → 500.
- Pagination uses MyBatis-Plus `Page<T>` with the `PaginationInnerInterceptor` configured for MySQL.
- CORS is configured in `CorsConfig.java` (adjust allowed origins for production).
