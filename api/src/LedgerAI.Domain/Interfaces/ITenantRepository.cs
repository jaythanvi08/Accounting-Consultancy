using LedgerAI.Domain.Entities;

namespace LedgerAI.Domain.Interfaces;

public interface ITenantRepository
{
    Task AddAsync(Tenant tenant, CancellationToken cancellationToken = default);
}
