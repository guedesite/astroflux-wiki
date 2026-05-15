import { ELITE_TECH_COST, WEAPON_ELITE_TECHS } from "./build-constants.js";
import { formatNumber, numberValue, percentLabel, rangeText, valueLabel } from "./display-utils.js";
import { dropSourceData, sourceSortScore } from "./drop-utils.js";
import { refKey } from "./entity-links.js";
import { escapeHtml } from "./html-utils.js";
import { titleFor } from "./record-utils.js";

export function weaponHits(record) {
  return Math.max(1, numberValue(record.numberOfHits, 1) * Math.max(1, numberValue(record.multiNrOfP, 1)));
}

export function weaponShotDamage(record) {
  return numberValue(record.dmg) * weaponHits(record);
}

export function weaponDps(record) {
  const reload = numberValue(record.reloadTime);
  if (!reload) return "";
  const direct = weaponShotDamage(record);
  const dot = numberValue(record.dot);
  return Math.round((direct + dot) * 1000 / reload);
}

export function weaponHeatPerSecond(record) {
  const reload = numberValue(record.reloadTime);
  if (!reload) return "";
  return Math.round(numberValue(record.heatCost) * 1000 / reload);
}

export function weaponTags(record) {
  const tags = [];
  if (numberValue(record.radius) > 0) tags.push("AoE");
  if (numberValue(record.dot) > 0 || numberValue(record.dotDuration) > 0) tags.push("DoT");
  if (numberValue(record.healthVamp) > 0) tags.push("Health leech");
  if (numberValue(record.shieldVamp) > 0) tags.push("Shield leech");
  if (numberValue(record.numberOfHits) > 1 || numberValue(record.multiNrOfP) > 1) tags.push("Multi-hit");
  if (record.hasChargeUp) tags.push("Charge");
  if (record.type) tags.push(record.type);
  return tags.slice(0, 5).join(", ");
}

export function weaponSourceSummary(weaponKey, cache) {
  const shops = Object.values(cache.Bodies || {}).reduce((sum, body) => sum + (body.shopItems || []).filter((item) => item.table === "Weapons" && item.item === weaponKey).length, 0);
  const drops = Object.values(cache.Drops || {}).reduce((sum, drop) => sum + (drop.dropItems || []).filter((item) => item.table === "Weapons" && item.item === weaponKey).length, 0);
  return { shops, drops, total: shops + drops };
}

export function weaponSourceRowsData(weaponKey, cache) {
  const rows = [];
  for (const [bodyKey, body] of Object.entries(cache.Bodies || {})) {
    for (const item of body.shopItems || []) {
      if (item.table !== "Weapons" || item.item !== weaponKey) continue;
      if (!item.available) continue;
      rows.push({
        table: "Bodies",
        key: bodyKey,
        type: "Shop",
        sourceName: titleFor(body, bodyKey),
        contextText: body.solarSystem ? titleFor(cache.SolarSystems?.[body.solarSystem], body.solarSystem) : "Shop",
        effective: 1,
        chanceText: valueLabel(item.available),
        price: (item.priceItems || []).map((p) => `${titleFor(cache.Commodities?.[p.item], p.item)} x${valueLabel(p.amount)}`).join(", ")
      });
    }
  }
  for (const [dropKey, drop] of Object.entries(cache.Drops || {})) {
    for (const item of drop.dropItems || []) {
      if (item.table !== "Weapons" || item.item !== weaponKey) continue;
      const crateChance = drop.crate ? numberValue(drop.chance, 1) : 1;
      const itemChance = numberValue(item.chance, 1);
      const sources = dropSourceData(dropKey, cache);
      if (!sources.length) {
        rows.push({
          table: "Drops",
          key: dropKey,
          type: "Drop table",
          sourceName: drop.name || dropKey,
          contextText: "Direct drop table",
          effective: crateChance * itemChance,
          chanceText: percentLabel(crateChance * itemChance),
          qty: rangeText(item.min, item.max)
        });
      }
      for (const source of sources) {
        rows.push({
          ...source,
          type: source.type === "Spawner" ? "Spawner drop" : `${source.type} drop`,
          sourceName: titleFor(cache[source.table]?.[source.key], source.key),
          contextText: source.table === "Spawners"
            ? `${source.body ? titleFor(cache.Bodies?.[source.body], source.body) : "No linked body"}${source.enemy ? ` / ${titleFor(cache.Enemies?.[source.enemy], source.enemy)}` : ""}`
            : source.context,
          dropKey,
          effective: numberValue(source.chance, 1) * crateChance * itemChance,
          chanceText: percentLabel(numberValue(source.chance, 1) * crateChance * itemChance),
          qty: rangeText(item.min, item.max)
        });
      }
    }
  }
  for (const [enemyKey, enemy] of Object.entries(cache.Enemies || {})) {
    if ((enemy.weapons || []).some((item) => refKey("Weapons", item) === weaponKey)) {
      rows.push({
        table: "Enemies",
        key: enemyKey,
        type: "Enemy loadout",
        sourceName: titleFor(enemy, enemyKey),
        contextText: `Level ${valueLabel(enemy.level)} uses this weapon`,
        effective: 0,
        chanceText: "Used by enemy"
      });
    }
  }
  return rows.sort((a, b) => sourceSortScore(b) - sourceSortScore(a));
}

