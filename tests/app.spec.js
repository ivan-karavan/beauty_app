import { test, expect } from "@playwright/test";

const photo = "clothes_photos/photo_2026-11-01 14.59.34.jpeg";
const forecast = {
  current: {
    temperature_2m: 12,
    apparent_temperature: 10,
    precipitation: 0,
    weather_code: 3,
    wind_speed_10m: 2,
  },
};

test.beforeEach(async ({ page }) => {
  await page.route("https://api.open-meteo.com/**", (route) =>
    route.fulfill({ json: forecast }),
  );
  await page.goto("./");
});

test("loads catalog, updates occasions and opens details", async ({
  page,
}) => {
  await expect(
    page.getByRole("heading", { name: "Образы", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("look-card")).toHaveCount(4);
  await expect(page.getByText("+12° · Облачно", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Голубой + тёмный" }).click();
  await expect(page.getByRole("dialog")).toContainText("Как носить");
  await expect(page.getByRole("dialog")).not.toContainText(
    "Чёрные или тёмно-коричневые ботильоны",
  );
  await page.getByRole("button", { name: "Закрыть" }).click();
  await page.getByRole("button", { name: "Вечерний", exact: true }).click();
  await expect(page.getByText("Подходящих сочетаний пока нет")).toBeVisible();
  await page.getByRole("button", { name: "Сменить основу" }).click();
  await page
    .getByRole("button", { name: "Белая водолазка", exact: true })
    .click();
  await expect(page.getByTestId("look-card")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Сливочный + шоколадный" }).locator("img"),
  ).toHaveCount(1);
});

test("look cards show full-width artwork and details retain original photographs", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const card = page.getByRole("button", { name: "Голубой + тёмный", exact: true });
  await expect(card.locator("img")).toHaveCount(1);
  const catalog = await page.request.get("looks/looks.json").then(response => response.json());
  const look = catalog.looks.find(look => look.id === 1);
  await expect(card.locator("img")).toHaveAttribute("src", look.preview);
  const artwork = await card.locator("img").boundingBox();
  const copy = await card.locator(".look-copy").boundingBox();
  const bounds = await card.boundingBox();
  expect(artwork.width).toBeGreaterThan(bounds.width - 4);
  expect(artwork.height).toBeGreaterThan(artwork.width);
  expect(copy.y).toBeGreaterThanOrEqual(artwork.y + artwork.height);
  await card.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".look-artwork img")).toHaveAttribute("src", look.preview);
  await expect(dialog.getByRole("heading", { name: "Исходные фотографии" })).toBeVisible();
  const originals = dialog.locator(".look-originals figure");
  await expect(originals).toHaveCount(look.items.length);
  for (const [index, id] of look.items.entries()) {
    const item = catalog.items[id];
    await expect(originals.nth(index).locator("img")).toHaveAttribute("src", item.file);
    await expect(originals.nth(index).locator("img")).toHaveAttribute("alt", item.name);
    await expect(originals.nth(index).locator("img")).toHaveAttribute("style", `transform:rotate(${item.rotation || 0}deg)`);
    await expect(originals.nth(index).locator("figcaption")).toHaveText(item.name);
  }
});

test("suggested additions are marked outside the wardrobe and complex looks have a badge", async ({ page }) => {
  const catalog = await page.request.get("looks/looks.json").then(response => response.json());
  const card = page.getByRole("button", { name: "Голубой + тёмный", exact: true });
  await expect(card).toContainText("Дополнить:");
  await expect(card).toContainText("Вне каталога");
  const look = catalog.looks.find(look => look.id === 1);
  expect(look.additions).toHaveLength(3);
  for (const addition of look.additions) await expect(card).toContainText(addition.name);
  await card.click();
  const additions = page.getByRole("dialog").getByRole("region", { name: "Чего не хватает" });
  await expect(additions).toContainText("Предлагаемые дополнения — их нет в каталоге.");
  await expect(additions.locator("li")).toHaveCount(look.additions.length);
  for (const addition of look.additions) await expect(additions).toContainText(addition.name);
  await page.getByRole("button", { name: "Закрыть" }).click();
  const complex = catalog.looks.find(look => look.extended);
  expect(complex).toBeTruthy();
  await page.locator(`[data-occasion="${complex.scenarios.some(value => value.startsWith("Театр")) ? "evening" : "everyday"}"]`).click();
  await page.getByRole("button", { name: "Сменить основу" }).click();
  await page.locator(`[data-base="${complex.items[0]}"]`).click();
  await expect(page.locator(`[data-look="${complex.id}"]`)).toContainText("Сложный образ · С дополнениями");
});

test("every prepared look uses its artwork, marks additions and keeps owned garment photos", async ({ page }) => {
  const catalog = await page.request.get("looks/looks.json").then(response => response.json());
  for (const look of catalog.looks) {
    const occasion = look.scenarios.some(value => value.startsWith("Театр")) ? "evening" : "everyday";
    await page.locator(`[data-occasion="${occasion}"]`).click();
    await page.getByRole("button", { name: "Сменить основу" }).click();
    await page.locator(`[data-base="${look.items[0]}"]`).click();
    const card = page.locator(`[data-look="${look.id}"]`);
    await expect(card.locator("img")).toHaveCount(1);
    await expect(card.locator("img")).toHaveAttribute("src", look.preview);
    await expect(card).toContainText("Дополнить:");
    await expect(card).toContainText("Вне каталога");
    for (const addition of look.additions) await expect(card).toContainText(addition.name);
    if (look.extended) await expect(card).toContainText("Сложный образ · С дополнениями");
    await card.click();
    const dialog = page.getByRole("dialog");
    const artwork = dialog.locator(".look-artwork img");
    await expect(artwork).toHaveAttribute("src", look.preview);
    await artwork.scrollIntoViewIfNeeded();
    await expect.poll(() => artwork.evaluate(img => img.complete && img.naturalWidth > 0), {
      message: `Look ${look.id} (${look.title}): ${look.preview} must load`,
    }).toBe(true);
    const additions = dialog.getByRole("region", { name: "Чего не хватает" });
    await expect(additions.locator("li")).toHaveCount(look.additions.length);
    for (const addition of look.additions) await expect(additions).toContainText(addition.name);
    const originals = dialog.locator(".look-originals figure");
    await expect(originals).toHaveCount(look.items.length);
    for (const [index, id] of look.items.entries()) {
      const item = catalog.items[id];
      await expect(originals.nth(index).locator("img")).toHaveAttribute("src", item.file);
      await expect(originals.nth(index).locator("img")).toHaveAttribute("alt", item.name);
      await expect(originals.nth(index).locator("img")).toHaveAttribute("style", `transform:rotate(${item.rotation || 0}deg)`);
      await expect(originals.nth(index).locator("figcaption")).toHaveText(item.name);
    }
    await page.getByRole("button", { name: "Закрыть" }).click();
  }
});

test("wardrobe filters and item action change the required base", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Гардероб", exact: true }).click();
  await expect(page.getByTestId("item-card")).toHaveCount(70);
  await page.getByRole("button", { name: "В подборе", exact: true }).click();
  await expect(page.getByTestId("item-card")).toHaveCount(70);
  await page
    .getByRole("button", { name: "Голубая рубашка", exact: true })
    .click();
  await page.getByRole("button", { name: "Образы с этой вещью" }).click();
  await expect(page.getByTestId("look-card")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Голубой + тёмный" }),
  ).toBeVisible();
});

