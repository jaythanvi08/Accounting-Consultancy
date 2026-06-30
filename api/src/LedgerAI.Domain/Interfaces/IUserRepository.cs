using LedgerAI.Domain.Entities;

namespace LedgerAI.Domain.Interfaces;

public interface IUserRepository
{
    Task<User?> GetByEmailAndTenantAsync(string email, Guid tenantId, CancellationToken cancellationToken = default);
    Task AddAsync(User user, CancellationToken cancellationToken = default);
}
