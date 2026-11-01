import {
  access,
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const root = new URL("../", import.meta.url);
const dist = new URL("dist/", root);

export async function build() {
  const catalog = JSON.parse(
    await readFile(new URL("looks/looks.json", root), "utf8"),
  );
  for (const look of catalog.looks) {
    if (typeof look.preview !== "string" || !look.preview)
      throw new Error(`Missing preview for look ${look.id}`);
  }
  const icons = [
    "icons/icon.svg",
    "icons/icon-192.png",
    "icons/icon-512.png",
    "icons/maskable-512.png",
    "icons/apple-touch-icon.png",
  ];
  const files = new Set([
    "index.html",
    "looks/looks.json",
    ...catalog.looks.map((look) => look.preview),
    ...Object.values(catalog.items).map((item) => item.file),
    "manifest.webmanifest",
    ...icons,
  ]);
  for (const file of files) await access(new URL(file, root));
  const sourceFiles = (
    await readdir(new URL("src/", root), { recursive: true })
  )
    .filter((file) => /\.(?:js|css)$/.test(file))
    .map((file) => `src/${file}`);
  const worker = await readFile(new URL("pwa/worker.js", root), "utf8");
  const hash = createHash("sha256").update(worker);
  for (const file of [...files, ...sourceFiles].sort())
    hash.update(file).update(await readFile(new URL(file, root)));
  const version = hash.digest("hex").slice(0, 16);
  const core = [
    "index.html",
    "looks/looks.json",
    "manifest.webmanifest",
    ...icons,
    ...sourceFiles,
  ];
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await cp(new URL("src/", root), new URL("src/", dist), { recursive: true });
  for (const file of files) {
    const target = new URL(file, dist);
    await mkdir(new URL(".", target), { recursive: true });
    if (file === "index.html") {
      const html = await readFile(new URL(file, root), "utf8");
      await writeFile(
        target,
        html.replace('content="development"', `content="${version}"`),
      );
    } else await cp(new URL(file, root), target);
  }
  await writeFile(
    new URL("sw.js", dist),
    worker
      .replace('"__BUILD_VERSION__"', JSON.stringify(version))
      .replace("/*__CORE_ASSETS__*/ []", JSON.stringify(core)),
  );
  await writeFile(new URL(".nojekyll", dist), "");
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
  await build();
