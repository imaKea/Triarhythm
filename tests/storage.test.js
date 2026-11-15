import { afterEach, describe, expect, it, vi } from 'vitest';
import { dbManager } from '../src/core/storage/db.js';

afterEach(() => {
  dbManager.db = null;
  dbManager.initPromise = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('IndexedDB transaction lifecycle', () => {
  it('retries opening the database after an initial open failure', async () => {
    const requests = [];
    const open = vi.fn(() => {
      const request = {};
      requests.push(request);
      return request;
    });
    vi.stubGlobal('indexedDB', { open });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const initialRequest = dbManager.getDB();
    const openError = new Error('IndexedDB unavailable');
    requests[0].onerror({ target: { error: openError } });
    await expect(initialRequest).rejects.toBe(openError);

    const database = {};
    const retry = dbManager.getDB();
    expect(open).toHaveBeenCalledTimes(2);
    requests[1].onsuccess({ target: { result: database } });

    await expect(retry).resolves.toBe(database);
    expect(database.onversionchange).toBeTypeOf('function');
  });

  it('clears the cached open promise when opening throws synchronously', async () => {
    const request = {};
    const openError = new Error('IndexedDB disabled');
    const open = vi.fn()
      .mockImplementationOnce(() => {
        throw openError;
      })
      .mockReturnValueOnce(request);
    vi.stubGlobal('indexedDB', { open });

    await expect(dbManager.getDB()).rejects.toBe(openError);

    const database = {};
    const retry = dbManager.getDB();
    expect(open).toHaveBeenCalledTimes(2);
    request.onsuccess({ target: { result: database } });

    await expect(retry).resolves.toBe(database);
  });

  it('resolves a score write only after its transaction commits', async () => {
    const request = { result: 41 };
    const store = { add: vi.fn(() => request) };
    const transaction = {
      error: null,
      objectStore: vi.fn(() => store)
    };
    dbManager.db = {
      transaction: vi.fn(() => transaction)
    };

    let settled = false;
    const save = dbManager.saveScore({ score: 100 }).then((id) => {
      settled = true;
      return id;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    request.onsuccess?.({ target: request });
    await Promise.resolve();
    expect(settled).toBe(false);

    transaction.oncomplete();
    await expect(save).resolves.toBe(41);
  });

  it('rejects a score write when its transaction aborts', async () => {
    const request = { result: 42 };
    const transactionError = new Error('Quota exceeded');
    const transaction = {
      error: transactionError,
      objectStore: vi.fn(() => ({ add: vi.fn(() => request) }))
    };
    dbManager.db = {
      transaction: vi.fn(() => transaction)
    };

    const save = dbManager.saveScore({ score: 100 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    request.onsuccess?.({ target: request });
    transaction.onerror({ target: { error: transactionError } });
    transaction.error = null;
    transaction.onabort();

    await expect(save).rejects.toBe(transactionError);
  });

  it('creates a collection with its first beatmap and waits for the write to commit', async () => {
    const store = { add: vi.fn() };
    const transaction = {
      error: null,
      objectStore: vi.fn(() => store)
    };
    dbManager.db = {
      transaction: vi.fn(() => transaction)
    };

    const create = dbManager.createCollection('Practice', 'map-1');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const collection = store.add.mock.calls[0][0];

    expect(collection).toMatchObject({
      name: 'Practice',
      beatmapIds: ['map-1']
    });
    transaction.oncomplete();
    await expect(create).resolves.toBe(collection);
  });

  it('adds a beatmap to a collection only once', async () => {
    const collection = { id: 'collection-1', name: 'Practice', beatmapIds: ['map-1'] };
    const request = {};
    const store = {
      get: vi.fn(() => request),
      put: vi.fn()
    };
    const transaction = {
      error: null,
      objectStore: vi.fn(() => store)
    };
    dbManager.db = {
      transaction: vi.fn(() => transaction)
    };

    const add = dbManager.addBeatmapToCollection(collection.id, 'map-1');
    await new Promise((resolve) => setTimeout(resolve, 0));
    request.result = collection;
    request.onsuccess();
    transaction.oncomplete();

    await expect(add).resolves.toMatchObject({
      added: false,
      collection: { beatmapIds: ['map-1'] }
    });
    expect(store.put).not.toHaveBeenCalled();
  });

  it('reopens a cached database that predates the collections store', async () => {
    const oldDatabase = {
      objectStoreNames: { contains: () => false },
      close: vi.fn()
    };
    const collectionRequest = {};
    const store = { getAll: vi.fn(() => collectionRequest) };
    const transaction = {
      error: null,
      objectStore: vi.fn(() => store)
    };
    const newDatabase = {
      objectStoreNames: { contains: (name) => name === 'collections' },
      transaction: vi.fn(() => transaction),
      close: vi.fn()
    };
    const openRequest = {};
    const open = vi.fn(() => openRequest);
    vi.stubGlobal('indexedDB', { open });
    vi.spyOn(dbManager, 'getDB').mockResolvedValue(oldDatabase);
    dbManager.db = oldDatabase;

    const load = dbManager.getAllCollections();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(oldDatabase.close).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith('TriarhythmDB', 3);

    openRequest.onsuccess({ target: { result: newDatabase } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    collectionRequest.result = [];
    collectionRequest.onsuccess();
    transaction.oncomplete();

    await expect(load).resolves.toEqual([]);
  });
});
