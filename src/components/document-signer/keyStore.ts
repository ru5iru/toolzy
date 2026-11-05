import { makePrivateHandles, hasPrivateKey, type KeyRecord } from "./keyUtils";

/**
 * Opt-in device storage for keys. Private keys are saved only as non-extractable CryptoKey handles,
 * so their bytes cannot be read back by this page. Scripts running on this origin can still ask the
 * stored key to sign, so this is convenience storage, not a vault.
 */
export interface StoredKey {
  id: string;
  name: string;
  algorithm: KeyRecord["algorithm"];
  spki: Uint8Array;
  fingerprint: string;
  createdAt: string;
  source: KeyRecord["source"];
  privateKeys?: Partial<Record<string, CryptoKey>>;
}

export interface KeyStoreBackend {
  getAll(): Promise<StoredKey[]>;
  put(entry: StoredKey): Promise<void>;
  remove(id: string): Promise<void>;
}

export async function rememberKey(backend: KeyStoreBackend, record: KeyRecord): Promise<KeyRecord> {
  const privateKeys = record.privateKeys ?? (record.pkcs8 ? await makePrivateHandles(record) : undefined);
  await backend.put({
    id: record.id, name: record.name, algorithm: record.algorithm, spki: record.spki, fingerprint: record.fingerprint,
    createdAt: record.createdAt, source: record.source, privateKeys,
  });
  // Drop the private bytes from memory too, so "cannot be exported" holds for the rest of this session.
  return { ...record, pkcs8: undefined, privateKeys, persisted: true };
}

export async function forgetKey(backend: KeyStoreBackend, id: string): Promise<void> {
  await backend.remove(id);
}

export async function loadStoredKeys(backend: KeyStoreBackend): Promise<KeyRecord[]> {
  const entries = await backend.getAll();
  return entries
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((entry) => ({ ...entry, persisted: true }));
}

export { hasPrivateKey };

const DB_NAME = "toolzy-document-signer";
const STORE = "keys";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
}

function openDb(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = factory.open(DB_NAME, 1);
    open.onupgradeneeded = () => { open.result.createObjectStore(STORE, { keyPath: "id" }); };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

/**
 * IndexedDB backend. `exists()` lets the page skip opening the database (which would create it)
 * until the person has actually saved a key.
 */
export function indexedDbBackend(factory: IDBFactory | undefined = typeof indexedDB === "undefined" ? undefined : indexedDB) {
  const supported = Boolean(factory);
  const withStore = async <T,>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await openDb(factory!);
    try { return await request(run(db.transaction(STORE, mode).objectStore(STORE))); } finally { db.close(); }
  };
  const backend: KeyStoreBackend & { supported: boolean; exists(): Promise<boolean> } = {
    supported,
    async exists() {
      if (!factory) return false;
      if (typeof factory.databases !== "function") return true; // cannot tell without opening
      return (await factory.databases()).some((db) => db.name === DB_NAME);
    },
    getAll: async () => (await backend.exists()) ? withStore<StoredKey[]>("readonly", (store) => store.getAll()) : [],
    put: async (entry) => { await withStore("readwrite", (store) => store.put(entry)); },
    // Never create the database just to delete from it.
    remove: async (id) => { if (await backend.exists()) await withStore("readwrite", (store) => store.delete(id)); },
  };
  return backend;
}
