using LedgerAI.Application.Abstractions;

namespace LedgerAI.Infrastructure.Persistence;

internal sealed class UnitOfWork : IUnitOfWork
{
    private readonly LedgerAIDbContext _db;

    public UnitOfWork(LedgerAIDbContext db) => _db = db;

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) =>
        _db.SaveChangesAsync(cancellationToken);
}
