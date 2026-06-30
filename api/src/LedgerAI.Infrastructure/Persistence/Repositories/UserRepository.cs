using LedgerAI.Domain.Entities;
using LedgerAI.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace LedgerAI.Infrastructure.Persistence.Repositories;

internal sealed class UserRepository : IUserRepository
{
    private readonly LedgerAIDbContext _db;

    public UserRepository(LedgerAIDbContext db) => _db = db;

    public Task<User?> GetByEmailAndTenantAsync(string email, Guid tenantId, CancellationToken cancellationToken = default) =>
        _db.Users.FirstOrDefaultAsync(u => u.Email == email.ToLowerInvariant() && u.TenantId == tenantId, cancellationToken);

    public Task AddAsync(User user, CancellationToken cancellationToken = default)
    {
        _db.Users.Add(user);
        return Task.CompletedTask;
    }
}
