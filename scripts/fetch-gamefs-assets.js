import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import https from "node:https";

// The Steam build is an Electron shell that loads the live HTML5 client, so the
// authoritative game data lives on the public game host (and on the legacy
// PlayerIO gamefs CDN). This script rebuilds the local `source/` folder from it.
const ROOT = process.cwd();
const GAME_ID = "rymdenrunt-k9qmg7cvt0ylialudmldvg";
const BASES = [`https://astroflux.net`, `http://r.playerio.com/r/${GAME_ID}`];
const SOURCE = path.join(ROOT, "source");
const BINARY_DIR = path.join(SOURCE, "binaryData");
const GAMEFS = path.join(SOURCE, "gamefs");
const IMAGE_DIR = path.join(SOURCE, "images");

const FORCE = process.argv.includes("--force");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function request(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https:") ? https : http;
    const req = mod.get(url, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 5) {
        res.resume();
        resolve(request(new URL(res.headers.location, url).toString(), redirects + 1));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.setTimeout(30000, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

function remoteUrl(base, remotePath) {
  // encodeURI keeps `$`, `-`, `_`, `.` and `/` intact while escaping spaces and
  // non-ASCII characters, which is what both hosts expect.
  return `${base}/${encodeURI(remotePath.replace(/^\/+/, ""))}`;
}

async function fetchRemote(remotePath) {
  let lastError = null;
  for (const base of BASES) {
    try {
      return await request(remoteUrl(base, remotePath));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function download(remotePath, outFile, overwrite = false) {
  ensureDir(path.dirname(outFile));
  if (!FORCE && !overwrite && fs.existsSync(outFile) && fs.statSync(outFile).size > 0) return "exists";
  const data = await fetchRemote(remotePath);
  fs.writeFileSync(outFile, data);
  return "downloaded";
}

// The manifests are AS3-serialized: strings are stored as `y<length>:<value>`,
// and the value is URL-encoded (`ui%2Flogo.png`).
function parseManifest(bytes) {
  const assets = JSON.parse(bytes.toString("utf8")).assets;
  if (!assets) return [];
  const values = [];
  const re = /y(\d+):/g;
  let match;
  while ((match = re.exec(assets))) {
    const length = Number(match[1]);
    const value = assets.slice(re.lastIndex, re.lastIndex + length);
    re.lastIndex += length;
    if (/%2F|\//.test(value)) values.push(decodeURIComponent(value));
  }
  return [...new Set(values)];
}

async function readManifest(name) {
  return parseManifest(await fetchRemote(`manifest/${name}.json`));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function flattenAssetName(assetPath) {
  // `ui/logo.png` -> `ui_logo_png.png`. The build looks for names containing
  // `logo_png` / `bg_jpg`, so separators and dots become underscores, and the
  // extension is repeated at the end so the file is still treated as an image.
  const ext = path.extname(assetPath);
  const stem = assetPath.slice(0, assetPath.length - ext.length).replace(/^\/+/, "").replace(/[/\\]/g, "_");
  return `${stem}_${ext.slice(1)}${ext}`;
}

async function main() {
  ensureDir(BINARY_DIR);
  ensureDir(GAMEFS);
  ensureDir(IMAGE_DIR);

  let ok = 0;
  let failed = 0;
  const failures = [];

  async function attempt(remotePath, outFile, label, overwrite = false) {
    try {
      const status = await download(remotePath, outFile, overwrite);
      ok += 1;
      if (status === "downloaded") console.log(`${status}: ${label}`);
    } catch (error) {
      failed += 1;
      failures.push(`${label} (${error.message})`);
      console.warn(`missing: ${label} (${error.message})`);
    }
  }

  // The database is the authoritative version marker, so always refresh it;
  // bulk assets are kept unless --force is passed.
  console.log("Fetching game data...");
  await attempt("data/cache.json", path.join(BINARY_DIR, "cache_json.json"), "binaryData/cache_json.json", true);
  await attempt("data/lang.json", path.join(BINARY_DIR, "lang_json.json"), "binaryData/lang_json.json", true);

  const cacheFile = path.join(BINARY_DIR, "cache_json.json");
  if (!fs.existsSync(cacheFile)) {
    throw new Error("Could not fetch data/cache.json; the rest of the source cannot be derived.");
  }
  const cache = JSON.parse(fs.readFileSync(cacheFile, "utf8"));

  console.log("Fetching texture atlases...");
  let textureFiles = [];
  try {
    textureFiles = await readManifest("textures");
  } catch (error) {
    console.warn(`textures manifest unavailable (${error.message}); deriving atlases from cache`);
  }
  if (textureFiles.length === 0) {
    textureFiles = unique([
      "textures/texture_gui1_test.xml",
      "textures/texture_gui1_test.png",
      "textures/texture_gui2.xml",
      "textures/texture_gui2.png",
      "textures/texture_main_NEW.xml",
      "textures/texture_main_NEW.png",
      "textures/texture_body.xml",
      "textures/texture_body.png",
      ...Object.values(cache.SolarSystems || {}).flatMap((system) => {
        const bg = cache.Images?.[system.background];
        return bg?.textureName ? [`textures/${bg.textureName}.xml`, `textures/${bg.textureName}.jpg`] : [];
      })
    ]);
  }
  for (const file of textureFiles.filter((entry) => entry.startsWith("textures/"))) {
    const name = file.slice("textures/".length);
    await attempt(file, path.join(GAMEFS, "textures", name), `textures/${name}`);
  }

  console.log("Fetching sounds referenced by the cache...");
  const soundFiles = unique(Object.values(cache.Sounds || {}).map((sound) => `${sound.type}/${sound.fileName}`));
  for (const file of soundFiles) {
    await attempt(`sound/${file}`, path.join(GAMEFS, "audio", file), `audio/${file}`);
  }

  console.log("Fetching UI images...");
  const uiFiles = unique([
    ...(await readManifest("ui").catch(() => [])),
    ...(await readManifest("fonts").catch(() => []))
  ]).filter((file) => /\.(png|jpe?g|webp|gif)$/i.test(file));

  for (const file of uiFiles) {
    const outName = flattenAssetName(file);
    await attempt(file, path.join(IMAGE_DIR, outName), `images/${outName}`);
  }

  console.log(`GameFS asset fetch complete: ${ok} ok, ${failed} failed`);
  if (failures.length) {
    console.log("Unavailable assets:");
    for (const failure of failures) console.log(`- ${failure}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
