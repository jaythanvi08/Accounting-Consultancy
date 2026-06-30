using LedgerAI.Domain.Entities;

namespace LedgerAI.Application.Abstractions;

public interface IJwtTokenService
{
    string GenerateToken(User user);
}
