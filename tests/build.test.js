import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readFile,
  access,
  writeFile,
  readdir,
  cp,
  mkdir,
  mkdtemp,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "../scripts/build.js";

test("deployment contains the app and referenced photos, excludes working files and stale artifacts", async () => {
  await build();
  assert.match(await readFile("dist/index.html", "utf8"), /Личный гардероб/);
  assert.ok(
    (await readdir("dist")).includes("manifest.webmanifest"),
    "production must contain the PWA manifest",
  );
  const manifest = JSON.parse(
    await readFile("dist/manifest.webmanifest", "utf8"),
  );
  assert.equal(manifest.display, "standalone");
  assert.equal(
    new URL(manifest.id, "https://ivan-karavan.github.io/").pathname,
    "/beauty_app/",
    "PWA identity must not collide with Gym on the same origin",
  );
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  for (const icon of manifest.icons) {
    const bytes = await readFile(`dist/${icon.src}`);
    assert.equal(bytes.subarray(1, 4).toString(), "PNG");
    assert.equal(
      `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`,
      icon.sizes,
    );
  }
  await access("dist/icons/apple-touch-icon.png");
  const worker = await readFile("dist/sw.js", "utf8");
  assert.ok(!worker.includes("__BUILD_VERSION__"));
  assert.ok(!worker.includes("__CORE_ASSETS__"));

  const catalog = JSON.parse(await readFile("dist/looks/looks.json", "utf8"));
  for (const item of Object.values(catalog.items)) {
    assert.deepEqual(
      await readFile(`dist/${item.file}`),
      await readFile(item.file),
    );
  }
  for (const look of catalog.looks) {
    assert.equal(
      typeof look.preview,
      "string",
      `look ${look.id} needs artwork`,
    );
    assert.deepEqual(
      await readFile(`dist/${look.preview}`),
      await readFile(look.preview),
    );
  }
  assert.equal(
    (await readdir("dist/looks/previews")).length,
    catalog.looks.length,
  );
  assert.equal(
    (await readdir("dist/clothes_photos")).length,
    Object.keys(catalog.items).length,
  );
  for (const file of ["src/app.js", "src/style.css", ".nojekyll"]) {
    await access(`dist/${file}`);
  }
  for (const file of [
    "README.md",
    "tests",
    "node_modules",
    ".github",
    "looks/lookbook.html",
    "looks/two-looks-preview.png",
  ]) {
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
    await cp(
      new URL("../scripts/build.js", import.meta.url),
      join(fixture, "scripts/build.mjs"),
    );
    await writeFile(join(fixture, "index.html"), "app");
    await writeFile(join(fixture, "dist/previous.txt"), "previous deployment");
    const { build: buildFixture } = await import(
      pathToFileURL(join(fixture, "scripts/build.mjs"))
    );
    await writeFile(
      join(fixture, "looks/looks.json"),
      JSON.stringify({ items: {}, looks: [{ id: 1 }] }),
    );
    await assert.rejects(buildFixture(), /Missing preview for look 1/);
    await writeFile(
      join(fixture, "looks/looks.json"),
      JSON.stringify({
        items: {},
        looks: [{ id: 1, preview: "looks/missing.jpg" }],
      }),
    );
    await assert.rejects(buildFixture(), /ENOENT/);
    assert.equal(
      await readFile(join(fixture, "dist/previous.txt"), "utf8"),
      "previous deployment",
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("worker build version is deterministic and changes with application code", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "wardrobe-pwa-build-"));
  try {
    for (const directory of ["scripts", "src", "looks", "pwa", "icons"])
      await mkdir(join(fixture, directory));
    await cp(
      new URL("../scripts/build.js", import.meta.url),
      join(fixture, "scripts/build.mjs"),
    );
    await cp(
      new URL("../manifest.webmanifest", import.meta.url),
      join(fixture, "manifest.webmanifest"),
    );
    await cp(new URL("../icons/", import.meta.url), join(fixture, "icons"), {
      recursive: true,
    });
    await cp(
      new URL("../pwa/worker.js", import.meta.url),
      join(fixture, "pwa/worker.js"),
    );
    await writeFile(
      join(fixture, "index.html"),
      '<meta name="app-build" content="development">',
    );
    await writeFile(
      join(fixture, "looks/looks.json"),
      JSON.stringify({ items: {}, looks: [] }),
    );
    await writeFile(join(fixture, "src/app.js"), "export const version = 1;");
    const { build: buildFixture } = await import(
      pathToFileURL(join(fixture, "scripts/build.mjs"))
    );
    await buildFixture();
    const first = await readFile(join(fixture, "dist/sw.js"), "utf8");
    await buildFixture();
    assert.equal(await readFile(join(fixture, "dist/sw.js"), "utf8"), first);
    await writeFile(join(fixture, "src/app.js"), "export const version = 2;");
    await buildFixture();
    assert.notEqual(await readFile(join(fixture, "dist/sw.js"), "utf8"), first);
    assert.ok(!first.includes("__BUILD_VERSION__"));
    assert.match(first, /src\/app\.js/);
    assert.ok(
      !(await readFile(join(fixture, "dist/index.html"), "utf8")).includes(
        "development",
      ),
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