test("preview can be cancelled, saved photo survives reload and stays out of selection", async ({
  page,
}) => {
  const outgoing = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") outgoing.push(request.url());
  });
  await page.getByLabel("Фото с устройства").setInputFiles(photo);
  await expect(page.getByRole("dialog").locator("img")).toBeVisible();
  await page.getByRole("button", { name: "Отмена" }).click();
  await page.getByRole("button", { name: "Гардероб", exact: true }).click();
  await page.getByRole("button", { name: "Новые фото", exact: true }).click();
  await expect(page.getByText("Новых фото пока нет")).toBeVisible();
  await page.getByLabel("Фото с устройства").setInputFiles(photo);
  await page.getByRole("button", { name: "Сохранить фото" }).click();
  await expect(page.getByText("Пока без подбора", { exact: true })).toHaveCount(
    1,
  );
  await page.reload();
  await page.getByRole("button", { name: "Гардероб", exact: true }).click();
  await page.getByRole("button", { name: "Новые фото", exact: true }).click();
  await expect(page.getByTestId("item-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Новое фото", exact: true }).click();
  await expect(page.getByRole("dialog").locator("img")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Образы с этой вещью" }),
  ).toHaveCount(0);
  expect(outgoing).toEqual([]);
});

test("weather failure offers manual input and updates weather advice", async ({
  page,
}) => {
  await page.route("https://api.open-meteo.com/**", (route) => route.abort());
  await page.reload();
  await expect(page.getByText("Не удалось загрузить погоду")).toBeVisible();
  await page.getByRole("button", { name: "Выбрать погоду" }).click();
  await page.getByLabel("Температура, °C").fill("-5");
  await page.getByLabel("Осадки").selectOption("snow");
  await page.getByLabel("Ветер, м/с").fill("12");
  await page.getByRole("button", { name: "Применить" }).click();
  await expect(page.getByText("−5° · Снег", { exact: true })).toBeVisible();
  await expect(page.getByTestId("weather-advice")).toContainText("утепление");
  await expect(page.getByTestId("weather-advice")).toContainText("Осадки");
  await expect(page.getByTestId("weather-advice")).toContainText(
    "Сильный ветер",
  );
});

