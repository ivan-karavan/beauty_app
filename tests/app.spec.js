import { test, expect } from "@playwright/test";
import { chooseSeason, seedLegacyPhoto, seasons } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  await page.goto("./");
});

test("header offers seasons and no photo adding or weather controls", async ({
  page,
}) => {
  await expect(
    page.locator("header").getByRole("button", { name: /^Сезон:/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Добавить фото/ })).toHaveCount(
    0,
  );
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.locator(".weather")).toHaveCount(0);
  await page.locator("#season-picker").click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Выбери сезон" }),
  ).toBeVisible();
  for (const name of ["Зима", "Весна", "Лето", "Осень"])
    await expect(
      page.getByRole("dialog").getByRole("button", { name, exact: true }),
    ).toBeVisible();
});

test("season persists on both tabs and ignores previous weather settings", async ({
  page,
}) => {
  const external = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(page.url()).origin)
      external.push(request.url());
  });
  await page.evaluate(() =>
    localStorage.setItem("beauty-app.manual-weather", '{"temperature":-7}'),
  );
  for (const [season, label] of [
    ["winter", "Зима"],
    ["spring", "Весна"],
    ["summer", "Лето"],
    ["autumn", "Осень"],
  ]) {
    await chooseSeason(page, season);
    await expect(page.locator("#season-picker")).toHaveAccessibleName(
      `Сезон: ${label}`,
    );
    await page.reload();
    await expect(page.locator("#season-picker")).toHaveAccessibleName(
      `Сезон: ${label}`,
    );
    expect(
      await page.evaluate(() => localStorage.getItem("beauty-app.season")),
    ).toBe(season);
  }
  await page.getByRole("button", { name: "Гардероб", exact: true }).click();
  await expect(
    page.locator("header").getByRole("button", { name: "Сезон: Осень" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("beauty-app.manual-weather"),
    ),
  ).toBe('{"temperature":-7}');
  expect(external).toEqual([]);
});

test("season choice filters the feed and owned clothes remain usable as a base", async ({
  page,
}) => {
  const catalog = await page.request
    .get("looks/looks.json")
    .then((response) => response.json());
  const look = catalog.looks[0];
  await chooseSeason(page, look.seasons[0]);
  await page.getByRole("button", { name: "Гардероб", exact: true }).click();
  await page.locator(`[data-item="${look.items[0]}"]`).click();
  await page.getByRole("button", { name: "Образы с этой вещью" }).click();
  for (const season of seasons) {
    await chooseSeason(page, season);
    const ids = await page
      .getByTestId("look-card")
      .evaluateAll((nodes) => nodes.map((node) => Number(node.dataset.look)));
    for (const id of ids) {
      const visible = catalog.looks.find((look) => look.id === id);
      expect(visible.seasons).toContain(season);
      expect(visible.items).toContain(look.items[0]);
    }
    if (!ids.length)
      await expect(
        page.getByText("Попробуй другой сезон, основу или повод."),
      ).toBeVisible();
  }
});

