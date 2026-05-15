import { numberValue, rangeText, valueLabel } from "./display-utils.js";
import { refKey } from "./entity-links.js";

export function normalizeDropRefs(value) {
  const items = Array.isArray(value) ? value : (value ? [value] : []);
  return items
    .map((item) => {
      const key = refKey("Drops", item);
      if (!key) return null;
      return {
        key,
        chance: typeof item === "object" ? numberValue(item.chance, 1) : 1,
        qty: typeof item === "object" ? rangeText(item.min, item.max) : ""
      };
    })
    .filter(Boolean);
}

export function dedupeDropRefs(dropRefs) {
  const seen = new Set();
  return dropRefs.filter((dropRef) => {
    const signature = `${dropRef.key}|${dropRef.chance}|${dropRef.qty || ""}`;
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

export function dropSourceData(dropKey, cache) {
  const rows = [];
  for (const [enemyKey, enemy] of Object.entries(cache.Enemies || {})) {
    for (const dropRef of normalizeDropRefs(enemy.drops)) {
      if (dropRef.key !== dropKey) continue;
      rows.push({ table: "Enemies", key: enemyKey, type: "Enemy", chance: dropRef.chance, qty: dropRef.qty, level: enemy.level, context: `Level ${valueLabel(enemy.level)}` });
    }
  }
  for (const [bossKey, boss] of Object.entries(cache.Bosses || {})) {
    for (const dropRef of normalizeDropRefs(boss.drops)) {
      if (dropRef.key !== dropKey) continue;
      rows.push({ table: "Bosses", key: bossKey, type: "Boss", chance: dropRef.chance, qty: dropRef.qty, level: boss.level, context: `Level ${valueLabel(boss.level)}` });
    }
  }
  for (const [spawnerKey, spawner] of Object.entries(cache.Spawners || {})) {
    for (const item of [...(spawner.drops || []), ...(spawner.drops2 || [])]) {
      if (item.drop === dropKey || refKey("Drops", item) === dropKey) {
        const enemyKey = spawner.enemy || refKey("Enemies", (spawner.enemies || [])[0]);
        const bossKey = typeof spawner.bossSpawner === "string" ? spawner.bossSpawner : typeof spawner.bossSpawner2 === "string" ? spawner.bossSpawner2 : "";
        rows.push({
          table: "Spawners",
          key: spawnerKey,
          type: "Spawner",
          chance: numberValue(item.chance, 1),
          qty: rangeText(item.min, item.max),
          level: spawner.level,
          body: spawner.body,
          enemy: enemyKey,
          boss: bossKey,
          hidden: spawner.hidden,
          context: spawner.body || "No linked body"
        });
      }
    }
  }
  return rows;
}

export function sourceSortScore(row) {
  const name = `${row.sourceName || ""} ${row.contextText || ""}`.toLowerCase();
  const penalty = /dev|test|dummy/.test(name) || row.hidden ? -10 : 0;
  return Number(row.effective || 0) + penalty;
}