test("broken image and unavailable storage show errors without reporting saved", async ({
  page,
}) => {
  await page.getByLabel("Фото с устройства").setInputFiles({
    name: "broken.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("broken"),
  });
  await expect(page.getByRole("alert")).toContainText(
    "Не удалось открыть фото",
  );
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      get() {
        throw new Error("storage blocked");
      },
    });
  });
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "Хранилище фото недоступно",
  );
  await page.getByLabel("Фото с устройства").setInputFiles(photo);
  await page.getByRole("button", { name: "Сохранить фото" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Не удалось сохранить фото",
  );
});

test("all visible assets load and page fits a narrow screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await expect(page.getByTestId("look-card")).toHaveCount(4);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (const image of await page.locator("main img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0),
      { message: await image.getAttribute("src") }).toBe(true);
  }
  await page.getByRole("button", { name: "Гардероб", exact: true }).click();
  await expect(page.getByTestId("item-card")).toHaveCount(70);
  for (const image of await page.locator("main img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(
        () => image.evaluate((img) => img.complete && img.naturalWidth > 0),
        { message: await image.getAttribute("src") },
      )
      .toBe(true);
  }
});

test("manual weather accepts decimal forecast defaults", async ({ page }) => {
  await page.route("https://api.open-meteo.com/**", (route) =>
    route.fulfill({
      json: {
        current: {
          ...forecast.current,
          temperature_2m: 12.3,
          wind_speed_10m: 2.4,
        },
      },
    }),
  );
  await page.reload();
  await page.getByRole("button", { name: "Изменить погоду" }).click();
  await page.getByRole("button", { name: "Применить" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByText("Вручную · твой выбор")).toBeVisible();
});

test("changing temperature preserves current precipitation", async ({
  page,
}) => {
  await page.route("https://api.open-meteo.com/**", (route) =>
    route.fulfill({
      json: {
        current: { ...forecast.current, precipitation: 1, weather_code: 71 },
      },
    }),
  );
  await page.reload();
  await page.getByRole("button", { name: "Изменить погоду" }).click();
  await expect(page.getByLabel("Осадки")).toHaveValue("snow");
  await page.getByLabel("Температура, °C").fill("-2");
  await page.getByRole("button", { name: "Применить" }).click();
  await expect(page.getByText("−2° · Снег", { exact: true })).toBeVisible();
});

test("finishing an old save preserves a newly opened dialog", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.readCompletions = 0;
    const descriptor = Object.getOwnPropertyDescriptor(
      IDBTransaction.prototype,
      "oncomplete",
    );
    Object.defineProperty(IDBTransaction.prototype, "oncomplete", {
      ...descriptor,
      set(handler) {
        descriptor.set.call(this, (event) => {
          if (this.mode === "readwrite")
            window.finishSave = () => handler.call(this, event);
          else {
            handler.call(this, event);
            window.readCompletions++;
          }
        });
      },
    });
  });
  await page.reload();
  await page.waitForFunction(() => window.readCompletions === 1);
  await page.getByLabel("Фото с устройства").setInputFiles(photo);
  await page.getByRole("button", { name: "Сохранить фото" }).click();
  await page.waitForFunction(() => typeof window.finishSave === "function");
  await page.getByRole("button", { name: "Закрыть" }).click();
  await page.getByRole("button", { name: "Изменить погоду" }).click();
  await page.evaluate(() => window.finishSave());
  await page.waitForFunction(() => window.readCompletions === 2);
  await expect(page.getByRole("dialog")).toContainText("Выбрать погоду");
  await page.getByRole("button", { name: "Закрыть" }).click();
  await page.getByRole("button", { name: "Гардероб", exact: true }).click();
  await page.getByRole("button", { name: "Новые фото", exact: true }).click();
  await expect(page.getByTestId("item-card")).toHaveCount(1);
});

