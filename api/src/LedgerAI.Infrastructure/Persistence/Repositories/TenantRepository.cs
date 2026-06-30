using LedgerAI.Domain.Entities;
using LedgerAI.Domain.Interfaces;

namespace LedgerAI.Infrastructure.Persistence.Repositories;

internal sealed class TenantRepository : ITenantRepository
{
    private readonly LedgerAIDbContext _db;

    public TenantRepository(LedgerAIDbContext db) => _db = db;

    public Task AddAsync(Tenant tenant, CancellationToken cancellationToken = default)
    {
        _db.Tenants.Add(tenant);
        return Task.CompletedTask;
    }
}
