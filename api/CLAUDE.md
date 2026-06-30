# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**LedgerAI API** — ASP.NET Core 10 backend for the LedgerAI accounting application. Currently a
Clean Architecture scaffold; no domain entities or real controllers exist yet. The Angular frontend
(`../web/`) stores all data in `localStorage` for now and is designed to swap in real HTTP calls
when this API is ready.

## Commands

Run from the repo root or from `api/`:

```powershell
dotnet build LedgerAI.slnx                          # build all projects
dotnet run --project src/LedgerAI.API               # http://localhost:5030  https://localhost:7175
dotnet test LedgerAI.slnx                           # run all xUnit test projects
dotnet test --filter "FullyQualifiedName~MyTest"    # run a single test
dotnet test LedgerAI.slnx --collect:"XPlat Code Coverage"  # with coverage (coverlet)

# EF Core migrations (always specify both projects)
dotnet ef migrations add <Name> \
  --project src/LedgerAI.Infrastructure \
  --startup-project src/LedgerAI.API

dotnet ef database update \
  --project src/LedgerAI.Infrastructure \
  --startup-project src/LedgerAI.API
```

OpenAPI/Swagger UI is available at `/openapi` in Development (`app.MapOpenApi()`).

## Architecture

Clean Architecture with strict dependency direction: `API → Infrastructure → Application → Domain`.

### LedgerAI.Domain
Pure domain layer — entities, value objects, domain events, repository interfaces. No framework
dependencies. This is the innermost ring; everything else references it.

### LedgerAI.Application
Use-cases via **MediatR 14** (CQRS pattern). Key conventions:
- One file per use-case: `Commands/CreateLedger/CreateLedgerCommand.cs` + `CreateLedgerCommandHandler.cs`
- Validation with **FluentValidation 12** `AbstractValidator<TCommand>` — register with
  `AddValidatorsFromAssembly` in DI.
- **AutoMapper 16** profiles live here; map from domain entities to response DTOs.
- Only interfaces for persistence (`ILedgerRepository`, etc.) are declared here — no EF references.

### LedgerAI.Infrastructure
Implements everything that touches external systems:
- **EF Core 10 + SQL Server** — `DbContext` and repository implementations.
- **JWT Bearer** (`Microsoft.AspNetCore.Authentication.JwtBearer`) for auth token validation.
- **BCrypt.Net-Next** for password hashing.
- EF migrations live here; run via `dotnet ef` with `--startup-project` pointing to the API.

### LedgerAI.API
Composition root and HTTP layer:
- Controllers are thin — no business logic, just `_mediator.Send(command)` and HTTP status mapping.
- DI wiring (`Program.cs`) registers Application and Infrastructure services.
- `WeatherForecastController` is a placeholder — **delete it** when adding the first real controller.
- `appsettings.json` has no real config yet; add `ConnectionStrings`, `Jwt`, etc. as needed.

## Test projects

Three xUnit projects mirror the source layers (`Domain.Tests`, `Application.Tests`,
`Infrastructure.Tests`). All are empty stubs — the placeholder `UnitTest1` class should be deleted
when real tests are added. Coverage collected via **coverlet**.

## Key config to add

Before the API can run end-to-end, `appsettings.Development.json` (never committed) needs:

```json
{
  "ConnectionStrings": {
    "Default": "Server=...;Database=LedgerAI;..."
  },
  "Jwt": {
    "Key": "...",
    "Issuer": "ledgerai-api",
    "Audience": "ledgerai-web"
  }
}
```
