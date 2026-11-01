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

test("loads catalog, updates occasions, opens details and uses correct collage", async ({
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

test("wardrobe filters and item action change the required base", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Гардероб", exact: true }).click();
  await expect(page.getByTestId("item-card")).toHaveCount(25);
  await page.getByRole("button", { name: "В подборе", exact: true }).click();
  await expect(page.getByTestId("item-card")).toHaveCount(25);
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
  await page
    .getByLabel("Фото с устройства")
    .setInputFiles({
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
  await page.getByRole("button", { name: "Гардероб", exact: true }).click();
  await expect(page.getByTestId("item-card")).toHaveCount(25);
  const images = await page.locator("main img").evaluateAll((images) =>
    Promise.all(
      images.map(async (img) => {
        img.loading = "eager";
        try {
          await img.decode();
          return img.naturalWidth > 0;
        } catch {
          return false;
        }
      }),
    ),
  );
  expect(images.every(Boolean)).toBe(true);
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
