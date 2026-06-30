using LedgerAI.Domain.Interfaces;
using Microsoft.AspNetCore.Http;
using System.Security.Claims;

namespace LedgerAI.Infrastructure.MultiTenancy;

internal sealed class TenantProvider : ITenantProvider
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public TenantProvider(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public Guid GetTenantId()
    {
        var context = _httpContextAccessor.HttpContext;
        if (context is null)
            return Guid.Empty;

        // 1. JWT claim "tid" — set when user selects a company after login
        var tidClaim = context.User.FindFirstValue("tid");
        if (Guid.TryParse(tidClaim, out var tenantFromClaim))
            return tenantFromClaim;

        // 2. X-Tenant-Id header — service-to-service or background jobs
        if (context.Request.Headers.TryGetValue("X-Tenant-Id", out var headerValue)
            && Guid.TryParse(headerValue, out var tenantFromHeader))
            return tenantFromHeader;

        return Guid.Empty;
    }
}
