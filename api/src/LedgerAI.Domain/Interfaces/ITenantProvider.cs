namespace LedgerAI.Domain.Interfaces;

public interface ITenantProvider
{
    Guid GetTenantId();
}
