import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, "source");
const BINARY_DIR = path.join(SOURCE_DIR, "binaryData");
const DATA_DIR = path.join(ROOT, "data");
const RAW_DIR = path.join(DATA_DIR, "raw");
const INDEX_DIR = path.join(DATA_DIR, "index");
const CONTENT_DIR = path.join(ROOT, "content");

const PAGE_TABLES = {
  SolarSystems: { dir: "systems", title: "Solar Systems" },
  Bodies: { dir: "bodies", title: "Bodies" },
  Enemies: { dir: "enemies", title: "Enemies" },
  Bosses: { dir: "bosses", title: "Bosses" },
  Drops: { dir: "drops", title: "Drops" },
  Weapons: { dir: "weapons", title: "Weapons" },
  Projectiles: { dir: "projectiles", title: "Projectiles" },
  Ships: { dir: "ships", title: "Ships" },
  Engines: { dir: "engines", title: "Engines" },
  Turrets: { dir: "turrets", title: "Turrets" },
  Spawners: { dir: "spawners", title: "Spawners" },
  Commodities: { dir: "commodities", title: "Commodities" },
  ArtifactTypes: { dir: "artifacts", title: "Artifacts" },
  MissionTypes: { dir: "missions", title: "Missions" }
};

const INDEX_TABLES = [
  "SolarSystems",
  "Bodies",
  "BodyAreas",
  "Spawners",
  "Enemies",
  "Bosses",
  "Drops",
  "Weapons",
  "Projectiles",
  "Ships",
  "Skins",
  "Engines",
  "Turrets",
  "Commodities",
  "ArtifactTypes",
  "MissionTypes",
  "Images",
  "Sounds",
  "WarpPaths"
];

const REF_FIELDS = {
  SolarSystems: {
    background: "Images",
    musicAction: "Sounds",
    musicQuiet: "Sounds",
    musicStandard: "Sounds"
  },
  Bodies: {
    solarSystem: "SolarSystems",
    parent: "Bodies",
    bitmap: "Images",
    mission: "MissionTypes",
    payVaultItem: "PayVaultItems"
  },
  Spawners: {
    body: "Bodies",
    bitmap: "Images",
    enemy: "Enemies",
    enemy2: "Enemies",
    drops: "Drops",
    drops2: "Drops",
    explosionEffect: "Effects"
  },
  Enemies: {
    ship: "Ships",
    engine: "Engines",
    drops: "Drops"
  },
  Bosses: {
    bitmap: "Images",
    drops: "Drops",
    explosionEffect: "Effects",
    explosionSound: "Sounds"
  },
  Drops: {
    bitmap: "Images",
    effect: "Effects"
  },
  Weapons: {
    projectile: "Projectiles",
    techIcon: "Images",
    fireSound: "Sounds",
    hitSound: "Sounds",
    sound: "Sounds",
    fireEffect: "Effects",
    hitEffect: "Effects",
    dotEffect: "Effects"
  },
  Projectiles: {
    bitmap: "Images",
    explosionEffect: "Effects",
    impactEffect: "Effects",
    sound: "Sounds"
  },
  Ships: {
    bitmap: "Images",
    explosionEffect: "Effects",
    explosionSound: "Sounds"
  },
  Skins: {
    ship: "Ships",
    engine: "Engines",
    bitmap: "Images"
  },
  Engines: {
    bitmap: "Images",
    sound: "Sounds"
  },
  Turrets: {
    bitmap: "Images",
    weapon: "Weapons"
  },
  Commodities: {
    bitmap: "Images"
  },
  ArtifactTypes: {
    bitmap: "Images"
  }
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);
}

