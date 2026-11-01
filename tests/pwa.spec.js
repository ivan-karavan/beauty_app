import { test, expect, chromium } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chooseSeason, seedLegacyPhoto } from "./helpers.js";

test.skip(
  !process.env.SITE_PATH,
  "PWA проверяется на production-сборке: npm run test:prod",
);

async function controlled(page) {
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.goto("./");
});

test("production manifest and worker make the project subpath installable", async ({
  baseURL,
}) => {
  // A normal temporary profile is required: Chrome forbids PWA installation in incognito contexts.
  const profile = await mkdtemp(join(tmpdir(), "wardrobe-pwa-"));
  const context = await chromium.launchPersistentContext(profile, {
    channel: process.env.PW_BROWSER_CHANNEL,
    headless: true,
  });
  try {
    const page = await context.newPage();
    await page.goto(baseURL);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      "href",
      "manifest.webmanifest",
    );
    await controlled(page);
    const session = await context.newCDPSession(page);
    const manifest = await session.send("Page.getAppManifest");
    expect(manifest.errors).toEqual([]);
    const data = JSON.parse(manifest.data);
    expect(data.display).toBe("standalone");
    expect(new URL(data.id, new URL(page.url()).origin).pathname).toBe(
      "/beauty_app/",
    );
    expect(new URL(data.scope, manifest.url).pathname).toBe(
      new URL(page.url()).pathname,
    );
    await expect
      .poll(
        async () =>
          (await session.send("Page.getInstallabilityErrors"))
            .installabilityErrors,
      )
      .toEqual([]);
    await session.detach();
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("offline reload keeps season legacy photos and opened artwork", async ({
  page,
  context,
}) => {
  await controlled(page);
  await seedLegacyPhoto(page);
  await page.reload();
  await chooseSeason(page, "autumn");
  const artwork = page.getByTestId("look-card").first().locator("img");
  await artwork.scrollIntoViewIfNeeded();
  await expect
    .poll(() => artwork.evaluate((img) => img.complete && img.naturalWidth > 0))
    .toBe(true);
  const source = await artwork.getAttribute("src");
  await expect
    .poll(() =>
      page.evaluate(
        async (src) => Boolean(await caches.match(new URL(src, location.href))),
        source,
      ),
    )
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#season-picker")).toHaveAccessibleName(
    "Сезон: Осень",
  );
  const cachedArtwork = page.locator(`img[src="${source}"]`);
  await cachedArtwork.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      cachedArtwork.evaluate((img) => img.complete && img.naturalWidth > 0),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Гардероб", exact: true }).click();
  await page.getByLabel("Категория").selectOption("saved");
  await expect(page.getByTestId("item-card")).toHaveCount(1);
  await expect
    .poll(() =>
      page
        .getByTestId("item-card")
        .locator("img")
        .evaluate((img) => img.complete && img.naturalWidth > 0),
    )
    .toBe(true);
});

test("worker update preserves local data and other applications caches", async ({
  page,
}) => {
  await controlled(page);
  await seedLegacyPhoto(page);
  await page.reload();
  await chooseSeason(page, "summer");
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const foreign = await caches.open("gym-test-cache");
    await foreign.put(
      new URL("../gym-sentinel", registration.scope),
      new Response("keep"),
    );
    await caches.open(
      `beauty-app:${new URL(registration.scope).pathname}:core-obsolete`,
    );
    await navigator.serviceWorker.register(
      new URL("sw.js?update-check=1", registration.scope),
      { scope: registration.scope },
    );
  });
  await page
    .getByRole("button", { name: "Обновить приложение", exact: true })
    .click();
  await expect(page.locator("#season-picker")).toHaveAccessibleName(
    "Сезон: Лето",
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        navigator.serviceWorker.controller?.scriptURL.includes(
          "update-check=1",
        ),
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Гардероб", exact: true }).click();
  await page.getByLabel("Категория").selectOption("saved");
  await expect(page.getByTestId("item-card")).toHaveCount(1);
  const names = await page.evaluate(() => caches.keys());
  expect(names).toContain("gym-test-cache");
  expect(names.some((name) => name.endsWith(":core-obsolete"))).toBe(false);
});

test.describe("iPhone", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
  });
  test("installation button explains adding the app through Safari", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: "Добавить на главный экран", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("Safari");
    await expect(page.getByRole("dialog")).toContainText("Поделиться");
    await expect(page.getByRole("dialog")).toContainText("На экран");
  });
});
