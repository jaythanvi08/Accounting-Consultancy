using LedgerAI.Domain.Common;
using LedgerAI.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
using System.Reflection;

namespace LedgerAI.Infrastructure.Persistence;

public sealed class LedgerAIDbContext : DbContext
{
    private readonly ITenantProvider _tenantProvider;

    // Field captured by EF Core query filter expressions — re-read per DbContext instance (scoped).
    private readonly Guid _currentTenantId;

    public LedgerAIDbContext(DbContextOptions<LedgerAIDbContext> options, ITenantProvider tenantProvider)
        : base(options)
    {
        _tenantProvider = tenantProvider;
        _currentTenantId = _tenantProvider.GetTenantId();
    }

    // DbSets will be added here as domain entities are created, e.g.:
    // public DbSet<Company> Companies => Set<Company>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());
        ApplyGlobalTenantFilters(modelBuilder);
    }

    private void ApplyGlobalTenantFilters(ModelBuilder modelBuilder)
    {
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (!typeof(TenantEntity).IsAssignableFrom(entityType.ClrType))
                continue;

            typeof(LedgerAIDbContext)
                .GetMethod(nameof(SetTenantFilter), BindingFlags.NonPublic | BindingFlags.Instance)!
                .MakeGenericMethod(entityType.ClrType)
                .Invoke(this, [modelBuilder]);
        }
    }

    private void SetTenantFilter<TEntity>(ModelBuilder modelBuilder)
        where TEntity : TenantEntity
    {
        modelBuilder.Entity<TEntity>().HasQueryFilter(e => e.TenantId == _currentTenantId);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        StampEntities();
        return base.SaveChangesAsync(cancellationToken);
    }

    public override int SaveChanges()
    {
        StampEntities();
        return base.SaveChanges();
    }

    private void StampEntities()
    {
        var tenantId = _tenantProvider.GetTenantId();
        var now = DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries<TenantEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.TenantId = tenantId;
                    entry.Entity.CreatedAt = now;
                    entry.Entity.UpdatedAt = now;
                    break;
                case EntityState.Modified:
                    entry.Entity.UpdatedAt = now;
                    break;
            }
        }
    }
}
