interface CacheEntry<T> {
  data: T;
  timestamp: number;
  etag?: string;
}

interface ExcelCache {
  values: any[][];
  etag?: string;
}

class StorageService {
  private readonly CACHE_PREFIX = 'dmd_';
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Plans
  savePlansLocal(plans: any[]): void {
    try {
      localStorage.setItem(`${this.CACHE_PREFIX}plans`, JSON.stringify(plans));
      localStorage.setItem(`${this.CACHE_PREFIX}plans_timestamp`, Date.now().toString());
    } catch (error) {
      console.error('Error saving plans to localStorage:', error);
    }
  }

  getPlansLocal(): any[] | null {
    try {
      const plansStr = localStorage.getItem(`${this.CACHE_PREFIX}plans`);
      if (!plansStr) return null;
      
      return JSON.parse(plansStr);
    } catch (error) {
      console.error('Error loading plans from localStorage:', error);
      return null;
    }
  }

  // Excel cache
  setExcelCache(filePath: string, data: ExcelCache): void {
    const key = `${this.CACHE_PREFIX}excel_${this.hashString(filePath)}`;
    const entry: CacheEntry<ExcelCache> = {
      data,
      timestamp: Date.now(),
      etag: data.etag
    };
    
    try {
      localStorage.setItem(key, JSON.stringify(entry));
    } catch (error) {
      console.error('Error caching Excel data:', error);
    }
  }

  getExcelCache(filePath: string): CacheEntry<ExcelCache> | null {
    const key = `${this.CACHE_PREFIX}excel_${this.hashString(filePath)}`;
    
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;
      
      const entry: CacheEntry<ExcelCache> = JSON.parse(cached);
      
      // Check if cache is still valid
      if (Date.now() - entry.timestamp > this.CACHE_DURATION) {
        localStorage.removeItem(key);
        return null;
      }
      
      return entry;
    } catch (error) {
      console.error('Error reading Excel cache:', error);
      return null;
    }
  }

  clearExcelCache(filePath: string): void {
    const key = `${this.CACHE_PREFIX}excel_${this.hashString(filePath)}`;
    localStorage.removeItem(key);
  }

  // Conflict resolution
  saveConflict(referencia: string, localData: any, remoteData: any): void {
    const conflicts = this.getConflicts();
    conflicts[referencia] = {
      localData,
      remoteData,
      timestamp: Date.now()
    };
    
    localStorage.setItem(`${this.CACHE_PREFIX}conflicts`, JSON.stringify(conflicts));
  }

  getConflicts(): Record<string, any> {
    try {
      const conflictsStr = localStorage.getItem(`${this.CACHE_PREFIX}conflicts`);
      return conflictsStr ? JSON.parse(conflictsStr) : {};
    } catch {
      return {};
    }
  }

  resolveConflict(referencia: string): void {
    const conflicts = this.getConflicts();
    delete conflicts[referencia];
    localStorage.setItem(`${this.CACHE_PREFIX}conflicts`, JSON.stringify(conflicts));
  }

  // Sync state
  setSyncState(state: 'syncing' | 'synced' | 'error' | 'offline'): void {
    localStorage.setItem(`${this.CACHE_PREFIX}sync_state`, state);
    localStorage.setItem(`${this.CACHE_PREFIX}sync_timestamp`, Date.now().toString());
  }

  getSyncState(): { state: string; timestamp: number } {
    const state = localStorage.getItem(`${this.CACHE_PREFIX}sync_state`) || 'offline';
    const timestamp = parseInt(localStorage.getItem(`${this.CACHE_PREFIX}sync_timestamp`) || '0');
    
    return { state, timestamp };
  }

  // Pending operations queue
  addPendingOperation(operation: any): void {
    const operations = this.getPendingOperations();
    operations.push({
      ...operation,
      id: this.generateId(),
      timestamp: Date.now()
    });
    
    localStorage.setItem(`${this.CACHE_PREFIX}pending_operations`, JSON.stringify(operations));
  }

  getPendingOperations(): any[] {
    try {
      const opsStr = localStorage.getItem(`${this.CACHE_PREFIX}pending_operations`);
      return opsStr ? JSON.parse(opsStr) : [];
    } catch {
      return [];
    }
  }

  removePendingOperation(id: string): void {
    const operations = this.getPendingOperations().filter(op => op.id !== id);
    localStorage.setItem(`${this.CACHE_PREFIX}pending_operations`, JSON.stringify(operations));
  }

  clearPendingOperations(): void {
    localStorage.removeItem(`${this.CACHE_PREFIX}pending_operations`);
  }

  // User preferences
  setUserPreference(key: string, value: any): void {
    const prefs = this.getUserPreferences();
    prefs[key] = value;
    localStorage.setItem(`${this.CACHE_PREFIX}preferences`, JSON.stringify(prefs));
  }

  getUserPreference(key: string, defaultValue?: any): any {
    const prefs = this.getUserPreferences();
    return prefs[key] ?? defaultValue;
  }

  private getUserPreferences(): Record<string, any> {
    try {
      const prefsStr = localStorage.getItem(`${this.CACHE_PREFIX}preferences`);
      return prefsStr ? JSON.parse(prefsStr) : {};
    } catch {
      return {};
    }
  }

  // Utilities
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Clean up old data
  cleanupOldData(): void {
    const keys = Object.keys(localStorage);
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

    keys.forEach(key => {
      if (key.startsWith(this.CACHE_PREFIX)) {
        try {
          const value = localStorage.getItem(key);
          if (value && key.includes('_timestamp')) {
            const timestamp = parseInt(value);
            if (now - timestamp > maxAge) {
              localStorage.removeItem(key);
              // Remove associated data key
              const dataKey = key.replace('_timestamp', '');
              localStorage.removeItem(dataKey);
            }
          }
        } catch {
          // Ignore errors
        }
      }
    });
  }
}

export const storageService = new StorageService();