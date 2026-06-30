using LedgerAI.Application.Abstractions;
using LedgerAI.Application.Auth.Responses;
using LedgerAI.Domain.Entities;
using LedgerAI.Domain.Enums;
using LedgerAI.Domain.Interfaces;
using MediatR;

namespace LedgerAI.Application.Auth.Commands.Register;

public sealed class RegisterCommandHandler : IRequestHandler<RegisterCommand, AuthResponse>
{
    private readonly ITenantRepository _tenants;
    private readonly IUserRepository _users;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IJwtTokenService _jwt;
    private readonly IPasswordHasher _hasher;

    public RegisterCommandHandler(
        ITenantRepository tenants,
        IUserRepository users,
        IUnitOfWork unitOfWork,
        IJwtTokenService jwt,
        IPasswordHasher hasher)
    {
        _tenants = tenants;
        _users = users;
        _unitOfWork = unitOfWork;
        _jwt = jwt;
        _hasher = hasher;
    }

    public async Task<AuthResponse> Handle(RegisterCommand request, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;

        var tenant = new Tenant
        {
            Id = Guid.NewGuid(),
            Name = request.CompanyName,
            CreatedAt = now
        };

        await _tenants.AddAsync(tenant, cancellationToken);

        var user = new User
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Email = request.Email.ToLowerInvariant(),
            DisplayName = request.DisplayName,
            PasswordHash = _hasher.Hash(request.Password),
            Role = UserRole.Admin,
            CreatedAt = now,
            UpdatedAt = now
        };

        await _users.AddAsync(user, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new AuthResponse(_jwt.GenerateToken(user), user.Id, tenant.Id);
    }
}
