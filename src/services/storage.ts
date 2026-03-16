export interface StorageProvider {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem?: (key: string) => Promise<void>;
}

export class LocalStorageProvider implements StorageProvider {
  async getItem(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  }
}

export class StorageService {
  constructor(private provider: StorageProvider) {}

  async getOptional<T>(key: string): Promise<T | null> {
    try {
      const value = await this.provider.getItem(key);
      if (value === null) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async get<T>(key: string, fallback: T): Promise<T> {
    try {
      const value = await this.provider.getItem(key);
      if (value === null) {
        return fallback;
      }
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      await this.provider.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage errors.
    }
  }
}
