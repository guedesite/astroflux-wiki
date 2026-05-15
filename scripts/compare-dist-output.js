import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import { DIST_DIR, ROOT } from "./lib/project-paths.js";

const baselineDir = path.resolve(process.argv[2] || "");
const currentDir = path.resolve(process.argv[3] || DIST_DIR);

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!process.argv[2]) fail("Usage: node scripts/compare-dist-output.js <baseline-dist-dir> [current-dist-dir]");
if (!fs.existsSync(baselineDir)) fail(`Missing baseline directory: ${baselineDir}`);
if (!fs.existsSync(currentDir)) fail(`Missing current directory: ${currentDir}`);

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

function relativeFileMap(root) {
  return new Map(walk(root).map((file) => [path.relative(root, file).replaceAll("\\", "/"), file]));
}

function normalizedBytes(rel, file) {
  const data = fs.readFileSync(file);
  if (!rel.endsWith(".html")) return data;

  return Buffer.from(
    data.toString("utf8").replace(/\?v=[A-Za-z0-9_-]+(?=")/g, "?v=ASSET_VERSION"),
    "utf8"
  );
}

function hash(data) {
  return createHash("sha256").update(data).digest("hex");
}

const baseline = relativeFileMap(baselineDir);
const current = relativeFileMap(currentDir);
const missing = [...baseline.keys()].filter((file) => !current.has(file));
const added = [...current.keys()].filter((file) => !baseline.has(file));
const changed = [];

for (const rel of baseline.keys()) {
  if (!current.has(rel)) continue;
  if (hash(normalizedBytes(rel, baseline.get(rel))) !== hash(normalizedBytes(rel, current.get(rel)))) {
    changed.push(rel);
  }
}

if (missing.length || added.length || changed.length) {
  console.error("Static output differs from baseline");
  for (const [label, files] of [["Missing", missing], ["Added", added], ["Changed", changed]]) {
    if (!files.length) continue;
    console.error(`${label}: ${files.length}`);
    for (const file of files.slice(0, 20)) console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log(
  `Static output matches ${path.relative(ROOT, baselineDir) || baselineDir} against ${path.relative(ROOT, currentDir) || currentDir}`
);
