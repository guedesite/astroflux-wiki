import fs from "node:fs";
import path from "node:path";

import { PAGE_TABLES, INDEX_TABLES } from "./lib/extract-config.js";
import { buildGraph } from "./lib/extract-graph.js";
import { buildDropIndex, buildMapIndex } from "./lib/extract-indexes.js";
import { compactStats, findBinaryFile, normalizeTable, slugify, titleFor, uniqueSlug } from "./lib/extract-helpers.js";
import { cleanDir, ensureDir, readJson, writeJson } from "./lib/file-utils.js";
import { CONTENT_DIR, INDEX_DIR, RAW_DIR, ROOT, SOURCE_DIR } from "./lib/project-paths.js";

function yamlScalar(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(String(value));
}

function markdownValue(value) {
  if (value === null || value === undefined || value === "") return "n/a";
  if (Array.isArray(value) || typeof value === "object") return `\`${JSON.stringify(value)}\``;
  return String(value);
}

function graphLabel(cache, nodeId) {
  const [table, key] = nodeId.split(":");
  const record = cache[table]?.[key];
  if (!record) return nodeId;
  return `${titleFor(record, key)} (${table})`;
}

function buildMarkdown(cache, graph, table, key, record, slug) {
  const name = titleFor(record, key);
  const id = `${table}:${key}`;
  const reverse = graph.reverse[id] || [];
  const outgoing = graph.edges.filter((edge) => edge.from === id);
  const statEntries = Object.entries(compactStats(record)).filter(([field]) => !["key", "table"].includes(field));

  const lines = [
    "---",
    `id: ${yamlScalar(id)}`,
    `source_table: ${yamlScalar(table)}`,
    `source_key: ${yamlScalar(key)}`,
    `slug: ${yamlScalar(slug)}`,
    `name: ${yamlScalar(name)}`,
    `type: ${yamlScalar(record.type ?? null)}`,
    "---",
    "",
    `# ${name}`,
    "",
    "## Summary",
    "",
    `- Type: ${markdownValue(record.type)}`,
    ""
  ];

  if (statEntries.length > 0) {
    lines.push("## Stats", "", "| Field | Value |", "| --- | --- |");
    for (const [field, value] of statEntries.slice(0, 80)) {
      lines.push(`| \`${field}\` | ${markdownValue(value)} |`);
    }
    lines.push("");
  }

  if (table === "Drops") {
    const crateChance = record.crate ? Number(record.chance ?? 1) : 1;
    lines.push("## Drop Rolls", "", "| Item | Table | Chance | Effective Chance | Quantity |", "| --- | --- | ---: | ---: | --- |");
    for (const item of record.dropItems || []) {
      const itemChance = Number(item.chance ?? 1);
      const target = cache[item.table]?.[item.item];
      const itemName = target ? titleFor(target, item.item) : item.item;
      const qty = item.min || item.max ? `${item.min ?? "?"}-${item.max ?? "?"}` : "n/a";
      lines.push(`| ${itemName} | \`${item.table || "?"}\` | ${itemChance} | ${crateChance * itemChance} | ${qty} |`);
    }
    lines.push("");
  }

  if (outgoing.length > 0) {
    lines.push("## Links", "", "| Relation | Target |", "| --- | --- |");
    for (const edge of outgoing.slice(0, 120)) {
      lines.push(`| \`${edge.rel}\` | ${graphLabel(cache, edge.to)} |`);
    }
    lines.push("");
  }

  if (reverse.length > 0) {
    lines.push("## Referenced By", "", "| Relation | Source |", "| --- | --- |");
    for (const edge of reverse.slice(0, 120)) {
      lines.push(`| \`${edge.rel}\` | ${graphLabel(cache, edge.from)} |`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function generateMarkdown(cache, graph) {
  cleanDir(CONTENT_DIR);
  const slugRegistry = {};
  const manifest = {};

  for (const [table, config] of Object.entries(PAGE_TABLES)) {
    const tableDir = path.join(CONTENT_DIR, config.dir);
    ensureDir(tableDir);
    const used = new Set();
    slugRegistry[table] = used;
    manifest[table] = [];

    for (const [key, record] of Object.entries(cache[table] || {})) {
      const slug = uniqueSlug(slugify(titleFor(record, key), key), used);
      const markdown = buildMarkdown(cache, graph, table, key, record, `${config.dir}/${slug}`);
      fs.writeFileSync(path.join(tableDir, `${slug}.md`), markdown, "utf8");
      manifest[table].push({
        id: `${table}:${key}`,
        source_key: key,
        name: titleFor(record, key),
        slug: `${config.dir}/${slug}`,
        file: `content/${config.dir}/${slug}.md`
      });
    }
  }

  writeJson(path.join(INDEX_DIR, "content-manifest.json"), manifest);
}

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    throw new Error(`Missing source directory: ${SOURCE_DIR}`);
  }

  const cacheFile = findBinaryFile("cache_json");
  const langFile = findBinaryFile("lang_json");
  const cache = readJson(cacheFile);
  const lang = readJson(langFile);

  cleanDir(RAW_DIR);
  cleanDir(INDEX_DIR);
  writeJson(path.join(RAW_DIR, "cache.json"), cache);
  writeJson(path.join(RAW_DIR, "lang.json"), lang);

  const slugRegistry = {};
  const tableSummary = Object.fromEntries(
    Object.entries(cache)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([table, records]) => [table, Object.keys(records || {}).length])
  );

  writeJson(path.join(INDEX_DIR, "tables.json"), tableSummary);

  for (const table of INDEX_TABLES) {
    if (!cache[table]) continue;
    writeJson(path.join(INDEX_DIR, `${PAGE_TABLES[table]?.dir || table}.json`), normalizeTable(cache, table, slugRegistry));
  }

  const { graph, warnings } = buildGraph(cache);
  writeJson(path.join(INDEX_DIR, "graph.json"), graph);
  writeJson(path.join(INDEX_DIR, "warnings.json"), warnings);
  writeJson(path.join(INDEX_DIR, "drops-expanded.json"), buildDropIndex(cache));
  writeJson(path.join(INDEX_DIR, "galaxy-map.json"), buildMapIndex(cache));

  generateMarkdown(cache, graph);

  console.log(`Parsed ${Object.keys(cache).length} cache tables from ${path.relative(ROOT, cacheFile)}`);
  console.log(`Parsed ${Object.keys(lang).length} language dictionaries from ${path.relative(ROOT, langFile)}`);
  console.log(`Generated ${graph.nodes.length} graph nodes and ${graph.edges.length} valid edges`);
  console.log(`Wrote ${warnings.length} validation warnings`);
  console.log(`Generated Markdown under ${path.relative(ROOT, CONTENT_DIR)}`);
}

main();
