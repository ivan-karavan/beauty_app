import { test } from "node:test";
import assert from "node:assert/strict";
import { loadWeather } from "../src/weather.js";

const current = {
  temperature_2m: 12,
  apparent_temperature: 9,
  precipitation: 0.3,
  weather_code: 3,
  wind_speed_10m: 4,
};
const location = { latitude: 55.75, longitude: 37.62 };

test("requests only coordinates and weather variables, converts current forecast", async () => {
  let requested;
  const fetcher = async (url) => {
    requested = new URL(url);
    return { ok: true, json: async () => ({ current }) };
  };
  assert.deepEqual(await loadWeather(location, fetcher), {
    temperature: 12,
    feelsLike: 9,
    precipitation: 0.3,
    code: 3,
    wind: 4,
  });
  assert.equal(requested.origin, "https://api.open-meteo.com");
  assert.equal(requested.searchParams.get("latitude"), "55.75");
  assert.equal(requested.searchParams.get("wind_speed_unit"), "ms");
  assert.equal(requested.searchParams.has("items"), false);
});

test("rejects HTTP errors and incomplete or nonnumeric forecasts", async () => {
  await assert.rejects(() =>
    loadWeather(location, async () => ({ ok: false })),
  );
  for (const invalid of [
    undefined,
    {},
    { ...current, temperature_2m: null },
    { ...current, precipitation: "rain" },
  ]) {
    await assert.rejects(() =>
      loadWeather(location, async () => ({
        ok: true,
        json: async () => ({ current: invalid }),
      })),
    );
  }
});

test("propagates network failures for manual fallback", async () => {
  await assert.rejects(
    () =>
      loadWeather(location, async () => {
        throw new Error("offline");
      }),
    /offline/,
  );
});
