using LedgerAI.Domain.Interfaces;
using LedgerAI.Infrastructure.MultiTenancy;
using LedgerAI.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace LedgerAI.Infrastructure.Extensions;

public static class InfrastructureServiceExtensions
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddHttpContextAccessor();

        services.AddScoped<ITenantProvider, TenantProvider>();

        services.AddDbContext<LedgerAIDbContext>(options =>
            options.UseSqlServer(
                configuration.GetConnectionString("Default"),
                sql =>
                {
                    sql.MigrationsAssembly(typeof(LedgerAIDbContext).Assembly.FullName);
                    sql.EnableRetryOnFailure(
                        maxRetryCount: 5,
                        maxRetryDelay: TimeSpan.FromSeconds(30),
                        errorNumbersToAdd: null);
                }));

        return services;
    }
}
