export const seasons = ["winter", "spring", "summer", "autumn"];

export async function chooseSeason(page, season) {
  await page.locator("#season-picker").click();
  await page.locator(`[data-season="${season}"]`).click();
}

export async function seedLegacyPhoto(page) {
  await page.evaluate(async () => {
    const file = await fetch(
      "clothes_photos/photo_2026-11-01 14.59.34.jpeg",
    ).then((response) => response.blob());
    await new Promise((resolve, reject) => {
      const request = indexedDB.open("personal-wardrobe", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("photos", { keyPath: "id" });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction("photos", "readwrite");
        transaction
          .objectStore("photos")
          .put({ id: "legacy-photo", file, createdAt: 1 });
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };
      };
    });
  });
}
