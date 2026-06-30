namespace LedgerAI.Application.Auth.Responses;

public sealed record AuthResponse(string Token, Guid UserId, Guid TenantId);
