import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, access, writeFile, readdir } from "node:fs/promises";
import { build } from "../scripts/build.js";

test("deployment contains the app and referenced photos, excludes working files and stale artifacts", async () => {
  await build();
  assert.match(await readFile("dist/index.html", "utf8"), /Личный гардероб/);
  const catalog = JSON.parse(await readFile("dist/looks/looks.json", "utf8"));
  for (const item of Object.values(catalog.items)) {
    assert.deepEqual(await readFile(`dist/${item.file}`), await readFile(item.file));
  }
  assert.equal((await readdir("dist/clothes_photos")).length, Object.keys(catalog.items).length);
  for (const file of ["src/app.js", "src/style.css", "looks/two-looks-preview.png", ".nojekyll"]) {
    await access(`dist/${file}`);
  }
  for (const file of ["README.md", "tests", "node_modules", ".github", "looks/lookbook.html"]) {
    await assert.rejects(access(`dist/${file}`));
  }
  await writeFile("dist/stale.txt", "old deployment");
  await build();
  await assert.rejects(access("dist/stale.txt"));
});
