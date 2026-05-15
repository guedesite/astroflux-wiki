import { REF_FIELDS } from "./extract-config.js";

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

export function buildGraph(cache) {
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
