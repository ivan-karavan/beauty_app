import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, access, writeFile, readdir, cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "../scripts/build.js";

test("deployment contains the app and referenced photos, excludes working files and stale artifacts", async () => {
  await build();
  assert.match(await readFile("dist/index.html", "utf8"), /Личный гардероб/);
  const catalog = JSON.parse(await readFile("dist/looks/looks.json", "utf8"));
  for (const item of Object.values(catalog.items)) {
    assert.deepEqual(await readFile(`dist/${item.file}`), await readFile(item.file));
  }
  for (const look of catalog.looks) {
    assert.equal(typeof look.preview, "string", `look ${look.id} needs artwork`);
    assert.deepEqual(await readFile(`dist/${look.preview}`), await readFile(look.preview));
  }
  assert.equal((await readdir("dist/looks/previews")).length, catalog.looks.length);
  assert.equal((await readdir("dist/clothes_photos")).length, Object.keys(catalog.items).length);
  for (const file of ["src/app.js", "src/style.css", ".nojekyll"]) {
    await access(`dist/${file}`);
  }
  for (const file of ["README.md", "tests", "node_modules", ".github", "looks/lookbook.html", "looks/two-looks-preview.png"]) {
    await assert.rejects(access(`dist/${file}`));
  }
  await writeFile("dist/stale.txt", "old deployment");
  await build();
  await assert.rejects(access("dist/stale.txt"));
});

test("build rejects absent artwork before replacing the previous deployment", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "wardrobe-build-"));
  try {
    await mkdir(join(fixture, "scripts"));
    await mkdir(join(fixture, "looks"));
    await mkdir(join(fixture, "dist"));
    await cp(new URL("../scripts/build.js", import.meta.url), join(fixture, "scripts/build.mjs"));
    await writeFile(join(fixture, "index.html"), "app");
    await writeFile(join(fixture, "dist/previous.txt"), "previous deployment");
    const { build: buildFixture } = await import(pathToFileURL(join(fixture, "scripts/build.mjs")));
    await writeFile(join(fixture, "looks/looks.json"), JSON.stringify({ items: {}, looks: [{ id: 1 }] }));
    await assert.rejects(buildFixture(), /Missing preview for look 1/);
    await writeFile(join(fixture, "looks/looks.json"), JSON.stringify({ items: {}, looks: [{ id: 1, preview: "looks/missing.jpg" }] }));
    await assert.rejects(buildFixture(), /ENOENT/);
    assert.equal(await readFile(join(fixture, "dist/previous.txt"), "utf8"), "previous deployment");
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