function findBinaryFile(token) {
  const files = fs.readdirSync(BINARY_DIR);
  const found = files.find((file) => file.includes(token));
  if (!found) {
    throw new Error(`Could not find ${token} in ${BINARY_DIR}`);
  }
  return path.join(BINARY_DIR, found);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function slugify(value, fallback) {
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

function uniqueSlug(base, used) {
  let slug = base;
  let i = 2;
  while (used.has(slug)) {
    slug = `${base}-${i}`;
    i += 1;
  }
  used.add(slug);
  return slug;
}

function titleFor(record, key) {
  return record?.name || record?.title || record?.fileName || record?.textureName || key;
}

function compactStats(record) {
  const stats = {};
  for (const [key, value] of Object.entries(record || {})) {
    if (["string", "number", "boolean"].includes(typeof value)) {
      stats[key] = value;
    }
  }
  return stats;
}

function normalizeTable(cache, table, slugRegistry) {
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

function isMeaningfulRef(value) {
  return typeof value === "string" && value.trim() !== "";
}

function hasRecord(cache, table, key) {
  return Boolean(cache[table] && Object.prototype.hasOwnProperty.call(cache[table], key));
}

function addEdge(graph, warnings, cache, fromTable, fromKey, rel, toTable, toKey, meta = {}) {
  if (!isMeaningfulRef(toKey)) return;
  const from = `${fromTable}:${fromKey}`;
  const to = `${toTable}:${toKey}`;
  if (!hasRecord(cache, toTable, toKey)) {
    warnings.push({
      type: "missing_reference",
      from,
      rel,
      to_table: toTable,
      to_key: toKey,
      meta
    });
    return;
  }
  graph.edges.push({ from, to, rel, ...meta });
  if (!graph.reverse[to]) graph.reverse[to] = [];
  graph.reverse[to].push({ from, rel, ...meta });
}

function addRefsFromValue(graph, warnings, cache, fromTable, fromKey, rel, toTable, value, meta = {}) {
  if (Array.isArray(value)) {
    for (const item of value) addRefsFromValue(graph, warnings, cache, fromTable, fromKey, rel, toTable, item, meta);
    return;
  }
  if (typeof value === "object" && value !== null) {
    if (isMeaningfulRef(value.key)) addEdge(graph, warnings, cache, fromTable, fromKey, rel, toTable, value.key, meta);
    if (isMeaningfulRef(value.item)) addEdge(graph, warnings, cache, fromTable, fromKey, rel, toTable, value.item, meta);
    return;
  }
  addEdge(graph, warnings, cache, fromTable, fromKey, rel, toTable, value, meta);
}

function buildGraph(cache) {
  const warnings = [];
  const graph = { nodes: [], edges: [], reverse: {} };

  for (const [table, records] of Object.entries(cache)) {
    for (const key of Object.keys(records || {})) {
      graph.nodes.push({ id: `${table}:${key}`, table, key });
    }
  }

  for (const [table, records] of Object.entries(cache)) {
    const fields = REF_FIELDS[table] || {};
    for (const [key, record] of Object.entries(records || {})) {
      for (const [field, toTable] of Object.entries(fields)) {
        addRefsFromValue(graph, warnings, cache, table, key, field, toTable, record[field], { field });
      }

      if (table === "Bodies") {
        addRefsFromValue(graph, warnings, cache, table, key, "exploreAreas", "BodyAreas", record.exploreAreas, { field: "exploreAreas" });
        addShopItemRefs(graph, warnings, cache, table, key, record.shopItems);
      }

      if (table === "Drops") {
        addDropItemRefs(graph, warnings, cache, table, key, record.dropItems);
      }

      if (table === "Enemies") {
        addRefsFromValue(graph, warnings, cache, table, key, "weapons", "Weapons", record.weapons, { field: "weapons" });
        addRefsFromValue(graph, warnings, cache, table, key, "enemies", "Enemies", record.enemies, { field: "enemies" });
      }

      if (table === "Bosses") {
        addRefsFromValue(graph, warnings, cache, table, key, "spawners", "Spawners", record.spawners, { field: "spawners" });
        addRefsFromValue(graph, warnings, cache, table, key, "turrets", "Turrets", record.turrets, { field: "turrets" });
      }

      if (table === "Weapons") {
        for (const techLevel of record.techLevels || []) {
          addRefsFromValue(graph, warnings, cache, table, key, "techLevelProjectile", "Projectiles", techLevel.projectile, {
            field: "techLevels.projectile",
            level: techLevel.id
          });
          addRefsFromValue(graph, warnings, cache, table, key, "techLevelMineral", "Commodities", techLevel.mineralType1 || techLevel.mineral_type_1, {
            field: "techLevels.mineralType1",
            level: techLevel.id
          });
          addRefsFromValue(graph, warnings, cache, table, key, "techLevelMineral", "Commodities", techLevel.mineralType2 || techLevel.mineral_type_2, {
            field: "techLevels.mineralType2",
            level: techLevel.id
          });
        }
      }

      if (table === "WarpPaths") {
        for (const [field, value] of Object.entries(record)) {
          if (/solar|system|from|to/i.test(field)) {
            addRefsFromValue(graph, warnings, cache, table, key, field, "SolarSystems", value, { field });
          }
        }
      }
    }
  }

  return { graph, warnings };
}

function addShopItemRefs(graph, warnings, cache, fromTable, fromKey, shopItems) {
  for (const item of shopItems || []) {
    const table = item?.table || item?.itemTable || item?.type;
    const key = item?.item || item?.key || item?.itemKey;
    if (table && key) {
      addEdge(graph, warnings, cache, fromTable, fromKey, "shopItem", table, key, { field: "shopItems" });
    }
  }
}

function addDropItemRefs(graph, warnings, cache, fromTable, fromKey, dropItems) {
  for (const item of dropItems || []) {
    if (item?.table && item?.item) {
      addEdge(graph, warnings, cache, fromTable, fromKey, "dropItem", item.table, item.item, {
        field: "dropItems",
        chance: item.chance,
        min: item.min,
        max: item.max
      });
    }
  }
}

function buildDropIndex(cache) {
  const drops = cache.Drops || {};
  return Object.entries(drops).map(([key, record]) => {
    const crateChance = record.crate ? Number(record.chance ?? 1) : 1;
    const items = (record.dropItems || []).map((item) => {
      const itemChance = Number(item.chance ?? 1);
      const target = cache[item.table]?.[item.item];
      return {
        table: item.table,
        key: item.item,
        name: target ? titleFor(target, item.item) : null,
        chance: itemChance,
        effective_chance: crateChance * itemChance,
        min: item.min ?? null,
        max: item.max ?? null
      };
    });
    return {
      id: `Drops:${key}`,
      source_key: key,
      name: titleFor(record, key),
      crate: Boolean(record.crate),
      crate_chance: crateChance,
      artifact_chance: record.artifactChance ?? null,
      flux_min: record.fluxMin ?? null,
      flux_max: record.fluxMax ?? null,
      xp_min: record.xpMin ?? null,
      xp_max: record.xpMax ?? null,
      items
    };
  });
}

function buildMapIndex(cache) {
  const systems = Object.entries(cache.SolarSystems || {}).map(([key, system]) => ({
    id: `SolarSystems:${key}`,
    key,
    name: titleFor(system, key),
    type: system.type ?? null,
    galaxy: system.galaxy ?? null,
    x: system.x ?? null,
    y: system.y ?? null,
    size: system.size ?? null
  }));

  const bodies = Object.entries(cache.Bodies || {}).map(([key, body]) => ({
    id: `Bodies:${key}`,
    key,
    name: titleFor(body, key),
    type: body.type ?? null,
    solar_system: body.solarSystem ? `SolarSystems:${body.solarSystem}` : null,
    parent: body.parent ? `Bodies:${body.parent}` : null,
    x: body.x ?? null,
    y: body.y ?? null,
    orbit_angle: body.orbitAngle ?? null,
    orbit_radius: body.orbitRadius ?? null,
    orbit_speed: body.orbitSpeed ?? null,
    landable: body.landable ?? null,
    explorable: body.explorable ?? null,
    level: body.level ?? null
  }));

  const warpPaths = Object.entries(cache.WarpPaths || {}).map(([key, warpPath]) => ({
    id: `WarpPaths:${key}`,
    key,
    name: titleFor(warpPath, key),
    stats: compactStats(warpPath)
  }));

  return { systems, bodies, warpPaths };
}

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
