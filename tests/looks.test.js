import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { selectLooks, SEASONS, currentSeason } from "../src/looks.js";

const catalog = JSON.parse(
  readFileSync(new URL("../looks/looks.json", import.meta.url)),
);

test("keeps the required item and only currently owned clothes", () => {
  const choose = (data) =>
    selectLooks(data, { base: "49", occasion: "everyday" });
  assert.ok(choose(catalog).length > 0);
  assert.ok(choose(catalog).every((look) => look.items.includes(49)));
  const items = { ...catalog.items };
  delete items["35"];
  assert.ok(!choose({ ...catalog, items }).some((look) => look.id === 1));
  assert.deepEqual(
    selectLooks(catalog, { base: "missing", occasion: "everyday" }),
    [],
  );
});

test("season and occasion select only relevant prepared looks", () => {
  const data = {
    items: { 1: {}, 2: {}, 3: {} },
    looks: [
      { id: 101, items: [1, 2], seasons: ["summer"], scenarios: ["Друзья"] },
      { id: 102, items: [1, 3], seasons: ["winter"], scenarios: ["Поездки"] },
      {
        id: 103,
        items: [1],
        seasons: ["winter"],
        scenarios: ["Театр · нарядно"],
      },
    ],
  };
  assert.deepEqual(
    selectLooks(data, {
      base: "1",
      occasion: "everyday",
      season: "winter",
    }).map((x) => x.id),
    [102],
  );
  assert.deepEqual(
    selectLooks(data, {
      base: "1",
      occasion: "everyday",
      season: "summer",
    }).map((x) => x.id),
    [101],
  );
  assert.deepEqual(
    selectLooks(data, { base: "1", occasion: "evening", season: "winter" }).map(
      (x) => x.id,
    ),
    [103],
  );
  assert.deepEqual(
    selectLooks(data, { base: "1", occasion: "everyday", season: "spring" }),
    [],
  );
});

test("current season follows calendar months", () => {
  const expected = [
    "winter",
    "winter",
    "spring",
    "spring",
    "spring",
    "summer",
    "summer",
    "summer",
    "autumn",
    "autumn",
    "autumn",
    "winter",
  ];
  expected.forEach((season, month) =>
    assert.equal(currentSeason(new Date(2026, month, 15)), season),
  );
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

test("catalog includes every submitted photo exactly once", () => {
  const submitted = readdirSync(new URL("../clothes_photos/", import.meta.url))
    .filter((file) => file.endsWith(".jpeg"))
    .sort();
  const included = Object.values(catalog.items)
    .map((item) => item.file.replace("clothes_photos/", ""))
    .sort();
  assert.deepEqual(included, submitted);
});

test("every garment has at least three distinct clothing combinations", () => {
  const signature = (look) =>
    JSON.stringify([
      [...look.items].sort((a, b) => a - b),
      (look.additions || [])
        .filter((x) => x.type === "clothing")
        .map((x) => x.name)
        .sort(),
    ]);
  const missing = Object.keys(catalog.items).filter(
    (id) =>
      new Set(
        catalog.looks
          .filter((look) => look.items.includes(Number(id)))
          .map(signature),
      ).size < 3,
  );
  assert.deepEqual(
    missing,
    [],
    "Accessories alone must not count as a different clothing combination",
  );
});

test("all items are assigned to declared wardrobe categories", () => {
  assert.ok(Array.isArray(catalog.categories));
  const ids = new Set(catalog.categories.map((x) => x.id));
  for (const id of [
    "tshirts",
    "longsleeves",
    "sweaters",
    "cardigans",
    "hoodies",
    "shorts",
    "jeans",
    "trousers",
    "skirts",
    "dresses",
  ])
    assert.ok(ids.has(id), id);
  for (const [id, item] of Object.entries(catalog.items))
    assert.ok(ids.has(item.category), id);
  assert.equal(catalog.items[48].category, "shorts");
});

test("all looks have explicit seasonal suitability", () => {
  const seasons = new Set(SEASONS.map((x) => x.id));
  for (const look of catalog.looks) {
    assert.ok(
      Array.isArray(look.seasons) && look.seasons.length > 0,
      String(look.id),
    );
    assert.ok(
      look.seasons.every((season) => seasons.has(season)),
      String(look.id),
    );
    assert.ok(
      typeof look.seasonNote === "string" && look.seasonNote.length > 0,
      String(look.id),
    );
  }
});
