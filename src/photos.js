function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("personal-wardrobe", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("photos", { keyPath: "id" });
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Хранилище занято другой вкладкой"));
  });
}

async function transaction(mode, operation) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("photos", mode);
      const request = operation(tx.objectStore("photos"));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error || new Error("Запись отменена"));
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export const listPhotos = () =>
  transaction("readonly", (store) => store.getAll());
export const savePhoto = (file) =>
  transaction("readwrite", (store) =>
    store.put({
      id: crypto.randomUUID(),
      file,
      createdAt: Date.now(),
    }),
  );
