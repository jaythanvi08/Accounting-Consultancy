using LedgerAI.Application.Abstractions;
using LedgerAI.Application.Auth.Commands.Register;
using LedgerAI.Domain.Entities;
using LedgerAI.Domain.Interfaces;

namespace LedgerAI.Application.Tests.Auth;

public sealed class RegisterCommandHandlerTests
{
    [Fact]
    public async Task Handle_ValidCommand_ReturnsTokenAndIds()
    {
        var tenants = new FakeTenantRepository();
        var users = new FakeUserRepository();
        var uow = new FakeUnitOfWork();
        var jwt = new FakeJwtTokenService("test-token");
        var hasher = new FakePasswordHasher();

        var handler = new RegisterCommandHandler(tenants, users, uow, jwt, hasher);
        var result = await handler.Handle(
            new RegisterCommand("Acme Corp", "Jay Thanvi", "jay@acme.com", "Password123"),
            CancellationToken.None);

        Assert.Equal("test-token", result.Token);
        Assert.NotEqual(Guid.Empty, result.UserId);
        Assert.NotEqual(Guid.Empty, result.TenantId);
        Assert.Single(tenants.Added);
        Assert.Single(users.Added);
        Assert.Equal(1, uow.SaveCallCount);
    }

    [Fact]
    public async Task Handle_ValidCommand_NormalizesEmailToLowercase()
    {
        var users = new FakeUserRepository();
        var handler = new RegisterCommandHandler(
            new FakeTenantRepository(), users,
            new FakeUnitOfWork(),
            new FakeJwtTokenService("tok"),
            new FakePasswordHasher());

        await handler.Handle(
            new RegisterCommand("Acme Corp", "Jay", "JAY@ACME.COM", "Password123"),
            CancellationToken.None);

        Assert.Equal("jay@acme.com", users.Added[0].Email);
    }

    [Fact]
    public async Task Handle_ValidCommand_UserBelongsToCreatedTenant()
    {
        var tenants = new FakeTenantRepository();
        var users = new FakeUserRepository();
        var handler = new RegisterCommandHandler(
            tenants, users, new FakeUnitOfWork(),
            new FakeJwtTokenService("tok"), new FakePasswordHasher());

        var result = await handler.Handle(
            new RegisterCommand("Beta Ltd", "Alice", "alice@beta.com", "SecurePass1"),
            CancellationToken.None);

        Assert.Equal(tenants.Added[0].Id, users.Added[0].TenantId);
        Assert.Equal(result.TenantId, users.Added[0].TenantId);
    }

    [Fact]
    public async Task Handle_ValidCommand_PasswordIsHashed()
    {
        var users = new FakeUserRepository();
        var handler = new RegisterCommandHandler(
            new FakeTenantRepository(), users, new FakeUnitOfWork(),
            new FakeJwtTokenService("tok"), new FakePasswordHasher());

        await handler.Handle(
            new RegisterCommand("Corp", "Bob", "bob@corp.com", "PlainPassword"),
            CancellationToken.None);

        Assert.NotEqual("PlainPassword", users.Added[0].PasswordHash);
    }
}

// ---- in-memory test doubles ----

internal sealed class FakeTenantRepository : ITenantRepository
{
    public List<Tenant> Added { get; } = [];
    public Task AddAsync(Tenant t, CancellationToken _ = default) { Added.Add(t); return Task.CompletedTask; }
}

internal sealed class FakeUserRepository : IUserRepository
{
    public List<User> Added { get; } = [];
    public Task AddAsync(User u, CancellationToken _ = default) { Added.Add(u); return Task.CompletedTask; }
    public Task<User?> GetByEmailAndTenantAsync(string email, Guid tenantId, CancellationToken _ = default)
        => Task.FromResult<User?>(null);
}

internal sealed class FakeUnitOfWork : IUnitOfWork
{
    public int SaveCallCount { get; private set; }
    public Task<int> SaveChangesAsync(CancellationToken _ = default) { SaveCallCount++; return Task.FromResult(1); }
}

internal sealed class FakeJwtTokenService : IJwtTokenService
{
    private readonly string _token;
    public FakeJwtTokenService(string token) => _token = token;
    public string GenerateToken(User _) => _token;
}

internal sealed class FakePasswordHasher : IPasswordHasher
{
    public string Hash(string p) => $"hashed:{p}";
    public bool Verify(string p, string h) => h == $"hashed:{p}";
}
