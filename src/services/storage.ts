export interface StorageProvider {
  getItem: (key: string) => Promise<unknown>;
  setItem: (key: string, value: unknown) => Promise<void>;
}

export class LocalStorageProvider implements StorageProvider {
  async getItem(key: string): Promise<unknown> {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }

  async setItem(key: string, value: unknown): Promise<void> {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

export class StorageService {
  constructor(private provider: StorageProvider) {}

  async getOptional<T>(key: string): Promise<T | null> {
    try {
      const value = await this.provider.getItem(key);
      return (value ?? null) as T | null;
    } catch {
      return null;
    }
  }

  async get<T>(key: string, fallback: T): Promise<T> {
    try {
      const value = await this.provider.getItem(key);
      return (value ?? fallback) as T;
    } catch {
      return fallback;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      await this.provider.setItem(key, value);
    } catch {
      // Ignore storage errors.
    }
  }
}
