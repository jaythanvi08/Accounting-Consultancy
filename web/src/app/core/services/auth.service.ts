import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { StorageService } from './storage.service';
import { AuthSession, LoginPayload, RegisterPayload, User } from '../models';
import { environment } from '../../../environments/environment';

interface StoredUser extends User {
  password: string;
}

interface ApiRegisterResponse {
  token: string;
  userId: string;
  tenantId: string;
}

const USERS_KEY = 'ledgerai.users';
const SESSION_KEY = 'ledgerai.session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storage = inject(StorageService);
  private readonly http = inject(HttpClient);

  private readonly session = signal<AuthSession | null>(this.storage.get<AuthSession>(SESSION_KEY));

  readonly currentUser = computed<User | null>(() => this.session()?.user ?? null);
  readonly isLoggedIn = computed(() => this.session() !== null);
  readonly token = computed(() => this.session()?.token ?? null);

  /** Register a new user + company via the API. Saves to the database. */
  async register(payload: RegisterPayload): Promise<User> {
    const res = await firstValueFrom(
      this.http.post<ApiRegisterResponse>(`${environment.apiBaseUrl}/api/auth/register`, {
        companyName: payload.companyName,
        displayName: `${payload.firstName} ${payload.lastName}`.trim(),
        email: payload.email,
        password: payload.password
      })
    );

    const user: User = {
      id: res.userId,
      tenantId: res.tenantId,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone,
      email: payload.email,
      age: payload.age,
      profession: payload.profession,
      gender: payload.gender,
      createdAt: new Date().toISOString()
    };

    const session: AuthSession = { token: res.token, user, issuedAt: Date.now() };
    this.session.set(session);
    this.storage.set(SESSION_KEY, session);
    return user;
  }

  /** Authenticate by email or phone + password (localStorage until login API is built). */
  async login(payload: LoginPayload): Promise<User> {
    const users = this.storage.get<StoredUser[]>(USERS_KEY) ?? [];
    const id = payload.identifier.trim().toLowerCase();
    const match = users.find(
      (u) => u.email.toLowerCase() === id || u.phone === payload.identifier.trim()
    );

    if (!match || match.password !== payload.password) {
      throw new Error('Invalid credentials. Please check your email/phone and password.');
    }

    this.startSession(match, payload.remember);
    return this.stripPassword(match);
  }

  logout(): void {
    this.session.set(null);
    this.storage.remove(SESSION_KEY);
  }

  private startSession(user: StoredUser, persist: boolean): void {
    const session: AuthSession = {
      token: this.fakeToken(user.id),
      user: this.stripPassword(user),
      issuedAt: Date.now()
    };
    this.session.set(session);
    if (persist) {
      this.storage.set(SESSION_KEY, session);
    }
  }

  private stripPassword(u: StoredUser): User {
    const { password: _omit, ...user } = u;
    return user;
  }

  private fakeToken(sub: string): string {
    const header = this.b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
    const body = this.b64url(JSON.stringify({ sub, iat: Date.now() }));
    return `${header}.${body}.ledgerai`;
  }

  private b64url(s: string): string {
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}
