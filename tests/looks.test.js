import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { selectLooks, weatherAdvice } from "../src/looks.js";

const catalog = JSON.parse(
  readFileSync(new URL("../looks/looks.json", import.meta.url)),
);
const choose = (options = {}, data = catalog) =>
  selectLooks(data, { base: "49", occasion: "everyday", ...options });

test("keeps the required item and only currently owned items", () => {
  assert.deepEqual(
    choose()
      .map((x) => x.id)
      .sort((a, b) => a - b),
    [1, 5, 9, 16],
  );
  const items = { ...catalog.items };
  delete items["35"];
  assert.ok(!choose({}, { ...catalog, items }).some((x) => x.id === 1));
  assert.deepEqual(choose({ base: "missing" }), []);
});

test("evening selects harmonious theatre combinations, everyday prioritizes movement", () => {
  assert.deepEqual(
    choose({ base: "66", occasion: "evening" }).map((x) => x.id),
    [3, 8],
  );
  assert.equal(choose({ base: "53" })[0].id, 13);
  assert.deepEqual(choose({ base: "31" }), []);
  assert.equal(choose({ base: "31", occasion: "evening" })[0].id, 7);
});

test("weather changes layering priority without inventing garment warmth", () => {
  const cold = choose({
    base: "66",
    weather: { temperature: -5, precipitation: 0, wind: 3 },
  });
  const warm = choose({
    base: "66",
    weather: { temperature: 24, precipitation: 0, wind: 3 },
  });
  assert.equal(cold[0].id, 14);
  assert.notEqual(warm[0].id, 14);
  assert.match(
    weatherAdvice({ temperature: -5, precipitation: 2, wind: 12 }),
    /утепление/,
  );
  assert.match(
    weatherAdvice({ temperature: -5, precipitation: 2, wind: 12 }),
    /осадки/i,
  );
  assert.match(weatherAdvice(null), /неизвестна/);
});

test("catalog references real photos and every look uses current catalog", () => {
  for (const item of Object.values(catalog.items))
    assert.ok(
      existsSync(new URL("../" + item.file, import.meta.url)),
      item.file,
    );
  for (const look of catalog.looks)
    for (const id of look.items)
      assert.ok(catalog.items[id], `${look.id}: ${id}`);
});
