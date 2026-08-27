import type { CharacterDraft, EntitlementSnapshot, OshiProfileDraft } from './models';

const DB_NAME = 'chibi-life-local';
const DB_VERSION = 1;
const STORE_NAME = 'records';

type RecordKey = 'character-draft' | 'profile-draft' | 'entitlements-cache';

type StoredRecord<T> = {
  key: RecordKey;
  value: T;
};

export class DraftStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  loadCharacterDraft(): Promise<CharacterDraft | null> {
    return this.get<CharacterDraft>('character-draft');
  }

  saveCharacterDraft(draft: CharacterDraft): Promise<void> {
    return this.put('character-draft', { ...draft, updatedAt: Date.now() });
  }

  loadProfileDraft(): Promise<OshiProfileDraft | null> {
    return this.get<OshiProfileDraft>('profile-draft');
  }

  saveProfileDraft(draft: OshiProfileDraft): Promise<void> {
    return this.put('profile-draft', { ...draft, updatedAt: Date.now() });
  }

  loadEntitlementsCache(): Promise<EntitlementSnapshot | null> {
    return this.get<EntitlementSnapshot>('entitlements-cache');
  }

  saveEntitlementsCache(snapshot: EntitlementSnapshot): Promise<void> {
    return this.put('entitlements-cache', snapshot);
  }

  async clearDrafts(): Promise<void> {
    const db = await this.open();
    await Promise.all([
      this.deleteRecord(db, 'character-draft'),
      this.deleteRecord(db, 'profile-draft'),
    ]);
  }

  private async get<T>(key: RecordKey): Promise<T | null> {
    const db = await this.open();
    return new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => {
        const record = request.result as StoredRecord<T> | undefined;
        resolve(record?.value ?? null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async put<T>(key: RecordKey, value: T): Promise<void> {
    const db = await this.open();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ key, value } satisfies StoredRecord<T>);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  private deleteRecord(db: IDBDatabase, key: RecordKey): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  private open(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('IndexedDB upgrade blocked.'));
    });

    return this.dbPromise;
  }
}
