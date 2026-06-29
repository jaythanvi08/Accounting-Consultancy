import { Injectable } from '@angular/core';

/** Thin, type-safe wrapper around localStorage with JSON (de)serialisation. */
@Injectable({ providedIn: 'root' })
export class StorageService {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota / serialisation errors are non-fatal */
    }
  }

  remove(key: string): void {
    localStorage.removeItem(key);
  }
}
