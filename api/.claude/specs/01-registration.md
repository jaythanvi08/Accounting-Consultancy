# Spec: Registration

## Overview
A public `POST /api/auth/register` endpoint accepts company name, display name, email, and
password. It creates a new Tenant row plus a User row (admin role, BCrypt-hashed password)
inside a single EF SaveChanges call, then issues a JWT access token. No email verification
in this step — that is a future concern.

## Depends on
None — this is step 01 and has no predecessors.

## Endpoints
- `POST /api/auth/register` — public — 201 Created `{ token, userId, tenantId }`

## Database changes

**Tenants**
| Column    | Type                    |
|-----------|-------------------------|
| Id        | uniqueidentifier PK     |
| Name      | nvarchar(200) NOT NULL  |
| CreatedAt | datetime2 NOT NULL      |

**Users**
| Column       | Type                   |
|--------------|------------------------|
| Id           | uniqueidentifier PK    |
| TenantId     | uniqueidentifier FK    |
| Email        | nvarchar(256) NOT NULL |
| DisplayName  | nvarchar(200) NOT NULL |
| PasswordHash | nvarchar(max) NOT NULL |
| Role         | nvarchar(50) NOT NULL  |
| CreatedAt    | datetime2 NOT NULL     |
| UpdatedAt    | datetime2 NOT NULL     |

Unique index on (TenantId, Email).

> `User` does NOT extend `TenantEntity` — during registration there is no authenticated tenant
> context so `StampEntities()` would overwrite a manually-set TenantId with `Guid.Empty`.

## Files to change
- `src/LedgerAI.API/Program.cs`
- `src/LedgerAI.Infrastructure/Persistence/LedgerAIDbContext.cs`
- `src/LedgerAI.Infrastructure/Extensions/InfrastructureServiceExtensions.cs`
- `src/LedgerAI.Application/LedgerAI.Application.csproj` (add FluentValidation.DependencyInjectionExtensions)
- `src/LedgerAI.API/appsettings.json` (add Jwt placeholder section)

## Files to create

### Domain
- `src/LedgerAI.Domain/Entities/Tenant.cs`
- `src/LedgerAI.Domain/Entities/User.cs`
- `src/LedgerAI.Domain/Enums/UserRole.cs`
- `src/LedgerAI.Domain/Interfaces/IUserRepository.cs`
- `src/LedgerAI.Domain/Interfaces/ITenantRepository.cs`

### Application
- `src/LedgerAI.Application/Abstractions/IJwtTokenService.cs`
- `src/LedgerAI.Application/Abstractions/IPasswordHasher.cs`
- `src/LedgerAI.Application/Abstractions/IUnitOfWork.cs`
- `src/LedgerAI.Application/Auth/Commands/Register/RegisterCommand.cs`
- `src/LedgerAI.Application/Auth/Commands/Register/RegisterCommandHandler.cs`
- `src/LedgerAI.Application/Auth/Commands/Register/RegisterCommandValidator.cs`
- `src/LedgerAI.Application/Auth/Responses/AuthResponse.cs`
- `src/LedgerAI.Application/Common/Behaviors/ValidationBehavior.cs`
- `src/LedgerAI.Application/Extensions/ApplicationServiceExtensions.cs`

### Infrastructure
- `src/LedgerAI.Infrastructure/Auth/JwtTokenService.cs`
- `src/LedgerAI.Infrastructure/Auth/BcryptPasswordHasher.cs`
- `src/LedgerAI.Infrastructure/Persistence/UnitOfWork.cs`
- `src/LedgerAI.Infrastructure/Persistence/Repositories/TenantRepository.cs`
- `src/LedgerAI.Infrastructure/Persistence/Repositories/UserRepository.cs`
- `src/LedgerAI.Infrastructure/Persistence/Configurations/TenantConfiguration.cs`
- `src/LedgerAI.Infrastructure/Persistence/Configurations/UserConfiguration.cs`

### API
- `src/LedgerAI.API/Controllers/AuthController.cs`

### Tests
- `tests/LedgerAI.Application.Tests/Auth/RegisterCommandHandlerTests.cs`

### Delete (placeholder stubs)
- `tests/LedgerAI.Domain.Tests/UnitTest1.cs`
- `tests/LedgerAI.Application.Tests/UnitTest1.cs`
- `tests/LedgerAI.Infrastructure.Tests/UnitTest1.cs`

## Rules for implementation
- No business logic in `AuthController` — controller calls `_mediator.Send()` only
- Passwords hashed with BCrypt.Net-Next via `IPasswordHasher` (Infrastructure implements, Application declares)
- JWT signed with HS256; key/issuer/audience read from `Jwt:*` config
- FluentValidation: email format, password ≥ 8 chars, company name ≥ 2 chars
- `RegisterCommandHandler` creates Tenant + User then calls `IUnitOfWork.SaveChangesAsync` once
- AutoMapper registered but no profile needed in this step
- `ValidationBehavior<,>` MediatR pipeline behavior validates all commands automatically

## Definition of done
- `dotnet build LedgerAI.slnx` — 0 errors
- `POST /api/auth/register` valid body → 201 + `{ token, userId, tenantId }`
- `POST /api/auth/register` invalid body → 400 + FluentValidation error list
- `dotnet test LedgerAI.slnx` — all tests pass
- EF migration exists; `dotnet ef database update` succeeds
