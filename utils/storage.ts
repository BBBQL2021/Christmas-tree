const DB_NAME = 'BingbingXmasTreeDB';
const PHOTO_STORE = 'photos';
const AUDIO_STORE = 'audio';
const DB_VERSION = 2; // Incremented version

export interface StoredPhoto {
  id: string;
  url: string;
  timestamp: number;
}

export interface StoredAudio {
  id: string;
  blob: Blob;
  name: string;
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create photos store if not exists
      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        db.createObjectStore(PHOTO_STORE, { keyPath: 'id' });
      }
      
      // Create audio store if not exists (New in v2)
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        db.createObjectStore(AUDIO_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

// --- Photos ---

export const savePhotoToDB = async (photo: StoredPhoto): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PHOTO_STORE, 'readwrite');
    const store = transaction.objectStore(PHOTO_STORE);
    const request = store.put(photo);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getAllPhotosFromDB = async (): Promise<StoredPhoto[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PHOTO_STORE, 'readonly');
    const store = transaction.objectStore(PHOTO_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result as StoredPhoto[];
      results.sort((a, b) => a.timestamp - b.timestamp);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
};

export const deletePhotoFromDB = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PHOTO_STORE, 'readwrite');
    const store = transaction.objectStore(PHOTO_STORE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// --- Audio ---

export const saveAudioToDB = async (blob: Blob, name: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(AUDIO_STORE, 'readwrite');
    const store = transaction.objectStore(AUDIO_STORE);
    // We only store one background track for simplicity, using fixed ID 'bg-music'
    const request = store.put({ id: 'bg-music', blob, name });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getAudioFromDB = async (): Promise<StoredAudio | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(AUDIO_STORE, 'readonly');
    const store = transaction.objectStore(AUDIO_STORE);
    const request = store.get('bg-music');

    request.onsuccess = () => resolve(request.result as StoredAudio | undefined);
    request.onerror = () => reject(request.error);
  });
};
