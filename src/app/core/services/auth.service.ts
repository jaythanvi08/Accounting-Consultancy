import { Injectable, computed, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { AuthSession, LoginPayload, RegisterPayload, User } from '../models';

interface StoredUser extends User {
  password: string;
}

const USERS_KEY = 'ledgerai.users';
const SESSION_KEY = 'ledgerai.session';

/**
 * Client-side auth service. With no backend wired, it persists users and the
 * active session in localStorage and exposes reactive signals. Swap the method
 * bodies for HttpClient calls when an API is available — the public surface
 * (signals + promises) stays the same.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storage = inject(StorageService);

  private readonly session = signal<AuthSession | null>(this.storage.get<AuthSession>(SESSION_KEY));

  readonly currentUser = computed<User | null>(() => this.session()?.user ?? null);
  readonly isLoggedIn = computed(() => this.session() !== null);
  readonly token = computed(() => this.session()?.token ?? null);

  /** Register a new user. Rejects if email/phone already exists. */
  async register(payload: RegisterPayload): Promise<User> {
    const users = this.storage.get<StoredUser[]>(USERS_KEY) ?? [];
    const exists = users.some(
      (u) => u.email.toLowerCase() === payload.email.toLowerCase() || u.phone === payload.phone
    );
    if (exists) {
      throw new Error('An account with this email or phone already exists.');
    }

    const user: StoredUser = {
      id: crypto.randomUUID(),
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone,
      email: payload.email,
      age: payload.age,
      profession: payload.profession,
      gender: payload.gender,
      createdAt: new Date().toISOString(),
      password: payload.password
    };

    this.storage.set(USERS_KEY, [...users, user]);
    this.startSession(user, true);
    return this.stripPassword(user);
  }

  /** Authenticate by email or phone + password. */
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

  /** Mock JWT-shaped token (header.payload.signature, base64url) — demo only. */
  private fakeToken(sub: string): string {
    const header = this.b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
    const body = this.b64url(JSON.stringify({ sub, iat: Date.now() }));
    return `${header}.${body}.ledgerai`;
  }

  private b64url(s: string): string {
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}
