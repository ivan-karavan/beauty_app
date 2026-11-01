import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const root = new URL("../", import.meta.url);
const dist = new URL("dist/", root);

export async function build() {
  const catalog = JSON.parse(await readFile(new URL("looks/looks.json", root), "utf8"));
  const files = new Set([
    "index.html",
    "looks/looks.json",
    "looks/two-looks-preview.png",
    ...Object.values(catalog.items).map(item => item.file),
  ]);
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await cp(new URL("src/", root), new URL("src/", dist), { recursive: true });
  for (const file of files) {
    const target = new URL(file, dist);
    await mkdir(new URL(".", target), { recursive: true });
    await cp(new URL(file, root), target);
  }
  await writeFile(new URL(".nojekyll", dist), "");
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await build();
