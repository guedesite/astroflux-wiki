import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import https from "node:https";

const ROOT = process.cwd();
const CACHE = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "raw", "cache.json"), "utf8"));
const GAME_ID = "rymdenrunt-k9qmg7cvt0ylialudmldvg";
const BASE = `http://r.playerio.com/r/${GAME_ID}`;
const OUT = path.join(ROOT, "source", "gamefs");

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
    req.setTimeout(15000, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

async function download(remotePath, outFile) {
  ensureDir(path.dirname(outFile));
  if (fs.existsSync(outFile) && fs.statSync(outFile).size > 0) return "exists";
  const data = await request(`${BASE}${remotePath}`);
  fs.writeFileSync(outFile, data);
  return "downloaded";
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

const textureFiles = unique([
  "texture_gui1_test.xml",
  "texture_gui1_test.png",
  "texture_gui2.xml",
  "texture_gui2.png",
  "texture_main_NEW.xml",
  "texture_main_NEW.png",
  "texture_body.xml",
  "texture_body.png",
  ...Object.values(CACHE.SolarSystems || {}).flatMap((system) => {
    const bg = CACHE.Images?.[system.background];
    return bg?.textureName ? [`${bg.textureName}.xml`, `${bg.textureName}.jpg`] : [];
  })
]);

const soundFiles = unique(Object.values(CACHE.Sounds || {}).map((sound) => `${sound.type}/${sound.fileName}`));

let ok = 0;
let failed = 0;

for (const file of textureFiles) {
  try {
    const status = await download(`/textures/${file}`, path.join(OUT, "textures", file));
    console.log(`${status}: textures/${file}`);
    ok += 1;
  } catch (error) {
    console.warn(`missing: textures/${file} (${error.message})`);
    failed += 1;
  }
}

for (const file of soundFiles) {
  try {
    const status = await download(`/sound/${file}`, path.join(OUT, "audio", file));
    console.log(`${status}: audio/${file}`);
    ok += 1;
  } catch (error) {
    console.warn(`missing: audio/${file} (${error.message})`);
    failed += 1;
  }
}

console.log(`GameFS asset fetch complete: ${ok} ok, ${failed} failed`);