export function isPlayerFacingWeapon(record) {
  if (!record?.name) return false;
  const name = record.name.toLowerCase();
  const enemyPrefixes = ["enemy ", "boss ", "emperor ", "wasp ", "moth ", "turret "];
  if (enemyPrefixes.some((prefix) => name.startsWith(prefix))) return false;
  if (name.includes("stress test")) return false;
  if (/\blvl\b/.test(name)) return false;
  return true;
}

export function eliteTechName(key) {
  return WEAPON_ELITE_TECHS.find(([id]) => id === key)?.[1] || key;
}

export function eliteCost(level, kind) {
  const total = ELITE_TECH_COST[kind] || ELITE_TECH_COST.primary;
  return Math.round(Math.pow(ELITE_TECH_COST.increase, level - 1) / ELITE_TECH_COST.sum * total);
}

export function eliteCostRange(from, to, kind) {
  let total = 0;
  for (let level = Math.max(1, from); level <= Math.min(100, to); level += 1) total += eliteCost(level, kind);
  return total;
}

export function weaponEliteRows(record) {
  const techs = record.eliteTechs || {};
  return WEAPON_ELITE_TECHS
    .filter(([key]) => numberValue(techs[key]) > 0)
    .map(([key, name]) => {
      const value = numberValue(techs[key]);
      const level1 = value / 100;
      const level100 = value;
      return `<tr><td>${escapeHtml(name)}</td><td><code>${escapeHtml(key)}</code></td><td>${escapeHtml(formatNumber(level1, 2))}</td><td>${escapeHtml(formatNumber(level100, 2))}</td><td>${escapeHtml(eliteTechHint(key, value))}</td></tr>`;
    })
    .join("");
}

export function eliteTechHint(key, value) {
  const amount = formatNumber(value, 2);
  if (key.includes("Dot5")) return `Adds ${amount}% total DoT over 5 seconds at level 100.`;
  if (key.includes("Dot10") || key.includes("Burn")) return `Adds ${amount}% total DoT over 10 seconds at level 100.`;
  if (key.includes("Dot20")) return `Adds ${amount}% total DoT over 20 seconds at level 100.`;
  if (key.includes("Penetration")) return `Reduces the matching resistance by ${amount}% at level 100.`;
  if (key === "AddAOE") return `Adds ${formatNumber(5 + value, 2)} radius units at level 100.`;
  if (key === "IncreaseNrHits") return `Adds ${Math.trunc(1 + value)} hit(s) at level 100.`;
  if (key === "AddExtraProjectiles") return "Changes projectile count and redistributes damage per projectile.";
  return `${amount}% effect at level 100.`;
}