test("newly catalogued clothes participate in prepared looks", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Гардероб", exact: true }).click();
  await page.locator('[data-item="1"]').click();
  await expect(page.getByRole("dialog")).toContainText(
    "Для этой вещи есть готовые сочетания",
  );
  await page.getByRole("button", { name: "Образы с этой вещью" }).click();
  await expect(page.getByTestId("look-card")).toHaveCount(2);
  await page.getByRole("button", { name: "Гардероб", exact: true }).click();
  await page.getByRole("button", { name: "Новые фото", exact: true }).click();
  await expect(page.getByTestId("item-card")).toHaveCount(0);
});

test("negative temperature can be entered without a minus key", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Изменить погоду" }).click();
  await page.getByLabel("Температура, °C").fill("5");
  await page.getByRole("button", { name: "Сменить знак температуры" }).click();
  await expect(page.getByLabel("Температура, °C")).toHaveValue("-5");
  await page.getByRole("button", { name: "Применить" }).click();
  await expect(page.getByText("−5° · Ясно", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Изменить погоду" }).click();
  await page.getByRole("button", { name: "Сменить знак температуры" }).click();
  await expect(page.getByLabel("Температура, °C")).toHaveValue("5");
  await page.getByRole("button", { name: "Применить" }).click();
  await expect(page.getByText("+5° · Ясно", { exact: true })).toBeVisible();
});

test("manual weather survives reload with temperature precipitation and wind", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Изменить погоду" }).click();
  await page.getByLabel("Температура, °C").fill("-5");
  await page.getByLabel("Осадки").selectOption("snow");
  await page.getByLabel("Ветер, м/с").fill("12");
  await page.getByRole("button", { name: "Применить" }).click();
  await page.reload();
  await expect(page.getByText("−5° · Снег", { exact: true })).toBeVisible();
  await expect(page.getByText("Вручную · твой выбор")).toBeVisible();
  await expect(page.getByTestId("weather-advice")).toContainText(
    "Сильный ветер",
  );
  await page.getByRole("button", { name: "Изменить погоду" }).click();
  await expect(page.getByLabel("Температура, °C")).toHaveValue("-5");
  await expect(page.getByLabel("Осадки")).toHaveValue("snow");
  await expect(page.getByLabel("Ветер, м/с")).toHaveValue("12");
});

test("returning to automatic forecast clears the saved manual choice", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Изменить погоду" }).click();
  await page.getByLabel("Температура, °C").fill("-5");
  await page.getByRole("button", { name: "Применить" }).click();
  await page.getByRole("button", { name: "Вернуть автопогоду" }).click();
  await expect(page.getByText("+12° · Облачно", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("+12° · Облачно", { exact: true })).toBeVisible();
  await expect(page.getByText("Вручную · твой выбор")).toHaveCount(0);
});

test("blocked weather storage reports that the choice cannot survive reload", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
  });
  await page.reload();
  await page.getByRole("button", { name: "Изменить погоду" }).click();
  await page.getByLabel("Температура, °C").fill("-5");
  await page.getByRole("button", { name: "Применить" }).click();
  await expect(page.getByText("−5° · Ясно", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "Не удалось сохранить погоду",
  );
});
