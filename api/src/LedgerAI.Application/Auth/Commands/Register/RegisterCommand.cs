using LedgerAI.Application.Auth.Responses;
using MediatR;

namespace LedgerAI.Application.Auth.Commands.Register;

public sealed record RegisterCommand(
    string CompanyName,
    string DisplayName,
    string Email,
    string Password) : IRequest<AuthResponse>;
