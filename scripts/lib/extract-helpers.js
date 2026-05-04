import fs from "node:fs";
import path from "node:path";

import { BINARY_DIR } from "./project-paths.js";
import { titleFor } from "./record-utils.js";

export { titleFor } from "./record-utils.js";

export function findBinaryFile(token) {
  const files = fs.readdirSync(BINARY_DIR);
  const found = files.find((file) => file.includes(token));
  if (!found) {
    throw new Error(`Could not find ${token} in ${BINARY_DIR}`);
  }
  return path.join(BINARY_DIR, found);
}

export function slugify(value, fallback) {
  const text = String(value || fallback || "item")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return text || String(fallback || "item").toLowerCase().replace(/[^\w-]/g, "");
}

export function uniqueSlug(base, used) {
  let slug = base;
  let i = 2;
  while (used.has(slug)) {
    slug = `${base}-${i}`;
    i += 1;
  }
  used.add(slug);
  return slug;
}

export function compactStats(record) {
  const stats = {};
  for (const [key, value] of Object.entries(record || {})) {
    if (["string", "number", "boolean"].includes(typeof value)) {
      stats[key] = value;
    }
  }
  return stats;
}

export function normalizeTable(cache, table, slugRegistry) {
  const source = cache[table] || {};
  const used = slugRegistry[table] || new Set();
  slugRegistry[table] = used;
  return Object.entries(source).map(([key, record]) => {
    const name = titleFor(record, key);
    const slug = uniqueSlug(slugify(name, key), used);
    return {
      id: `${table}:${key}`,
      source_table: table,
      source_key: key,
      name,
      slug,
      type: record?.type ?? null,
      stats: compactStats(record)
    };
  });
}