test("blocked settings storage reports failure while season selection still works", async ({
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
  await chooseSeason(page, "summer");
  await expect(page.locator("#season-picker")).toHaveAccessibleName(
    "Сезон: Лето",
  );
  await expect(page.getByRole("alert")).toContainText(
    "Не удалось сохранить сезон",
  );
});

test("wardrobe groups every catalog item once and filters every category", async ({
  page,
}) => {
  const catalog = await page.request
    .get("looks/looks.json")
    .then((response) => response.json());
  await page.getByRole("button", { name: "Гардероб", exact: true }).click();
  const cards = page.getByTestId("item-card");
  await expect(cards).toHaveCount(Object.keys(catalog.items).length);
  expect(
    (
      await cards.evaluateAll((nodes) => nodes.map((node) => node.dataset.item))
    ).sort(),
  ).toEqual(Object.keys(catalog.items).sort());
  await expect(
    page.getByLabel("Категория").locator('option[value="saved"]'),
  ).toHaveCount(0);
  for (const category of catalog.categories) {
    const expected = Object.entries(catalog.items)
      .filter(([, item]) => item.category === category.id)
      .map(([id]) => id)
      .sort();
    await page.getByLabel("Категория").selectOption(category.id);
    await expect(page.locator(".wardrobe-category > h2")).toHaveText([
      category.label,
    ]);
    expect(
      (
        await cards.evaluateAll((nodes) =>
          nodes.map((node) => node.dataset.item),
        )
      ).sort(),
    ).toEqual(expected);
  }
  await page.getByLabel("Категория").selectOption(catalog.items[48].category);
  await expect(page.locator('[data-item="48"]')).toHaveAccessibleName(
    "Голубые джинсовые бермуды",
  );
  await page.getByLabel("Категория").selectOption("all");
  await expect(cards).toHaveCount(70);
});

test("previously saved photos remain read-only after reload", async ({
  page,
}) => {
  await seedLegacyPhoto(page);
  await page.reload();
  await page.getByRole("button", { name: "Гардероб", exact: true }).click();
  await expect(page.getByTestId("item-card")).toHaveCount(71);
  await page.getByLabel("Категория").selectOption("saved");
  await expect(page.getByTestId("item-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Сохранённое фото", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("img")).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Образы с этой вещью" }),
  ).toHaveCount(0);
  await expect(dialog).toContainText("доступно для просмотра");
  expect(
    await page.evaluate(async () =>
      Object.keys(await import("./src/photos.js")),
    ),
  ).toEqual(["listPhotos"]);
  await page.getByRole("button", { name: "Закрыть" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Гардероб", exact: true }).click();
  await page.getByLabel("Категория").selectOption("saved");
  await expect(page.getByTestId("item-card")).toHaveCount(1);
});

test("unavailable legacy storage keeps the catalog usable", async ({
  page,
}) => {
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
  await page.getByRole("button", { name: "Гардероб", exact: true }).click();
  await expect(page.getByTestId("item-card")).toHaveCount(70);
});

test("cards show full-width artwork, owned originals and explicit suggestions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const catalog = await page.request
    .get("looks/looks.json")
    .then((response) => response.json());
  const look = catalog.looks[0];
  await chooseSeason(page, look.seasons[0]);
  await page
    .locator(
      `[data-occasion="${look.scenarios.some((value) => value.startsWith("Театр")) ? "evening" : "everyday"}"]`,
    )
    .click();
  await page.getByRole("button", { name: "Сменить основу" }).click();
  await page.locator(`[data-base="${look.items[0]}"]`).click();
  const card = page.locator(`[data-look="${look.id}"]`);
  await expect(card.locator("img")).toHaveCount(1);
  const artwork = await card.locator("img").boundingBox();
  const copy = await card.locator(".look-copy").boundingBox();
  expect(artwork.width).toBeGreaterThan((await card.boundingBox()).width - 4);
  expect(artwork.height).toBeGreaterThan(artwork.width);
  expect(copy.y).toBeGreaterThanOrEqual(artwork.y + artwork.height);
  await card.click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "По сезону" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText(look.seasonNote);
  await expect(
    page.getByRole("dialog").getByRole("region", { name: "Чего не хватает" }),
  ).toContainText("Предлагаемые дополнения — их нет в каталоге.");
});

for (const season of seasons)
  test(`every prepared look loads artwork and preserves garment details: ${season}`, async ({
    page,
  }) => {
    const catalog = await page.request
      .get("looks/looks.json")
      .then((response) => response.json());
    await chooseSeason(page, season);
    for (const look of catalog.looks.filter(
      (look) => look.seasons[0] === season,
    )) {
      await page
        .locator(
          `[data-occasion="${look.scenarios.some((value) => value.startsWith("Театр")) ? "evening" : "everyday"}"]`,
        )
        .click();
      await page.getByRole("button", { name: "Сменить основу" }).click();
      await page.locator(`[data-base="${look.items[0]}"]`).click();
      const card = page.locator(`[data-look="${look.id}"]`);
      await expect(card.locator("img")).toHaveCount(1);
      await expect(card.locator("img")).toHaveAttribute("src", look.preview);
      await expect(card).toContainText("Дополнить:");
      await expect(card).toContainText("Вне каталога");
      for (const addition of look.additions)
        await expect(card).toContainText(addition.name);
      if (look.extended)
        await expect(card).toContainText("Сложный образ · С дополнениями");
      await card.click();
      const dialog = page.getByRole("dialog");
      const artwork = dialog.locator(".look-artwork img");
      await expect(artwork).toHaveAttribute("src", look.preview);
      await artwork.scrollIntoViewIfNeeded();
      await expect
        .poll(
          () => artwork.evaluate((img) => img.complete && img.naturalWidth > 0),
          {
            message: `Look ${look.id} (${look.title}): ${look.preview} must load`,
          },
        )
        .toBe(true);
      const additions = dialog.getByRole("region", { name: "Чего не хватает" });
      await expect(additions.locator("li")).toHaveCount(look.additions.length);
      for (const addition of look.additions)
        await expect(additions).toContainText(addition.name);
      const originals = dialog.locator(".look-originals figure");
      await expect(originals).toHaveCount(look.items.length);
      for (const [index, id] of look.items.entries()) {
        const item = catalog.items[id];
        await expect(originals.nth(index).locator("img")).toHaveAttribute(
          "src",
          item.file,
        );
        await expect(originals.nth(index).locator("img")).toHaveAttribute(
          "alt",
          item.name,
        );
        await expect(originals.nth(index).locator("img")).toHaveAttribute(
          "style",
          `transform:rotate(${item.rotation || 0}deg)`,
        );
        await expect(originals.nth(index).locator("figcaption")).toHaveText(
          item.name,
        );
      }
      await expect(dialog).toContainText(look.seasonNote);
      await page.getByRole("button", { name: "Закрыть" }).click();
    }
  });

test("all visible assets load, compact navigation fits a narrow screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await expect(
    page.getByRole("heading", { name: "Образы", exact: true }),
  ).toBeVisible();
  const navigation = page.getByRole("navigation", { name: "Разделы" });
  expect((await navigation.boundingBox()).height).toBeLessThanOrEqual(60);
  for (const button of await navigation.locator("button").all())
    expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
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
