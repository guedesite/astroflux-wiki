import fs from "node:fs";
import path from "node:path";

import {
  ARTIFACT_STAT_LABELS,
  DAMAGE_TYPES,
  DESTROYED_SYSTEMS,
  ELITE_TECH_COST,
  GUIDE_PAGES,
  STATION_TYPES,
  UNIQUE_ARTIFACT_BUILD_HINTS,
  UNIQUE_ARTIFACT_DESCRIPTIONS,
  UNIQUE_ARTIFACT_ICON_HINTS,
  UNIQUE_ARTIFACT_STATS,
  UNIQUE_ARTIFACT_TYPES,
  WEAPON_ELITE_TECHS
} from "./lib/build-constants.js";
import { writeAssets } from "./lib/build-assets.js";
import { cleanDir, ensureDir, readJson } from "./lib/file-utils.js";
import { CONTENT_DIR, DIST_DIR, INDEX_DIR, RAW_DIR, ROOT, ROOT_INDEX_FILE, SOURCE_DIR } from "./lib/project-paths.js";
import { titleFor } from "./lib/record-utils.js";
import { writeRootIndexPage } from "./lib/root-index.js";
import { siteBaseHref, stripLeadingSlashSiteUrls } from "./lib/site-url-utils.js";

const ASSET_VERSION = Date.now().toString(36);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function stripFrontmatter(markdown) {
  if (!markdown.startsWith("---")) return markdown;
  const end = markdown.indexOf("\n---", 3);
  if (end === -1) return markdown;
  return markdown.slice(end + 5).trimStart();
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function slugify(value) {
  return String(value || "item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function routeForEntry(entry) {
  const [table] = entry.id.split(":");
  const slug = table === "Bodies" ? entry.slug.replace(/^bodies\//, "stations/") : entry.slug;
  return `/${slug}.html`;
}

function routeMap(manifest, cache = null) {
  const routes = new Map();
  for (const entries of Object.values(manifest)) {
    for (const entry of entries) {
      const [table, key] = entry.id.split(":");
      if (cache && table === "SolarSystems" && !isVisibleMapSystem(cache.SolarSystems?.[key], key)) continue;
      routes.set(entry.id, routeForEntry(entry));
    }
  }
  if (cache) {
    for (const item of uniqueArtifactCatalog(cache)) {
      routes.set(`UniqueArtifacts:${item.key}`, item.url);
    }
  }
  return routes;
}

function entityLink(table, key, cache, routes, fallback = null) {
  key = refKey(table, key);
  if (!table || !key) return missingValue("n/a");
  const id = `${table}:${key}`;
  const record = cache[table]?.[key];
  const label = fallback || (record ? titleFor(record, key) : key);
  const href = routes.get(id);
  return href ? `<a href="${escapeAttr(href)}">${escapeHtml(label)}</a>` : `<span>${escapeHtml(label)}</span>`;
}

function missingValue(label = "n/a") {
  return `<span class="missing-value">${escapeHtml(label)}</span>`;
}

function refKey(table, value) {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) return value.map((item) => refKey(table, item)).find(Boolean) || "";
  if (typeof value !== "object") return value;
  const byTable = {
    Weapons: "weapon",
    Projectiles: "projectile",
    Ships: "ship",
    Engines: "engine",
    Drops: "drops",
    Enemies: "enemy",
    Bosses: "boss",
    Bodies: "body",
    Commodities: "item"
  };
  return value[byTable[table]] || value.drop || value.key || value.id || value.item || value.weapon || "";
}

function entityLinks(table, value, cache, routes) {
  if (!Array.isArray(value)) return entityLink(table, value, cache, routes);
  const links = value.map((item) => entityLink(table, item, cache, routes)).filter((html) => !html.includes('class="missing-value"'));
  return links.length ? links.join(", ") : missingValue();
}

function soundLink(key, cache, routes) {
  return cache.Sounds?.[key] ? entityLink("Sounds", key, cache, routes) : missingValue();
}

function valueLabel(value) {
  if (value === null || value === undefined || value === "") return "n/a";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
  return String(value);
}
function coordinateLabel(value) {
  if (value === null || value === undefined || value === "") return "n/a";
  const num = Number(value);
  if (!Number.isFinite(num)) return "n/a";
  return formatNumber(num * 0.025, 3);
}

function statCard(label, value, hint = "") {
  const missing = value === null || value === undefined || value === "";
  return `<div class="stat-card"><span>${escapeHtml(label)}</span><strong${missing ? ' class="missing-value"' : ""}>${missing ? escapeHtml("n/a") : escapeHtml(valueLabel(value))}</strong>${hint ? `<small>${escapeHtml(hint)}</small>` : ""}</div>`;
}

function tip(label, text) {
  return `<span class="tip" title="${escapeAttr(text)}">${escapeHtml(label)}</span>`;
}

function damageTypeLabel(type) {
  if (type === null || type === undefined || type === "") return "n/a";
  return DAMAGE_TYPES[Number(type)] || `Type ${type}`;
}

function numberValue(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function percentLabel(value) {
  if (value === null || value === undefined || value === "") return "n/a";
  const num = Number(value);
  if (!Number.isFinite(num)) return valueLabel(value);
  return `${(num * 100).toFixed(num < 0.01 && num > 0 ? 2 : 1).replace(/\.0$/, "")}%`;
}

function rangeText(min, max) {
  const a = valueLabel(min);
  const b = valueLabel(max);
  return a === b ? a : `${a}-${b}`;
}

function formatNumber(value, digits = 1) {
  const num = Number(value);
  if (!Number.isFinite(num)) return valueLabel(value);
  if (Math.abs(num) >= 1000) return Math.round(num).toLocaleString("en-US");
  return num.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function weaponHits(record) {
  return Math.max(1, numberValue(record.numberOfHits, 1) * Math.max(1, numberValue(record.multiNrOfP, 1)));
}

function weaponShotDamage(record) {
  return numberValue(record.dmg) * weaponHits(record);
}

function weaponDps(record) {
  const reload = numberValue(record.reloadTime);
  if (!reload) return "";
  const direct = weaponShotDamage(record);
  const dot = numberValue(record.dot);
  return Math.round((direct + dot) * 1000 / reload);
}

function weaponHeatPerSecond(record) {
  const reload = numberValue(record.reloadTime);
  if (!reload) return "";
  return Math.round(numberValue(record.heatCost) * 1000 / reload);
}

function weaponTags(record) {
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

function weaponSourceSummary(weaponKey, cache) {
  const shops = Object.values(cache.Bodies || {}).reduce((sum, body) => sum + (body.shopItems || []).filter((item) => item.table === "Weapons" && item.item === weaponKey).length, 0);
  const drops = Object.values(cache.Drops || {}).reduce((sum, drop) => sum + (drop.dropItems || []).filter((item) => item.table === "Weapons" && item.item === weaponKey).length, 0);
  return { shops, drops, total: shops + drops };
}

function isPlayerFacingWeapon(record) {
  if (!record?.name) return false;
  const name = record.name.toLowerCase();
  const enemyPrefixes = ["enemy ", "boss ", "emperor ", "wasp ", "moth ", "turret "];
  if (enemyPrefixes.some((prefix) => name.startsWith(prefix))) return false;
  if (name.includes("stress test")) return false;
  if (/\blvl\b/.test(name)) return false;
  return true;
}

function cleanText(value) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function renderDescription(value) {
  const text = cleanText(value);
  if (!text) return "";
  const lines = text.split("\n").map((line) => line.replace(/^-\s*/, "").trim()).filter(Boolean);
  if (lines.length > 1) return `<ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`; 
  return `<p>${escapeHtml(lines[0] || text)}</p>`;
  return `<p>${escapeHtml(lines[0] || text)}</p>`;
}

function enemyShipStats(record, cache) {
  const ship = cache.Ships?.[record.ship] || {};
  const hpMax = numberValue(ship.hp, "");
  const shieldMax = numberValue(ship.shieldHp, "");
  const startHp = record.startHp !== undefined && hpMax !== "" ? Math.round(hpMax * numberValue(record.startHp, 100) / 100) : hpMax;
  return {
    hpMax,
    startHp,
    shieldMax: numberValue(ship.shieldHp, ""),
    armor: numberValue(ship.armor, ""),
    body: ship.name || ""
  };
}

function enemyHp(record, cache) {
  return enemyShipStats(record, cache).hpMax;
}

function bossHpStats(record, cache) {
  const directHp = numberValue(record.hp, "");
  const shipHp = numberValue(cache.Ships?.[record.ship]?.hp, "");
  const bodyHps = (record.basicObjs || [])
    .map((part) => numberValue(part?.hp, 0))
    .filter((hp) => hp > 0);
  const turretHps = (record.turrets || [])
    .map((part) => numberValue(cache.Ships?.[cache.Turrets?.[part?.turret]?.body]?.hp, 0))
    .filter((hp) => hp > 0);
  const spawnerHps = (record.spawners || [])
    .map((part) => numberValue(cache.Spawners?.[part?.spawner]?.hp, 0))
    .filter((hp) => hp > 0);
  const partHps = [...bodyHps, ...turretHps, ...spawnerHps];
  const totalPartHp = partHps.reduce((sum, hp) => sum + hp, 0);
  const highestPartHp = partHps.length ? Math.max(...partHps) : "";
  const displayHp = directHp !== "" ? directHp : shipHp !== "" ? shipHp : totalPartHp || "";
  const source = directHp !== ""
    ? "boss record"
    : shipHp !== ""
      ? "linked ship"
      : totalPartHp
        ? "sum of body/turret/spawner HP"
        : "";
  return {
    displayHp,
    source,
    totalPartHp: totalPartHp || "",
    highestPartHp,
    destructibleParts: partHps.length
  };
}

function enemyTraitItems(record) {
  const flags = [
    ["miniBoss", "Mini-boss", "Higher stat variant; treat it as tougher than the base enemy."],
    ["melee", "Melee", "Tries to fight at close range, often punishing slow ships."],
    ["kamikaze", "Kamikaze", "Can explode or self-damage near the target."],
    ["teleport", "Teleport", "Can reposition and break simple kiting patterns."],
    ["cloak", "Cloak", "Can hide or interrupt normal target reading."],
    ["healer", "Healer", "Can restore allies or targets; usually a priority kill."],
    ["grab", "Grab", "Can pull or hold the player."],
    ["sniper", "Sniper", "Has a long-range behavior profile."],
    ["flee", "Flees", "May run away after taking damage."]
  ];
  return flags.filter(([field]) => record[field]).map(([, label, hint]) => ({ label, hint }));
}

function enemyTraits(record, html = false) {
  const items = enemyTraitItems(record);
  if (!items.length) return html ? tip("Standard", "No special AI flag was found in the enemy record.") : "Standard";
  if (!html) return items.map((item) => item.label).join(", ");
  return items.map((item) => tip(item.label, item.hint)).join(", ");
}

function renderSpawnerDropItems(items, cache, routes) {
  if (!Array.isArray(items) || !items.length) return "<span>n/a</span>";
  const links = items
    .map((item) => {
      if (typeof item === "object" && item?.drop) return `${entityLink("Drops", item.drop, cache, routes)}${item.chance !== undefined ? ` <span class="muted">${percentLabel(item.chance)}</span>` : ""}`;
      return entityLink("Drops", item, cache, routes);
    })
    .filter(Boolean)
    .slice(0, 5);
  return links.length ? links.join("<br>") : "<span>n/a</span>";
}

function normalizeDropRefs(value) {
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

function dedupeDropRefs(dropRefs) {
  const seen = new Set();
  return dropRefs.filter((dropRef) => {
    const signature = `${dropRef.key}|${dropRef.chance}|${dropRef.qty || ""}`;
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function linkedEnemySpawners(enemyKey, cache) {
  return Object.entries(cache.Spawners || {}).filter(([, spawner]) =>
    spawner.enemy === enemyKey
    || spawner.enemy2 === enemyKey
    || (spawner.enemies || []).some((item) => refKey("Enemies", item) === enemyKey)
  );
}

function enemyDropRefs(enemyKey, record, cache) {
  return dedupeDropRefs([
    ...normalizeDropRefs(record?.drops),
    ...linkedEnemySpawners(enemyKey, cache).flatMap(([, spawner]) => normalizeDropRefs([...(spawner.drops || []), ...(spawner.drops2 || [])]))
  ]);
}

function dropSourceData(dropKey, cache) {
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

function dropSourceLocationHtml(source, cache, routes) {
  const location = sourceLocationInfo(source, cache);
  if (!location) return missingValue("n/a");
  return `${entityLink("Bodies", location.bodyKey, cache, routes, location.bodyName)}${location.extraLocations ? `<br><span class="muted">+${escapeHtml(valueLabel(location.extraLocations))} more</span>` : ""}`;
}

function dropSourceSystemHtml(source, cache, routes) {
  const location = sourceLocationInfo(source, cache);
  return location ? entityLink("SolarSystems", location.systemKey, cache, routes, location.systemName) : missingValue("n/a");
}

function dropSourceContextHtml(source, cache, routes) {
  if (source.table === "Spawners") {
    const parts = [];
    if (source.enemy) parts.push(`Enemy: ${entityLink("Enemies", source.enemy, cache, routes)}`);
    if (source.boss) parts.push(`Boss: ${entityLink("Bosses", source.boss, cache, routes)}`);
    if (source.level !== undefined && source.level !== "") parts.push(`Level ${escapeHtml(valueLabel(source.level))}`);
    return parts.length ? parts.join("<br>") : "<span class=\"muted\">Spawner source</span>";
  }
  return escapeHtml(source.context || "");
}

function dropSourceRows(dropKey, cache, routes) {
  return dropSourceData(dropKey, cache)
    .sort((a, b) => numberValue(b.chance, 0) - numberValue(a.chance, 0) || String(a.type).localeCompare(String(b.type)) || String(a.key).localeCompare(String(b.key)))
    .slice(0, 120)
    .map((source) => `<tr><td>${entityLink(source.table, source.key, cache, routes)}</td><td>${escapeHtml(source.type)}</td><td>${dropSourceSystemHtml(source, cache, routes)}</td><td>${dropSourceLocationHtml(source, cache, routes)}</td><td>${dropSourceContextHtml(source, cache, routes)}</td><td>${escapeHtml(percentLabel(source.chance))}</td><td>${escapeHtml(source.qty || "n/a")}</td></tr>`)
    .join("");
}

function dropSourceSummary(dropKey, cache, routes) {
  const sources = dropSourceData(dropKey, cache).slice(0, 3);
  if (!sources.length) return "<span class=\"muted\">No direct enemy, boss, or spawner reference found in cache</span>";
  return sources.map((source) => {
    const system = sourceLocationInfo(source, cache)?.systemName || "";
    const location = sourceLocationInfo(source, cache)?.bodyName || "";
    const context = source.table === "Spawners"
      ? `${location || "unknown body"}${source.enemy ? ` / ${titleFor(cache.Enemies?.[source.enemy], source.enemy)}` : ""}${source.boss ? ` / ${titleFor(cache.Bosses?.[source.boss], source.boss)}` : ""}`
      : `${system ? `${system} / ` : ""}${source.context || ""}`;
    return `${entityLink(source.table, source.key, cache, routes)}<br><span class="muted">${escapeHtml(context)}${context ? " / " : ""}${escapeHtml(percentLabel(source.chance))}</span>`;
  }).join("<br>");
}

function dropKindLabel(drop) {
  if (!drop) return "Drop table";
  const name = String(drop.name || "").toLowerCase();
  if (name.includes("unique artifact")) return "Unique artifact crate";
  if (drop.crate && (numberValue(drop.artifactChance, 0) > 0 || numberValue(drop.artifactLevel, 0) > 0 || name.includes("artifact"))) return "Artifact crate";
  if (drop.crate) return "Crate";
  if (numberValue(drop.artifactChance, 0) > 0 || numberValue(drop.artifactLevel, 0) > 0 || name.includes("artifact")) return "Artifact roll";
  return "Drop table";
}

function entityThumbLinkHtml(table, key, cache, media, routes, fallback = null) {
  if (!table || !key) return fallback ? `<span>${escapeHtml(fallback)}</span>` : "<span>n/a</span>";
  const record = cache[table]?.[key];
  const imageKey = record ? primaryImageKey(table, record, cache) : "";
  const image = imageKey ? cache.Images?.[imageKey] : null;
  const icon = image ? renderImageThumb(image, media) : "";
  return `${icon}${entityLink(table, key, cache, routes, fallback)}`;
}

function sourceDropSummaryRows(dropRefs, cache, routes) {
  return dropRefs
    .map((dropRef) => {
      const drop = cache.Drops?.[dropRef.key];
      if (!drop) return "";
      const sourceChance = numberValue(dropRef.chance, 1);
      const crateChance = drop.crate ? numberValue(drop.chance, 1) : 1;
      const effectiveOpen = sourceChance * crateChance;
      const rewardCount = numberValue(drop.artifactAmount, 0) > 0
        ? `${valueLabel(drop.artifactAmount)} artifact roll${numberValue(drop.artifactAmount, 0) === 1 ? "" : "s"}`
        : `${valueLabel((drop.dropItems || []).length)} item row${(drop.dropItems || []).length === 1 ? "" : "s"}`;
      return {
        sort: effectiveOpen,
        html: `<tr><td>${entityLink("Drops", dropRef.key, cache, routes, drop.name || dropRef.key)}</td><td>${escapeHtml(dropKindLabel(drop))}</td><td>${escapeHtml(percentLabel(sourceChance))}</td><td>${escapeHtml(percentLabel(crateChance))}</td><td>${escapeHtml(percentLabel(effectiveOpen))}</td><td>${escapeHtml(dropRef.qty || "1")}</td><td>${escapeHtml(valueLabel(drop.artifactLevel || ""))}</td><td>${escapeHtml(percentLabel(drop.artifactChance))}</td><td>${escapeHtml(rangeText(drop.xpMin, drop.xpMax))}</td><td>${escapeHtml(rangeText(drop.fluxMin, drop.fluxMax))}</td><td>${escapeHtml(rewardCount)}</td></tr>`
      };
    })
    .filter((row) => row.html)
    .sort((a, b) => b.sort - a.sort)
    .map((row) => row.html)
    .join("");
}

function sourceDropRewardRows(dropRefs, cache, media, routes) {
  const rows = [];
  for (const dropRef of dropRefs) {
    const drop = cache.Drops?.[dropRef.key];
    if (!drop) continue;
    const sourceChance = numberValue(dropRef.chance, 1);
    const crateChance = drop.crate ? numberValue(drop.chance, 1) : 1;
    for (const item of drop.dropItems || []) {
      const table = item.table || "";
      const key = item.item || refKey(table, item);
      const itemChance = numberValue(item.chance, 1);
      const effective = sourceChance * crateChance * itemChance;
      const searchText = `${drop.name || dropRef.key} ${table} ${titleFor(cache[table]?.[key], key)} ${dropKindLabel(drop)}`;
      rows.push({
        effective,
        searchText,
        html: `<tr data-search="${escapeAttr(searchText)}"><td>${entityThumbLinkHtml(table, key, cache, media, routes)}</td><td>${escapeHtml(valueLabel(table))}</td><td>${entityLink("Drops", dropRef.key, cache, routes, drop.name || dropRef.key)}</td><td>${escapeHtml(percentLabel(sourceChance))}</td><td>${escapeHtml(percentLabel(itemChance))}</td><td>${escapeHtml(percentLabel(effective))}</td><td>${escapeHtml(rangeText(item.min, item.max))}</td><td>${escapeHtml(valueLabel(drop.artifactLevel || ""))}</td></tr>`
      });
    }
  }
  return rows
    .sort((a, b) => b.effective - a.effective || a.searchText.localeCompare(b.searchText))
    .slice(0, 220)
    .map((row) => row.html)
    .join("");
}

function renderSourceDropArticles(label, dropRefs, cache, media, routes) {
  if (!dropRefs.length) return `<article><h2>${escapeHtml(label)} Loot</h2><p class="muted">No direct drop table is linked from the downloaded client cache for this source.</p></article>`;
  const summaryRows = sourceDropSummaryRows(dropRefs, cache, routes);
  const rewardRows = sourceDropRewardRows(dropRefs, cache, media, routes);
  return [
    `<article><h2>${escapeHtml(label)} Loot Tables</h2><input class="table-filter" name="table-filter" placeholder="Filter loot tables"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Drop table</th><th>Type</th><th>Source chance</th><th>Crate open</th><th>Effective open</th><th>Qty / rolls</th><th>Artifact lvl</th><th>Artifact chance</th><th>XP</th><th>Flux</th><th>Rewards</th></tr></thead><tbody>${summaryRows}</tbody></table></div></article>`,
    rewardRows ? `<article><h2>Possible Rewards</h2><input class="table-filter" name="table-filter" placeholder="Filter rewards"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Reward</th><th>Table</th><th>From drop</th><th>Source chance</th><th>Item chance</th><th>Effective</th><th>Qty</th><th>Artifact lvl</th></tr></thead><tbody>${rewardRows}</tbody></table></div></article>` : ""
  ].filter(Boolean).join("");
}

function sourceSortScore(row) {
  const name = `${row.sourceName || ""} ${row.contextText || ""}`.toLowerCase();
  const penalty = /dev|test|dummy/.test(name) || row.hidden ? -10 : 0;
  return Number(row.effective || 0) + penalty;
}

function commoditySourceRowsData(itemKey, cache) {
  const rows = [];
  for (const [dropKey, drop] of Object.entries(cache.Drops || {})) {
    for (const item of drop.dropItems || []) {
      if (item.table !== "Commodities" || item.item !== itemKey) continue;
      const crateChance = drop.crate ? numberValue(drop.chance, 1) : 1;
      const itemChance = numberValue(item.chance, 1);
      const sources = dropSourceData(dropKey, cache);
      const base = {
        dropKey,
        dropName: drop.name || dropKey,
        qty: rangeText(item.min, item.max),
        itemChance,
        crateChance
      };
      if (!sources.length) {
        rows.push({
          ...base,
          table: "Drops",
          key: dropKey,
          sourceName: drop.name || dropKey,
          contextText: drop.type === "mission" ? "Mission reward table" : "Drop table",
          effective: crateChance * itemChance,
          chanceText: percentLabel(crateChance * itemChance)
        });
      }
      for (const source of sources) {
        const sourceName = titleFor(cache[source.table]?.[source.key], source.key);
        const bodyName = source.body ? titleFor(cache.Bodies?.[source.body], source.body) : "No linked body";
        const contextText = source.table === "Spawners"
          ? `${bodyName}${source.enemy ? ` / ${titleFor(cache.Enemies?.[source.enemy], source.enemy)}` : ""}${source.boss ? ` / ${titleFor(cache.Bosses?.[source.boss], source.boss)}` : ""}`
          : source.context;
        rows.push({
          ...base,
          ...source,
          sourceName,
          contextText,
          effective: numberValue(source.chance, 1) * crateChance * itemChance,
          chanceText: percentLabel(numberValue(source.chance, 1) * crateChance * itemChance)
        });
      }
    }
  }
  return rows.sort((a, b) => sourceSortScore(b) - sourceSortScore(a));
}

function weaponSourceRowsData(weaponKey, cache) {
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

function eliteTechName(key) {
  return WEAPON_ELITE_TECHS.find(([id]) => id === key)?.[1] || key;
}

function eliteCost(level, kind) {
  const total = ELITE_TECH_COST[kind] || ELITE_TECH_COST.primary;
  return Math.round(Math.pow(ELITE_TECH_COST.increase, level - 1) / ELITE_TECH_COST.sum * total);
}

function eliteCostRange(from, to, kind) {
  let total = 0;
  for (let level = Math.max(1, from); level <= Math.min(100, to); level += 1) total += eliteCost(level, kind);
  return total;
}

function weaponEliteRows(record) {
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

function eliteTechHint(key, value) {
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

function artifactBaseType(type) {
  return String(type || "").replace(/[23]$/, "");
}

function artifactStatLabel(type) {
  return ARTIFACT_STAT_LABELS[type] || ARTIFACT_STAT_LABELS[artifactBaseType(type)] || valueLabel(type);
}

function artifactStatValue(type, value) {
  const base = artifactBaseType(type);
  const v = numberValue(value);
  switch (base) {
    case "healthAdd": return `${formatNumber(2 * v)} health`;
    case "healthMulti": return `${formatNumber(1.35 * v)}% health`;
    case "armorAdd": return `${formatNumber(7.5 * v)} armor`;
    case "armorMulti": return `${formatNumber(v)}% armor`;
    case "corrosiveAdd": return `${formatNumber(4 * v)} corrosive damage`;
    case "corrosiveMulti": return `${formatNumber(v)}% corrosive damage`;
    case "energyAdd": return `${formatNumber(4 * v)} energy damage`;
    case "energyMulti": return `${formatNumber(v)}% energy damage`;
    case "kineticAdd": return `${formatNumber(4 * v)} kinetic damage`;
    case "kineticMulti": return `${formatNumber(v)}% kinetic damage`;
    case "shieldAdd": return `${formatNumber(1.75 * v)} shield`;
    case "shieldMulti": return `${formatNumber(1.35 * v)}% shield`;
    case "allAdd": return `${formatNumber(1.5 * v)} all damage`;
    case "allMulti": return `${formatNumber(1.5 * v)}% all damage`;
    case "speed": return `${formatNumber(0.2 * v, 2)}% speed`;
    case "refire": return `${formatNumber(0.3 * v)}% attack speed`;
    case "convHp": return `-${formatNumber(Math.min(100, 0.1 * v))}% HP to 150% shield`;
    case "convShield": return `-${formatNumber(Math.min(100, 0.1 * v))}% shield to 150% HP`;
    case "powerReg": return `${formatNumber(0.15 * v)}% power regen`;
    case "powerMax": return `${formatNumber(1.5 * v)}% maximum power`;
    case "cooldown": return `${formatNumber(0.1 * v)}% cooldown reduction`;
    default:
      if (base.includes("Resist") || base.includes("Reduction") || base === "shieldRegen" || base === "dotDamage" || base === "dotDuration" || base === "directDamage" || base === "healthRegenAdd" || base === "shieldVamp" || base === "healthVamp") {
        return `${formatNumber(v)}% ${artifactStatLabel(type).toLowerCase()}`;
      }
      return `${formatNumber(v)} ${artifactStatLabel(type).toLowerCase()}`;
  }
}

function artifactStatNumber(type, value) {
  const base = artifactBaseType(type);
  const v = numberValue(value);
  switch (base) {
    case "healthAdd": return 2 * v;
    case "healthMulti": return 1.35 * v;
    case "armorAdd": return 7.5 * v;
    case "corrosiveAdd":
    case "energyAdd":
    case "kineticAdd": return 4 * v;
    case "shieldAdd": return 1.75 * v;
    case "shieldMulti": return 1.35 * v;
    case "allAdd":
    case "allMulti": return 1.5 * v;
    case "speed": return 0.2 * v;
    case "refire": return 0.3 * v;
    case "convHp":
    case "convShield": return -Math.min(100, 0.1 * v);
    case "powerReg": return 0.15 * v;
    case "powerMax": return 1.5 * v;
    case "cooldown": return 0.1 * v;
    default: return v;
  }
}

function artifactNumericRange(record) {
  const min = record.add ? record.addMinValue : record.multiMinValue;
  const max = record.add ? record.addMaxValue : record.multiMaxValue;
  const raw = [min, max].filter((value) => value !== undefined && value !== null && value !== "");
  if (!raw.length) return { min: "", max: "" };
  const values = raw.map((value) => artifactStatNumber(record.type, value));
  return { min: Math.min(...values), max: Math.max(...values) };
}

function artifactValueRange(record) {
  const min = record.add ? record.addMinValue : record.multiMinValue;
  const max = record.add ? record.addMaxValue : record.multiMaxValue;
  if (min === undefined && max === undefined) return "n/a";
  if (min === undefined || min === max) return artifactStatValue(record.type, max);
  return `${artifactStatValue(record.type, min)} to ${artifactStatValue(record.type, max)}`;
}

function artifactLevelRange(record) {
  if (record.minLevel === undefined && record.maxLevel === undefined) return "Any";
  return rangeText(record.minLevel ?? 1, record.maxLevel ?? 150);
}

const ARTIFACT_FINDER_BANDS = [
  { id: "1-49", label: "1-49", min: 1, max: 49 },
  { id: "50-60", label: "50-60", min: 50, max: 60 },
  { id: "61-70", label: "61-70", min: 61, max: 70 },
  { id: "71-80", label: "71-80", min: 71, max: 80 },
  { id: "81-90", label: "81-90", min: 81, max: 90 },
  { id: "91-100", label: "91-100", min: 91, max: 100 },
  { id: "101-110", label: "101-110", min: 101, max: 110 },
  { id: "111-120", label: "111-120", min: 111, max: 120 },
  { id: "121-130", label: "121-130", min: 121, max: 130 },
  { id: "131-150", label: "131-150", min: 131, max: 150 }
];

function artifactFinderBandFor(level) {
  const value = numberValue(level, 0);
  return ARTIFACT_FINDER_BANDS.find((band) => value >= band.min && value <= band.max) || ARTIFACT_FINDER_BANDS[ARTIFACT_FINDER_BANDS.length - 1];
}

function artifactIsUnique(record) {
  return UNIQUE_ARTIFACT_TYPES.has(record?.type);
}

function artifactRarityLabel(record) {
  if (artifactIsUnique(record)) return "Unique";
  if (record.special) return "Special";
  return "Normal";
}

function artifactUpgradeLabel(record) {
  return artifactIsUnique(record) ? "No, unique artifacts cannot be upgraded" : "Yes";
}

function uniqueArtifactLabelFromTexture(textureName) {
  return String(textureName || "")
    .replace(/^artifact_unique_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bOf\b/g, "of");
}

function normalizedLookupName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function uniqueDropEntry(cache) {
  return Object.entries(cache.Drops || {}).find(([, drop]) => /unique artifact/i.test(drop.name || ""));
}

function artifactDropEntries(record, cache) {
  return (record?.drops || []).filter((item) => {
    const drop = cache.Drops?.[item.drop];
    return numberValue(drop?.artifactChance, 0) > 0 || /artifact/i.test(drop?.name || item.name || "");
  });
}

function uniqueArtifactCatalog(cache) {
  const bossByName = new Map(Object.entries(cache.Bosses || {}).map(([key, boss]) => [normalizedLookupName(titleFor(boss, key)), { key, boss }]));
  return Object.entries(cache.Images || {})
    .filter(([, image]) => /^artifact_unique_/i.test(image.textureName || ""))
    .map(([imageKey, image]) => {
      const textureName = image.textureName || "";
      const hint = UNIQUE_ARTIFACT_ICON_HINTS[textureName] || {};
      const statHint = UNIQUE_ARTIFACT_BUILD_HINTS[hint.stat] || {};
      const label = uniqueArtifactLabelFromTexture(textureName);
      const bossNames = [...(hint.bossNames || [])];
      const textureBoss = bossByName.get(normalizedLookupName(label));
      if (textureBoss && !bossNames.includes(titleFor(textureBoss.boss, textureBoss.key))) bossNames.push(titleFor(textureBoss.boss, textureBoss.key));
      const bossKeys = bossNames
        .map((name) => bossByName.get(normalizedLookupName(name))?.key)
        .filter(Boolean);
      return {
        key: textureName,
        slug: `artifacts/unique/${slugify(label)}`,
        url: `/artifacts/unique/${slugify(label)}.html`,
        imageKey,
        image,
        label,
        stat: hint.stat || "",
        confidence: hint.confidence || (bossKeys.length ? "boss-sprite-match" : "sprite-only"),
        bossKeys,
        damageType: hint.damageType || statHint.damageType || "",
        focus: hint.focus || statHint.focus || ""
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

function uniqueArtifactSourceStatus(item, cache) {
  const hasStat = item.stat && UNIQUE_ARTIFACT_TYPES.has(item.stat);
  if (item.bossKeys.length && hasStat) return "Boss sprite match + unique stat";
  if (item.bossKeys.length) return "Boss sprite match";
  if (item.confidence === "direct-stat-name") return "Direct unique stat";
  if (hasStat) return "Inferred unique stat";
  return "Sprite only";
}

function uniqueArtifactEffectRole(item) {
  const text = `${item.stat ? artifactStatLabel(item.stat) : ""} ${item.stat ? (UNIQUE_ARTIFACT_DESCRIPTIONS[item.stat] || "") : ""}`.toLowerCase();
  const buffMatch = /(increase|adds?|improv|boost|grant|regen|recovery|heal|leech|doubles?)/.test(text);
  const debuffMatch = /(reduce|reduces|reduc|slow|disable|ignite|overload|penetrat|drain|shockwave|reflect)/.test(text);
  if (buffMatch && debuffMatch) return "Mixed";
  if (debuffMatch) return "Debuff";
  if (buffMatch) return "Buff";
  if (item.stat) return "Utility";
  return "Unknown";
}

function uniqueArtifactFocusSummary(item) {
  const parts = [];
  const damageType = String(item.damageType || "");
  const focus = String(item.focus || "");
  if (damageType && (!focus || !focus.toLowerCase().includes(damageType.toLowerCase()))) parts.push(damageType);
  if (focus && !parts.includes(focus)) parts.push(focus);
  return parts.join(" / ");
}

function uniqueArtifactFocusCell(item, fallback = "unconfirmed") {
  const summary = uniqueArtifactFocusSummary(item);
  return summary ? escapeHtml(summary) : missingValue(fallback);
}

function uniqueArtifactBossSummary(item, cache, routes) {
  if (!item.bossKeys.length) return "<span class=\"muted\">No strict boss match in client data</span>";
  return item.bossKeys.map((bossKey) => {
    const boss = cache.Bosses?.[bossKey];
    const artDrops = artifactDropEntries(boss, cache);
    const dropText = artDrops.length
      ? artDrops.map((dropItem) => `${entityLink("Drops", dropItem.drop, cache, routes)} x${escapeHtml(rangeText(dropItem.min, dropItem.max))} @ ${escapeHtml(percentLabel(dropItem.chance ?? 1))}`).join("<br>")
      : "<span class=\"muted\">Artifact roll not exposed</span>";
    return `${entityLink("Bosses", bossKey, cache, routes)}<div class=\"muted\">${dropText}</div>`;
  }).join("<br>");
}

function uniqueArtifactRowNotes(item) {
  const focus = uniqueArtifactFocusSummary(item);
  if (item.stat && UNIQUE_ARTIFACT_TYPES.has(item.stat)) {
    return focus
      ? `${UNIQUE_ARTIFACT_DESCRIPTIONS[item.stat] || artifactStatLabel(item.stat)} Best fit: ${focus}.`
      : UNIQUE_ARTIFACT_DESCRIPTIONS[item.stat] || artifactStatLabel(item.stat);
  }
  return focus
    ? `Best fit: ${focus}. The downloaded client cache does not expose a fixed stat type or value for this sprite.`
    : "The downloaded client cache does not expose a fixed stat type or value for this sprite.";
}

function uniqueArtifactMainRows(cache, media, routes) {
  return uniqueArtifactCatalog(cache).map((item) => {
    const focus = uniqueArtifactFocusSummary(item);
    const statText = item.stat && UNIQUE_ARTIFACT_TYPES.has(item.stat)
      ? `${artifactStatLabel(item.stat)}: ${UNIQUE_ARTIFACT_DESCRIPTIONS[item.stat] || item.stat}`
      : "Fixed stat not exposed by the downloaded client cache";
    return `<tr data-search="${escapeAttr(`${item.label} ${item.stat} ${focus} ${uniqueArtifactSourceStatus(item, cache)} ${item.bossKeys.map((bossKey) => titleFor(cache.Bosses?.[bossKey], bossKey)).join(" ")} ${UNIQUE_ARTIFACT_DESCRIPTIONS[item.stat] || ""}`)}" data-stat="${escapeAttr(item.stat || "")}" data-role="${escapeAttr(uniqueArtifactEffectRole(item))}" data-source-status="${escapeAttr(uniqueArtifactSourceStatus(item, cache))}"><td>${renderImageThumb(item.image, media)}<a href="${escapeAttr(item.url)}">${escapeHtml(item.label)}</a></td><td>${escapeHtml(statText)}${item.stat ? `<br><code class="source-key">${escapeHtml(item.stat)}</code>` : ""}</td><td>${uniqueArtifactFocusCell(item)}</td><td>${escapeHtml(uniqueArtifactEffectRole(item))}</td><td>${uniqueArtifactBossSummary(item, cache, routes)}</td><td>${escapeHtml(uniqueArtifactRowNotes(item))}</td></tr>`;
  }).join("");
}

function classicArtifactRows(artifacts, cache, media, routes) {
  return artifacts.filter(({ record }) => !artifactIsUnique(record)).map(({ entry, key, record }) => {
    const imageKey = primaryImageKey("ArtifactTypes", record, cache);
    const image = cache.Images?.[imageKey];
    const icon = image ? renderImageThumb(image, media) : "";
    const rarity = artifactRarityLabel(record);
    const upgradeable = artifactUpgradeLabel(record);
    const range = artifactValueRange(record);
    const levelRange = artifactLevelRange(record);
    const dropWeight = valueLabel(record.dropRate);
    const eligible = artifacts.filter(({ record: other }) => {
      if (artifactIsUnique(other)) return false;
      const min = other.minLevel ?? 1;
      const max = other.maxLevel ?? 150;
      const recordMin = record.minLevel ?? 1;
      const recordMax = record.maxLevel ?? 150;
      return Math.max(min, recordMin) <= Math.min(max, recordMax);
    });
    const totalWeight = eligible.reduce((sum, artifact) => sum + numberValue(artifact.record.dropRate), 0);
    const typeChance = totalWeight ? numberValue(record.dropRate) / totalWeight : 0;
    const searchText = `${entry.name} ${key} ${record.type || ""} ${rarity} ${upgradeable} ${range} ${levelRange}`;
    const href = entry.url || routes.get(`ArtifactTypes:${key}`) || `/${entry.slug}.html`;
    return `<tr data-search="${escapeAttr(searchText)}" data-stat="${escapeAttr(artifactBaseType(record.type))}" data-rarity="${escapeAttr(rarity)}" data-unique="0"><td>${icon}<a href="${escapeAttr(href)}">${escapeHtml(entry.name)}</a></td><td>${escapeHtml(artifactStatLabel(record.type))}<br><code class="source-key">${escapeHtml(record.type)}</code></td><td>${escapeHtml(artifactBaseType(record.type))}</td><td>${escapeHtml(range)}</td><td>${rarity === "Unknown" ? missingValue(rarity) : escapeHtml(rarity)}</td><td>${upgradeable === "Unknown" ? missingValue(upgradeable) : escapeHtml(upgradeable)}</td><td>${escapeHtml(dropWeight)}</td><td>${levelRange === "Any" ? missingValue(levelRange) : escapeHtml(levelRange)}</td><td>${escapeHtml(percentLabel(typeChance))}</td></tr>`;
  }).join("");
}

function uniqueArtifactRows(cache, media, routes) {
  const uniqueDrop = Object.entries(cache.Drops || {}).find(([, drop]) => /unique artifact/i.test(drop.name || ""));
  return UNIQUE_ARTIFACT_STATS.map(([type, label]) => {
    const icon = uniqueArtifactCatalog(cache).find((item) => item.stat === type);
    const linkedLabel = icon ? `<a href="${escapeAttr(icon.url)}">${escapeHtml(label)}</a>` : escapeHtml(label);
    return `<tr><td>${icon ? renderImageThumb(icon.image, media) : ""}${linkedLabel}</td><td>${escapeHtml(UNIQUE_ARTIFACT_DESCRIPTIONS[type] || artifactStatLabel(type))}<br><code class="source-key">${escapeHtml(type)}</code></td><td>${escapeHtml(artifactStatLabel(type))}</td><td>No</td><td>${uniqueDrop ? entityLink("Drops", uniqueDrop[0], cache, routes) : "Unique artifact drop tables / BigDB artifact rolls"}</td></tr>`;
  }).join("");
}

function uniqueArtifactIconRows(cache, media, routes) {
  const drop = uniqueDropEntry(cache);
  return uniqueArtifactCatalog(cache).map((item) => {
    const focus = uniqueArtifactFocusSummary(item);
    const statText = item.stat && UNIQUE_ARTIFACT_TYPES.has(item.stat)
      ? `${artifactStatLabel(item.stat)}: ${UNIQUE_ARTIFACT_DESCRIPTIONS[item.stat] || item.stat}`
      : "Fixed stat not exposed by the downloaded client cache";
    const bosses = item.bossKeys.length
      ? item.bossKeys.map((bossKey) => {
        const boss = cache.Bosses?.[bossKey];
        const artDrops = artifactDropEntries(boss, cache);
        const qty = artDrops.map((dropItem) => rangeText(dropItem.min, dropItem.max)).join(", ");
        return `${entityLink("Bosses", bossKey, cache, routes)}${qty ? ` <span class="muted">artifact rolls ${escapeHtml(qty)}</span>` : ""}`;
      }).join("<br>")
      : "<span class=\"muted\">No direct boss name match in client data</span>";
    return `<tr data-search="${escapeAttr(`${item.label} ${item.stat} ${focus} ${uniqueArtifactSourceStatus(item, cache)} ${item.bossKeys.map((bossKey) => titleFor(cache.Bosses?.[bossKey], bossKey)).join(" ")}`)}"><td>${renderImageThumb(item.image, media)}<a href="${escapeAttr(item.url)}">${escapeHtml(item.label)}</a></td><td>${escapeHtml(statText)}${item.stat ? `<br><code class="source-key">${escapeHtml(item.stat)}</code>` : ""}</td><td>${uniqueArtifactFocusCell(item)}</td><td>${bosses}</td><td>${drop ? entityLink("Drops", drop[0], cache, routes) : "<span>n/a</span>"}</td><td>${escapeHtml(uniqueArtifactSourceStatus(item, cache))}</td></tr>`;
  }).join("");
}

function bossUniqueArtifactRows(cache, media, routes) {
  const catalog = uniqueArtifactCatalog(cache);
  return Object.entries(cache.Bosses || {})
    .filter(([, boss]) => artifactDropEntries(boss, cache).length)
    .sort((a, b) => titleFor(a[1], a[0]).localeCompare(titleFor(b[1], b[0])))
    .map(([bossKey, boss]) => {
      const matches = catalog.filter((item) => item.bossKeys.includes(bossKey));
      const dropText = artifactDropEntries(boss, cache)
        .map((item) => `${entityLink("Drops", item.drop, cache, routes)} x${escapeHtml(rangeText(item.min, item.max))} @ ${escapeHtml(percentLabel(item.chance ?? 1))}`)
        .join("<br>");
      const uniqueText = matches.length
        ? matches.map((item) => `${renderImageThumb(item.image, media)}<a href="${escapeAttr(item.url)}">${escapeHtml(item.label)}</a>`).join("<br>")
        : "<span class=\"muted\">No unique sprite name matches this boss in the client cache</span>";
      const evidence = matches.length
        ? "Boss name matches artifact_unique_* sprite; boss has artifact drop rows"
        : "Boss has artifact drop rows, but unique roll identity is server-side";
      return `<tr><td>${entityLink("Bosses", bossKey, cache, routes)}</td><td>${uniqueText}</td><td>${dropText}</td><td>${escapeHtml(evidence)}</td></tr>`;
    })
    .join("");
}

function bossArtifactDropRows(cache, routes) {
  const rows = [];
  for (const [bossKey, boss] of Object.entries(cache.Bosses || {})) {
    for (const item of boss.drops || []) {
      const drop = cache.Drops?.[item.drop];
      if (!drop) continue;
      const artifactChance = numberValue(drop.artifactChance, 0);
      const isArtifactDrop = artifactChance > 0 || /artifact/i.test(drop.name || item.name || "");
      if (!isArtifactDrop) continue;
      const bossDropChance = numberValue(item.chance, 1);
      const crateChance = drop.crate ? numberValue(drop.chance, 1) : 1;
      const effective = bossDropChance * crateChance * (artifactChance || 1);
      rows.push({
        bossKey,
        bossName: titleFor(boss, bossKey),
        dropKey: item.drop,
        dropName: drop.name || item.name || item.drop,
        kind: /unique artifact/i.test(drop.name || "") ? "Unique artifact crate" : drop.crate ? "Artifact crate" : "Artifact drop",
        bossDropChance,
        crateChance,
        artifactChance: artifactChance || 1,
        effective,
        qty: rangeText(item.min, item.max),
        level: drop.artifactLevel ?? "Roll level",
        amount: drop.artifactAmount ?? item.max ?? item.min ?? 1
      });
    }
  }
  if (!rows.some((row) => /unique/i.test(row.kind))) {
    const uniqueDrop = Object.entries(cache.Drops || {}).find(([, drop]) => /unique artifact/i.test(drop.name || ""));
    if (uniqueDrop) {
      rows.unshift({
        bossKey: "",
        bossName: "No direct boss reference found in cache",
        dropKey: uniqueDrop[0],
        dropName: uniqueDrop[1].name || "Crate Unique Artifact",
        kind: "Unique artifact crate",
        bossDropChance: 0,
        crateChance: numberValue(uniqueDrop[1].chance, 1),
        artifactChance: numberValue(uniqueDrop[1].artifactChance, 0),
        effective: 0,
        qty: "n/a",
        level: uniqueDrop[1].artifactLevel ?? "Roll level",
        amount: uniqueDrop[1].artifactAmount ?? "n/a"
      });
    }
  }
  return rows
    .sort((a, b) => Number(/unique/i.test(b.kind)) - Number(/unique/i.test(a.kind)) || b.effective - a.effective || a.bossName.localeCompare(b.bossName) || a.dropName.localeCompare(b.dropName))
    .map((row) => `<tr><td>${row.bossKey ? entityLink("Bosses", row.bossKey, cache, routes, row.bossName) : `<span>${escapeHtml(row.bossName)}</span>`}</td><td>${entityLink("Drops", row.dropKey, cache, routes, row.dropName)}</td><td>${escapeHtml(row.kind)}</td><td>${escapeHtml(percentLabel(row.bossDropChance))}</td><td>${escapeHtml(percentLabel(row.crateChance))}</td><td>${escapeHtml(percentLabel(row.artifactChance))}</td><td>${escapeHtml(percentLabel(row.effective))}</td><td>${escapeHtml(row.qty)}</td><td>${escapeHtml(valueLabel(row.amount))}</td><td>${escapeHtml(valueLabel(row.level))}</td></tr>`)
    .join("");
}

function artifactFinderRollChance(drop) {
  const chance = numberValue(drop?.artifactChance, 0);
  if (chance > 0) return chance;
  return numberValue(drop?.artifactAmount, 0) > 0 ? 1 : 0;
}

function artifactFinderEligiblePool(artifacts, artifactLevel) {
  return artifacts
    .filter(({ record }) => !artifactIsUnique(record))
    .filter(({ record }) => artifactLevel >= numberValue(record.minLevel, 1) && artifactLevel <= numberValue(record.maxLevel, 150))
    .sort((a, b) => a.entry.name.localeCompare(b.entry.name));
}

function artifactFinderPoolHtml(pool, cache, routes) {
  if (!pool.length) return missingValue("n/a");
  const preview = pool
    .slice(0, 5)
    .map(({ key, entry }) => entityLink("ArtifactTypes", key, cache, routes, entry.name))
    .join(", ");
  const extra = pool.length - 5;
  return `${preview}${extra > 0 ? `<br><span class="muted">+${escapeHtml(valueLabel(extra))} more eligible artifacts</span>` : ""}`;
}

function artifactFinderSourceHtml(source, cache, routes, sourceType) {
  if (!source) return `<span>${escapeHtml(sourceType)}</span>`;
  if (source.table === "Spawners") {
    const parts = [entityLink("Spawners", source.key, cache, routes)];
    if (source.enemy) parts.push(`Enemy: ${entityLink("Enemies", source.enemy, cache, routes)}`);
    if (source.boss) parts.push(`Boss: ${entityLink("Bosses", source.boss, cache, routes)}`);
    return `${parts[0]}${parts.length > 1 ? `<div class="muted">${parts.slice(1).join(" / ")}</div>` : ""}`;
  }
  return entityLink(source.table, source.key, cache, routes);
}

function artifactFinderRows(artifacts, cache, routes) {
  const rows = [];
  for (const [dropKey, drop] of Object.entries(cache.Drops || {})) {
    const artifactLevel = numberValue(drop.artifactLevel, 0);
    const artifactRollChance = artifactFinderRollChance(drop);
    if (!artifactLevel || (!artifactRollChance && !/artifact/i.test(drop.name || ""))) continue;
    if (/unique artifact/i.test(drop.name || "")) continue;

    const eligiblePool = artifactFinderEligiblePool(artifacts, artifactLevel);
    if (!eligiblePool.length) continue;

    const band = artifactFinderBandFor(artifactLevel);
    const crateChance = drop.crate ? numberValue(drop.chance, 1) : 1;
    const dropName = drop.name || dropKey;
    const qtyText = numberValue(drop.artifactAmount, 0) > 0 ? valueLabel(drop.artifactAmount) : "1 roll";
    const dropSources = dropSourceData(dropKey, cache);

    const pushRow = (source, location, sourceType) => {
      const effective = numberValue(source?.chance, 1) * crateChance * artifactRollChance;
      const systemHtml = location
        ? entityLink("SolarSystems", location.systemKey, cache, routes, location.systemName)
        : sourceType === "Mission reward"
          ? `<span>Mission reward</span>`
          : missingValue("n/a");
      const locationHtml = location
        ? `${entityLink("Bodies", location.bodyKey, cache, routes, location.bodyName)}${location.extraLocations ? `<br><span class="muted">+${escapeHtml(valueLabel(location.extraLocations))} more known locations</span>` : ""}`
        : sourceType === "Mission reward"
          ? `<span class="muted">Mission table</span>`
          : missingValue("n/a");
      const sourceHtml = artifactFinderSourceHtml(source, cache, routes, sourceType);
      const poolNames = eligiblePool.map(({ entry }) => entry.name).join(" ");
      const sourceName = source ? titleFor(cache[source.table]?.[source.key], source.key) : sourceType;
      const enemyName = source?.enemy ? titleFor(cache.Enemies?.[source.enemy], source.enemy) : "";
      const bossName = source?.boss ? titleFor(cache.Bosses?.[source.boss], source.boss) : "";
      rows.push({
        band,
        artifactLevel,
        effective,
        systemHtml,
        locationHtml,
        sourceHtml,
        dropHtml: entityLink("Drops", dropKey, cache, routes, dropName),
        rollText: percentLabel(effective),
        qtyText,
        poolHtml: artifactFinderPoolHtml(eligiblePool, cache, routes),
        searchText: `${band.label} ${artifactLevel} ${dropName} ${sourceName} ${enemyName} ${bossName} ${location?.systemName || ""} ${location?.bodyName || ""} ${poolNames}`
      });
    };

    if (!dropSources.length) {
      if (drop.type === "mission") pushRow(null, null, "Mission reward");
      continue;
    }

    for (const source of dropSources) {
      const location = sourceLocationInfo(source, cache);
      if (source.table === "Spawners" && !location) continue;
      pushRow(source, location, source.type || "Source");
    }
  }

  return rows
    .sort((a, b) => a.band.min - b.band.min || b.artifactLevel - a.artifactLevel || b.effective - a.effective || a.searchText.localeCompare(b.searchText))
    .map((row) => `<tr data-search="${escapeAttr(row.searchText)}" data-band="${escapeAttr(row.band.id)}" data-level="${escapeAttr(row.artifactLevel)}"><td>${escapeHtml(row.band.label)}</td><td>${escapeHtml(valueLabel(row.artifactLevel))}</td><td>${row.systemHtml}</td><td>${row.locationHtml}</td><td>${row.sourceHtml}</td><td>${row.dropHtml}</td><td>${escapeHtml(row.rollText)}</td><td>${escapeHtml(row.qtyText)}</td><td>${row.poolHtml}</td></tr>`)
    .join("");
}

function bossImageKeys(record, cache = null) {
  const keys = [];
  if (record.bitmap) keys.push(record.bitmap);
  for (const obj of record.basicObjs || []) {
    if (obj?.bitmap) keys.push(obj.bitmap);
  }
  if (cache) {
    for (const mount of record.turrets || []) {
      const turretKey = mount?.turret || refKey("Turrets", mount);
      const shipKey = cache.Turrets?.[turretKey]?.body;
      const bitmap = shipKey ? cache.Ships?.[shipKey]?.bitmap : "";
      if (bitmap) keys.push(bitmap);
    }
    for (const mount of record.spawners || []) {
      const spawnerKey = mount?.spawner || refKey("Spawners", mount);
      const bitmap = cache.Spawners?.[spawnerKey]?.bitmap;
      if (bitmap) keys.push(bitmap);
    }
  }
  return [...new Set(keys)];
}

function relationCount(graph, id) {
  return (graph.reverse[id] || []).length + graph.edges.filter((edge) => edge.from === id).length;
}

function renderMarkdown(markdown) {
  const lines = stripFrontmatter(markdown).split(/\r?\n/);
  const html = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("# ")) {
      html.push(`<h1>${inlineMarkdown(line.slice(2))}</h1>`);
      i += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      html.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
      i += 1;
      continue;
    }
    if (line.startsWith("- ")) {
      html.push("<ul>");
      while (i < lines.length && lines[i].startsWith("- ")) {
        html.push(`<li>${inlineMarkdown(lines[i].slice(2))}</li>`);
        i += 1;
      }
      html.push("</ul>");
      continue;
    }
    if (line.startsWith("| ")) {
      const tableLines = [];
      while (i < lines.length && lines[i].startsWith("| ")) {
        tableLines.push(lines[i]);
        i += 1;
      }
      html.push(renderTable(tableLines));
      continue;
    }
    if (line.trim() === "") {
      i += 1;
      continue;
    }
    html.push(`<p>${inlineMarkdown(line)}</p>`);
    i += 1;
  }

  return html.join("\n");
}

function renderTable(lines) {
  if (lines.length < 2) return "";
  const rows = lines
    .filter((line, index) => index !== 1)
    .map((line) => line.slice(1, -1).split("|").map((cell) => cell.trim()));
  const [head, ...body] = rows;
  return [
    "<div class=\"table-wrap\"><table>",
    `<thead><tr>${head.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join("")}</tr></thead>`,
    "<tbody>",
    ...body.map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`),
    "</tbody></table></div>"
  ].join("\n");
}

function pageShell(title, body, nav = "", baseHref = "./") {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="${baseHref}">
  <title>${escapeHtml(title)} - Astroflux Wiki</title>
  <link rel="icon" href="assets/favicon.ico">
  <link rel="stylesheet" href="assets/site.css?v=${ASSET_VERSION}">
</head>
<body>
  <header>
    <a class="brand" href=".">Astroflux Wiki</a>
    <form class="site-search" role="search">
      <input id="search-input" type="search" placeholder="Search wiki" autocomplete="off">
      <div id="search-results" class="search-results" hidden></div>
    </form>
    <nav>
      <a href="guides/">Guides</a>
      <a href="quests/">Quests</a>
      <a href="systems/">Systems</a>
      <a href="stations/">Stations</a>
      <a href="enemies/">Enemies</a>
      <a href="bosses/">Bosses</a>
      <a href="weapons/">Weapons</a>
      <a href="ships/">Ships</a>
      <a href="commodities/">Items</a>
      <a href="artifacts/">Artifacts</a>
      <a href="drops/">Drops</a>
      <a href="media/">Media</a>
      <a href="map/">Map</a>
    </nav>
  </header>
  ${nav}
  <main>${body}</main>
  <footer class="site-footer">
    <p>Want to improve this wiki? Contributions are welcome on <a href="https://github.com/guedesite/astroflux-wiki">github.com/guedesite/astroflux-wiki</a>.</p>
  </footer>
  <script src="assets/search.js?v=${ASSET_VERSION}"></script>
</body>
</html>`;
}

function writePage(file, title, body, nav = "") {
  ensureDir(path.dirname(file));
  const html = pageShell(title, body, nav, siteBaseHref(file, DIST_DIR));
  fs.writeFileSync(file, stripLeadingSlashSiteUrls(html), "utf8");
}

function buildContentPages(manifest, cache, media, graph, routes) {
  for (const entries of Object.values(manifest)) {
    for (const entry of entries) {
      const output = path.join(DIST_DIR, routeForEntry(entry).slice(1));
      const [table, key] = entry.id.split(":");
      const record = cache[table]?.[key];
      if (!record) continue;
      if (table === "SolarSystems" && !isVisibleMapSystem(record, key)) continue;
      writePage(output, entry.name, renderEntityPage(table, key, record, cache, media, graph, routes));
    }
  }
}

function renderEntityPage(table, key, record, cache, media, graph, routes) {
  if (table === "SolarSystems") {
    return [
      renderPlayerSections(table, key, record, cache, media, routes),
      renderMediaPanel(table, record, cache, media),
      renderRelations(table, key, cache, graph, routes),
      renderAdvancedDetails(table, key, record)
    ].filter(Boolean).join("\n");
  }
  const name = titleFor(record, key);
  const type = record.type ? `<span class="pill">${escapeHtml(record.type)}</span>` : "";
  const visual = renderPrimaryVisual(table, record, cache, media);
  if (table === "Bosses") {
    const sections = renderBossPageSections(record, cache, media, routes);
    return [
      `<section class="entity-hero">${visual}<div class="hero-main"><p class="eyebrow">${escapeHtml(playerTableName(table))}</p><h1>${escapeHtml(name)}</h1>${type}</div>${renderHeroFacts(table, record, cache)}</section>`,
      sections.preMedia,
      renderMediaPanel(table, record, cache, media),
      sections.postMedia,
      renderRelations(table, key, cache, graph, routes),
      renderAdvancedDetails(table, key, record)
    ].filter(Boolean).join("\n");
  }
  return [
    `<section class="entity-hero">${visual}<div class="hero-main"><p class="eyebrow">${escapeHtml(playerTableName(table))}</p><h1>${escapeHtml(name)}</h1>${type}</div>${renderHeroFacts(table, record, cache)}</section>`,
    renderMediaPanel(table, record, cache, media),
    renderPlayerSections(table, key, record, cache, media, routes),
    renderRelations(table, key, cache, graph, routes),
    renderAdvancedDetails(table, key, record)
  ].filter(Boolean).join("\n");
}

function playerTableName(table) {
  return ({
    SolarSystems: "Solar system",
    Bodies: "Station / location",
    Enemies: "Enemy",
    Bosses: "Boss",
    Drops: "Loot",
    Weapons: "Weapon",
    Ships: "Ship",
    Projectiles: "Projectile",
    Engines: "Engine",
    Turrets: "Turret",
    Spawners: "Spawner",
    Commodities: "Item",
    ArtifactTypes: "Artifact",
    MissionTypes: "Quest"
  })[table] || table;
}

function sourceTableDisplayName(table) {
  return ({
    Bodies: "Stations / locations"
  })[table] || table;
}

function primaryImageKey(table, record, cache) {
  if (table === "Enemies") return cache.Ships?.[record.ship]?.bitmap || record.bitmap || "";
  if (table === "Bosses") return cache.Ships?.[record.ship]?.bitmap || record.bitmap || bossImageKeys(record, cache)[0] || "";
  if (table === "Weapons") return record.techIcon || "";
  if (table === "Ships") return record.bitmap || "";
  if (table === "Projectiles") return record.bitmap || record.texture || record.techIcon || "";
  if (table === "Bodies") return record.bitmap || record.background || "";
  return record.bitmap || record.techIcon || record.background || "";
}

function renderPrimaryVisual(table, record, cache, media) {
  if (table === "Bosses") {
    const bossCard = renderBossLayeredCard(record, cache, media);
    if (bossCard) return `<div class="hero-visual">${bossCard}</div>`;
  }
  const key = primaryImageKey(table, record, cache);
  const image = cache.Images?.[key];
  if (!image) return "";
  const card = renderImageCard(image, key, media, true);
  return card ? `<div class="hero-visual">${card}</div>` : "";
}

function renderHeroFacts(table, record, cache) {
  const cards = [];
  if (record.level !== undefined) cards.push(statCard("Level", record.level));
  if (table === "Bosses") {
    const hp = bossHpStats(record, cache);
    if (hp.displayHp !== "") cards.push(statCard("HP", formatNumber(hp.displayHp, 0), hp.source));
  }
  if (record.type !== undefined) cards.push(statCard("Type", record.type));
  if (record.xp !== undefined) cards.push(statCard("XP", record.xp));
  if (record.dmg !== undefined) cards.push(statCard("Damage", record.dmg));
  if (record.range !== undefined) cards.push(statCard("Range", record.range));
  if (record.reloadTime !== undefined) cards.push(statCard("Reload", record.reloadTime, "ms"));
  if (record.hp !== undefined) cards.push(statCard(table === "Spawners" ? "Spawner HP" : "HP", record.hp));
  if (record.shieldHp !== undefined) cards.push(statCard("Shield", record.shieldHp));
  if (record.armor !== undefined) cards.push(statCard("Armor", record.armor));
  if (table === "ArtifactTypes") {
    cards.push(statCard("Stat", artifactStatLabel(record.type)));
    cards.push(statCard("Value range", artifactValueRange(record)));
    cards.push(statCard("Rarity", artifactRarityLabel(record)));
    cards.push(statCard("Upgradeable", artifactIsUnique(record) ? "No" : "Yes"));
    cards.push(statCard("Drop weight", record.dropRate));
    cards.push(statCard("Levels", artifactLevelRange(record)));
  }
  if (record.landable !== undefined) cards.push(statCard("Landable", record.landable));
  return cards.length ? `<div class="hero-facts"><div class="stat-grid compact">${cards.slice(0, 6).join("")}</div></div>` : "";
}

function buildListing(dir, title, entries, table, cache, media, routes) {
  const specialized = renderSpecialListing(dir, entries, table, cache, media, routes);
  if (specialized) {
    writePage(path.join(DIST_DIR, dir, "index.html"), title, specialized);
    return;
  }
  const rows = entries
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => `<li><a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a><span>${escapeHtml(entry.id.split(":")[0])}</span></li>`)
    .join("\n");
  const body = `<h1>${escapeHtml(title)}</h1><ol class="listing">${rows}</ol>`;
  writePage(path.join(DIST_DIR, dir, "index.html"), title, body);
}

function renderSpecialListing(dir, entries, table, cache, media, routes) {
  if (dir === "weapons") return renderWeaponListing(entries, cache, media, routes);
  if (dir === "enemies") return renderEnemyListing(entries, cache, media, routes);
  if (dir === "bosses") return renderBossListing(entries, cache, media, routes);
  if (dir === "bodies") return renderBodyListing(entries, cache, routes);
  if (dir === "ships") return renderShipListing(entries, cache, media, routes);
  if (dir === "drops") return renderDropListing(entries, cache, routes);
  if (dir === "commodities") return renderCommodityListing(entries, cache, media, routes);
  if (dir === "artifacts") return renderArtifactListing(entries, cache, media, routes);
  if (dir === "systems") return renderSystemListing(entries, cache, routes);
  return "";
}

function entryKey(entry) {
  return entry.id.split(":")[1];
}

function renderWeaponListing(entries, cache, media, routes) {
  const damageOptions = DAMAGE_TYPES.map((label, index) => `<option value="${index}">${escapeHtml(label)}</option>`).join("");
  const kindOptions = [...new Set(entries.map((entry) => cache.Weapons?.[entryKey(entry)]?.type).filter(Boolean))]
    .sort()
    .map((kind) => `<option value="${escapeAttr(kind)}">${escapeHtml(kind)}</option>`)
    .join("");
  const rows = entries
    .map((entry) => {
      const key = entryKey(entry);
      const record = cache.Weapons?.[key];
      if (!record) return "";
      const icon = cache.Images?.[record.techIcon] ? renderImageThumb(cache.Images[record.techIcon], media) : "";
      const dps = weaponDps(record) || 0;
      const heat = weaponHeatPerSecond(record) || 0;
      const source = weaponSourceSummary(key, cache);
      return `<tr data-search="${escapeAttr(`${entry.name} ${record.type || ""} ${damageTypeLabel(record.damageType)} ${weaponTags(record)}`)}" data-damage="${escapeAttr(record.damageType ?? "")}" data-kind="${escapeAttr(record.type || "")}" data-dps="${escapeAttr(dps)}" data-heat="${escapeAttr(heat)}" data-range="${escapeAttr(record.range ?? 0)}" data-player="${isPlayerFacingWeapon(record) ? "1" : "0"}"><td>${icon}<a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${escapeHtml(damageTypeLabel(record.damageType))}</td><td>${escapeHtml(valueLabel(record.type))}</td><td>${escapeHtml(valueLabel(record.dmg))}</td><td>${escapeHtml(valueLabel(weaponShotDamage(record)))}</td><td>${escapeHtml(valueLabel(weaponHits(record)))}</td><td>${escapeHtml(valueLabel(dps || ""))}</td><td>${escapeHtml(valueLabel(record.range))}</td><td>${escapeHtml(valueLabel(heat || ""))}</td><td>${escapeHtml(source.total ? `${source.total} source${source.total === 1 ? "" : "s"}` : "Research")}</td><td>${escapeHtml(weaponTags(record))}</td></tr>`;
    })
    .join("");
  return `<h1>Weapons</h1><p class="muted">Use this table to compare all weapons quickly. DPS is an approximation from cache damage, hit count, and reload time; open a weapon for where to get it, sounds, projectiles, tech levels, elite branches, and related pages.</p><p><a class="button-link" href="/guides/weapons.html">Open weapon finder</a></p>
<div class="filter-panel" data-table-filter="weapons-table">
  <input id="weapon-filter-text" name="weapon-filter-text" data-filter-text type="search" placeholder="Search weapon, tag, damage type">
  <select id="weapon-filter-damage" name="weapon-filter-damage" data-filter-attr="damage"><option value="">All damage types</option>${damageOptions}</select>
  <select id="weapon-filter-kind" name="weapon-filter-kind" data-filter-attr="kind"><option value="">All weapon kinds</option>${kindOptions}</select>
  <label>Min DPS <input id="weapon-filter-min-dps" name="weapon-filter-min-dps" data-filter-min="dps" type="number" min="0"></label>
  <label>Max heat/s <input id="weapon-filter-max-heat" name="weapon-filter-max-heat" data-filter-max="heat" type="number" min="0"></label>
  <label>Min range <input id="weapon-filter-min-range" name="weapon-filter-min-range" data-filter-min="range" type="number" min="0"></label>
  <label class="check"><input id="weapon-filter-player" name="weapon-filter-player" data-filter-flag="player" type="checkbox"> Player-facing only</label>
</div>
<div class="table-wrap"><table id="weapons-table" class="sortable filterable"><thead><tr><th>Weapon</th><th>Damage type</th><th>Kind</th><th>Per Hit</th><th>Shot Total</th><th>Hits</th><th>Approx. DPS</th><th>Range</th><th>Heat/s</th><th>Sources</th><th>Tags</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderEnemyListing(entries, cache, media, routes) {
  const traitOptions = ["Mini-boss", "Melee", "Kamikaze", "Teleport", "Cloak", "Healer", "Grab", "Sniper", "Flees", "Standard"]
    .map((trait) => `<option value="${escapeAttr(trait)}">${escapeHtml(trait)}</option>`)
    .join("");
  const damageOptions = DAMAGE_TYPES.map((label, index) => `<option value="${index}">${escapeHtml(label)}</option>`).join("");
  const rows = entries
    .map((entry) => {
      const key = entryKey(entry);
      const record = cache.Enemies?.[key];
      if (!record) return "";
      const imageKey = primaryImageKey("Enemies", record, cache);
      const icon = cache.Images?.[imageKey] ? renderImageThumb(cache.Images[imageKey], media) : "";
      const stats = enemyShipStats(record, cache);
      const traits = enemyTraits(record, false);
      const effective = numberValue(stats.hpMax) + numberValue(stats.shieldMax);
      return `<tr data-search="${escapeAttr(`${entry.name} ${traits} ${damageTypeLabel(record.damageType)} ${stats.body}`)}" data-trait="${escapeAttr(traits)}" data-damage="${escapeAttr(record.damageType ?? "")}" data-level="${escapeAttr(record.level ?? 0)}" data-hp="${escapeAttr(effective)}" data-kres="${escapeAttr(record.kineticResist ?? 0)}" data-eres="${escapeAttr(record.energyResist ?? 0)}" data-cres="${escapeAttr(record.corrosiveResist ?? 0)}"><td class="name-cell">${icon}<a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${escapeHtml(valueLabel(record.level))}</td><td>${escapeHtml(valueLabel(stats.hpMax))}</td><td>${escapeHtml(valueLabel(stats.shieldMax))}</td><td>${escapeHtml(valueLabel(record.xp))}</td><td>${enemyTraits(record, true)}</td><td>${escapeHtml(damageTypeLabel(record.damageType))}</td><td>${escapeHtml(valueLabel(record.kineticResist))}</td><td>${escapeHtml(valueLabel(record.energyResist))}</td><td>${escapeHtml(valueLabel(record.corrosiveResist))}</td></tr>`;
    })
    .join("");
  return `<h1>Enemies</h1><p class="muted">The useful first pass for a player: sprite, name, level, survivability, special behavior, damage type, and resistances. HP is taken from the linked ship record; <code>startHp</code> is shown on detail pages when an enemy starts damaged.</p><p><a class="button-link" href="/guides/combat.html">Open combat guide</a></p>
<div class="filter-panel" data-table-filter="enemies-table">
  <input id="enemy-filter-text" name="enemy-filter-text" data-filter-text type="search" placeholder="Search enemy, trait, ship">
  <select id="enemy-filter-trait" name="enemy-filter-trait" data-filter-contains="trait"><option value="">All traits</option>${traitOptions}</select>
  <select id="enemy-filter-damage" name="enemy-filter-damage" data-filter-attr="damage"><option value="">All damage types</option>${damageOptions}</select>
  <label>Min level <input id="enemy-filter-min-level" name="enemy-filter-min-level" data-filter-min="level" type="number" min="0"></label>
  <label>Max level <input id="enemy-filter-max-level" name="enemy-filter-max-level" data-filter-max="level" type="number" min="0"></label>
  <label>Min HP+Shield <input id="enemy-filter-min-hp" name="enemy-filter-min-hp" data-filter-min="hp" type="number" min="0"></label>
</div>
<div class="table-wrap"><table id="enemies-table" class="sortable filterable"><thead><tr><th>Enemy</th><th>Level</th><th>HP</th><th>Shield</th><th>XP</th><th>Traits</th><th>Damage</th><th>Kinetic res</th><th>Energy res</th><th>Corrosive res</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderBossListing(entries, cache, media, routes) {
  const rows = entries.map((entry) => {
    const key = entryKey(entry);
    const boss = cache.Bosses?.[key];
    if (!boss) return "";
    const sprite = renderBossSpriteThumb(boss, cache, media);
    const hp = bossHpStats(boss, cache);
    return `<tr data-hp="${escapeAttr(hp.displayHp || 0)}"><td class="name-cell">${sprite}<a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${escapeHtml(valueLabel(boss.level))}</td><td>${escapeHtml(hp.displayHp !== "" ? formatNumber(hp.displayHp, 0) : "n/a")}</td><td>${escapeHtml(valueLabel(boss.xp))}</td><td>${escapeHtml(valueLabel((boss.basicObjs || []).length))}</td><td>${escapeHtml(valueLabel((boss.turrets || []).length))}</td><td>${entityLink("Drops", boss.drops, cache, routes)}</td><td>${escapeHtml(valueLabel(boss.kineticResist))}</td><td>${escapeHtml(valueLabel(boss.energyResist))}</td><td>${escapeHtml(valueLabel(boss.corrosiveResist))}</td></tr>`;
  }).join("");
  return `<h1>Bosses</h1><p class="muted">Boss sprites are assembled from the boss <code>basicObjs</code> parts used by the game client. HP is calculated from boss HP, linked ship HP, or the sum of destructible sprite-part HP when the boss is made from parts.</p><input class="table-filter" name="table-filter" placeholder="Filter bosses"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Boss</th><th>Level</th><th>HP</th><th>XP</th><th>Sprite parts</th><th>Turrets</th><th>Loot</th><th>Kinetic res</th><th>Energy res</th><th>Corrosive res</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderBodyListing(entries, cache, routes) {
  const spawnersByBody = new Map();
  for (const spawner of Object.values(cache.Spawners || {})) {
    if (!spawner.body) continue;
    spawnersByBody.set(spawner.body, (spawnersByBody.get(spawner.body) || 0) + 1);
  }
  const rows = entries.map((entry) => {
    const key = entryKey(entry);
    const body = cache.Bodies?.[key];
    if (!body) return "";
    return `<tr><td><a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${entityLink("SolarSystems", body.solarSystem, cache, routes)}</td><td>${escapeHtml(valueLabel(body.type))}</td><td>${escapeHtml(valueLabel(body.level))}</td><td>${escapeHtml(valueLabel(body.landable))}</td><td>${escapeHtml(valueLabel((body.shopItems || []).length))}</td><td>${escapeHtml(valueLabel(spawnersByBody.get(key) || 0))}</td><td>${escapeHtml(valueLabel(body.x))}, ${escapeHtml(valueLabel(body.y))}</td></tr>`;
    return `<tr><td><a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${entityLink("SolarSystems", body.solarSystem, cache, routes)}</td><td>${escapeHtml(valueLabel(body.type))}</td><td>${escapeHtml(valueLabel(body.level))}</td><td>${escapeHtml(valueLabel(body.landable))}</td><td>${escapeHtml(valueLabel((body.shopItems || []).length))}</td><td>${escapeHtml(valueLabel(spawnersByBody.get(key) || 0))}</td><td>${escapeHtml(coordinateLabel(body.x))}, ${escapeHtml(coordinateLabel(body.y))}</td></tr>`;
  }).join("");
  return `<h1>Bodies and Locations</h1><p class="muted">Locations are grouped around systems. Use shop count and hostile count to find practical destinations quickly.</p><input class="table-filter" name="table-filter" placeholder="Filter locations"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Location</th><th>System</th><th>Type</th><th>Level</th><th>Landable</th><th>Shop items</th><th>Hostiles</th><th>Coords</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function shipUsageSummary(key, cache) {
  const enemies = Object.values(cache.Enemies || {}).filter((enemy) => enemy.ship === key).length;
  const turrets = Object.values(cache.Turrets || {}).filter((turret) => turret.body === key).length;
  const skins = Object.values(cache.Skins || {}).filter((skin) => skin.ship === key).length;
  return {
    enemies,
    turrets,
    skins
  };
}

function shipBitmapImage(record, cache) {
  return cache.Images?.[record?.bitmap] || null;
}

function imageAnimationStatus(image, media) {
  if (!image) return { animated: false, frames: [] };
  const atlas = findAtlasSprite(media, image);
  const frames = atlas?.frames || [];
  const animated = frames.length > 1
    || Boolean(image.animate)
    || numberValue(image.animationCells, 0) > 1
    || /\.gif$/i.test(image.fileName || "");
  return { animated, frames };
}

function resolveShopItem(item, cache) {
  const key = item?.item || item?.key || item?.itemKey || "";
  const table = item?.table || item?.itemTable || item?.type || "";
  if (table && key) {
    return { table, key, name: item?.name || titleFor(cache[table]?.[key], key) };
  }
  for (const candidate of ["Skins", "Weapons", "Commodities", "Ships", "ArtifactTypes", "Engines"]) {
    if (key && cache[candidate]?.[key]) {
      return { table: candidate, key, name: item?.name || titleFor(cache[candidate]?.[key], key) };
    }
  }
  return { table: "", key, name: item?.name || key || "n/a" };
}

function shopItemLink(item, cache, routes) {
  const resolved = resolveShopItem(item, cache);
  if (resolved.table === "Skins" && cache.Skins?.[resolved.key]?.ship) {
    return entityLink("Ships", cache.Skins[resolved.key].ship, cache, routes, resolved.name);
  }
  return resolved.table
    ? entityLink(resolved.table, resolved.key, cache, routes, resolved.name)
    : `<span>${escapeHtml(resolved.name)}</span>`;
}

function shopItemPriceHtml(item, cache, routes) {
  return (item?.priceItems || []).length
    ? item.priceItems.map((price) => `${entityLink("Commodities", price.item, cache, routes)} x${escapeHtml(valueLabel(price.amount))}`).join("<br>")
    : "<span>n/a</span>";
}

function shipPlayerSources(shipKey, cache) {
  const skinKeys = new Set(
    Object.entries(cache.Skins || {})
      .filter(([, skin]) => skin.ship === shipKey)
      .map(([skinKey]) => skinKey)
  );
  const sources = [];
  for (const [bodyKey, body] of Object.entries(cache.Bodies || {})) {
    const system = cache.SolarSystems?.[body.solarSystem];
    for (const item of body.shopItems || []) {
      const resolved = resolveShopItem(item, cache);
      const matchesShip = resolved.table === "Ships" && resolved.key === shipKey;
      const matchesSkin = resolved.table === "Skins" && skinKeys.has(resolved.key);
      if (!matchesShip && !matchesSkin) continue;
      const sourceKey = `${bodyKey}:${resolved.table}:${resolved.key}`;
      if (sources.some((source) => source.sourceKey === sourceKey)) continue;
      sources.push({
        sourceKey,
        bodyKey,
        bodyName: titleFor(body, bodyKey),
        systemKey: body.solarSystem,
        systemName: titleFor(system, body.solarSystem),
        available: item.available !== false,
        item,
        resolved
      });
    }
  }
  return sources.sort((left, right) => {
    if (left.available !== right.available) return left.available ? -1 : 1;
    return left.bodyName.localeCompare(right.bodyName, "en", { numeric: true });
  });
}

function shipAcquireSummary(shipKey, cache, routes) {
  const sources = shipPlayerSources(shipKey, cache);
  const buyableSources = sources.filter((source) => source.available);
  const primarySources = (buyableSources.length ? buyableSources : sources).slice(0, 2);
  const summary = primarySources.map((source) => entityLink("Bodies", source.bodyKey, cache, routes)).join(", ");
  const extra = (buyableSources.length ? buyableSources : sources).length - primarySources.length;
  return {
    isUserShip: sources.length > 0,
    sources,
    buyableSources,
    status: !sources.length ? "NPC / enemy asset" : buyableSources.length ? "Buyable ship" : "Obtainable ship",
    summaryHtml: sources.length ? `${summary}${extra > 0 ? ` <span class="muted">+${escapeHtml(valueLabel(extra))} more</span>` : ""}` : "<span class=\"muted\">No player acquisition found</span>",
    searchText: sources.map((source) => `${source.bodyName} ${source.systemName} ${source.resolved.name}`).join(" ")
  };
}

function primaryShipSkin(shipKey, cache) {
  const skins = Object.entries(cache.Skins || {})
    .filter(([, skin]) => skin.ship === shipKey)
    .map(([skinKey, skin]) => ({ key: skinKey, skin }));
  if (!skins.length) return null;
  const sources = shipPlayerSources(shipKey, cache);
  const sourceWithSkin = sources.find((source) => source.available && source.resolved.table === "Skins")
    || sources.find((source) => source.resolved.table === "Skins");
  if (sourceWithSkin) {
    const match = skins.find((entry) => entry.key === sourceWithSkin.resolved.key);
    if (match) return match;
  }
  return skins[0];
}

function shipSkinWeapons(skin, cache) {
  return (skin?.upgrades || [])
    .filter((upgrade) => cache.Weapons?.[upgrade.tech])
    .map((upgrade, index) => ({
      index,
      name: upgrade.name || titleFor(cache.Weapons?.[upgrade.tech], upgrade.tech),
      level: upgrade.level,
      key: upgrade.tech,
      record: cache.Weapons?.[upgrade.tech]
    }));
}

function shipSkinBasicTechs(skin, cache) {
  return (skin?.upgrades || [])
    .filter((upgrade) => cache.BasicTechs?.[upgrade.tech])
    .map((upgrade, index) => ({
      index,
      name: upgrade.name || titleFor(cache.BasicTechs?.[upgrade.tech], upgrade.tech),
      level: upgrade.level,
      key: upgrade.tech,
      record: cache.BasicTechs?.[upgrade.tech]
    }));
}

function techIconThumb(imageKey, cache, media) {
  return imageKey && cache.Images?.[imageKey] ? renderImageThumb(cache.Images[imageKey], media) : "";
}

function shipSkinBaseStats(skin) {
  return [
    ["Base health", skin?.statHealth],
    ["Base shield", skin?.statShield],
    ["Base shield regen", skin?.statShieldRegen],
    ["Base armor", skin?.statArmor],
    ["Base speed", skin?.statSpeed],
    ["Base turn speed", skin?.statTurnSpeed],
    ["Base power", skin?.statPower],
    ["Base power regen", skin?.statPowerRegen],
    ["Base cargo", skin?.statCargo]
  ].filter(([, value]) => value !== undefined && value !== null && value !== "");
}

function shipSpecialLabel(key) {
  return ({
    powerReg: "Power regen",
    powerMax: "Max power",
    refire: "Refire / reload",
    cooldown: "Cooldown efficiency",
    speed: "Speed",
    kineticMulti: "Kinetic damage",
    energyMulti: "Energy damage",
    corrosiveMulti: "Corrosive damage",
    kineticAdd: "Flat kinetic damage",
    energyAdd: "Flat energy damage",
    corrosiveAdd: "Flat corrosive damage"
  })[key] || key;
}

function shipSpecialValue(key, value) {
  if (value === null || value === undefined || value === "") return "";
  if (["kineticAdd", "energyAdd", "corrosiveAdd"].includes(key)) return valueLabel(value);
  return `${valueLabel(value)}%`;
}

function shipSkinSpecialRows(skin) {
  return Object.entries(skin?.specials || {})
    .filter(([, value]) => numberValue(value, 0) !== 0)
    .map(([key, value]) => ({ key, label: shipSpecialLabel(key), value: shipSpecialValue(key, value) }));
}

function renderShipListing(entries, cache, media, routes) {
  const typeOptions = [...new Set(entries.map((entry) => cache.Ships?.[entryKey(entry)]?.type).filter(Boolean))]
    .sort()
    .map((type) => `<option value="${escapeAttr(type)}">${escapeHtml(type)}</option>`)
    .join("");
  const rows = entries
    .map((entry) => {
      const key = entryKey(entry);
      const ship = cache.Ships?.[key];
      if (!ship) return "";
      const image = shipBitmapImage(ship, cache);
      const icon = image ? renderImageThumb(image, media) : "";
      const usage = shipUsageSummary(key, cache);
      const acquisition = shipAcquireSummary(key, cache, routes);
      const animation = imageAnimationStatus(image, media);
      const usageText = [
        usage.enemies ? `${usage.enemies} ${usage.enemies === 1 ? "enemy" : "enemies"}` : "",
        usage.turrets ? `${usage.turrets} turret${usage.turrets === 1 ? "" : "s"}` : "",
        usage.skins ? `${usage.skins} skin${usage.skins === 1 ? "" : "s"}` : ""
      ].filter(Boolean).join(" / ") || "No direct reuse";
      const animated = animation.animated ? "yes" : "no";
      return `<tr data-search="${escapeAttr(`${entry.name} ${ship.type || ""} ${usageText} ${acquisition.searchText}`)}" data-type="${escapeAttr(ship.type || "")}" data-hp="${escapeAttr(numberValue(ship.hp, 0))}" data-shield="${escapeAttr(numberValue(ship.shieldHp, 0))}" data-armor="${escapeAttr(numberValue(ship.armor, 0))}" data-animated="${escapeAttr(animated)}" data-user="${acquisition.isUserShip ? "1" : "0"}"><td class="name-cell">${icon}<a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${escapeHtml(valueLabel(ship.type))}</td><td>${escapeHtml(valueLabel(ship.hp))}</td><td>${escapeHtml(valueLabel(ship.shieldHp))}</td><td>${escapeHtml(valueLabel(ship.shieldRegen))}</td><td>${escapeHtml(valueLabel(ship.armor))}</td><td>${escapeHtml(valueLabel(ship.collisionRadius))}</td><td>${escapeHtml(animated === "yes" ? "Yes" : "No")}</td><td>${escapeHtml(acquisition.status)}</td><td>${acquisition.summaryHtml}</td><td>${escapeHtml(usageText)}</td></tr>`;
    })
    .join("");
  return `<h1>Ships</h1><p class="muted">This index starts on the ships a player can actually obtain. Those entries are resolved from hangar shop items that point to ship skins, which in turn point to the underlying ship hull. Uncheck the default filter if you want to inspect NPC and boss assets too.</p>
<div class="filter-panel" data-table-filter="ships-table">
  <input id="ship-filter-text" name="ship-filter-text" data-filter-text type="search" placeholder="Search ship, type, reuse">
  <select id="ship-filter-type" name="ship-filter-type" data-filter-attr="type"><option value="">All ship types</option>${typeOptions}</select>
  <label>Min HP <input id="ship-filter-min-hp" name="ship-filter-min-hp" data-filter-min="hp" type="number" min="0"></label>
  <label>Min shield <input id="ship-filter-min-shield" name="ship-filter-min-shield" data-filter-min="shield" type="number" min="0"></label>
  <label>Min armor <input id="ship-filter-min-armor" name="ship-filter-min-armor" data-filter-min="armor" type="number" min="0"></label>
  <label class="check"><input id="ship-filter-user" name="ship-filter-user" data-filter-flag="user" type="checkbox" checked> User ships only</label>
  <select id="ship-filter-animated" name="ship-filter-animated" data-filter-attr="animated"><option value="">Animated + static</option><option value="yes">Animated only</option><option value="no">Static only</option></select>
</div>
<div class="table-wrap"><table id="ships-table" class="sortable filterable"><thead><tr><th>Ship</th><th>Type</th><th>HP</th><th>Shield</th><th>Shield regen</th><th>Armor</th><th>Radius</th><th>Animated</th><th>Access</th><th>Where to buy</th><th>Referenced by</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderDropListing(entries, cache, routes) {
  const rows = entries.map((entry) => {
    const key = entryKey(entry);
    const drop = cache.Drops?.[key];
    if (!drop) return "";
    const firstItems = (drop.dropItems || []).slice(0, 4).map((item) => entityLink(item.table, item.item, cache, routes)).join(", ");
    return `<tr><td><a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${dropSourceSummary(key, cache, routes)}</td><td>${escapeHtml(valueLabel(drop.crate))}</td><td>${escapeHtml(percentLabel(drop.crate ? drop.chance ?? 1 : 1))}</td><td>${escapeHtml(percentLabel(drop.artifactChance))}</td><td>${escapeHtml(rangeText(drop.fluxMin, drop.fluxMax))}</td><td>${escapeHtml(rangeText(drop.xpMin, drop.xpMax))}</td><td>${firstItems}</td></tr>`;
  }).join("");
  return `<h1>Drops</h1><p class="muted">Open a drop page to see effective chances and the enemies or bosses that reference it.</p><input class="table-filter" name="table-filter" placeholder="Filter drops"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Drop table</th><th>Where it drops</th><th>Crate</th><th>Crate chance</th><th>Artifact</th><th>Flux</th><th>XP</th><th>Preview items</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderCommodityListing(entries, cache, media, routes) {
  const usageCounts = new Map();
  const sourceCounts = new Map();
  for (const drop of Object.values(cache.Drops || {})) {
    for (const item of drop.dropItems || []) {
      if (item.table === "Commodities") sourceCounts.set(item.item, (sourceCounts.get(item.item) || 0) + 1);
    }
  }
  for (const spawner of Object.values(cache.Spawners || {})) {
    for (const item of [...(spawner.drops || []), ...(spawner.drops2 || [])]) {
      if (item.drop) sourceCounts.set(item.drop, (sourceCounts.get(item.drop) || 0) + 1);
    }
  }
  for (const weapon of Object.values(cache.Weapons || {})) {
    for (const lvl of weapon.techLevels || []) {
      for (const key of [lvl.mineralType1, lvl.mineralType2, lvl.mineral_type_1, lvl.mineral_type_2].filter(Boolean)) {
        usageCounts.set(key, (usageCounts.get(key) || 0) + 1);
      }
    }
  }
  const rows = entries.map((entry) => {
    const key = entryKey(entry);
    const item = cache.Commodities?.[key];
    if (!item) return "";
    const icon = cache.Images?.[item.bitmap] ? renderImageThumb(cache.Images[item.bitmap], media) : "";
    return `<tr><td>${icon}<a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${escapeHtml(valueLabel(item.type))}</td><td>${escapeHtml(valueLabel(sourceCounts.get(key) || 0))}</td><td>${escapeHtml(valueLabel(usageCounts.get(key) || 0))}</td><td>${escapeHtml(valueLabel((item.recycleItems || []).length))}</td></tr>`;
  }).join("");
  return `<h1>Items</h1><p class="muted">Use this as a farming and crafting entry point. Each item page explains where it drops and what weapon upgrades consume it.</p><p><a class="button-link" href="/guides/farming.html">Open farming guide</a></p><input class="table-filter" name="table-filter" placeholder="Filter items"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Item</th><th>Type</th><th>Sources</th><th>Upgrade uses</th><th>Recycle outputs</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderArtifactListing(entries, cache, media, routes) {
  const artifacts = entries.map((entry) => {
    const key = entryKey(entry);
    const record = cache.ArtifactTypes?.[key];
    return record ? { entry, key, record } : null;
  }).filter(Boolean);
  const data = artifacts.map(({ entry, record }) => ({
    key: entryKey(entry),
    name: entry.name,
    url: `/${entry.slug}.html`,
    type: record.type,
    statFamily: artifactBaseType(record.type),
    stat: artifactStatLabel(record.type),
    special: Boolean(record.special),
    unique: artifactIsUnique(record),
    dropRate: numberValue(record.dropRate, 0),
    minLevel: record.minLevel ?? 1,
    maxLevel: record.maxLevel ?? 150,
    valueMin: artifactNumericRange(record).min,
    valueMax: artifactNumericRange(record).max,
    valueText: artifactValueRange(record)
  }));
  const artifactOptions = [...data].sort((a, b) => a.name.localeCompare(b.name)).map(({ key, name }) => `<option value="${escapeAttr(key)}">${escapeHtml(name)}</option>`).join("");
  const classicRows = classicArtifactRows(artifacts, cache, media, routes);
  const finderRows = artifactFinderRows(artifacts, cache, routes);
  const statOptions = [...new Set(artifacts.map(({ record }) => artifactBaseType(record.type)))].sort()
    .map((stat) => `<option value="${escapeAttr(stat)}">${escapeHtml(artifactStatLabel(stat))}</option>`).join("");
  const rarityOptions = [...new Set(artifacts.map(({ record }) => artifactRarityLabel(record)))].sort().map((rarity) => `<option value="${escapeAttr(rarity)}">${escapeHtml(rarity)}</option>`).join("");
  const bandOptions = ARTIFACT_FINDER_BANDS.map((band) => `<option value="${escapeAttr(band.id)}">${escapeHtml(band.label)}</option>`).join("");
  const uniqueRows = uniqueArtifactMainRows(cache, media, routes);
  return `<h1>Artifacts</h1>
<p class="muted">Classic artifacts are listed with their roll range, rarity, level gate, and drop weight. Use the calculator first, then filter the table if you want to narrow the pool.</p>
<section class="content-grid">
  <article>
    <h2>Classic Artifact Calculator</h2>
    <p class="muted">Pick an artifact, set the level, and the calculator estimates its share of the eligible pool.</p>
    <div class="calculator" id="artifact-calculator" data-artifacts="${escapeAttr(JSON.stringify(data))}">
      <label>Target artifact <select id="artifact-target">${artifactOptions}</select></label>
      <label>Artifact level <input id="artifact-level" type="number" min="1" max="150" value="80"></label>
      <label>Artifact drop chance <input id="artifact-drop-chance" type="number" min="0" max="100" step="0.1" value="100"><span>%</span></label>
      <label>Attempts <input id="artifact-attempts" type="number" min="1" value="100"></label>
      <output id="artifact-result">Choose an artifact to estimate odds.</output>
    </div>
  </article>
  <article>
    <h2>Artifact Finder</h2>
    <p class="muted">Choose a preset artifact roll band to see where classic artifacts of that level can drop. The table shows the system, location, enemy / spawner / boss context, and the eligible classic artifact pool for that exact roll level.</p>
    <div class="filter-panel" data-table-filter="artifact-finder-table">
      <select id="artifact-finder-band" name="artifact-finder-band" data-filter-attr="band"><option value="">All predefined level ranges</option>${bandOptions}</select>
      <input id="artifact-finder-text" name="artifact-finder-text" data-filter-text type="search" placeholder="Search system, body, enemy, spawner, boss, artifact">
    </div>
    <div class="table-wrap"><table id="artifact-finder-table" class="sortable filterable"><thead><tr><th>Band</th><th>Artifact lvl</th><th>System</th><th>Location</th><th>Mob / Spawner / Boss</th><th>Drop table</th><th>Effective artifact roll</th><th>Qty</th><th>Eligible classic artifacts</th></tr></thead><tbody>${finderRows}</tbody></table></div>
  </article>
  <article>
    <h2>Classic Artifacts</h2>
    <p class="muted">The table below keeps the important details on one line per artifact so the regular pool is easy to scan.</p>
    <div class="filter-panel" data-table-filter="classic-artifact-table">
      <input id="classic-artifact-filter-text" name="classic-artifact-filter-text" data-filter-text type="search" placeholder="Search classic artifact, stat, rarity">
      <select id="classic-artifact-filter-stat" name="classic-artifact-filter-stat" data-filter-attr="stat"><option value="">All stats</option>${statOptions}</select>
      <select id="classic-artifact-filter-rarity" name="classic-artifact-filter-rarity" data-filter-attr="rarity"><option value="">All rarities</option>${rarityOptions}</select>
    </div>
    <div class="table-wrap"><table id="classic-artifact-table" class="sortable filterable"><thead><tr><th>Sprite</th><th>Artifact</th><th>Stat family</th><th>Value range</th><th>Rarity</th><th>Upgradeable</th><th>Drop weight</th><th>Levels</th><th>Type odds</th></tr></thead><tbody>${classicRows}</tbody></table></div>
  </article>
  <article>
    <h2>Unique Artifact Sources</h2>
    <p class="muted">Unique artifacts stay in the same catalog with their boss sources, so the page is easier to scan.</p>
    <div class="filter-panel" data-table-filter="artifact-table">
      <input id="artifact-filter-text" name="artifact-filter-text" data-filter-text type="search" placeholder="Search unique artifact, stat, boss, note">
      <select id="artifact-filter-stat" name="artifact-filter-stat" data-filter-attr="stat"><option value="">All stats</option>${statOptions}</select>
      <select id="artifact-filter-role" name="artifact-filter-role" data-filter-attr="role"><option value="">All roles</option><option value="Buff">Buff</option><option value="Debuff">Debuff</option><option value="Mixed">Mixed</option><option value="Utility">Utility</option><option value="Unknown">Unknown</option></select>
    </div>
  </article>
</section>
<div class="table-wrap"><table id="artifact-table" class="sortable filterable"><thead><tr><th>Sprite</th><th>Unique artifact</th><th>Stat family</th><th>Damage / build focus</th><th>Buff / debuff</th><th>Bosses</th><th>Additional notes</th></tr></thead><tbody>${uniqueRows}</tbody></table></div>`;
}

function isStationBody(body) {
  return STATION_TYPES.has(body?.type);
}

function systemStatusInfo(system, key = "") {
  const destroyed = DESTROYED_SYSTEMS.get(key);
  if (destroyed) return { key: "destroyed", label: destroyed.status, access: destroyed.access, note: destroyed.note };
  if (String(system?.name || "").trim().toLowerCase() === "dev") return { key: "hidden", label: "Hidden", access: "Development system", note: "Filtered out of player navigation pages." };
  return { key: "accessible", label: "Accessible", access: "Selectable", note: "Visible in the player star map data." };
}

function isGenericHiddenBodyName(name, body = null) {
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) return false;
  if (!body && /\bhidden\b/.test(normalized)) return true;
  if (normalized === "hidden" || normalized === "hidden body") return true;
  if (body?.type === "hidden" && /\bhidden\b/.test(normalized)) return true;
  return false;
}

function hiddenBodyDisplayName(bodyKey, body, cache) {
  const name = titleFor(body, bodyKey);
  if (!isGenericHiddenBodyName(name, body)) return name;

  const spawners = Object.entries(cache.Spawners || {}).filter(([, spawner]) => spawner.body === bodyKey);
  const enemyNames = [...new Set(spawners
    .map(([, spawner]) => titleFor(cache.Enemies?.[spawner.enemy || spawner.enemy2], spawner.enemy || spawner.enemy2 || ""))
    .filter((label) => label && !isGenericHiddenBodyName(label)))];
  if (enemyNames.length === 1) return enemyNames[0];

  const bossNames = [...new Set(spawners
    .map(([, spawner]) => titleFor(cache.Bosses?.[spawner.bossSpawner || spawner.bossSpawner2], spawner.bossSpawner || spawner.bossSpawner2 || ""))
    .filter((label) => label && !isGenericHiddenBodyName(label)))];
  if (bossNames.length === 1) return bossNames[0];

  const spawnerNames = [...new Set(spawners
    .map(([spawnerKey, spawner]) => titleFor(spawner, spawnerKey))
    .filter((label) => label && !isGenericHiddenBodyName(label)))];
  if (spawnerNames.length === 1) return spawnerNames[0];

  return "";
}

function bodyDisplayName(bodyKey, body, cache) {
  const sourceName = titleFor(body, bodyKey);
  return hiddenBodyDisplayName(bodyKey, body, cache)
    || (isGenericHiddenBodyName(sourceName, body) ? "Hidden location" : sourceName);
}

function bodyLocationInfo(bodyKey, cache) {
  const body = cache.Bodies?.[bodyKey];
  if (!body) return null;
  const systemKey = body.solarSystem;
  if (!isVisibleMapSystem(cache.SolarSystems?.[systemKey], systemKey)) return null;
  return {
    systemKey,
    systemName: titleFor(cache.SolarSystems?.[systemKey], systemKey),
    bodyKey,
    bodyName: bodyDisplayName(bodyKey, body, cache)
  };
}

function sourceLocationInfo(source, cache) {
  const dedupe = (items) => [...new Map(items.filter(Boolean).map((item) => [`${item.systemKey}:${item.bodyKey}`, item])).values()];
  if (source.body) {
    const direct = bodyLocationInfo(source.body, cache);
    if (direct) return { ...direct, extraLocations: 0 };
  }
  if (source.table === "Enemies") {
    const locations = dedupe(Object.entries(cache.Spawners || {})
      .filter(([, spawner]) => spawner.enemy === source.key || spawner.enemy2 === source.key || (spawner.enemies || []).some((enemy) => refKey("Enemies", enemy) === source.key))
      .map(([, spawner]) => bodyLocationInfo(spawner.body, cache)));
    if (locations.length) return { ...locations[0], extraLocations: locations.length - 1 };
  }
  if (source.table === "Bosses") {
    const bodyLocations = dedupe(Object.entries(cache.Bodies || {})
      .filter(([, body]) => body.boss === source.key)
      .map(([bodyKey]) => bodyLocationInfo(bodyKey, cache)));
    if (bodyLocations.length) return { ...bodyLocations[0], extraLocations: bodyLocations.length - 1 };
    const spawnerLocations = dedupe(Object.entries(cache.Spawners || {})
      .filter(([, spawner]) => spawner.bossSpawner === source.key || spawner.bossSpawner2 === source.key)
      .map(([, spawner]) => bodyLocationInfo(spawner.body, cache)));
    if (spawnerLocations.length) return { ...spawnerLocations[0], extraLocations: spawnerLocations.length - 1 };
  }
  return null;
}

function resolvedSystemBodies(systemKey, cache) {
  const entries = Object.entries(cache.Bodies || {}).filter(([, body]) => body.solarSystem === systemKey);
  const byKey = new Map(entries);
  const memo = new Map();
  const positionFor = (bodyKey) => {
    if (memo.has(bodyKey)) return memo.get(bodyKey);
    const body = byKey.get(bodyKey);
    if (!body) return { x: 0, y: 0 };
    let pos;
    if (body.parent && byKey.has(body.parent)) {
      const parent = positionFor(body.parent);
      const angle = numberValue(body.orbitAngle, 0);
      const radius = numberValue(body.orbitRadius, 0);
      pos = {
        x: parent.x + radius * Math.cos(angle),
        y: parent.y + radius * Math.sin(angle)
      };
    } else {
      pos = { x: numberValue(body.x, 0), y: numberValue(body.y, 0) };
    }
    memo.set(bodyKey, pos);
    return pos;
  };
  return entries.map(([bodyKey, body]) => {
    const pos = positionFor(bodyKey);
    const sourceName = titleFor(body, bodyKey);
    const displayName = bodyDisplayName(bodyKey, body, cache);
    return {
      key: bodyKey,
      name: displayName,
      sourceName,
      displayName,
      type: body.type || "body",
      level: body.level ?? "",
      x: Math.round(pos.x),
      y: Math.round(pos.y),
      radius: numberValue(body.collisionRadius, 80),
      warningRadius: numberValue(body.warningRadius, 0),
      parent: body.parent || "",
      landable: Boolean(body.landable),
      explorable: Boolean(body.explorable),
      station: isStationBody(body),
      boss: body.type === "boss" ? body.boss || "" : "",
      hidden: body.type === "hidden"
    };
  });
}

function renderSystemLocalMap(systemKey, record, cache, media, routes, options = {}) {
  const bodies = resolvedSystemBodies(systemKey, cache);
  if (!bodies.length) return "";
  const bodyByKey = new Map(bodies.map((body) => [body.key, body]));
  const spawners = Object.entries(cache.Spawners || {})
    .filter(([, spawner]) => bodyByKey.has(spawner.body))
    .map(([spawnerKey, spawner], index) => {
      const anchor = bodyByKey.get(spawner.body);
      const angle = ((spawnerKey.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0) + index * 47) % 360) * Math.PI / 180;
      const radius = Math.max(70, Math.min(520, numberValue(spawner.orbitRadius, 0) || numberValue(spawner.innerRadius, 90) + 40));
      return {
        key: spawnerKey,
        name: titleFor(spawner, spawnerKey),
        body: spawner.body,
        bodyName: anchor?.displayName || anchor?.name || "",
        enemy: spawner.enemy || spawner.enemy2 || "",
        enemyName: titleFor(cache.Enemies?.[spawner.enemy || spawner.enemy2], spawner.enemy || spawner.enemy2 || ""),
        level: spawner.level ?? "",
        hidden: Boolean(spawner.hidden),
        bossSpawner: Boolean(spawner.bossSpawner || spawner.bossSpawner2),
        drops: [...(spawner.drops || []), ...(spawner.drops2 || [])].map((drop) => drop.name || titleFor(cache.Drops?.[drop.drop], drop.drop)).slice(0, 4),
        x: Math.round((anchor?.x || 0) + Math.cos(angle) * radius),
        y: Math.round((anchor?.y || 0) + Math.sin(angle) * radius)
      };
    });
  const bossMarkers = bodies
    .filter((body) => body.boss)
    .map((body) => ({ key: body.boss, name: titleFor(cache.Bosses?.[body.boss], body.boss), bodyKey: body.key, x: body.x, y: body.y }));
  const deathLines = (record.deathLines || [])
    .map((line, index) => ({
      key: `${systemKey}-death-line-${index}`,
      x: numberValue(line?.x, NaN),
      y: numberValue(line?.y, NaN),
      x2: numberValue(line?.x2, NaN),
      y2: numberValue(line?.y2, NaN)
    }))
    .filter((line) => Number.isFinite(line.x) && Number.isFinite(line.y) && Number.isFinite(line.x2) && Number.isFinite(line.y2));
  const focusBody = options.focusBodyKey ? bodyByKey.get(options.focusBodyKey) : null;
  const data = {
    name: titleFor(record, systemKey),
    background: resolveCanvasImageAsset(record.background, cache, media),
    bodies,
    spawners,
    bosses: bossMarkers,
    deathLines,
    focus: focusBody ? { kind: "body", key: focusBody.key, label: focusBody.displayName || focusBody.name || focusBody.key } : null,
    routes: {
      Bodies: Object.fromEntries(bodies.map((body) => [body.key, routes.get(`Bodies:${body.key}`) || ""])),
      Spawners: Object.fromEntries(spawners.map((spawner) => [spawner.key, routes.get(`Spawners:${spawner.key}`) || ""])),
      Bosses: Object.fromEntries(bossMarkers.map((boss) => [boss.key, routes.get(`Bosses:${boss.key}`) || ""]))
    }
  };
  const canvasSuffix = `${systemKey}-${options.focusBodyKey || ""}`.replace(/[^a-z0-9_-]/gi, "").slice(0, 40);
  const canvasId = `system-map-${canvasSuffix}`;
  const mapTitle = options.title || "System Map";
  const intro = options.description || "2D placement from body coordinates and orbit data. Red lines mark movement-death barriers, yellow rings are elite zones, and station, boss, and spawner markers are clickable when a page exists. Use the mouse wheel to zoom and drag to pan.";
  const readout = focusBody
    ? `Focused marker shows ${focusBody.displayName || focusBody.name || focusBody.key}. Hover a marker to inspect location, spawner, boss, or elite-zone data.`
    : "Hover a marker to inspect location, spawner, boss, or elite-zone data.";
  return `<article class="system-map-card"><h2>${escapeHtml(mapTitle)}</h2><p class="muted">${escapeHtml(intro)}</p><div class="system-map-wrap"><div class="map-toolbar"><button type="button" data-map-action="zoom-out">-</button><button type="button" data-map-action="zoom-reset">Reset</button><button type="button" data-map-action="zoom-in">+</button></div><canvas id="${escapeAttr(canvasId)}" width="1080" height="660" aria-label="${escapeAttr(titleFor(record, systemKey))} local map"></canvas><div class="map-tooltip" id="${escapeAttr(canvasId)}-tooltip" aria-hidden="true"></div><div class="map-readout" id="${escapeAttr(canvasId)}-readout">${escapeHtml(readout)}</div><div class="map-legend"><span><i class="legend-dot" style="background:#ffd166"></i>Sun</span><span><i class="legend-dot" style="background:#6ee7f9"></i>Station</span><span><i class="legend-dot" style="background:#d7f5ff"></i>Body</span><span><i class="legend-dot" style="background:#c792ea"></i>Spawner</span><span><i class="legend-dot" style="background:#ff6b52"></i>Boss</span><span><i class="legend-dot" style="background:#ff4d6d"></i>Death line</span></div></div><script>window.addEventListener("DOMContentLoaded",()=>initSystemMap("${canvasId}",${JSON.stringify(data)}));</script></article>`;
}

function renderSystemListing(entries, cache, routes) {
  const rows = entries.filter((entry) => isVisibleMapSystem(cache.SolarSystems?.[entryKey(entry)], entryKey(entry))).map((entry) => {
    const key = entryKey(entry);
    const system = cache.SolarSystems?.[key];
    if (!system) return "";
    const bodies = Object.values(cache.Bodies || {}).filter((body) => body.solarSystem === key);
    const status = systemStatusInfo(system, key);
    return `<tr><td><a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${escapeHtml(valueLabel(system.galaxy))}</td><td><span class="status-pill status-${escapeAttr(status.key)}">${escapeHtml(status.label)}</span></td><td>${escapeHtml(valueLabel(system.type))}</td><td>${escapeHtml(rangeText(system.uberMinLevel, system.uberMaxLevel))}</td><td>${escapeHtml(valueLabel(system.pvpDisabled))}</td><td>${escapeHtml(valueLabel(bodies.length))}</td><td>${escapeHtml(valueLabel(system.x))}, ${escapeHtml(valueLabel(system.y))}</td></tr>`;
    return `<tr><td><a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${escapeHtml(valueLabel(system.galaxy))}</td><td><span class="status-pill status-${escapeAttr(status.key)}">${escapeHtml(status.label)}</span></td><td>${escapeHtml(valueLabel(system.type))}</td><td>${escapeHtml(rangeText(system.uberMinLevel, system.uberMaxLevel))}</td><td>${escapeHtml(valueLabel(system.pvpDisabled))}</td><td>${escapeHtml(valueLabel(bodies.length))}</td><td>${escapeHtml(coordinateLabel(system.x))}, ${escapeHtml(coordinateLabel(system.y))}</td></tr>`;
  }).join("");
  return `<h1>Systems</h1><p class="muted">Systems connect the map, locations, music, level ranges, access status, and PvP flags. Use the map for visual navigation.</p><p><a class="button-link" href="/map/">Open galaxy map</a></p><input class="table-filter" name="table-filter" placeholder="Filter systems"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>System</th><th>Galaxy</th><th>Status</th><th>Type</th><th>Level range</th><th>PvP disabled</th><th>Locations</th><th>Coords</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderPlayerSections(table, key, record, cache, media, routes) {
  switch (table) {
    case "SolarSystems":
      return renderSystemPage(key, record, cache, media, routes);
    case "Bodies":
      return renderBodyPage(key, record, cache, media, routes);
    case "Weapons":
      return renderWeaponPage(key, record, cache, routes);
    case "Enemies":
      return renderEnemyPage(key, record, cache, media, routes);
    case "Bosses":
      return renderBossPage(record, cache, media, routes);
    case "Drops":
      return renderDropPage(key, record, cache, routes);
    case "Ships":
      return renderShipPage(key, record, cache, media, routes);
    case "Commodities":
      return renderCommodityPage(key, record, cache, routes);
    case "ArtifactTypes":
      return renderArtifactPage(key, record, cache, routes);
    case "Projectiles":
      return renderProjectilePage(record, cache, routes);
    case "Engines":
      return renderEnginePage(record, cache, routes);
    case "MissionTypes":
      return renderMissionPage(key, record, cache, routes);
    default:
      return renderGeneralInfo(record);
  }
}

function renderSystemPage(key, record, cache, media, routes) {
  const bodies = Object.entries(cache.Bodies || {}).filter(([, body]) => body.solarSystem === key);
  const resolved = new Map(resolvedSystemBodies(key, cache).map((body) => [body.key, body]));
  const bodyRows = bodies.map(([bodyKey, body]) => {
    const pos = resolved.get(bodyKey);
    const bodyLabel = pos?.displayName || (pos?.hidden ? "Hidden location" : null);
    return `<tr><td>${entityLink("Bodies", bodyKey, cache, routes, bodyLabel)}</td><td>${escapeHtml(valueLabel(body.type))}</td><td>${escapeHtml(valueLabel(body.level))}</td><td>${escapeHtml(valueLabel(body.landable))}</td><td>${escapeHtml(valueLabel(body.explorable))}</td><td>${escapeHtml(coordinateLabel(pos?.x))}, ${escapeHtml(coordinateLabel(pos?.y))}</td></tr>`;
  }).join("");
  const warpLinks = renderSystemWarpLinks(key, cache, routes);
  const status = systemStatusInfo(record, key);
  const statusNotice = status.key === "destroyed"
    ? `<article class="notice status-notice"><h2>Destroyed System</h2><p>${escapeHtml(status.note)}</p><p class="muted">${escapeHtml(status.access)}</p></article>`
    : "";
  const map = renderSystemLocalMap(key, record, cache, media, routes);
  return `<section class="system-first">
    <div class="system-title"><p class="eyebrow">Solar system</p><h1>${escapeHtml(titleFor(record, key))}</h1><span class="status-pill status-${escapeAttr(status.key)}">${escapeHtml(status.label)}</span></div>
    ${map}
  </section>
  <section class="content-grid">
    <article><h2>Overview</h2><div class="stat-grid">${statCard("Galaxy", record.galaxy)}${statCard("Status", status.label, status.access)}${statCard("Coordinates", `${coordinateLabel(record.x)}, ${coordinateLabel(record.y)}`)}${statCard("PvP disabled", record.pvpDisabled)}${statCard("Locations", bodies.length)}</div></article>
    ${statusNotice}
    ${warpLinks}
    <article><h2>Locations</h2><input class="table-filter" name="table-filter" placeholder="Filter locations"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Name</th><th>Type</th><th>Level</th><th>Landable</th><th>Explorable</th><th>Map coords</th></tr></thead><tbody>${bodyRows}</tbody></table></div></article>
  </section>`;
}

function renderBodyPage(key, record, cache, media, routes) {
  const spawners = Object.entries(cache.Spawners || {}).filter(([, spawner]) => spawner.body === key);
  const systemRecord = cache.SolarSystems?.[record.solarSystem];
  const map = isStationBody(record) && isVisibleMapSystem(systemRecord, record.solarSystem)
    ? renderSystemLocalMap(record.solarSystem, systemRecord, cache, media, routes, {
      focusBodyKey: key,
      title: "Station Position In System",
      description: `2D system map centered on ${bodyDisplayName(key, record, cache)}. The large cyan marker shows exactly where this station sits inside the system.`
    })
    : "";
  const shopRows = (record.shopItems || []).map((item) => `<tr><td>${shopItemLink(item, cache, routes)}</td><td>${escapeHtml(valueLabel(item.available))}</td><td>${shopItemPriceHtml(item, cache, routes)}</td></tr>`).join("");
  const spawnerRows = spawners.map(([spawnerKey, spawner]) => `<tr><td>${entityLink("Spawners", spawnerKey, cache, routes, spawner.name || spawnerKey)}</td><td>${entityLink("Enemies", spawner.enemy, cache, routes)}</td><td>${entityLink("Bosses", spawner.bossSpawner, cache, routes)}</td><td>${renderSpawnerDropItems([...(spawner.drops || []), ...(spawner.drops2 || [])], cache, routes)}</td><td>${escapeHtml(valueLabel(spawner.level))}</td></tr>`).join("");
  return `${map}<section class="content-grid">
    <article><h2>Location Info</h2><div class="stat-grid">${statCard("System", record.solarSystem ? titleFor(cache.SolarSystems?.[record.solarSystem], record.solarSystem) : "n/a")}${statCard("Safe zone", record.safeZoneRadius)}${statCard("Orbit", record.orbitRadius)}${statCard("Spawners", spawners.length)}</div></article>
    <article><h2>Travel Links</h2><ul class="link-list"><li>System: ${entityLink("SolarSystems", record.solarSystem, cache, routes)}</li><li>Coordinates: ${escapeHtml(coordinateLabel(record.x))}, ${escapeHtml(coordinateLabel(record.y))}</li><li>Type: ${escapeHtml(valueLabel(record.type))}</li></ul></article>
    ${shopRows ? `<article><h2>Shop Items</h2><input class="table-filter" name="table-filter" placeholder="Filter shop"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Item</th><th>Available</th><th>Price</th></tr></thead><tbody>${shopRows}</tbody></table></div></article>` : ""}
    ${spawnerRows ? `<article><h2>Hostiles Around This Location</h2><input class="table-filter" name="table-filter" placeholder="Filter hostiles"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Spawner</th><th>Enemy</th><th>Boss</th><th>Loot</th><th>Level</th></tr></thead><tbody>${spawnerRows}</tbody></table></div></article>` : ""}
  </section>`;
}

function renderWeaponPage(key, record, cache, routes) {
  const techRows = (record.techLevels || []).map((lvl) => {
    const m1 = lvl.mineralType1 || lvl.mineral_type_1;
    const m2 = lvl.mineralType2 || lvl.mineral_type_2;
    const c1 = lvl.mineralType1Cost || lvl.mineral_type_1_Cost || "";
    const c2 = lvl.mineralType2Cost || lvl.mineral_type_2_Cost || "";
    return `<tr><td>${escapeHtml(valueLabel(lvl.id))}</td><td>${escapeHtml(valueLabel(lvl.description))}</td><td>${entityLink("Projectiles", lvl.projectile, cache, routes)}</td><td>${m1 ? `${entityLink("Commodities", m1, cache, routes)} x${escapeHtml(valueLabel(c1))}` : "n/a"}</td><td>${m2 ? `${entityLink("Commodities", m2, cache, routes)} x${escapeHtml(valueLabel(c2))}` : "n/a"}</td></tr>`;
  }).join("");
  const sourceRows = weaponSourceRowsData(key, cache).slice(0, 160).map((row) => {
    const context = row.table === "Spawners"
      ? `${row.body ? entityLink("Bodies", row.body, cache, routes) : "<span>No linked body</span>"}${row.enemy ? ` / ${entityLink("Enemies", row.enemy, cache, routes)}` : ""}${row.dropKey ? ` / ${entityLink("Drops", row.dropKey, cache, routes)}` : ""}`
      : `${escapeHtml(row.contextText || "")}${row.dropKey ? ` / ${entityLink("Drops", row.dropKey, cache, routes)}` : ""}`;
    return `<tr><td>${entityLink(row.table, row.key, cache, routes)}</td><td>${escapeHtml(row.type)}</td><td>${context}</td><td>${escapeHtml(row.chanceText || percentLabel(row.effective))}</td><td>${escapeHtml(row.qty || row.price || "")}</td></tr>`;
  }).join("");
  const eliteRows = weaponEliteRows(record);
  const fireSound = cache.Sounds?.[record.fireSound]?.fileName || "n/a";
  const hitSound = cache.Sounds?.[record.hitSound]?.fileName || "n/a";
  return `<section class="content-grid">
    <article><h2>How To Read This Weapon</h2><div class="stat-grid">${statCard("Damage type", damageTypeLabel(record.damageType))}${statCard("Per hit", record.dmg)}${statCard("Shot total", weaponShotDamage(record), "per hit x hit count")}${statCard("Approx. DPS", weaponDps(record) || "n/a", "shot total + DoT / reload")}${statCard("Heat per sec", weaponHeatPerSecond(record) || "n/a")}${statCard("Hits per shot", weaponHits(record))}${statCard("Tags", weaponTags(record) || "Standard")}</div>${renderDescription(record.description)}</article>
    <article><h2>Combat Stats</h2><div class="stat-grid">${statCard("DoT", record.dot)}${statCard("DoT duration", record.dotDuration)}${statCard("Range", record.range)}${statCard("Radius", record.radius)}${statCard("Reload", record.reloadTime, "ms")}${statCard("Heat cost", record.heatCost)}${statCard("Type", record.type)}</div></article>
    <article><h2>Projectile and Audio</h2><ul class="link-list"><li>Projectile: ${entityLink("Projectiles", record.projectile, cache, routes)}</li><li>Fire sound: ${soundLink(record.fireSound, cache, routes)} <span class="muted">${escapeHtml(fireSound)}</span></li><li>Hit sound: ${soundLink(record.hitSound, cache, routes)} <span class="muted">${escapeHtml(hitSound)}</span></li><li>Icon: ${entityLink("Images", record.techIcon, cache, routes)}</li></ul></article>
    ${sourceRows ? `<article><h2>Where To Get It</h2><input class="table-filter" name="table-filter" placeholder="Filter sources"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Source</th><th>Type</th><th>Context</th><th>Chance / Availability</th><th>Qty / Price</th></tr></thead><tbody>${sourceRows}</tbody></table></div></article>` : ""}
    ${eliteRows ? `<article><h2>Elite Tech Branches</h2><div class="elite-calculator" data-cost-primary="${eliteCostRange(1, 100, "primary")}" data-cost-secondary="${eliteCostRange(1, 100, "secondary")}" data-cost-flux="${eliteCostRange(1, 100, "flux")}"><label>From level <input id="elite-from" name="elite-from" class="elite-from" type="number" min="0" max="99" value="0"></label><label>To level <input id="elite-to" name="elite-to" class="elite-to" type="number" min="1" max="100" value="100"></label><output class="elite-result"></output></div><div class="table-wrap"><table class="sortable"><thead><tr><th>Branch</th><th>Key</th><th>Level 1 value</th><th>Level 100 value</th><th>Meaning</th></tr></thead><tbody>${eliteRows}</tbody></table></div></article>` : ""}
    ${techRows ? `<article><h2>Tech Levels</h2><div class="table-wrap"><table class="sortable"><thead><tr><th>Level</th><th>Description</th><th>Projectile</th><th>Primary Material</th><th>Secondary Material</th></tr></thead><tbody>${techRows}</tbody></table></div></article>` : ""}
  </section>`;
}

function renderEnemyPage(key, record, cache, media, routes) {
  const stats = enemyShipStats(record, cache);
  const loadout = (record.weapons || []).map((weapon) => renderWeaponLoadout(weapon, cache, routes)).join("");
  const dropRefs = enemyDropRefs(key, record, cache);
  const lootLinks = [...new Set(dropRefs.map((item) => item.key))]
    .map((dropKey) => entityLink("Drops", dropKey, cache, routes))
    .join(", ");
  const spawnerRows = linkedEnemySpawners(key, cache)
    .slice(0, 60)
    .map(([spawnerKey, spawner]) => `<tr><td>${entityLink("Spawners", spawnerKey, cache, routes)}</td><td>${entityLink("Bodies", spawner.body, cache, routes)}</td><td>${escapeHtml(valueLabel(spawner.level))}</td><td>${renderSpawnerDropItems([...(spawner.drops || []), ...(spawner.drops2 || [])], cache, routes)}</td></tr>`)
    .join("");
  return `<section class="content-grid">
    <article><h2>Threat Profile</h2><div class="stat-grid">${statCard("Traits", enemyTraits(record, false))}${statCard("Damage type", damageTypeLabel(record.damageType))}${statCard("Damage", record.damage || record.kamikazeDmg)}${statCard("Range", record.range || record.aggroRange)}${statCard("Refire", record.refire)}${statCard("XP", record.xp)}</div>${renderDescription(record.description)}</article>
    <article><h2>Survival Info</h2><div class="stat-grid">${statCard("Max HP", stats.hpMax)}${record.startHp !== undefined ? statCard("Starts With HP", stats.startHp, `${valueLabel(record.startHp)}% of max`) : ""}${statCard("Shield", stats.shieldMax)}${statCard("Armor", stats.armor)}${statCard("Kinetic resist", record.kineticResist)}${statCard("Energy resist", record.energyResist)}${statCard("Corrosive resist", record.corrosiveResist)}</div></article>
    <article><h2>Equipment</h2><ul class="link-list"><li>Ship sprite/base stats: ${entityLink("Ships", record.ship, cache, routes)}${stats.body ? ` <span class="muted">${escapeHtml(stats.body)}</span>` : ""}</li><li>Engine: ${entityLink("Engines", record.engine, cache, routes)}</li><li>Loot: ${lootLinks || missingValue()}</li>${loadout}</ul></article>
    ${renderSourceDropArticles("Enemy", dropRefs, cache, media, routes)}
    ${spawnerRows ? `<article><h2>Found At</h2><input class="table-filter" name="table-filter" placeholder="Filter spawn locations"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Spawner</th><th>Location</th><th>Level</th><th>Spawner drops</th></tr></thead><tbody>${spawnerRows}</tbody></table></div></article>` : ""}
  </section>`;
}

function renderWeaponLoadout(loadout, cache, routes) {
  const key = refKey("Weapons", loadout);
  const range = typeof loadout === "object" && loadout
    ? [loadout.minRange, loadout.maxRange].filter((value) => value !== undefined).join("-")
    : "";
  return `<li>Weapon: ${entityLink("Weapons", key, cache, routes)}${range ? ` <span class="muted">range ${escapeHtml(range)}</span>` : ""}</li>`;
}

function renderBossPage(record, cache, media, routes) {
  const sections = renderBossPageSections(record, cache, media, routes);
  return [sections.preMedia, sections.postMedia].filter(Boolean).join("");
}

function renderBossPageSections(record, cache, media, routes) {
  const hp = bossHpStats(record, cache);
  const dropRefs = normalizeDropRefs(record.drops);
  const lootLinks = [...new Set((record.drops || []).map((item) => item.drop).filter(Boolean))]
    .map((dropKey) => entityLink("Drops", dropKey, cache, routes))
    .join(", ");
  const spawnerLinks = [...new Set((record.spawners || []).map((item) => item.spawner).filter(Boolean))]
    .map((spawnerKey) => `<li>Spawner: ${entityLink("Spawners", spawnerKey, cache, routes)}</li>`)
    .join("");
  const turretLinks = [...new Set((record.turrets || []).map((item) => item.turret).filter(Boolean))]
    .map((turretKey) => `<li>Turret: ${entityLink("Turrets", turretKey, cache, routes)}</li>`)
    .join("");
  return {
    preMedia: `<section class="content-grid">${renderSourceDropArticles("Boss", dropRefs, cache, media, routes)}<article><h2>Boss Stats</h2><div class="stat-grid">${statCard("Level", record.level)}${statCard("HP", hp.displayHp !== "" ? formatNumber(hp.displayHp, 0) : "", hp.source)}${statCard("Total part HP", hp.totalPartHp !== "" ? formatNumber(hp.totalPartHp, 0) : "")}${statCard("Highest part HP", hp.highestPartHp !== "" ? formatNumber(hp.highestPartHp, 0) : "")}${statCard("Destructible parts", hp.destructibleParts)}${statCard("XP", record.xp)}${statCard("Regen", record.regen)}${statCard("Radius", record.radius)}${statCard("Speed", record.speed)}${statCard("Reset", record.resetTime)}${statCard("Body sprites", (record.basicObjs || []).length)}${statCard("Turret sprites", (record.turrets || []).length)}${statCard("Spawner sprites", (record.spawners || []).length)}${statCard("Kinetic resist", record.kineticResist)}${statCard("Energy resist", record.energyResist)}${statCard("Corrosive resist", record.corrosiveResist)}</div></article></section>`,
    postMedia: `<section class="content-grid">${renderBossLayeredPreview(record, cache, media)}${renderBossSpriteParts(record, cache, media, routes)}<article><h2>Encounter Links</h2><ul class="link-list"><li>Loot: ${lootLinks || "<span>n/a</span>"}</li><li>Explosion sound: ${entityLink("Sounds", record.explosionSound, cache, routes)}</li>${spawnerLinks}${turretLinks}</ul></article></section>`
  };
}

function renderDropPage(key, record, cache, routes) {
  const crateChance = record.crate ? Number(record.chance ?? 1) : 1;
  const rows = (record.dropItems || []).map((item) => {
    const effective = crateChance * Number(item.chance ?? 1);
    return `<tr><td>${entityLink(item.table, item.item, cache, routes)}</td><td>${escapeHtml(item.table || "")}</td><td>${escapeHtml(percentLabel(item.chance))}</td><td>${escapeHtml(percentLabel(effective))}</td><td>${escapeHtml(rangeText(item.min, item.max))}</td></tr>`;
  }).join("");
  const sources = dropSourceRows(key, cache, routes);
  const sourceSection = sources
    ? `<article><h2>Where It Appears</h2><input class="table-filter" name="table-filter" placeholder="Filter sources"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Source</th><th>Type</th><th>System</th><th>Location</th><th>Context</th><th>Source chance</th><th>Qty</th></tr></thead><tbody>${sources}</tbody></table></div></article>`
    : `<article><h2>Where It Appears</h2><p class="muted">No direct enemy, boss, or spawner reference for this drop table was found in the downloaded client cache. Some drops still appear only through indirect or server-side logic.</p></article>`;
  return `<section class="content-grid"><article><h2>Loot Summary</h2><div class="stat-grid">${statCard("Crate", record.crate)}${statCard("Crate chance", percentLabel(crateChance))}${statCard("Artifact chance", percentLabel(record.artifactChance))}${statCard("Flux", rangeText(record.fluxMin, record.fluxMax))}${statCard("XP", rangeText(record.xpMin, record.xpMax))}</div></article>${rows ? `<article><h2>Possible Items</h2><input class="table-filter" name="table-filter" placeholder="Filter loot"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Item</th><th>Table</th><th>Chance</th><th>Effective</th><th>Qty</th></tr></thead><tbody>${rows}</tbody></table></div></article>` : ""}${sourceSection}</section>`;
}

function renderCommodityPage(key, record, cache, routes) {
  const sourceData = commoditySourceRowsData(key, cache);
  const dropRows = sourceData.map((row) => {
    const context = row.table === "Spawners"
      ? `${row.body ? entityLink("Bodies", row.body, cache, routes) : "<span>No linked body</span>"}${row.enemy ? ` / ${entityLink("Enemies", row.enemy, cache, routes)}` : ""}${row.boss ? ` / ${entityLink("Bosses", row.boss, cache, routes)}` : ""}`
      : escapeHtml(row.contextText || "");
    return `<tr><td>${entityLink(row.table, row.key, cache, routes)}</td><td>${context}</td><td>${entityLink("Drops", row.dropKey, cache, routes)}</td><td>${escapeHtml(row.chanceText)}</td><td>${escapeHtml(row.qty)}</td></tr>`;
  });
  const bestRows = sourceData.slice(0, 12).map((row) => `<li><strong>${escapeHtml(row.sourceName)}</strong> <span>${escapeHtml(row.chanceText)} ${row.qty ? `x${escapeHtml(row.qty)}` : ""}</span><small>${escapeHtml(row.contextText || row.dropName)}</small></li>`).join("");
  const spawnerRows = Object.entries(cache.Spawners || {}).flatMap(([spawnerKey, spawner]) => [...(spawner.drops || []), ...(spawner.drops2 || [])]
    .filter((item) => item.drop === key)
    .map((item) => `<tr><td>${entityLink("Spawners", spawnerKey, cache, routes)}</td><td>${entityLink("Bodies", spawner.body, cache, routes)}</td><td>Direct spawner entry</td><td>${escapeHtml(percentLabel(item.chance))}</td><td>${escapeHtml(rangeText(item.min, item.max))}</td></tr>`));
  const shopRows = Object.entries(cache.Bodies || {}).flatMap(([bodyKey, body]) => (body.shopItems || [])
    .filter((item) => item.table === "Commodities" && item.item === key)
    .map((item) => `<tr><td>${entityLink("Bodies", bodyKey, cache, routes)}</td><td>Shop</td><td>Shop item</td><td>${escapeHtml(valueLabel(item.available))}</td><td>${(item.priceItems || []).map((p) => `${entityLink("Commodities", p.item, cache, routes)} x${escapeHtml(valueLabel(p.amount))}`).join("<br>")}</td></tr>`));
  const useRows = Object.entries(cache.Weapons || {}).flatMap(([weaponKey, weapon]) => (weapon.techLevels || [])
    .filter((lvl) => lvl.mineralType1 === key || lvl.mineralType2 === key || lvl.mineral_type_1 === key || lvl.mineral_type_2 === key)
    .map((lvl) => `<tr><td>${entityLink("Weapons", weaponKey, cache, routes)}</td><td>Tech level ${escapeHtml(valueLabel(lvl.id))}</td><td>${escapeHtml(valueLabel(lvl.mineralType1 === key || lvl.mineral_type_1 === key ? lvl.mineralType1Cost || lvl.mineral_type_1_Cost : lvl.mineralType2Cost || lvl.mineral_type_2_Cost))}</td></tr>`));
  const recycleRows = (record.recycleItems || []).map((item) => `<tr><td>${entityLink("Commodities", item.item, cache, routes)}</td><td>${escapeHtml(percentLabel(item.chance))}</td><td>${escapeHtml(rangeText(item.min, item.max))}</td></tr>`).join("");
  return `<section class="content-grid">
    <article><h2>Item Summary</h2><div class="stat-grid">${statCard("Type", record.type)}${statCard("Drop tables", dropRows.length)}${statCard("Spawner drops", spawnerRows.length)}${statCard("Shop entries", shopRows.length)}${statCard("Weapon upgrades", useRows.length)}</div></article>
    ${bestRows ? `<article><h2>Best Known Sources</h2><ol class="source-rank">${bestRows}</ol></article>` : ""}
    ${dropRows.length || spawnerRows.length || shopRows.length ? `<article><h2>Where To Get It</h2><input class="table-filter" name="table-filter" placeholder="Filter sources"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Source</th><th>Place / Enemy</th><th>Drop Table</th><th>Effective Chance</th><th>Qty / Price</th></tr></thead><tbody>${[...dropRows, ...spawnerRows, ...shopRows].slice(0, 180).join("")}</tbody></table></div></article>` : ""}
    ${useRows.length ? `<article><h2>Used For Weapon Tech</h2><input class="table-filter" name="table-filter" placeholder="Filter uses"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Weapon</th><th>Upgrade</th><th>Cost</th></tr></thead><tbody>${useRows.slice(0, 160).join("")}</tbody></table></div></article>` : ""}
    ${recycleRows ? `<article><h2>Recycles Into</h2><div class="table-wrap"><table class="sortable"><thead><tr><th>Item</th><th>Chance</th><th>Qty</th></tr></thead><tbody>${recycleRows}</tbody></table></div></article>` : ""}
  </section>`;
}

function eliteZoneForBody(bodyKey, cache, memo = new Map()) {
  if (!bodyKey) return "";
  if (memo.has(bodyKey)) return memo.get(bodyKey);
  const body = cache.Bodies?.[bodyKey];
  if (!body?.solarSystem) {
    memo.set(bodyKey, "");
    return "";
  }
  const positions = resolvedSystemBodies(body.solarSystem, cache);
  const target = positions.find((item) => item.key === bodyKey);
  const warning = positions
    .filter((item) => item.type === "warning" && item.warningRadius)
    .find((item) => target && Math.hypot(target.x - item.x, target.y - item.y) <= item.warningRadius);
  const label = warning ? `${warning.name === "Warning" ? "Elite Zone" : warning.name} in ${titleFor(cache.SolarSystems?.[body.solarSystem], body.solarSystem)}` : "";
  memo.set(bodyKey, label);
  return label;
}

function resourceTechniqueHint(row, cache, eliteMemo) {
  const hints = [];
  const spawner = row.table === "Spawners" ? cache.Spawners?.[row.key] : null;
  if (spawner) {
    const elite = eliteZoneForBody(row.body, cache, eliteMemo);
    if (elite) hints.push(`Elite-zone route: ${elite}`);
    const volume = numberValue(spawner.maxActiveEnemies, 0) + numberValue(spawner.maxActiveEnemies2, 0);
    const stock = numberValue(spawner.nrOfEnemies, 0) + numberValue(spawner.nrOfEnemies2, 0);
    if (volume >= 12 || stock >= 200) hints.push("High-volume spawner");
    if (spawner.hidden) hints.push("Hidden or mission-triggered spawner");
    if (row.enemy) hints.push(`Farm ${titleFor(cache.Enemies?.[row.enemy], row.enemy)}`);
  }
  if (row.table === "Bodies") hints.push("Station/shop source");
  if (row.effective >= 0.95) hints.push("Reliable drop table");
  if (/data chip/i.test(row.dropName || "")) hints.push("Data-chip crate source");
  return hints.slice(0, 3).join("; ") || "Open the item page for the full source list.";
}

function renderArtifactPage(key, record, cache, routes) {
  const related = Object.entries(cache.ArtifactTypes || {})
    .filter(([otherKey, artifact]) => otherKey !== key && artifactBaseType(artifact.type) === artifactBaseType(record.type))
    .map(([otherKey]) => `<li>${entityLink("ArtifactTypes", otherKey, cache, routes)}</li>`)
    .join("");
  const recycleRows = (record.recycleItems || []).map((item) => `<tr><td>${entityLink("Commodities", item.item, cache, routes)}</td><td>${escapeHtml(rangeText(item.min, item.max))}</td></tr>`).join("");
  const eligible = Object.values(cache.ArtifactTypes || {}).filter((artifact) => {
    const min = artifact.minLevel ?? 1;
    const max = artifact.maxLevel ?? 150;
    const recordMin = record.minLevel ?? 1;
    const recordMax = record.maxLevel ?? 150;
    return Math.max(min, recordMin) <= Math.min(max, recordMax);
  });
  const totalWeight = eligible.reduce((sum, artifact) => sum + numberValue(artifact.dropRate), 0);
  const typeChance = totalWeight ? numberValue(record.dropRate) / totalWeight : 0;
  return `<section class="content-grid">
    <article><h2>Artifact Stat</h2><div class="stat-grid">${statCard("Stat", artifactStatLabel(record.type))}${statCard("Value range", artifactValueRange(record))}${statCard("Rarity", artifactRarityLabel(record))}${statCard("Upgradeable", artifactUpgradeLabel(record))}${statCard("Drop weight", record.dropRate)}${statCard("Eligible levels", artifactLevelRange(record))}${statCard("Approx. type odds", percentLabel(typeChance), "among eligible artifact types")}</div></article>
    <article><h2>How To Use It</h2><p>${escapeHtml(artifactStatLabel(record.type))} is the readable effect family. The value range applies the same display multipliers used by the game artifact tooltip, so it is easier to compare with in-game rolls.</p></article>
    ${recycleRows ? `<article><h2>Recycles Into</h2><div class="table-wrap"><table class="sortable"><thead><tr><th>Material</th><th>Qty</th></tr></thead><tbody>${recycleRows}</tbody></table></div></article>` : ""}
    ${related ? `<article><h2>Related Artifact Variants</h2><ul class="link-list">${related}</ul></article>` : ""}
  </section>`;
}

function renderUniqueArtifactPage(item, cache, media, routes) {
  const drop = uniqueDropEntry(cache);
  const focus = uniqueArtifactFocusSummary(item);
  const bossRows = item.bossKeys.map((bossKey) => {
    const boss = cache.Bosses?.[bossKey];
    const artDrops = artifactDropEntries(boss, cache)
      .map((dropItem) => `${entityLink("Drops", dropItem.drop, cache, routes)} x${escapeHtml(rangeText(dropItem.min, dropItem.max))} @ ${escapeHtml(percentLabel(dropItem.chance ?? 1))}`)
      .join("<br>");
    return `<tr><td>${entityLink("Bosses", bossKey, cache, routes)}</td><td>${artDrops || "<span>n/a</span>"}</td></tr>`;
  }).join("");
  const statRows = item.stat && UNIQUE_ARTIFACT_TYPES.has(item.stat)
    ? `<tr><td>${escapeHtml(artifactStatLabel(item.stat))}<br><code class="source-key">${escapeHtml(item.stat)}</code></td><td>${escapeHtml(UNIQUE_ARTIFACT_DESCRIPTIONS[item.stat] || item.stat)}</td><td>${uniqueArtifactFocusCell(item, "general")}</td><td>No</td></tr>`
    : `<tr><td>Server-generated artifact instance</td><td>The downloaded client cache does not expose a fixed stat type or value for this sprite.</td><td>${uniqueArtifactFocusCell(item, "unconfirmed")}</td><td>No, when the received stat is one of <code>ArtifactStat.isUnique</code></td></tr>`;
  const synergyRows = [
    ["Damage type", item.damageType || ""],
    ["Build focus", item.focus || ""],
    ["Best fit", focus || ""]
  ].filter(([, text]) => text).map(([kind, text]) => `<tr><td>${escapeHtml(kind)}</td><td>${escapeHtml(text)}</td></tr>`).join("");
  const sourceRows = [
    ["Sprite", `Atlas image ${item.imageKey} / ${item.image.textureName}`],
    ["Crate", drop ? `${drop[1].name}: crate ${percentLabel(drop[1].chance)}, artifact ${percentLabel(drop[1].artifactChance)}` : "No unique crate record found"],
    ["How it shows up", "Unique artifacts are spawned from the server and resolved when the item is picked up."],
    ["Stat rule", item.stat ? "This family is marked unique and cannot be upgraded." : "No fixed stat row is present in the downloaded client cache."],
    ["Boss link", item.bossKeys.length ? "The boss name matches the artifact and the boss has drop rows." : "No direct boss match in the client data."],
    ["Combat read", focus || "No stable combat focus exposed in the downloaded client cache."]
  ].map(([kind, text]) => `<tr><td>${escapeHtml(kind)}</td><td>${escapeHtml(text)}</td></tr>`).join("");
  return `<section class="entity-hero unique-artifact-hero"><div class="hero-visual">${renderImageCard(item.image, item.imageKey, media, true)}</div><div class="hero-main"><p class="eyebrow">Unique artifact</p><h1>${escapeHtml(item.label)}</h1><span class="pill">${escapeHtml(uniqueArtifactSourceStatus(item, cache))}</span></div><div class="hero-facts"><div class="stat-grid compact">${statCard("Upgradeable", "No")}${statCard("Source", drop ? drop[1].name : "Unique crate")}${statCard("Sprite", item.image.textureName)}${statCard("Mapped stat", item.stat ? artifactStatLabel(item.stat) : "Server-side")}${statCard("Build focus", focus || "Unconfirmed")}</div></div></section>
<section class="content-grid">
  <article><h2>Stats</h2><div class="table-wrap"><table><thead><tr><th>Stat</th><th>Effect</th><th>Build focus</th><th>Upgradeable</th></tr></thead><tbody>${statRows}</tbody></table></div></article>
  ${synergyRows ? `<article><h2>Build Focus</h2><div class="table-wrap"><table><thead><tr><th>Aspect</th><th>Details</th></tr></thead><tbody>${synergyRows}</tbody></table></div></article>` : ""}
  ${bossRows ? `<article><h2>Bosses</h2><div class="table-wrap"><table><thead><tr><th>Boss</th><th>Artifact drop rows</th></tr></thead><tbody>${bossRows}</tbody></table></div></article>` : ""}
  <article><h2>Where It Comes From</h2><div class="table-wrap"><table><thead><tr><th>Source</th><th>Notes</th></tr></thead><tbody>${sourceRows}</tbody></table></div></article>
</section>`;
}

function buildUniqueArtifactPages(cache, media, routes) {
  const rows = uniqueArtifactIconRows(cache, media, routes);
  writePage(path.join(DIST_DIR, "artifacts", "unique", "index.html"), "Unique Artifacts", `<h1>Unique Artifacts</h1><p class="muted">Sprites come from the GameFS atlas, and unique stat families are marked when the client exposes a stable mapping.</p><input class="table-filter" name="table-filter" placeholder="Filter unique artifacts"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Unique artifact</th><th>Stat / effect</th><th>Damage / build focus</th><th>Bosses</th><th>Crate</th><th>Source status</th></tr></thead><tbody>${rows}</tbody></table></div>`);
  for (const item of uniqueArtifactCatalog(cache)) {
    writePage(path.join(DIST_DIR, `${item.slug}.html`), item.label, renderUniqueArtifactPage(item, cache, media, routes));
  }
}

function renderProjectilePage(record, cache, routes) {
  return `<section class="content-grid"><article><h2>Projectile Behavior</h2><div class="stat-grid">${statCard("AI", record.ai)}${statCard("Collision radius", record.collisionRadius)}${statCard("Explosive", record.explosive)}${statCard("Forced rotation", record.forcedRotation)}${statCard("Wave", record.wave)}${statCard("Blast speed", record.aiBlastSpeed)}</div></article><article><h2>Effects</h2><ul class="link-list"><li>Explosion effect: ${entityLink("Images", record.explosionEffect, cache, routes)}</li><li>Explosion sound: ${soundLink(record.explosionSound, cache, routes)}</li></ul></article></section>`;
}

function renderEnginePage(record, cache, routes) {
  return `<section class="content-grid"><article><h2>Engine Stats</h2><div class="stat-grid">${statCard("Acceleration", record.acceleration)}${statCard("Max speed", record.maxSpeed)}${statCard("Rotation speed", record.rotationSpeed)}${statCard("Friction", record.friction)}${statCard("Booster", record.booster)}${statCard("Sound", cache.Sounds?.[record.sound]?.fileName || "n/a")}</div></article></section>`;
}

function renderShipPage(key, record, cache, media, routes) {
  const acquisition = shipAcquireSummary(key, cache, routes);
  const playerSkin = primaryShipSkin(key, cache);
  const skin = playerSkin?.skin;
  const weaponRows = shipSkinWeapons(skin, cache)
    .map((weapon) => `<tr><td class="name-cell">${techIconThumb(weapon.record?.techIcon, cache, media)}${entityLink("Weapons", weapon.key, cache, routes, weapon.name)}</td><td>${escapeHtml(valueLabel(weapon.level))}</td><td>${escapeHtml(valueLabel(weapon.index + 1))}</td><td>${escapeHtml(valueLabel(weapon.record?.type))}</td></tr>`)
    .join("");
  const basicTechRows = shipSkinBasicTechs(skin, cache)
    .map((tech) => `<tr><td class="name-cell">${techIconThumb(tech.record?.techIcon, cache, media)}${escapeHtml(tech.name)}</td><td>${escapeHtml(valueLabel(tech.level))}</td><td>${escapeHtml((tech.record?.description || "").replace(/\s+/g, " ").trim() || "n/a")}</td></tr>`)
    .join("");
  const baseStats = shipSkinBaseStats(skin);
  const specialRows = shipSkinSpecialRows(skin)
    .map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${escapeHtml(item.value)}</td></tr>`)
    .join("");
  const sourceRows = acquisition.sources.map((source) => `<tr><td>${entityLink("Bodies", source.bodyKey, cache, routes)}</td><td>${entityLink("SolarSystems", source.systemKey, cache, routes)}</td><td>${shopItemLink(source.item, cache, routes)}</td><td>${escapeHtml(source.available ? "Yes" : "Listed but unavailable")}</td><td>${shopItemPriceHtml(source.item, cache, routes)}</td></tr>`).join("");
  return `<section class="content-grid">${skin ? `<article><h2>Player Ship Profile</h2><div class="stat-grid">${statCard("Engine", titleFor(cache.Engines?.[skin.engine], skin.engine))}${statCard("Default weapons", shipSkinWeapons(skin, cache).length)}${statCard("Base techs", shipSkinBasicTechs(skin, cache).length)}${statCard("Special traits", shipSkinSpecialRows(skin).length)}${baseStats.map(([label, value]) => statCard(label, value)).join("")}</div>${skin.upgradeDescription ? `<p>${escapeHtml(skin.upgradeDescription)}</p>` : ""}${skin.specialDescription ? `<p>${escapeHtml(skin.specialDescription)}</p>` : ""}</article>` : ""}<article><h2>Ship Stats</h2><div class="stat-grid">${statCard("HP", record.hp)}${statCard("Shield", record.shieldHp)}${statCard("Regen", record.shieldRegen)}${statCard("Armor", record.armor)}${statCard("Radius", record.collisionRadius)}${statCard("Image", titleFor(cache.Images?.[record.bitmap], record.bitmap))}${statCard("Player access", acquisition.status)}${statCard("Known hangars", acquisition.sources.length)}</div></article>${weaponRows ? `<article><h2>Default Weapons</h2><div class="table-wrap"><table class="sortable"><thead><tr><th>Weapon</th><th>Start level</th><th>Slot</th><th>Type</th></tr></thead><tbody>${weaponRows}</tbody></table></div></article>` : ""}${basicTechRows ? `<article><h2>Default Upgrades</h2><div class="table-wrap"><table class="sortable"><thead><tr><th>Tech</th><th>Start level</th><th>What it gives</th></tr></thead><tbody>${basicTechRows}</tbody></table></div></article>` : ""}${specialRows ? `<article><h2>Ship Specialties</h2><div class="table-wrap"><table class="sortable"><thead><tr><th>Trait</th><th>Bonus</th></tr></thead><tbody>${specialRows}</tbody></table></div></article>` : ""}${sourceRows ? `<article><h2>Where To Buy / Obtain It</h2><input class="table-filter" name="table-filter" placeholder="Filter hangars"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Hangar</th><th>System</th><th>Shop entry</th><th>Available</th><th>Price</th></tr></thead><tbody>${sourceRows}</tbody></table></div></article>` : `<article><h2>Where To Buy / Obtain It</h2><p class="muted">No player-facing hangar or skin shop entry references this hull in the downloaded client cache, so it is treated as an NPC / enemy asset.</p></article>`}</section>`;
}

function questCategoryInfo(record = {}) {
  const majorType = String(record?.majorType || "").toLowerCase();
  if (majorType === "time") return { id: "timed", label: "Timed" };
  if (majorType === "pvpchain") return { id: "pvp", label: "PvP" };
  return { id: "story", label: "Story" };
}

function cleanQuestText(value) {
  return cleanText(value)
    .replace(/\u0008/g, "")
    .replace(/\[(\/?)h\]/gi, "")
    .replace(/\[player\]/gi, "player")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

function questHasPlaceholders(value) {
  return /\[(amount|location\d+|player)\]/i.test(String(value || ""));
}

function renderQuestNarrative(value, fallback = "") {
  const text = cleanQuestText(value);
  if (!text) return fallback ? `<p class="muted">${escapeHtml(fallback)}</p>` : "";
  return text
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${escapeHtml(part)}</p>`)
    .join("");
}

function missionStarterInfo(missionKey, cache) {
  const hit = Object.entries(cache.Bodies || {}).find(([, body]) => body.mission === missionKey);
  if (!hit) return null;
  const [bodyKey, body] = hit;
  return {
    bodyKey,
    bodyName: bodyDisplayName(bodyKey, body, cache),
    bodyType: body.type || "",
    systemKey: body.solarSystem,
    systemName: titleFor(cache.SolarSystems?.[body.solarSystem], body.solarSystem)
  };
}

function missionPreviousKey(missionKey, cache) {
  return Object.entries(cache.MissionTypes || {}).find(([, mission]) => mission.nextMission === missionKey)?.[0] || "";
}

function missionChainEntries(missionKey, cache) {
  let startKey = missionKey;
  const backSeen = new Set();
  while (startKey) {
    const prev = missionPreviousKey(startKey, cache);
    if (!prev || backSeen.has(prev)) break;
    backSeen.add(prev);
    startKey = prev;
  }
  const chain = [];
  let current = startKey;
  const forwardSeen = new Set();
  while (current && cache.MissionTypes?.[current] && !forwardSeen.has(current)) {
    forwardSeen.add(current);
    chain.push(current);
    current = cache.MissionTypes[current].nextMission;
  }
  return chain;
}

function missionCountValue(record) {
  for (const field of ["value", "targetLvlReq", "reqLvl"]) {
    if (record?.[field] !== undefined && record[field] !== null && record[field] !== "") return record[field];
  }
  return "";
}

function missionLevelRange(record) {
  const min = numberValue(record?.minLvl, 0);
  const max = numberValue(record?.maxLvl, 0);
  if (min > 0 && max <= 0) return valueLabel(min);
  if (min <= 0 && max > 0) return valueLabel(max);
  if (min === 0 && max === 0) return "0";
  return rangeText(record?.minLvl, record?.maxLvl);
}

function missionItemInfo(record, cache) {
  const key = refKey("Commodities", record?.item);
  return key ? { key, name: titleFor(cache.Commodities?.[key], key) } : null;
}

function missionEnemyTargets(record, cache) {
  const entries = [];
  if (record?.enemy) {
    const key = refKey("Enemies", record.enemy);
    if (key) entries.push({ table: "Enemies", key, name: titleFor(cache.Enemies?.[key], key) });
  }
  if (record?.boss) {
    const key = refKey("Bosses", record.boss);
    if (key) entries.push({ table: "Bosses", key, name: titleFor(cache.Bosses?.[key], key) });
  }
  for (const key of record?.addedEnemies || []) {
    if (!key) continue;
    if (cache.Bosses?.[key]) {
      entries.push({ table: "Bosses", key, name: titleFor(cache.Bosses?.[key], key) });
    } else if (cache.Enemies?.[key]) {
      entries.push({ table: "Enemies", key, name: titleFor(cache.Enemies?.[key], key) });
    }
  }
  return [...new Map(entries.map((item) => [`${item.table}:${item.key}`, item])).values()];
}

function missionBodyTargets(record, cache) {
  const bodyKeys = [refKey("Bodies", record?.body), ...(record?.addedBodies || []).map((item) => refKey("Bodies", item))].filter(Boolean);
  return [...new Map(bodyKeys.map((bodyKey) => {
    const body = cache.Bodies?.[bodyKey];
    const location = bodyLocationInfo(bodyKey, cache);
    return [bodyKey, {
      bodyKey,
      bodyName: bodyDisplayName(bodyKey, body, cache),
      bodyType: body?.type || "",
      systemKey: location?.systemKey || body?.solarSystem || "",
      systemName: location?.systemName || titleFor(cache.SolarSystems?.[body?.solarSystem], body?.solarSystem)
    }];
  })).values()];
}

function missionSystemTargets(record, cache) {
  const systemKeys = [record?.solarsystem, record?.solarSystem, ...(record?.addedSystems || [])].filter(Boolean);
  for (const body of missionBodyTargets(record, cache)) {
    if (body.systemKey) systemKeys.push(body.systemKey);
  }
  return [...new Map(systemKeys.map((systemKey) => [systemKey, {
    systemKey,
    systemName: titleFor(cache.SolarSystems?.[systemKey], systemKey)
  }])).values()];
}

function missionObjectiveSummaryHtml(record, cache, routes) {
  const amount = missionCountValue(record);
  const item = missionItemInfo(record, cache);
  const enemies = missionEnemyTargets(record, cache);
  const bodies = missionBodyTargets(record, cache);
  const systems = missionSystemTargets(record, cache);
  const enemyLinks = enemies.map((enemy) => entityLink(enemy.table, enemy.key, cache, routes)).join(", ");
  const bodyLinks = bodies.map((body) => entityLink("Bodies", body.bodyKey, cache, routes, body.bodyName)).join(", ");
  const systemLinks = systems.map((system) => entityLink("SolarSystems", system.systemKey, cache, routes, system.systemName)).join(", ");
  switch (record.type) {
    case "kill":
      return `${amount ? `Defeat ${escapeHtml(valueLabel(amount))}` : "Defeat"} ${enemyLinks || (record.subtype === "player" ? "another player" : record.subtype === "boss" ? "the boss target" : record.subtype === "spawner" ? "the required spawners" : "the quest targets")}${systemLinks ? ` in ${systemLinks}` : ""}`;
    case "pickup":
      return `${amount ? `Collect ${escapeHtml(valueLabel(amount))}` : "Collect"} ${item ? entityLink("Commodities", item.key, cache, routes, item.name) : "the required item"}`;
    case "recycle":
      return `${amount ? `Recycle ${escapeHtml(valueLabel(amount))}` : "Recycle"} ${item ? entityLink("Commodities", item.key, cache, routes, item.name) : "the required material"}`;
    case "transport":
      return bodyLinks ? `Travel / deliver to ${bodyLinks}` : systemLinks ? `Travel to ${systemLinks}` : "Travel to the linked story location";
    case "level":
      return `Reach level ${escapeHtml(valueLabel(amount || record.minLvl || record.maxLvl || record.reqLvl || ""))}`;
    case "explore":
      return bodyLinks || systemLinks || "Explore the target area";
    default:
      return escapeHtml(valueLabel(record.type || "Quest objective"));
  }
}

function missionRewardArticle(record, cache, routes) {
  const dropKey = refKey("Drops", record.drop);
  const drop = cache.Drops?.[dropKey];
  if (!dropKey || !drop) return `<article><h2>Rewards</h2><p class="muted">No mission reward table was resolved from the downloaded client cache.</p></article>`;
  const rows = (drop.dropItems || []).slice(0, 12).map((item) => `<tr><td>${entityLink(item.table, item.item, cache, routes)}</td><td>${escapeHtml(percentLabel(item.chance))}</td><td>${escapeHtml(rangeText(item.min, item.max))}</td></tr>`).join("");
  return `<article><h2>Rewards</h2><div class="stat-grid">${statCard("Reward table", drop.name || dropKey)}${statCard("XP", rangeText(drop.xpMin, drop.xpMax))}${statCard("Flux", rangeText(drop.fluxMin, drop.fluxMax))}${statCard("Items", (drop.dropItems || []).length)}</div><p>Resolved from ${entityLink("Drops", dropKey, cache, routes)}.</p>${rows ? `<div class="table-wrap"><table><thead><tr><th>Reward</th><th>Chance</th><th>Qty</th></tr></thead><tbody>${rows}</tbody></table></div>` : ""}</article>`;
}

function missionSolutionSteps(key, record, cache, routes) {
  const steps = [];
  const starter = missionStarterInfo(key, cache);
  const item = missionItemInfo(record, cache);
  const enemies = missionEnemyTargets(record, cache);
  const bodies = missionBodyTargets(record, cache);
  const systems = missionSystemTargets(record, cache);
  const amount = missionCountValue(record);
  if (starter) steps.push(`Start at ${entityLink("Bodies", starter.bodyKey, cache, routes, starter.bodyName)} in ${entityLink("SolarSystems", starter.systemKey, cache, routes, starter.systemName)}.`);
  if (bodies.length) {
    steps.push(`Travel to ${bodies.map((body) => entityLink("Bodies", body.bodyKey, cache, routes, body.bodyName)).join(", ")}.`);
  } else if (systems.length) {
    steps.push(`Go to ${systems.map((system) => entityLink("SolarSystems", system.systemKey, cache, routes, system.systemName)).join(", ")}.`);
  }
  switch (record.type) {
    case "kill":
      steps.push(`${amount ? `Defeat ${escapeHtml(valueLabel(amount))}` : "Defeat"} ${enemies.length ? enemies.map((enemy) => entityLink(enemy.table, enemy.key, cache, routes)).join(", ") : record.subtype === "player" ? "another player" : record.subtype === "boss" ? "the boss target" : record.subtype === "spawner" ? "the required spawners" : "the required hostiles"}.`);
      break;
    case "pickup":
      steps.push(`${amount ? `Collect ${escapeHtml(valueLabel(amount))}` : "Collect"} ${item ? entityLink("Commodities", item.key, cache, routes, item.name) : "the required item"}.`);
      break;
    case "recycle":
      steps.push(`${amount ? `Collect ${escapeHtml(valueLabel(amount))}` : "Collect"} ${item ? entityLink("Commodities", item.key, cache, routes, item.name) : "the required material"} and recycle it at the requested station.`);
      break;
    case "transport":
      steps.push(bodies.length ? "Land or interact at the target location(s) to advance the quest." : "Follow the travel objective described in the quest text.");
      break;
    case "level":
      steps.push(`Reach level ${escapeHtml(valueLabel(amount || record.minLvl || record.maxLvl || record.reqLvl || ""))}.`);
      break;
    default:
      if (item) steps.push(`Use ${entityLink("Commodities", item.key, cache, routes, item.name)} as the structured quest target.`);
      break;
  }
  if (record.nextMission) steps.push(`Turn in the quest to unlock ${entityLink("MissionTypes", record.nextMission, cache, routes)}.`);
  if (questHasPlaceholders(record.description) || questHasPlaceholders(record.completeDescription)) {
    steps.push("Some exact counts or destination names still come from placeholder text in the client cache, so the narrative text remains important.");
  }
  return steps.length ? `<article><h2>Detected Solution Path</h2><p class="muted">This path is reconstructed from structured quest fields, linked locations, targets, and the mission text.</p><ol class="steps">${steps.map((step) => `<li>${step}</li>`).join("")}</ol></article>` : "";
}

function dailyMissionCatalog(cache) {
  return Object.entries(cache.DailyMissions || {})
    .map(([key, record]) => {
      const slug = slugify(`${record.name || key}-${key}`);
      return { key, name: record.name || key, record, slug: `quests/daily/${slug}`, url: `/quests/daily/${slug}.html` };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function dailyMissionRewards(record, cache) {
  return (record.reward || []).map((rewardKey) => {
    const reward = cache.DailyMissionRewards?.[rewardKey];
    const low = Math.min(numberValue(reward?.k1, 0), numberValue(reward?.k2, numberValue(reward?.k1, 0)));
    const high = Math.max(numberValue(reward?.k1, 0), numberValue(reward?.k2, numberValue(reward?.k1, 0)));
    return {
      key: rewardKey,
      reward,
      itemKey: reward?.itemKey || "",
      itemName: reward?.itemKey ? titleFor(cache.Commodities?.[reward.itemKey], reward.itemKey) : "",
      amount: reward ? rangeText(low || reward.k1 || "", high || reward.k2 || reward.k1 || "") : ""
    };
  });
}

function renderMissionPage(key, record, cache, routes) {
  const category = questCategoryInfo(record);
  const starter = missionStarterInfo(key, cache);
  const systems = missionSystemTargets(record, cache);
  const bodies = missionBodyTargets(record, cache);
  const enemies = missionEnemyTargets(record, cache);
  const item = missionItemInfo(record, cache);
  const amount = missionCountValue(record);
  const previousKey = missionPreviousKey(key, cache);
  const chain = missionChainEntries(key, cache);
  const chainRows = chain.map((missionKey, index) => {
    const mission = cache.MissionTypes?.[missionKey];
    return `<tr><td>${index + 1}</td><td>${missionKey === key ? `<strong>${entityLink("MissionTypes", missionKey, cache, routes)}</strong>` : entityLink("MissionTypes", missionKey, cache, routes)}</td><td>${escapeHtml(questCategoryInfo(mission).label)}</td><td>${escapeHtml(valueLabel(mission?.type))}</td></tr>`;
  }).join("");
  return `<section class="content-grid">
    <article><h2>Quest Overview</h2><div class="stat-grid">${statCard("Category", category.label)}${statCard("Type", record.type)}${statCard("Subtype", record.subtype || "n/a")}${statCard("Level range", missionLevelRange(record))}${statCard("Target value", amount || "n/a")}${statCard("Expires", record.expires || "n/a")}${statCard("In order", record.mustBeInorder)}${statCard("Starter", starter?.bodyName || "No explicit starter body")}</div><p>${missionObjectiveSummaryHtml(record, cache, routes)}</p></article>
    <article><h2>Start Here</h2><ul class="link-list">${starter ? `<li>Start location: ${entityLink("Bodies", starter.bodyKey, cache, routes, starter.bodyName)}</li><li>System: ${entityLink("SolarSystems", starter.systemKey, cache, routes, starter.systemName)}</li><li>Location type: ${escapeHtml(valueLabel(starter.bodyType))}</li>` : "<li>No explicit starter body was linked in <code>Bodies.mission</code>; this quest may start automatically, from another quest, or from a hidden trigger.</li>"}</ul></article>
    <article><h2>Where To Go</h2><ul class="link-list">${systems.length ? systems.map((system) => `<li>System: ${entityLink("SolarSystems", system.systemKey, cache, routes, system.systemName)}</li>`).join("") : "<li>No fixed system was resolved from the structured fields.</li>"}${bodies.length ? bodies.map((body) => `<li>Location: ${entityLink("Bodies", body.bodyKey, cache, routes, body.bodyName)}${body.systemKey ? ` <span class="muted">in ${entityLink("SolarSystems", body.systemKey, cache, routes, body.systemName)}</span>` : ""}</li>`).join("") : ""}</ul></article>
    <article><h2>What To Kill / Collect</h2><ul class="link-list">${enemies.length ? `<li>Targets: ${enemies.map((enemy) => entityLink(enemy.table, enemy.key, cache, routes)).join(", ")}</li>` : ""}${item ? `<li>Item: ${entityLink("Commodities", item.key, cache, routes, item.name)}</li>` : ""}${!enemies.length && !item ? "<li>No explicit enemy or item target was exposed in the structured fields.</li>" : ""}</ul></article>
    ${missionRewardArticle(record, cache, routes)}
    ${chainRows ? `<article><h2>Quest Chain</h2><div class="stat-grid">${statCard("Previous", previousKey ? titleFor(cache.MissionTypes?.[previousKey], previousKey) : "Start of chain")}${statCard("Next", record.nextMission ? titleFor(cache.MissionTypes?.[record.nextMission], record.nextMission) : "End of chain")}${statCard("Chain size", chain.length || 1)}${statCard("Current step", chain.includes(key) ? `${chain.indexOf(key) + 1}/${chain.length}` : "n/a")}</div><div class="table-wrap"><table><thead><tr><th>Step</th><th>Quest</th><th>Category</th><th>Type</th></tr></thead><tbody>${chainRows}</tbody></table></div></article>` : ""}
    ${missionSolutionSteps(key, record, cache, routes)}
    <article><h2>Quest Text</h2><h3>Description</h3>${renderQuestNarrative(record.description, "No description was exposed for this quest.")}<h3>Completion</h3>${renderQuestNarrative(record.completeDescription, "No completion text was exposed for this quest.")}${questHasPlaceholders(record.description) || questHasPlaceholders(record.completeDescription) ? `<p class="muted">This quest still contains placeholder markers in the client cache, so some counts or location names may only be partially resolved automatically.</p>` : ""}</article>
  </section>`;
}

function renderDailyMissionPage(item, cache, media, routes) {
  const record = item.record;
  const image = cache.Images?.[record.bitmap];
  const targets = record.targets || {};
  const systemKey = targets.solarsystem || "";
  const planetKey = targets.planet || "";
  const enemyTargets = (targets.enemies || []).map((key) => cache.Bosses?.[key]
    ? { table: "Bosses", key }
    : { table: "Enemies", key });
  const rewards = dailyMissionRewards(record, cache);
  const rewardRows = rewards.map((reward) => `<tr><td>${reward.itemKey ? entityLink("Commodities", reward.itemKey, cache, routes, reward.itemName) : escapeHtml(reward.key.toUpperCase())}</td><td>${escapeHtml(reward.amount || reward.key)}</td></tr>`).join("");
  const objective = record.type === "kill"
    ? `Defeat ${escapeHtml(valueLabel(targets.count || 1))} ${enemyTargets.length ? enemyTargets.map((enemy) => entityLink(enemy.table, enemy.key, cache, routes)).join(", ") : targets.any ? "enemies of any kind" : "enemies"}${systemKey ? ` in ${entityLink("SolarSystems", systemKey, cache, routes)}` : ""}.`
    : record.type === "pickup"
      ? `Collect ${escapeHtml(valueLabel(targets.count || 1))} ${targets.type ? entityLink("Commodities", targets.type, cache, routes) : "target items"}.`
      : record.type === "land_on_planet"
        ? `Land on ${entityLink("Bodies", planetKey, cache, routes)}.`
        : record.type === "upgrade_tech"
          ? "Upgrade one ship tech in your fleet."
          : escapeHtml(cleanQuestText(record.description));
  const steps = [
    systemKey ? `Travel to ${entityLink("SolarSystems", systemKey, cache, routes)}.` : "",
    planetKey ? `Land on ${entityLink("Bodies", planetKey, cache, routes)}.` : "",
    record.type === "kill" ? `Complete ${escapeHtml(valueLabel(targets.count || 1))} kill(s)${enemyTargets.length ? ` against ${enemyTargets.map((enemy) => entityLink(enemy.table, enemy.key, cache, routes)).join(", ")}` : targets.any ? " against any enemy" : ""}.` : "",
    record.type === "pickup" ? `Collect ${escapeHtml(valueLabel(targets.count || 1))} ${targets.type ? entityLink("Commodities", targets.type, cache, routes) : "target items"}.` : "",
    record.type === "upgrade_tech" ? "Open the ship tech screen and upgrade any ship tech once." : "",
    "Claim the daily reward after the objective completes."
  ].filter(Boolean);
  const visual = image ? `<div class="hero-visual">${renderImageCard(image, record.bitmap, media, true)}</div>` : "";
  return `<section class="entity-hero">${visual}<div class="hero-main"><p class="eyebrow">Daily quest</p><h1>${escapeHtml(item.name)}</h1><span class="pill">Daily</span></div><div class="hero-facts"><div class="stat-grid compact">${statCard("Level", record.level)}${statCard("Type", record.type)}${statCard("Target count", targets.count || 1)}${statCard("Rewards", rewards.length)}</div></div></section>
<section class="content-grid">
  <article><h2>Objective</h2><div class="stat-grid">${statCard("Level", record.level)}${statCard("Type", record.type)}${statCard("System", systemKey ? titleFor(cache.SolarSystems?.[systemKey], systemKey) : "n/a")}${statCard("Planet", planetKey ? titleFor(cache.Bodies?.[planetKey], planetKey) : "n/a")}${statCard("Count", targets.count || 1)}</div><p>${objective}</p>${renderQuestNarrative(record.description)}</article>
  <article><h2>Targets</h2><ul class="link-list">${systemKey ? `<li>System: ${entityLink("SolarSystems", systemKey, cache, routes)}</li>` : ""}${planetKey ? `<li>Planet: ${entityLink("Bodies", planetKey, cache, routes)}</li>` : ""}${enemyTargets.length ? `<li>Enemies / bosses: ${enemyTargets.map((enemy) => entityLink(enemy.table, enemy.key, cache, routes)).join(", ")}</li>` : ""}${targets.type ? `<li>Item: ${entityLink("Commodities", targets.type, cache, routes)}</li>` : ""}${targets.any ? "<li>Any matching target is valid.</li>" : ""}</ul></article>
  <article><h2>Rewards</h2>${rewardRows ? `<div class="table-wrap"><table><thead><tr><th>Reward</th><th>Amount / roll</th></tr></thead><tbody>${rewardRows}</tbody></table></div>` : `<p class="muted">No resolved reward rows were found for this daily quest.</p>`}</article>
  <article><h2>Detected Solution Path</h2><ol class="steps">${steps.map((step) => `<li>${step}</li>`).join("")}</ol></article>
</section>`;
}

function renderQuestRows(entries, cache, routes, predicate) {
  return entries
    .filter((entry) => predicate(cache.MissionTypes?.[entryKey(entry)], entry))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const key = entryKey(entry);
      const record = cache.MissionTypes?.[key];
      if (!record) return "";
      const category = questCategoryInfo(record);
      const starter = missionStarterInfo(key, cache);
      const systems = missionSystemTargets(record, cache);
      const rewards = cache.Drops?.[record.drop];
      const chain = missionChainEntries(key, cache);
      const index = chain.indexOf(key);
      const chainText = chain.length > 1 ? `Part ${index + 1} / ${chain.length}` : "Standalone";
      return `<tr data-search="${escapeAttr(`${entry.name} ${category.label} ${record.type || ""} ${record.subtype || ""} ${starter?.bodyName || ""} ${systems.map((system) => system.systemName).join(" ")}`)}" data-kind="${escapeAttr(record.type || "")}"><td><a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${escapeHtml(category.label)}</td><td>${escapeHtml(valueLabel(record.type))}</td><td>${starter ? `${entityLink("Bodies", starter.bodyKey, cache, routes, starter.bodyName)}<div class="muted">${entityLink("SolarSystems", starter.systemKey, cache, routes, starter.systemName)}</div>` : `<span class="muted">No explicit starter body</span>`}</td><td>${systems.length ? systems.map((system) => entityLink("SolarSystems", system.systemKey, cache, routes, system.systemName)).join(", ") : `<span class="muted">No fixed system</span>`}</td><td>${missionObjectiveSummaryHtml(record, cache, routes)}</td><td>${rewards ? entityLink("Drops", record.drop, cache, routes, rewards.name || record.drop) : `<span class="muted">No reward table</span>`}</td><td>${escapeHtml(chainText)}</td></tr>`;
    })
    .join("");
}

function renderDailyQuestRows(cache, routes) {
  return dailyMissionCatalog(cache).map((item) => {
    const record = item.record;
    const rewards = dailyMissionRewards(record, cache);
    const targetText = record.targets?.enemies?.length
      ? record.targets.enemies.map((key) => cache.Bosses?.[key] ? entityLink("Bosses", key, cache, routes) : entityLink("Enemies", key, cache, routes)).join(", ")
      : record.targets?.type
        ? entityLink("Commodities", record.targets.type, cache, routes)
        : record.targets?.planet
          ? entityLink("Bodies", record.targets.planet, cache, routes)
          : record.targets?.solarsystem
            ? entityLink("SolarSystems", record.targets.solarsystem, cache, routes)
            : "<span class=\"muted\">General objective</span>";
    return `<tr data-search="${escapeAttr(`${item.name} daily ${record.type || ""} ${record.description || ""}`)}" data-kind="${escapeAttr(record.type || "")}"><td><a href="${escapeAttr(item.url)}">${escapeHtml(item.name)}</a></td><td>${escapeHtml(valueLabel(record.level))}</td><td>${escapeHtml(valueLabel(record.type))}</td><td>${record.targets?.solarsystem ? entityLink("SolarSystems", record.targets.solarsystem, cache, routes) : record.targets?.planet ? entityLink("Bodies", record.targets.planet, cache, routes) : `<span class="muted">Any</span>`}</td><td>${targetText}</td><td>${rewards.map((reward) => reward.itemKey ? entityLink("Commodities", reward.itemKey, cache, routes, reward.itemName) : escapeHtml(reward.key.toUpperCase())).join(", ")}</td></tr>`;
  }).join("");
}

function renderQuestCategoryPage(title, description, tableId, rows) {
  return `<h1>${escapeHtml(title)}</h1><p class="muted">${escapeHtml(description)}</p><div class="filter-panel" data-table-filter="${escapeAttr(tableId)}"><input id="${escapeAttr(tableId)}-filter-text" name="${escapeAttr(tableId)}-filter-text" data-filter-text type="search" placeholder="Search quest, type, target, system"></div><div class="table-wrap"><table id="${escapeAttr(tableId)}" class="sortable filterable"><thead><tr><th>Quest</th><th>Category</th><th>Type</th><th>Start</th><th>System</th><th>Objective</th><th>Reward</th><th>Chain</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderDailyCategoryPage(cache, routes) {
  return `<h1>Daily Quests</h1><p class="muted">Daily quests use a cleaner data structure than story missions, so the targets and rewards can be resolved much more directly.</p><div class="filter-panel" data-table-filter="daily-quests-table"><input id="daily-quests-filter-text" name="daily-quests-filter-text" data-filter-text type="search" placeholder="Search daily, target, system"><select id="daily-quests-filter-kind" name="daily-quests-filter-kind" data-filter-attr="kind"><option value="">All daily types</option><option value="kill">Kill</option><option value="pickup">Pickup</option><option value="land_on_planet">Land on planet</option><option value="upgrade_tech">Upgrade tech</option></select></div><div class="table-wrap"><table id="daily-quests-table" class="sortable filterable"><thead><tr><th>Quest</th><th>Level</th><th>Type</th><th>Place</th><th>Target</th><th>Rewards</th></tr></thead><tbody>${renderDailyQuestRows(cache, routes)}</tbody></table></div>`;
}

function buildQuestPages(manifest, cache, media, routes) {
  const missionEntries = manifest.MissionTypes || [];
  const storyRows = renderQuestRows(missionEntries, cache, routes, (record) => questCategoryInfo(record).id === "story");
  const timedRows = renderQuestRows(missionEntries, cache, routes, (record) => questCategoryInfo(record).id === "timed");
  const pvpRows = renderQuestRows(missionEntries, cache, routes, (record) => questCategoryInfo(record).id === "pvp");
  const cards = [
    ["Story", "/quests/story/", missionEntries.filter((entry) => questCategoryInfo(cache.MissionTypes?.[entryKey(entry)]).id === "story").length, "Main quest chains and static world quests."],
    ["Timed", "/quests/timed/", missionEntries.filter((entry) => questCategoryInfo(cache.MissionTypes?.[entryKey(entry)]).id === "timed").length, "Timed missions with rotating objectives and placeholder-heavy text."],
    ["Daily", "/quests/daily/", Object.keys(cache.DailyMissions || {}).length, "Structured daily missions with resolved targets and rewards."],
    ["PvP", "/quests/pvp/", missionEntries.filter((entry) => questCategoryInfo(cache.MissionTypes?.[entryKey(entry)]).id === "pvp").length, "PvP chains and progression quests."]
  ].map(([label, href, count, desc]) => `<a class="card" href="${escapeAttr(href)}"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(valueLabel(count))} quests</span><span>${escapeHtml(desc)}</span></a>`).join("");
  writePage(path.join(DIST_DIR, "quests", "index.html"), "Quests", `<h1>Quests</h1><p class="muted">This hub groups story quests, timed quests, daily missions, and PvP chains. Story and timed pages reuse the enriched mission detail pages, while daily quests get dedicated pages under <code>/quests/daily/</code>.</p><section class="cards">${cards}</section><section class="notice"><strong>Tip:</strong> use the category pages to filter by objective, then open a quest detail page for the full chain, reward table, and detected solution path.</section>`);
  writePage(path.join(DIST_DIR, "quests", "story", "index.html"), "Story Quests", renderQuestCategoryPage("Story Quests", "Static quest chains and world quests reconstructed from MissionTypes and starter bodies.", "story-quests-table", storyRows));
  writePage(path.join(DIST_DIR, "quests", "timed", "index.html"), "Timed Quests", renderQuestCategoryPage("Timed Quests", "Timed missions often rely on placeholder-heavy text, so the guide keeps both structured targets and the raw narrative hints.", "timed-quests-table", timedRows));
  writePage(path.join(DIST_DIR, "quests", "pvp", "index.html"), "PvP Quests", renderQuestCategoryPage("PvP Quests", "PvP chains are separated here so they do not get mixed into regular progression quests.", "pvp-quests-table", pvpRows));
  writePage(path.join(DIST_DIR, "quests", "daily", "index.html"), "Daily Quests", renderDailyCategoryPage(cache, routes));
  for (const item of dailyMissionCatalog(cache)) {
    writePage(path.join(DIST_DIR, `${item.slug}.html`), item.name, renderDailyMissionPage(item, cache, media, routes));
  }
}

function renderGeneralInfo(record) {
  const rows = Object.entries(record).filter(([, value]) => ["string", "number", "boolean"].includes(typeof value)).slice(0, 24).map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(valueLabel(v))}</td></tr>`).join("");
  return `<section><h2>Overview</h2><div class="table-wrap"><table>${rows}</table></div></section>`;
}

function buildGuidePages(cache, manifest, media, routes) {
  const guideCards = GUIDE_PAGES.slice(1)
    .map(([label, href, desc]) => `<a class="card" href="/${href}"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(desc)}</span></a>`)
    .join("");
  writePage(path.join(DIST_DIR, "guides", "index.html"), "Guides", `<h1>Guides</h1><p class="muted">These pages turn the source tables into practical questions: what to equip, what to farm, where to go, and what a hostile can do.</p><section class="cards">${guideCards}</section><section class="notice"><strong>Tip:</strong> every guide table is sortable and filterable. Open a row when you need exact source data, sprites, sounds, drops, and related pages.</section>`);
  writePage(path.join(DIST_DIR, "guides", "combat.html"), "Combat Guide", renderCombatGuide(cache));
  writePage(path.join(DIST_DIR, "guides", "weapons.html"), "Weapon Finder", renderWeaponGuide(cache, manifest, media, routes));
  writePage(path.join(DIST_DIR, "guides", "artifacts.html"), "Artifact Guide", renderArtifactGuide(cache, manifest, media, routes));
  writePage(path.join(DIST_DIR, "guides", "farming.html"), "Farming Guide", renderFarmingGuide(cache, manifest, media, routes));
  writePage(path.join(DIST_DIR, "guides", "travel.html"), "Travel Guide", renderTravelGuide(cache, manifest, routes));
}

function renderCombatGuide(cache) {
  const damageRows = DAMAGE_TYPES.map((label, id) => {
    const weapons = Object.values(cache.Weapons || {}).filter((weapon) => Number(weapon.damageType) === id).length;
    return `<tr><td>${id}</td><td>${escapeHtml(label)}</td><td>${weapons}</td></tr>`;
  }).join("");
  const traitRows = [
    ["Melee", "The enemy wants close range; range control matters."],
    ["Kamikaze", "The enemy has self-damage behavior and can punish staying too close."],
    ["Teleport", "The enemy can reset distance or reach targets that kite normally."],
    ["Cloak", "The enemy can hide or break targeting rules."],
    ["Healer", "The enemy can restore allies or targets; kill order matters."],
    ["Grab", "The enemy can pull or hold targets."],
    ["Mini-boss", "Expect inflated stats and better rewards than normal enemies."]
  ].map(([trait, note]) => `<tr><td>${trait}</td><td>${note}</td></tr>`).join("");
  return `<h1>Combat Guide</h1>
<section class="content-grid">
  <article><h2>Damage Types</h2><p>Astroflux damage types come from <code>core.weapon.Damage</code>. The game caps resistance at 75%, so high resistance is important but not absolute immunity.</p><div class="table-wrap"><table class="sortable"><thead><tr><th>ID</th><th>Meaning</th><th>Weapon count</th></tr></thead><tbody>${damageRows}</tbody></table></div></article>
  <article><h2>How To Read Enemy Pages</h2><p>Start with traits, damage type, and resistances. Then inspect the weapon loadout and spawn location. A low-HP enemy with teleport or kamikaze behavior can be more dangerous than a static high-HP target.</p><div class="table-wrap"><table><thead><tr><th>Trait</th><th>Player meaning</th></tr></thead><tbody>${traitRows}</tbody></table></div></article>
  <article><h2>Fast Workflow</h2><ol class="steps"><li>Find the enemy in <a href="/enemies/">Enemies</a>.</li><li>Check its weakest resistance and damage type.</li><li>Open its weapons to see range and projectile behavior.</li><li>Open its drops or spawn location when farming.</li></ol></article>
</section>`;
}

function renderWeaponGuide(cache, manifest, media, routes) {
  const entries = (manifest.Weapons || []).filter((entry) => isPlayerFacingWeapon(cache.Weapons?.[entryKey(entry)]));
  const topDps = entries
    .map((entry) => ({ entry, record: cache.Weapons?.[entryKey(entry)], score: weaponDps(cache.Weapons?.[entryKey(entry)] || {}) }))
    .filter((item) => item.record && item.score)
    .sort((a, b) => b.score - a.score)
    .slice(0, 25)
    .map(({ entry, record }) => weaponComparisonRow(entry, record, cache, media))
    .join("");
  const efficient = entries
    .map((entry) => {
      const record = cache.Weapons?.[entryKey(entry)];
      const heat = numberValue(record?.heatCost);
      const dps = weaponDps(record || {});
      return { entry, record, score: heat ? dps / heat : 0 };
    })
    .filter((item) => item.record && item.score)
    .sort((a, b) => b.score - a.score)
    .slice(0, 25)
    .map(({ entry, record }) => weaponComparisonRow(entry, record, cache, media))
    .join("");
  return `<h1>Weapon Finder</h1><p class="muted">These rankings focus on player-facing weapons. Enemy and boss weapons stay available in the complete weapon index for research.</p>
<section class="content-grid">
  <article><h2>Highest Approximate DPS</h2><input class="table-filter" name="table-filter" placeholder="Filter weapons"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Weapon</th><th>Damage type</th><th>DPS</th><th>Range</th><th>Heat/s</th><th>Tags</th></tr></thead><tbody>${topDps}</tbody></table></div></article>
  <article><h2>Best DPS Per Heat Cost</h2><input class="table-filter" name="table-filter" placeholder="Filter weapons"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Weapon</th><th>Damage type</th><th>DPS</th><th>Range</th><th>Heat/s</th><th>Tags</th></tr></thead><tbody>${efficient}</tbody></table></div></article>
  <article><h2>Full Table</h2><p><a class="button-link" href="/weapons/">Open all weapons</a></p></article>
</section>`;
}

function weaponComparisonRow(entry, record, cache, media) {
  const icon = cache.Images?.[record.techIcon] ? renderImageThumb(cache.Images[record.techIcon], media) : "";
  return `<tr><td>${icon}<a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${escapeHtml(damageTypeLabel(record.damageType))}</td><td>${escapeHtml(valueLabel(weaponDps(record)))}</td><td>${escapeHtml(valueLabel(record.range))}</td><td>${escapeHtml(valueLabel(weaponHeatPerSecond(record)))}</td><td>${escapeHtml(weaponTags(record))}</td></tr>`;
}

function renderArtifactGuide(cache, manifest, media, routes) {
  const uniqueDrop = uniqueDropEntry(cache);
  const artifacts = Object.entries(cache.ArtifactTypes || {}).map(([key, record]) => ({
    key,
    record,
    entry: { slug: `artifacts/${key}`, name: titleFor(record, key) }
  }));
  const classicRows = classicArtifactRows(artifacts, cache, media, routes);
  const uniqueRows = uniqueArtifactMainRows(cache, media, routes);
  return `<h1>Artifact Guide</h1>
<section class="content-grid">
  <article><h2>Artifact Database</h2><p>The full artifact database is on the main artifacts page. It includes the calculator, the classic pool, and the unique-source table in one place.</p><p><a class="button-link" href="/artifacts/">Open artifact database</a></p></article>
  <article><h2>Unique Artifact Sources</h2><p>Unique artifacts come from the crate and from boss-linked evidence. The rows below keep the source details close to the artifact name.</p></article>
</section>
<div class="table-wrap"><table class="sortable"><thead><tr><th>Sprite</th><th>Artifact</th><th>Stat family</th><th>Value range</th><th>Rarity</th><th>Upgradeable</th><th>Drop weight</th><th>Levels</th><th>Type odds</th></tr></thead><tbody>${classicRows}</tbody></table></div>
<div class="table-wrap"><table id="artifact-table" class="sortable filterable"><thead><tr><th>Sprite</th><th>Unique artifact</th><th>Stat family</th><th>Damage / build focus</th><th>Buff / debuff</th><th>Bosses</th><th>Additional notes</th></tr></thead><tbody>${uniqueRows}</tbody></table></div>`;
}

function renderFarmingGuide(cache, manifest, media, routes) {
  const sourceCounts = new Map();
  const useCounts = new Map();
  for (const drop of Object.values(cache.Drops || {})) {
    for (const item of drop.dropItems || []) if (item.table === "Commodities") sourceCounts.set(item.item, (sourceCounts.get(item.item) || 0) + 1);
  }
  for (const spawner of Object.values(cache.Spawners || {})) {
    for (const item of [...(spawner.drops || []), ...(spawner.drops2 || [])]) if (item.drop) sourceCounts.set(item.drop, (sourceCounts.get(item.drop) || 0) + 1);
  }
  for (const weapon of Object.values(cache.Weapons || {})) {
    for (const lvl of weapon.techLevels || []) {
      for (const key of [lvl.mineralType1, lvl.mineralType2, lvl.mineral_type_1, lvl.mineral_type_2].filter(Boolean)) useCounts.set(key, (useCounts.get(key) || 0) + 1);
    }
  }
  const eliteMemo = new Map();
  const playerSource = (row) => {
    const text = `${row.sourceName || ""} ${row.contextText || ""}`.toLowerCase();
    if (/dev|stress test|dummy/.test(text)) return false;
    if (row.body) return isVisibleMapSystem(cache.SolarSystems?.[cache.Bodies?.[row.body]?.solarSystem], cache.Bodies?.[row.body]?.solarSystem);
    if (row.table === "Bodies") return isVisibleMapSystem(cache.SolarSystems?.[cache.Bodies?.[row.key]?.solarSystem], cache.Bodies?.[row.key]?.solarSystem);
    return true;
  };
  const sourceContext = (row) => row.table === "Spawners"
    ? `${row.body ? entityLink("Bodies", row.body, cache, routes) : "<span>No linked body</span>"}${row.enemy ? ` / ${entityLink("Enemies", row.enemy, cache, routes)}` : ""}${row.boss ? ` / ${entityLink("Bosses", row.boss, cache, routes)}` : ""}${row.dropKey ? ` / ${entityLink("Drops", row.dropKey, cache, routes)}` : ""}`
    : `${escapeHtml(row.contextText || "")}${row.dropKey ? ` / ${entityLink("Drops", row.dropKey, cache, routes)}` : ""}`;
  const rows = (manifest.Commodities || [])
    .map((entry) => {
      const key = entryKey(entry);
      const item = cache.Commodities?.[key];
      if (!item) return "";
      const icon = cache.Images?.[item.bitmap] ? renderImageThumb(cache.Images[item.bitmap], media) : "";
      const sources = commoditySourceRowsData(key, cache).filter(playerSource);
      const best = sources[0];
      const technique = best ? resourceTechniqueHint(best, cache, eliteMemo) : "No player-facing drop source found in cache.";
      return `<tr data-search="${escapeAttr(`${entry.name} ${item.type || ""} ${best?.sourceName || ""} ${best?.contextText || ""} ${technique}`)}" data-kind="${escapeAttr(item.type || "")}" data-sources="${escapeAttr(sourceCounts.get(key) || 0)}" data-uses="${escapeAttr(useCounts.get(key) || 0)}"><td>${icon}<a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${escapeHtml(valueLabel(item.type))}</td><td>${best ? entityLink(best.table, best.key, cache, routes, best.sourceName) : "<span>n/a</span>"}</td><td>${best ? sourceContext(best) : "<span>n/a</span>"}</td><td>${escapeHtml(best?.chanceText || "n/a")}</td><td>${escapeHtml(best?.qty || "")}</td><td>${escapeHtml(technique)}</td><td>${escapeHtml(valueLabel(sourceCounts.get(key) || 0))}</td><td>${escapeHtml(valueLabel(useCounts.get(key) || 0))}</td></tr>`;
    })
    .join("");
  const typeOptions = [...new Set((manifest.Commodities || []).map((entry) => cache.Commodities?.[entryKey(entry)]?.type).filter(Boolean))]
    .sort()
    .map((type) => `<option value="${escapeAttr(type)}">${escapeHtml(type)}</option>`)
    .join("");
  return `<h1>Farming Guide</h1><p class="muted">Search a material name, then use the best-source row as the starting route. The technique column favors elite-zone spawners, high-volume spawners, reliable drop tables, and data-chip crate sources when the cache exposes those signals.</p>
<div class="filter-panel" data-table-filter="farming-table">
  <input id="farming-filter-text" name="farming-filter-text" data-filter-text type="search" placeholder="Search Steel, Iridium, Data Chip, spawner, enemy">
  <select id="farming-filter-kind" name="farming-filter-kind" data-filter-attr="kind"><option value="">All item types</option>${typeOptions}</select>
  <label>Min known sources <input id="farming-filter-sources" name="farming-filter-sources" data-filter-min="sources" type="number" min="0" placeholder="any"></label>
  <label>Min upgrade uses <input id="farming-filter-uses" name="farming-filter-uses" data-filter-min="uses" type="number" min="0" placeholder="any"></label>
</div>
<div class="table-wrap"><table id="farming-table" class="sortable filterable"><thead><tr><th>Item</th><th>Type</th><th>Best source</th><th>Place / Enemy / Drop</th><th>Effective chance</th><th>Qty</th><th>Technique signal</th><th>Known sources</th><th>Weapon uses</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderTravelGuide(cache, manifest, routes) {
  const rows = (manifest.SolarSystems || []).filter((entry) => isVisibleMapSystem(cache.SolarSystems?.[entryKey(entry)], entryKey(entry))).map((entry) => {
    const key = entryKey(entry);
    const system = cache.SolarSystems?.[key];
    if (!system) return "";
    const status = systemStatusInfo(system, key);
    const bodies = Object.values(cache.Bodies || {}).filter((body) => body.solarSystem === key);
    const shops = bodies.reduce((sum, body) => sum + (body.shopItems || []).length, 0);
    const hostileBodies = new Set(Object.values(cache.Spawners || {}).filter((spawner) => bodies.some((body) => body.key === spawner.body)).map((spawner) => spawner.body));
    return `<tr><td><a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${escapeHtml(valueLabel(system.galaxy))}</td><td><span class="status-pill status-${escapeAttr(status.key)}">${escapeHtml(status.label)}</span></td><td>${escapeHtml(valueLabel(system.type))}</td><td>${escapeHtml(rangeText(system.uberMinLevel, system.uberMaxLevel))}</td><td>${escapeHtml(valueLabel(bodies.length))}</td><td>${escapeHtml(valueLabel(shops))}</td><td>${escapeHtml(valueLabel(hostileBodies.size))}</td></tr>`;
  }).join("");
  return `<h1>Travel Guide</h1><p class="muted">Use this when choosing where to go next. Systems link to their locations; locations link to shops, hostiles, spawners, drops, and the global map.</p><p><a class="button-link" href="/map/">Open galaxy map</a></p><input class="table-filter" name="table-filter" placeholder="Filter systems"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>System</th><th>Galaxy</th><th>Status</th><th>Type</th><th>Level range</th><th>Locations</th><th>Shop items</th><th>Hostile locations</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderStationsPage(cache, routes) {
  const stations = Object.entries(cache.Bodies || {})
    .filter(([, body]) => isStationBody(body))
    .filter(([, body]) => isVisibleMapSystem(cache.SolarSystems?.[body.solarSystem], body.solarSystem))
    .sort((a, b) => titleFor(cache.SolarSystems?.[a[1].solarSystem], a[1].solarSystem).localeCompare(titleFor(cache.SolarSystems?.[b[1].solarSystem], b[1].solarSystem)) || titleFor(a[1], a[0]).localeCompare(titleFor(b[1], b[0])));
  const systems = [...new Map(stations.map(([, body]) => [body.solarSystem, titleFor(cache.SolarSystems?.[body.solarSystem], body.solarSystem)])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([key, name]) => `<option value="${escapeAttr(key)}">${escapeHtml(name)}</option>`)
    .join("");
  const types = [...new Set(stations.map(([, body]) => body.type).filter(Boolean))]
    .sort()
    .map((type) => `<option value="${escapeAttr(type)}">${escapeHtml(type)}</option>`)
    .join("");
  const statuses = [...new Map(stations.map(([, body]) => {
    const status = systemStatusInfo(cache.SolarSystems?.[body.solarSystem], body.solarSystem);
    return [status.key, status.label];
  })).entries()]
    .map(([key, label]) => `<option value="${escapeAttr(key)}">${escapeHtml(label)}</option>`)
    .join("");
  const rows = stations.map(([bodyKey, body]) => {
    const system = cache.SolarSystems?.[body.solarSystem];
    const shopItems = body.shopItems || [];
    const topItems = shopItems.slice(0, 5).map((item) => shopItemLink(item, cache, routes)).join(", ");
    const status = systemStatusInfo(system, body.solarSystem);
    return `<tr data-search="${escapeAttr(`${titleFor(body, bodyKey)} ${body.type} ${titleFor(system, body.solarSystem)} ${shopItems.map((item) => resolveShopItem(item, cache).name).join(" ")}`)}" data-system="${escapeAttr(body.solarSystem)}" data-kind="${escapeAttr(body.type || "")}" data-status="${escapeAttr(status.key)}" data-shop="${escapeAttr(shopItems.length)}"><td>${entityLink("Bodies", bodyKey, cache, routes)}</td><td>${escapeHtml(valueLabel(body.type))}</td><td>${entityLink("SolarSystems", body.solarSystem, cache, routes)}</td><td><span class="status-pill status-${escapeAttr(status.key)}">${escapeHtml(status.label)}</span></td><td>${escapeHtml(valueLabel(body.level))}</td><td>${escapeHtml(valueLabel(body.x))}, ${escapeHtml(valueLabel(body.y))}</td><td>${escapeHtml(valueLabel(shopItems.length))}</td><td>${topItems || "<span>n/a</span>"}</td></tr>`;
    return `<tr data-search="${escapeAttr(`${titleFor(body, bodyKey)} ${body.type} ${titleFor(system, body.solarSystem)} ${shopItems.map((item) => resolveShopItem(item, cache).name).join(" ")}`)}" data-system="${escapeAttr(body.solarSystem)}" data-kind="${escapeAttr(body.type || "")}" data-status="${escapeAttr(status.key)}" data-shop="${escapeAttr(shopItems.length)}"><td>${entityLink("Bodies", bodyKey, cache, routes)}</td><td>${escapeHtml(valueLabel(body.type))}</td><td>${entityLink("SolarSystems", body.solarSystem, cache, routes)}</td><td><span class="status-pill status-${escapeAttr(status.key)}">${escapeHtml(status.label)}</span></td><td>${escapeHtml(valueLabel(body.level))}</td><td>${escapeHtml(coordinateLabel(body.x))}, ${escapeHtml(coordinateLabel(body.y))}</td><td>${escapeHtml(valueLabel(shopItems.length))}</td><td>${topItems || "<span>n/a</span>"}</td></tr>`;
  }).join("");
  return `<h1>Stations</h1><p class="muted">A player-facing index for shops, warp gates, research stations, hangars, cantinas, paint shops, and recycle stations. Filter by system or station type, then open the station page for stock, prices, hostiles nearby, and related links.</p>
<div class="filter-panel" data-table-filter="stations-table">
  <input id="station-filter-text" name="station-filter-text" data-filter-text type="search" placeholder="Search station, item, system">
  <select id="station-filter-system" name="station-filter-system" data-filter-attr="system"><option value="">All systems</option>${systems}</select>
  <select id="station-filter-kind" name="station-filter-kind" data-filter-attr="kind"><option value="">All types</option>${types}</select>
  <select id="station-filter-status" name="station-filter-status" data-filter-attr="status"><option value="">All statuses</option>${statuses}</select>
  <label>Min shop items <input id="station-filter-shop" name="station-filter-shop" data-filter-min="shop" type="number" min="0" placeholder="any"></label>
</div>
<div class="table-wrap"><table id="stations-table" class="sortable filterable"><thead><tr><th>Station</th><th>Type</th><th>System</th><th>System status</th><th>Level</th><th>Coords</th><th>Shop items</th><th>Preview stock</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function buildStationsPage(cache, routes) {
  writePage(path.join(DIST_DIR, "stations", "index.html"), "Stations", renderStationsPage(cache, routes));
}

function buildIndex(manifest, tables, warnings, media, map, cache) {
  const guideCards = GUIDE_PAGES.slice(1)
    .map(([label, href, desc]) => `<a class="card" href="/${href}"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(desc)}</span></a>`)
    .join("\n");
  const visibleSystemCount = (manifest.SolarSystems || [])
    .filter((entry) => isVisibleMapSystem(cache.SolarSystems?.[entryKey(entry)], entryKey(entry))).length;
  const cards = [
    ["Systems", "systems", visibleSystemCount],
    ["Stations", "stations", Object.values(cache.Bodies || {}).filter((body) => isStationBody(body) && isVisibleMapSystem(cache.SolarSystems?.[body.solarSystem], body.solarSystem)).length],
    ["Enemies", "enemies", manifest.Enemies?.length ?? 0],
    ["Bosses", "bosses", manifest.Bosses?.length ?? 0],
    ["Weapons", "weapons", manifest.Weapons?.length ?? 0],
    ["Projectiles", "projectiles", manifest.Projectiles?.length ?? 0],
    ["Items", "commodities", manifest.Commodities?.length ?? 0],
    ["Artifacts", "artifacts", manifest.ArtifactTypes?.length ?? 0],
    ["Unique Artifacts", "artifacts/unique", uniqueArtifactCatalog(cache).length],
    ["Drops", "drops", manifest.Drops?.length ?? 0],
    ["Ships", "ships", manifest.Ships?.length ?? 0],
    ["Engines", "engines", manifest.Engines?.length ?? 0],
    ["Turrets", "turrets", manifest.Turrets?.length ?? 0],
    ["Quests", "quests", (manifest.MissionTypes?.length ?? 0) + Object.keys(cache.DailyMissions || {}).length],
    ["Media", "media", media.imageRecords + media.soundRecords]
  ].map(([label, href, count]) => `<a class="card" href="/${href}/"><strong>${label}</strong><span>${count} pages</span></a>`).join("\n");

  const tableRows = Object.entries(tables)
    .map(([table, count]) => {
      const label = sourceTableDisplayName(table);
      const source = label !== table ? `<span class="source-key">source: ${escapeHtml(table)}</span>` : "";
      return `<tr><td>${escapeHtml(label)}${source}</td><td>${count}</td></tr>`;
    })
    .join("\n");

  const body = `${renderGalaxyMapSection(map, manifest, "home-map", true)}
<section class="home-hero">
  <img src="/assets/source-images/logo.png" alt="Astroflux">
  <div>
    <h1>Astroflux Wiki</h1>
    <p>A player-first reference built from the game client data: enemies, weapons, drops, locations, sprites, sounds, and the links between them.</p>
  </div>
</section>
<h2>Start Here</h2>
<section class="cards">${guideCards}</section>
<h2>Browse Data</h2>
<section class="cards">${cards}</section>
<section class="notice">
  <strong>Media status:</strong>
  ${media.availableImages.length} preload/login images were found locally.
  ${media.atlasByName.size} GameFS atlas sprites were indexed from downloaded texture atlases.
  ${media.availableAudio.length} audio files were found locally.
</section>
  <details class="source-details"><summary>Build and validation details</summary><p>${warnings.length} unresolved references were found. See <code>data/index/warnings.json</code>.</p><div class="table-wrap"><table><thead><tr><th>Table</th><th>Rows</th></tr></thead><tbody>${tableRows}</tbody></table></div></details>`;

  writePage(path.join(DIST_DIR, "index.html"), "Home", body);
  writeRootIndexPage(ROOT_INDEX_FILE);
}

function renderMediaPanel(table, record, cache, media) {
  const imageKeys = collectImageKeys(table, record, cache);
  const soundRefs = collectSoundRefs(table, record, cache);
  if (imageKeys.length === 0 && soundRefs.length === 0) return "";

  const imageCards = imageKeys.map((key) => {
    const image = cache.Images?.[key];
    if (!image) return `<div class="media-card missing"><strong>Image</strong><span>Missing image key ${escapeHtml(key)}</span></div>`;
    return renderImageCard(image, key, media, false);
  });

  const soundCards = soundRefs.map(({ key, label }) => {
    const sound = cache.Sounds?.[key] || cache.Images?.[key];
    if (!sound) return `<div class="media-card missing"><strong>Audio</strong><span>Missing sound key ${escapeHtml(key)}</span></div>`;
    const local = media.byGameFile.get(sound.fileName);
    if (local) {
      return `<div class="media-card"><small class="media-label">${escapeHtml(label)}</small><strong>${escapeHtml(sound.fileName)}</strong><audio controls preload="none" src="${escapeAttr(local.url)}"></audio></div>`;
    }
    return `<div class="media-card missing"><strong>${escapeHtml(sound.fileName || key)}</strong><span>Audio metadata exists, file not present in source dump.</span></div>`;
  });

  return `<section class="media-panel"><h2>Media</h2><div class="media-grid">${[...imageCards, ...soundCards].join("")}</div></section>`;
}

function renderImageCard(image, key, media, primary = false) {
  const local = media.byGameFile.get(image.fileName);
  if (local && isImageFile(image.fileName)) {
    return `<figure class="media-card image-card${primary ? " primary" : ""}"><img loading="lazy" src="${escapeAttr(local.url)}" alt="${escapeAttr(image.fileName)}"><figcaption>${escapeHtml(image.fileName)}</figcaption></figure>`;
  }
  const atlas = findAtlasSprite(media, image);
  if (atlas) return renderAtlasCard(atlas, image, primary);
  return `<div class="media-card missing"><strong>${escapeHtml(image.fileName || image.textureName || key)}</strong><span>GameFS texture ref: ${escapeHtml(image.type || "unknown")} / ${escapeHtml(image.textureName || "no textureName")}</span></div>`;
}

function renderImageThumb(image, media) {
  const local = media.byGameFile.get(image.fileName);
  if (local && isImageFile(image.fileName)) {
    return `<span class="thumb-frame"><img class="thumb" loading="lazy" decoding="async" src="${escapeAttr(local.url)}" alt=""></span>`;
  }
  const atlas = findAtlasSprite(media, image);
  if (!atlas) return "";
  const frames = sampleAnimationFrames(atlas.frames, 12);
  const metrics = atlasThumbMetrics(frames);
  const framePayload = frames.map((item) => ({
    x: Math.round(item.x * metrics.scale),
    y: Math.round(item.y * metrics.scale),
    width: Math.max(1, Math.round(item.width * metrics.scale)),
    height: Math.max(1, Math.round(item.height * metrics.scale)),
    name: item.name
  }));
  const frameAttr = framePayload.length > 1 ? ` data-frame-data="${escapeAttr(JSON.stringify(framePayload))}"` : "";
  return `<span class="thumb-frame"><span class="thumb atlas-sprite"${frameAttr} style="${escapeAttr(atlasThumbStyle(frames[0], metrics))}" role="img" aria-label="${escapeAttr(image.fileName || atlas.label)}"></span></span>`;
}

function resolveCanvasImageAsset(imageKey, cache, media) {
  if (!imageKey) return null;
  const image = cache.Images?.[imageKey];
  if (!image) return null;
  const local = media.byGameFile.get(image.fileName);
  if (local && isImageFile(image.fileName)) {
    return { url: local.url, label: image.fileName || image.textureName || imageKey };
  }
  const atlas = findAtlasSprite(media, image);
  const frame = atlas?.frames?.[0];
  if (!frame) return null;
  return {
    url: frame.url,
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
    atlasWidth: frame.atlasWidth,
    atlasHeight: frame.atlasHeight,
    label: atlas.label || image.fileName || image.textureName || imageKey
  };
}

function mediaImageStatus(image, media) {
  if (media.byGameFile.has(image.fileName) && isImageFile(image.fileName)) return "standalone file";
  if (findAtlasSprite(media, image)) return "atlas sprite";
  if (media.byGameFile.has(image.fileName)) return "non-image media";
  return "not found";
}

function isImageFile(file) {
  return [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(path.extname(file || "").toLowerCase());
}

function findAtlasSprite(media, image) {
  if (!media.atlasByName) return null;
  const prefix = image.textureName || "";
  const animatedFrames = prefix.length >= 3 ? atlasFramesForTexture(media, prefix).slice(0, 24) : [];
  if ((image.animate || numberValue(image.animationCells, 0) > 1) && animatedFrames.length > 1) {
    return { frames: animatedFrames, label: prefix };
  }
  const names = [
    image.textureName,
    image.fileName ? path.basename(image.fileName, path.extname(image.fileName)) : "",
    image.textureName ? `${image.textureName}1` : "",
    image.textureName ? `${image.textureName}01` : ""
  ].filter(Boolean);
  for (const name of names) {
    if (media.atlasByName.has(name)) return { frames: [media.atlasByName.get(name)], label: name };
  }
  if (animatedFrames.length) return { frames: animatedFrames, label: prefix };
  return null;
}

function atlasFramesForTexture(media, prefix) {
  return [...media.atlasByName.values()]
    .filter((entry) => entry.name === prefix || (entry.name.startsWith(prefix) && /^\d+$/.test(entry.name.slice(prefix.length))))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

function sampleAnimationFrames(frames, limit = 12) {
  if (!Array.isArray(frames) || frames.length <= limit) return frames || [];
  const sampled = [];
  const seen = new Set();
  for (let index = 0; index < limit; index += 1) {
    const frame = frames[Math.min(frames.length - 1, Math.floor(index * frames.length / limit))];
    if (!frame || seen.has(frame.name)) continue;
    sampled.push(frame);
    seen.add(frame.name);
  }
  return sampled.length ? sampled : frames.slice(0, limit);
}

function atlasThumbMetrics(frames) {
  const maxFrameWidth = Math.max(...frames.map((frame) => numberValue(frame?.width, 1)), 1);
  const maxFrameHeight = Math.max(...frames.map((frame) => numberValue(frame?.height, 1)), 1);
  const box = 36;
  const scale = Math.min(1, box / maxFrameWidth, box / maxFrameHeight);
  const atlasWidth = Math.max(...frames.map((frame) => numberValue(frame?.atlasWidth, 1)), 1);
  const atlasHeight = Math.max(...frames.map((frame) => numberValue(frame?.atlasHeight, 1)), 1);
  return {
    scale,
    boxWidth: Math.max(1, Math.round(maxFrameWidth * scale)),
    boxHeight: Math.max(1, Math.round(maxFrameHeight * scale)),
    atlasWidth,
    atlasHeight
  };
}

function atlasFrameStyle(frame, scale = 1) {
  return [
    `width:${Math.max(1, Math.round(frame.width * scale))}px`,
    `height:${Math.max(1, Math.round(frame.height * scale))}px`,
    `background-image:url('${escapeAttr(frame.url)}')`,
    `background-size:${Math.round(frame.atlasWidth * scale)}px ${Math.round(frame.atlasHeight * scale)}px`,
    `background-position:-${Math.round(frame.x * scale)}px -${Math.round(frame.y * scale)}px`
  ].join(";");
}

function atlasStyle(frame, primary = false) {
  const maxWidth = primary ? 260 : 180;
  const maxHeight = primary ? 220 : 160;
  const minScale = primary ? 1.35 : 1;
  const scale = Math.min(minScale, maxWidth / frame.width, maxHeight / frame.height);
  return atlasFrameStyle(frame, scale);
}

function atlasThumbStyle(frame, metrics) {
  return [
    `width:${Math.max(1, Math.round(frame.width * metrics.scale))}px`,
    `height:${Math.max(1, Math.round(frame.height * metrics.scale))}px`,
    `background-image:url('${escapeAttr(frame.url)}')`,
    `background-size:${Math.round(metrics.atlasWidth * metrics.scale)}px ${Math.round(metrics.atlasHeight * metrics.scale)}px`,
    `background-position:-${Math.round(frame.x * metrics.scale)}px -${Math.round(frame.y * metrics.scale)}px`
  ].join(";");
}

function atlasCardMetrics(frames, primary = false) {
  const maxFrameWidth = Math.max(...frames.map((frame) => numberValue(frame?.width, 1)), 1);
  const maxFrameHeight = Math.max(...frames.map((frame) => numberValue(frame?.height, 1)), 1);
  const maxWidth = primary ? 260 : 180;
  const maxHeight = primary ? 220 : 160;
  const minScale = primary ? 1.35 : 1;
  const scale = Math.min(minScale, maxWidth / maxFrameWidth, maxHeight / maxFrameHeight);
  const atlasWidth = Math.max(...frames.map((frame) => numberValue(frame?.atlasWidth, 1)), 1);
  const atlasHeight = Math.max(...frames.map((frame) => numberValue(frame?.atlasHeight, 1)), 1);
  return {
    scale,
    boxWidth: Math.max(1, Math.round(maxFrameWidth * scale)),
    boxHeight: Math.max(1, Math.round(maxFrameHeight * scale)),
    atlasWidth,
    atlasHeight
  };
}

function renderAtlasCard(atlas, image, primary = false) {
  const frames = sampleAnimationFrames(atlas.frames, primary ? 18 : 12);
  const metrics = atlasCardMetrics(frames, primary);
  const frame = frames[0];
  const framePayload = frames.map((item) => ({
    x: Math.round(item.x * metrics.scale),
    y: Math.round(item.y * metrics.scale),
    width: Math.max(1, Math.round(item.width * metrics.scale)),
    height: Math.max(1, Math.round(item.height * metrics.scale)),
    name: item.name
  }));
  const frameAttr = framePayload.length > 1 ? ` data-frame-data="${escapeAttr(JSON.stringify(framePayload))}"` : "";
  return `<figure class="media-card atlas-card${primary ? " primary" : ""}"><span class="atlas-stage" style="--stage-w:${escapeAttr(metrics.boxWidth)}px;--stage-h:${escapeAttr(metrics.boxHeight)}px;--stage-max-h:${escapeAttr(primary ? 220 : 160)}px"><span class="atlas-sprite atlas-card-sprite"${frameAttr} style="${escapeAttr(atlasThumbStyle(frame, metrics))}" role="img" aria-label="${escapeAttr(image.fileName || atlas.label)}"></span></span><figcaption>${escapeHtml(image.fileName || atlas.label)}${framePayload.length > 1 ? ` (${framePayload.length} frames)` : ""}</figcaption></figure>`;
}

function renderBossPartCard(image, key, media) {
  const local = media.byGameFile.get(image?.fileName);
  if (local && isImageFile(image?.fileName)) {
    return `<figure class="media-card image-card boss-part-visual"><span class="boss-part-stage"><img loading="lazy" decoding="async" src="${escapeAttr(local.url)}" alt="${escapeAttr(image.fileName || key)}"></span><figcaption>${escapeHtml(image.fileName || key)}</figcaption></figure>`;
  }
  const atlas = findAtlasSprite(media, image);
  if (!atlas) return "";
  const frames = sampleAnimationFrames(atlas.frames, 10);
  const metrics = atlasCardMetrics(frames, false);
  const fitScale = Math.min(metrics.scale, 128 / Math.max(metrics.boxWidth || 1, 1), 96 / Math.max(metrics.boxHeight || 1, 1));
  const bounded = {
    scale: fitScale,
    boxWidth: Math.max(1, Math.round(Math.max(...frames.map((frame) => numberValue(frame?.width, 1)), 1) * fitScale)),
    boxHeight: Math.max(1, Math.round(Math.max(...frames.map((frame) => numberValue(frame?.height, 1)), 1) * fitScale)),
    atlasWidth: metrics.atlasWidth,
    atlasHeight: metrics.atlasHeight
  };
  const frame = frames[0];
  const framePayload = frames.map((item) => ({
    x: Math.round(item.x * bounded.scale),
    y: Math.round(item.y * bounded.scale),
    width: Math.max(1, Math.round(item.width * bounded.scale)),
    height: Math.max(1, Math.round(item.height * bounded.scale)),
    name: item.name
  }));
  const frameAttr = framePayload.length > 1 ? ` data-frame-data="${escapeAttr(JSON.stringify(framePayload))}"` : "";
  return `<figure class="media-card atlas-card boss-part-visual"><span class="atlas-stage boss-part-stage" style="--stage-w:${escapeAttr(bounded.boxWidth)}px;--stage-h:${escapeAttr(bounded.boxHeight)}px"><span class="atlas-sprite atlas-card-sprite"${frameAttr} style="${escapeAttr(atlasThumbStyle(frame, bounded))}" role="img" aria-label="${escapeAttr(image.fileName || atlas.label)}"></span></span><figcaption>${escapeHtml(image.fileName || atlas.label)}${framePayload.length > 1 ? ` (${framePayload.length} frames)` : ""}</figcaption></figure>`;
}

function renderBossSpriteThumb(record, cache, media) {
  const assembled = renderBossLayeredMini(record, cache, media);
  if (assembled) return assembled;
  for (const key of bossImageKeys(record, cache)) {
    const image = cache.Images?.[key];
    if (!image) continue;
    const thumb = renderImageThumb(image, media);
    if (thumb) return thumb;
  }
  return "";
}

function bossRotatedBounds(width, height, degrees) {
  const rad = numberValue(degrees, 0) * Math.PI / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return {
    width: width * cos + height * sin,
    height: width * sin + height * cos
  };
}

function bossLayeredParts(record, cache, media) {
  const parts = [];
  const addPart = (obj, index, kind, imageKey, refTable = "", refKeyValue = "") => {
    const image = cache.Images?.[imageKey];
    if (!image) return null;
    const atlas = findAtlasSprite(media, image);
    if (!atlas) return null;
    const frame = atlas.frames[0];
    const partScale = numberValue(obj.scale, numberValue(image.scale, 1)) || 1;
    const width = frame.width * partScale;
    const height = frame.height * partScale;
    const angle = numberValue(obj.angle, numberValue(obj.rotation, 0));
    const rotated = bossRotatedBounds(width, height, angle);
    return {
      obj,
      image,
      imageKey,
      frame,
      frames: atlas.frames,
      index,
      x: numberValue(obj.xpos, 0) + numberValue(obj.imageOffsetX, 0),
      y: numberValue(obj.ypos, 0) + numberValue(obj.imageOffsetY, 0),
      sourceX: numberValue(obj.xpos, 0),
      sourceY: numberValue(obj.ypos, 0),
      imageOffsetX: numberValue(obj.imageOffsetX, 0),
      imageOffsetY: numberValue(obj.imageOffsetY, 0),
      layer: numberValue(obj.layer, 0),
      angle,
      rotationSpeed: numberValue(obj.rotationSpeed, 0),
      mirror: Boolean(obj.mirror),
      scale: partScale,
      width,
      height,
      boundsWidth: rotated.width,
      boundsHeight: rotated.height,
      isDeadState: /\bdead\b/i.test(obj.name || ""),
      isHiddenAtStart: obj.active === false || obj.hideIfInactive === true,
      kind,
      refTable,
      refKey: refKeyValue
    };
  };
  (record.basicObjs || []).forEach((obj) => {
    const part = obj?.bitmap ? addPart(obj, parts.length, "body", obj.bitmap) : null;
    if (part) parts.push(part);
  });
  (record.turrets || []).forEach((mount) => {
    const turretKey = mount?.turret || refKey("Turrets", mount);
    const turret = cache.Turrets?.[turretKey];
    const ship = cache.Ships?.[turret?.body];
    const bitmap = ship?.bitmap;
    const obj = {
      ...mount,
      name: mount?.name || turret?.name || ship?.name || "Turret",
      hp: ship?.hp,
      bitmap,
      rotationSpeed: mount?.rotationSpeed ?? turret?.rotationSpeed ?? turret?.forcedRotationSpeed ?? 0,
      scale: mount?.scale ?? 1
    };
    const part = bitmap ? addPart(obj, parts.length, "turret", bitmap, "Turrets", turretKey) : null;
    if (part) parts.push(part);
  });
  (record.spawners || []).forEach((mount) => {
    const spawnerKey = mount?.spawner || refKey("Spawners", mount);
    const spawner = cache.Spawners?.[spawnerKey];
    const bitmap = spawner?.bitmap;
    const obj = {
      ...mount,
      name: mount?.name || spawner?.name || "Spawner",
      hp: spawner?.hp,
      bitmap,
      scale: mount?.scale ?? numberValue(spawner?.scale, 1)
    };
    const part = bitmap ? addPart(obj, parts.length, "spawner", bitmap, "Spawners", spawnerKey) : null;
    if (part) parts.push(part);
  });
  return parts;
}

function bossLayeredStage(parts, options = {}) {
  const maxWidth = options.maxWidth ?? 760;
  const maxHeight = options.maxHeight ?? 560;
  const maxScale = options.maxScale ?? 1.2;
  const minWidth = options.minWidth ?? 240;
  const minHeight = options.minHeight ?? 180;
  const pad = options.pad ?? 30;
  const containerClass = options.containerClass || "boss-layered-preview";
  const layerClass = options.layerClass || "boss-layer";
  const spriteClass = options.spriteClass || "boss-layer-sprite";
  const animate = options.animate !== false;
  const limit = options.limit ?? 120;
  const minX = Math.min(...parts.map((part) => part.x - part.boundsWidth / 2));
  const maxX = Math.max(...parts.map((part) => part.x + part.boundsWidth / 2));
  const minY = Math.min(...parts.map((part) => part.y - part.boundsHeight / 2));
  const maxY = Math.max(...parts.map((part) => part.y + part.boundsHeight / 2));
  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  const stageScale = Math.min(maxScale, maxWidth / contentWidth, maxHeight / contentHeight);
  const stageWidth = Math.max(minWidth, Math.round(contentWidth * stageScale + pad * 2));
  const stageHeight = Math.max(minHeight, Math.round(contentHeight * stageScale + pad * 2));
  const layers = parts
    .sort((a, b) => a.layer - b.layer || a.index - b.index)
    .slice(0, limit)
    .map((part, visualIndex) => {
      const x = pad + (part.x - part.width / 2 - minX) * stageScale;
      const y = pad + (part.y - part.height / 2 - minY) * stageScale;
      const spriteScale = stageScale * part.scale;
      const duration = part.rotationSpeed ? Math.max(2.8, Math.min(18, 7 / Math.abs(part.rotationSpeed))) : 0;
      const drift = Math.min(5, Math.max(1, Math.abs(part.layer) + 1));
      const layerStyle = [
        `left:${Math.round(x)}px`,
        `top:${Math.round(y)}px`,
        `z-index:${100 + part.layer * 10 + visualIndex}`,
        animate ? `--drift-x:${drift}px` : "",
        animate ? `--drift-x-neg:-${drift}px` : "",
        animate ? `--drift-y:${(drift * 0.35).toFixed(2)}px` : "",
        animate ? `--drift-y-neg:-${(drift * 0.35).toFixed(2)}px` : "",
        animate ? `animation-delay:-${(visualIndex % 9) * 0.22}s` : ""
      ].filter(Boolean).join(";");
      const spriteStyle = [
        atlasFrameStyle(part.frame, spriteScale),
        `--base-rot:${part.angle}deg`,
        part.mirror ? "--mirror:-1" : "",
        `--spin:${part.rotationSpeed < 0 ? "-360deg" : "360deg"}`,
        part.rotationSpeed ? `animation-duration:${duration.toFixed(2)}s` : ""
      ].filter(Boolean).join(";");
      const frameAttr = (part.frames || []).length > 1
        ? ` data-frames="${escapeAttr(JSON.stringify(part.frames.map((item) => ({ style: `${atlasFrameStyle(item, spriteScale)};--base-rot:${part.angle}deg;${part.mirror ? "--mirror:-1;" : ""}${part.rotationSpeed ? `--spin:${part.rotationSpeed < 0 ? "-360deg" : "360deg"};animation-duration:${duration.toFixed(2)}s;` : ""}`, name: item.name }))))}"`
        : "";
      const stateClass = `${part.rotationSpeed ? " spinning" : ""}${part.isDeadState ? " dead-state" : ""}${part.isHiddenAtStart ? " hidden-start" : ""} ${part.kind || "body"}-part`;
      const title = [
        part.kind ? `${part.kind} part` : "Boss part",
        part.obj.name || part.image.fileName || "Boss part",
        `layer ${valueLabel(part.layer)}`,
        `angle ${valueLabel(part.angle)}`,
        part.refTable && part.refKey ? `${part.refTable}:${part.refKey}` : "",
        part.imageOffsetX || part.imageOffsetY ? `image offset ${valueLabel(part.imageOffsetX)}, ${valueLabel(part.imageOffsetY)}` : ""
      ].filter(Boolean).join(" / ");
      return `<span class="${layerClass}" style="${escapeAttr(layerStyle)}" title="${escapeAttr(title)}"><span class="${spriteClass}${stateClass}"${frameAttr} style="${escapeAttr(spriteStyle)}" role="img" aria-label="${escapeAttr(part.image.fileName || part.obj.name || "Boss part")}"></span></span>`;
    }).join("");
  return {
    html: `<div class="${containerClass}" style="width:${stageWidth}px;height:${stageHeight}px">${layers}</div>`,
    width: stageWidth,
    height: stageHeight,
    scale: stageScale,
    rendered: Math.min(parts.length, limit)
  };
}

function renderBossLayeredMini(record, cache, media) {
  const rawParts = bossLayeredParts(record, cache, media);
  if (!rawParts.length) return "";
  return bossLayeredStage(rawParts, {
    maxWidth: 72,
    maxHeight: 56,
    minWidth: 58,
    minHeight: 48,
    maxScale: 0.8,
    pad: 4,
    containerClass: "boss-mini-preview",
    layerClass: "boss-mini-layer",
    spriteClass: "boss-mini-sprite",
    animate: true
  }).html;
}

function renderBossLayeredCard(record, cache, media) {
  const rawParts = bossLayeredParts(record, cache, media);
  if (!rawParts.length) return "";
  const stage = bossLayeredStage(rawParts, {
    maxWidth: 260,
    maxHeight: 220,
    minWidth: 180,
    minHeight: 150,
    maxScale: 1,
    pad: 12,
    containerClass: "boss-card-preview",
    layerClass: "boss-mini-layer",
    spriteClass: "boss-mini-sprite",
    animate: true
  });
  return `<figure class="media-card boss-assembled-card primary">${stage.html}<figcaption>${escapeHtml(record.name || "Boss")} assembled from ${rawParts.length} sprite part${rawParts.length === 1 ? "" : "s"}</figcaption></figure>`;
}

function renderBossLayeredPreview(record, cache, media) {
  const rawParts = bossLayeredParts(record, cache, media);
  if (!rawParts.length) return "";
  const deadCount = rawParts.filter((part) => part.isDeadState).length;
  const hiddenCount = rawParts.filter((part) => part.isHiddenAtStart).length;
  const offsetCount = rawParts.filter((part) => part.imageOffsetX || part.imageOffsetY).length;
  const bodyCount = rawParts.filter((part) => part.kind === "body").length;
  const turretCount = rawParts.filter((part) => part.kind === "turret").length;
  const spawnerCount = rawParts.filter((part) => part.kind === "spawner").length;
  const stage = bossLayeredStage(rawParts, {
    maxWidth: 760,
    maxHeight: 560,
    minWidth: 240,
    minHeight: 180,
    maxScale: 1.2,
    pad: 30,
    animate: true
  });
  const notes = [
    `${stage.rendered} of ${rawParts.length} sprite part${rawParts.length === 1 ? "" : "s"} rendered`,
    `${bodyCount} body / ${turretCount} turret / ${spawnerCount} spawner`,
    deadCount ? `${deadCount} dead-state variant${deadCount === 1 ? "" : "s"} included` : "",
    hiddenCount ? `${hiddenCount} initially hidden/triggered part${hiddenCount === 1 ? "" : "s"} included` : "",
    offsetCount ? `${offsetCount} part${offsetCount === 1 ? "" : "s"} use image offset data` : ""
  ].filter(Boolean).join(" / ");
  return `<article><h2>Animated Layer Preview</h2><p class="muted">This assembles boss body sprites, mounted turret sprites, and mounted spawner sprites from their source position, image offset, scale, angle, and layer order. Rotating parts use their source <code>rotationSpeed</code>. ${escapeHtml(notes)}.</p>${stage.html}</article>`;
}

function renderBossSpriteParts(record, cache, media, routes) {
  const parts = bossLayeredParts(record, cache, media);
  if (!parts.length) return "";
  const cards = parts.slice(0, 120).map((part) => {
    const card = renderBossPartCard(part.image, part.imageKey, media);
    const source = part.refTable && part.refKey ? entityLink(part.refTable, part.refKey, cache, routes) : escapeHtml(part.image.fileName || part.imageKey);
    return card ? `<div class="boss-part">${card}<dl><dt>Kind</dt><dd>${escapeHtml(valueLabel(part.kind))}</dd><dt>Part</dt><dd>${escapeHtml(part.obj.name || "Sprite part")}</dd><dt>Source</dt><dd>${source}</dd><dt>Layer</dt><dd>${escapeHtml(valueLabel(part.layer))}</dd><dt>HP</dt><dd>${escapeHtml(valueLabel(part.obj.hp))}</dd><dt>Position</dt><dd>${escapeHtml(valueLabel(part.sourceX))}, ${escapeHtml(valueLabel(part.sourceY))}</dd></dl></div>` : "";
  }).join("");
  return `<article><h2>Boss Sprite Parts</h2><p class="muted">These are the visual parts used in the assembled preview, including <code>basicObjs</code>, mounted turrets, and mounted spawners when the cache exposes their sprites.</p><div class="boss-sprite-grid">${cards}</div></article>`;
}

function renderRelations(table, key, cache, graph, routes) {
  const id = `${table}:${key}`;
  const outgoing = graph.edges.filter((edge) => edge.from === id && routes.has(edge.to));
  const incoming = (graph.reverse[id] || []).filter((edge) => routes.has(edge.from));
  if (!outgoing.length && !incoming.length) return "";
  const grouped = new Map();
  const add = (edge, targetId, direction) => {
    const groupKey = `${edge.rel}|${targetId}|${direction}`;
    const current = grouped.get(groupKey) || { rel: edge.rel, targetId, direction, count: 0 };
    current.count += 1;
    grouped.set(groupKey, current);
  };
  for (const edge of outgoing) add(edge, edge.to, "Uses");
  for (const edge of incoming) add(edge, edge.from, "Referenced by");
  const rows = [...grouped.values()]
    .sort((a, b) => a.direction.localeCompare(b.direction) || a.rel.localeCompare(b.rel) || a.targetId.localeCompare(b.targetId))
    .slice(0, 120)
    .map((item) => {
      const [targetTable, targetKey] = item.targetId.split(":");
      return `<tr><td>${escapeHtml(relationLabel(item.rel))}</td><td>${entityLink(targetTable, targetKey, cache, routes)}</td><td>${escapeHtml(item.direction)}</td><td>${escapeHtml(valueLabel(item.count))}</td></tr>`;
    })
    .join("");
  return `<section><h2>Related Pages</h2><input class="table-filter" name="table-filter" placeholder="Filter related pages"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Relation</th><th>Page</th><th>Direction</th><th>Links</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function relationLabel(rel) {
  return ({
    projectile: "Projectile",
    techLevelProjectile: "Upgrade projectile",
    techLevelMineral: "Upgrade material",
    drops: "Drop table",
    dropItem: "Loot item",
    ship: "Ship",
    engine: "Engine",
    weapon: "Weapon",
    enemy: "Enemy",
    boss: "Boss",
    body: "Location",
    solarSystem: "System",
    bitmap: "Image",
    background: "Image",
    techIcon: "Icon",
    fireSound: "Fire sound",
    hitSound: "Hit sound",
    explosionSound: "Explosion sound",
    sound: "Sound"
  })[rel] || rel;
}

function renderAdvancedDetails(table, key, record) {
  const rows = Object.entries(record).map(([field, value]) => `<tr><td><code>${escapeHtml(field)}</code></td><td>${escapeHtml(typeof value === "object" ? JSON.stringify(value) : valueLabel(value))}</td></tr>`).join("");
  return `<details class="source-details"><summary>Technical source data</summary><p><code>${escapeHtml(table)}:${escapeHtml(key)}</code></p><div class="table-wrap"><table>${rows}</table></div></details>`;
}

function isVisibleMapSystem(system, key = "") {
  if (!system) return false;
  const type = String(system.type || "").toLowerCase();
  const name = String(system.name || key || "").trim().toLowerCase();
  if (name === "dev") return false;
  if (type && !["regular", "pvp"].includes(type)) return false;
  if (/debug|test/.test(type)) return false;
  return true;
}

function normalizeWarpPath(key, warpPath, cache) {
  const stats = warpPath.stats || warpPath || {};
  const solarSystem1 = stats.solarSystem1 || warpPath.solarSystem1;
  const solarSystem2 = stats.solarSystem2 || warpPath.solarSystem2;
  const name = titleFor(warpPath, key);
  return {
    id: warpPath.id || `WarpPaths:${key}`,
    key,
    name,
    solarSystem1,
    solarSystem2,
    transit: Boolean(stats.transit),
    payVaultItem: stats.payVaultItem || null,
    priceItems: stats.priceItems || warpPath.priceItems || [],
    fromName: titleFor(cache.SolarSystems?.[solarSystem1], solarSystem1),
    toName: titleFor(cache.SolarSystems?.[solarSystem2], solarSystem2),
    stats: { ...stats, solarSystem1, solarSystem2, transit: Boolean(stats.transit), name, key }
  };
}

function prepareMapData(rawMap, cache) {
  const systems = Object.entries(cache.SolarSystems || {})
    .filter(([key, system]) => isVisibleMapSystem(system, key))
    .map(([key, system]) => {
      const status = systemStatusInfo(system, key);
      return {
        id: `SolarSystems:${key}`,
        key,
        name: titleFor(system, key),
        type: system.type ?? null,
        galaxy: system.galaxy ?? null,
        x: system.x ?? null,
        y: system.y ?? null,
        size: system.size ?? null,
        levelMin: system.uberMinLevel ?? null,
        levelMax: system.uberMaxLevel ?? null,
        status: status.label,
        statusKey: status.key,
        access: status.access,
        note: status.note,
        destroyed: status.key === "destroyed",
        links: []
      };
    });
  const systemKeys = new Set(systems.map((system) => system.key));
  const warpSource = Object.keys(cache.WarpPaths || {}).length
    ? Object.entries(cache.WarpPaths || {})
    : (rawMap.warpPaths || []).map((warpPath) => [warpPath.key, warpPath]);
  const warpPaths = warpSource
    .map(([key, warpPath]) => normalizeWarpPath(key, warpPath, cache))
    .filter((warpPath) => systemKeys.has(warpPath.solarSystem1) && systemKeys.has(warpPath.solarSystem2));
  const systemByKey = new Map(systems.map((system) => [system.key, system]));
  for (const warpPath of warpPaths) {
    const a = systemByKey.get(warpPath.solarSystem1);
    const b = systemByKey.get(warpPath.solarSystem2);
    if (!a || !b) continue;
    a.links.push({ key: b.key, name: b.name, pathKey: warpPath.key, pathName: warpPath.name, transit: warpPath.transit });
    b.links.push({ key: a.key, name: a.name, pathKey: warpPath.key, pathName: warpPath.name, transit: warpPath.transit });
  }
  const visibleBodies = (rawMap.bodies || []).filter((body) => {
    const key = String(body.solar_system || "").replace(/^SolarSystems:/, "");
    return systemKeys.has(key);
  });
  return { ...rawMap, systems, bodies: visibleBodies, warpPaths };
}

function systemWarpLinks(key, cache) {
  return Object.entries(cache.WarpPaths || {})
    .map(([warpKey, warpPath]) => normalizeWarpPath(warpKey, warpPath, cache))
    .filter((warpPath) => warpPath.solarSystem1 === key || warpPath.solarSystem2 === key)
    .filter((warpPath) => isVisibleMapSystem(cache.SolarSystems?.[warpPath.solarSystem1], warpPath.solarSystem1) && isVisibleMapSystem(cache.SolarSystems?.[warpPath.solarSystem2], warpPath.solarSystem2))
    .map((warpPath) => {
      const targetKey = warpPath.solarSystem1 === key ? warpPath.solarSystem2 : warpPath.solarSystem1;
      return { ...warpPath, targetKey, targetName: titleFor(cache.SolarSystems?.[targetKey], targetKey) };
    })
    .sort((a, b) => a.targetName.localeCompare(b.targetName));
}

function renderWarpPathPrice(warpPath, cache, routes) {
  const prices = (warpPath.priceItems || []).map((item) => `${entityLink("Commodities", item.item, cache, routes)} x${escapeHtml(valueLabel(item.amount))}`);
  if (prices.length) return prices.join("<br>");
  return warpPath.payVaultItem ? escapeHtml(warpPath.payVaultItem) : "Unlocked / transit";
}

function renderSystemWarpLinks(key, cache, routes) {
  const links = systemWarpLinks(key, cache);
  if (!links.length) return "";
  const rows = links.map((link) => {
    const status = systemStatusInfo(cache.SolarSystems?.[link.targetKey], link.targetKey);
    return `<tr><td>${entityLink("SolarSystems", link.targetKey, cache, routes, link.targetName)}</td><td><span class="status-pill status-${escapeAttr(status.key)}">${escapeHtml(status.label)}</span></td><td>${escapeHtml(link.transit ? "Transit" : "Warp path")}</td><td>${escapeHtml(link.name)}</td><td>${renderWarpPathPrice(link, cache, routes)}</td></tr>`;
  }).join("");
  return `<article><h2>Connected Systems</h2><p class="muted">These are the travel links from the game's <code>WarpPaths</code> table. Open the target system to continue following the route network.</p><div class="table-wrap"><table class="sortable"><thead><tr><th>Destination</th><th>Status</th><th>Link type</th><th>Warp path</th><th>Unlock cost</th></tr></thead><tbody>${rows}</tbody></table></div></article>`;
}

function collectImageKeys(table, record, cache) {
  const keys = [];
  const primary = primaryImageKey(table, record, cache);
  if (primary) keys.push(primary);
  if (table === "Bosses") keys.push(...bossImageKeys(record, cache));
  for (const field of ["bitmap", "background", "techIcon"]) {
    if (record[field]) keys.push(record[field]);
  }
  if (table === "Weapons" && record.techIcon) keys.push(record.techIcon);
  return [...new Set(keys)];
}

function collectSoundRefs(table, record, cache) {
  const fields = [
    ["fireSound", "Fire sound"],
    ["hitSound", "Hit sound"],
    ["explosionSound", "Explosion sound"],
    ["musicAction", "Action music"],
    ["musicQuiet", "Quiet music"],
    ["musicStandard", "System music"]
  ];
  if (table !== "Weapons" || !record.fireSound) fields.push(["sound", table === "Weapons" ? "Sustain sound" : "Sound"]);
  const refs = [];
  const seen = new Set();
  for (const [field, label] of fields) {
    if (!record[field] || seen.has(record[field]) || !cache.Sounds?.[record[field]]) continue;
    refs.push({ key: record[field], label });
    seen.add(record[field]);
  }
  return refs;
}

function renderGalaxyMapSection(map, manifest, canvasId = "map", compact = false) {
  const systems = JSON.stringify(map.systems);
  const warpPaths = JSON.stringify(map.warpPaths || []);
  const systemKeys = new Set((map.systems || []).map((system) => system.key));
  const systemRoutes = Object.fromEntries((manifest.SolarSystems || [])
    .filter((entry) => systemKeys.has(entry.source_key))
    .map((entry) => [entry.source_key, `/${entry.slug}.html`]));
  const galaxies = [...new Set((map.systems || []).map((system) => system.galaxy).filter(Boolean))].sort();
  const galaxyOptions = galaxies.map((galaxy) => `<option value="${escapeAttr(galaxy)}">${escapeHtml(galaxy)}</option>`).join("");
  return `<section class="map-section${compact ? " compact" : ""}">
<div class="map-head">
  <div><h2>${compact ? "Galaxy Map" : "Interactive Galaxy Map"}</h2><p class="muted">Click a system to open its page. Destroyed or inaccessible systems stay visible with a warning marker so their lore and source data remain inspectable. Use the mouse wheel to zoom and drag to pan.</p></div>
</div>
<div class="map-controls" data-map-controls="${escapeAttr(canvasId)}">
  <input id="${escapeAttr(canvasId)}-search" name="${escapeAttr(canvasId)}-search" type="search" placeholder="Find system">
  <select id="${escapeAttr(canvasId)}-galaxy" name="${escapeAttr(canvasId)}-galaxy"><option value="">All galaxies</option>${galaxyOptions}</select>
  <label class="check"><input id="${escapeAttr(canvasId)}-paths" name="${escapeAttr(canvasId)}-paths" type="checkbox" checked> Warp paths</label>
  <div class="map-toolbar"><button type="button" data-map-action="zoom-out">-</button><button type="button" data-map-action="zoom-reset">Reset</button><button type="button" data-map-action="zoom-in">+</button></div>
</div>
<canvas id="${escapeAttr(canvasId)}" width="${compact ? 1100 : 1300}" height="${compact ? 520 : 820}" aria-label="Galaxy map"></canvas>
  <div class="map-tooltip" id="${escapeAttr(canvasId)}-tooltip" aria-hidden="true"></div>
<div class="map-readout" id="${escapeAttr(canvasId)}-readout">Hover a system to inspect level range, galaxy, and coordinates.</div>
<script>
const systems = ${systems};
const warpPaths = ${warpPaths};
const routes = ${JSON.stringify(systemRoutes)};
window.addEventListener("DOMContentLoaded", () => initGalaxyMap("${canvasId}", systems, warpPaths, routes));
</script>
</section>`;
}

function buildMapPage(map, manifest) {
  const body = `<h1>Galaxy Map</h1>
${renderGalaxyMapSection(map, manifest, "map", false)}`;
  writePage(path.join(DIST_DIR, "map", "index.html"), "Galaxy Map", body);
}

function legacyMapScriptUnused() {
  return `
const canvas = document.getElementById("map");
const ctx = canvas.getContext("2d");
const xs = systems.map(s => Number(s.x || 0));
const ys = systems.map(s => Number(s.y || 0));
const minX = Math.min(...xs), maxX = Math.max(...xs);
const minY = Math.min(...ys), maxY = Math.max(...ys);
function scale(v, min, max, size) {
  if (max === min) return size / 2;
  return 60 + ((v - min) / (max - min)) * (size - 120);
}
ctx.fillStyle = "#071019";
ctx.fillRect(0, 0, canvas.width, canvas.height);
const points = [];
for (const s of systems) {
  const x = scale(Number(s.x || 0), minX, maxX, canvas.width);
  const y = scale(Number(s.y || 0), minY, maxY, canvas.height);
  const r = Math.max(4, Math.min(12, Number(s.size || 4)));
  points.push({s,x,y,r});
  ctx.beginPath();
  ctx.fillStyle = s.type === "pvp dom" || s.type === "pvp arena" ? "#ffb454" : "#6ee7f9";
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e6edf3";
  ctx.font = "13px system-ui";
  ctx.fillText(s.name, x + 10, y + 4);
}
canvas.addEventListener("mousemove", event => {
  const box = canvas.getBoundingClientRect();
  const mx = (event.clientX - box.left) * canvas.width / box.width;
  const my = (event.clientY - box.top) * canvas.height / box.height;
  canvas.style.cursor = points.some(p => Math.hypot(mx - p.x, my - p.y) <= p.r + 6) ? "pointer" : "default";
});
canvas.addEventListener("click", event => {
  const box = canvas.getBoundingClientRect();
  const mx = (event.clientX - box.left) * canvas.width / box.width;
  const my = (event.clientY - box.top) * canvas.height / box.height;
  const hit = points.find(p => Math.hypot(mx - p.x, my - p.y) <= p.r + 6);
  if (hit && routes[hit.s.key]) location.href = routes[hit.s.key];
});
`;
}

function findSourceImage(nameToken) {
  const dir = path.join(SOURCE_DIR, "images");
  if (!fs.existsSync(dir)) return null;
  return fs.readdirSync(dir).find((file) => file.toLowerCase().includes(nameToken));
}

function copyMediaAssets(cache) {
  const mediaDir = path.join(DIST_DIR, "assets", "source-images");
  const atlasDir = path.join(DIST_DIR, "assets", "atlases");
  const gamefsDir = path.join(SOURCE_DIR, "gamefs");
  ensureDir(mediaDir);
  ensureDir(atlasDir);
  const byGameFile = new Map();
  const availableImages = [];
  const availableAudio = [];
  const atlasByName = new Map();
  const sourceImageDir = path.join(SOURCE_DIR, "images");

  if (fs.existsSync(sourceImageDir)) {
    for (const file of fs.readdirSync(sourceImageDir)) {
      const ext = path.extname(file).toLowerCase();
      if (![".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) continue;
      const safeName = file.includes("logo_png") ? "logo.png" : file.includes("bg_jpg") ? "background.jpg" : file;
      fs.copyFileSync(path.join(sourceImageDir, file), path.join(mediaDir, safeName));
      availableImages.push({ source: file, url: `/assets/source-images/${safeName}` });
    }
  }

  const logo = findSourceImage("logo_png");
  const bg = findSourceImage("bg_jpg");
  if (logo) byGameFile.set("astroflux-logo", { url: "/assets/source-images/logo.png" });
  if (bg) byGameFile.set("astroflux-background", { url: "/assets/source-images/background.jpg" });

  const gamefsTextures = path.join(gamefsDir, "textures");
  if (fs.existsSync(gamefsTextures)) {
    for (const file of fs.readdirSync(gamefsTextures)) {
      const ext = path.extname(file).toLowerCase();
      if (![".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) continue;
      const outName = `gamefs-${file}`;
      fs.copyFileSync(path.join(gamefsTextures, file), path.join(mediaDir, outName));
      fs.copyFileSync(path.join(gamefsTextures, file), path.join(atlasDir, file));
      availableImages.push({ source: file, url: `/assets/source-images/${outName}` });
      byGameFile.set(file, { url: `/assets/source-images/${outName}` });
    }
    for (const file of fs.readdirSync(gamefsTextures)) {
      if (path.extname(file).toLowerCase() !== ".xml") continue;
      for (const entry of parseAtlasXml(path.join(gamefsTextures, file))) {
        atlasByName.set(entry.name, entry);
      }
    }
  }

  const gamefsAudio = path.join(gamefsDir, "audio");
  const audioOut = path.join(DIST_DIR, "assets", "audio");
  if (fs.existsSync(gamefsAudio)) {
    for (const type of fs.readdirSync(gamefsAudio)) {
      const typeDir = path.join(gamefsAudio, type);
      if (!fs.statSync(typeDir).isDirectory()) continue;
      ensureDir(path.join(audioOut, type));
      for (const file of fs.readdirSync(typeDir)) {
        fs.copyFileSync(path.join(typeDir, file), path.join(audioOut, type, file));
        availableAudio.push({ source: `${type}/${file}`, url: `/assets/audio/${type}/${file}` });
        byGameFile.set(file, { url: `/assets/audio/${type}/${file}` });
      }
    }
  }

  for (const image of Object.values(cache.Images || {})) {
    const found = availableImages.find((item) => item.source === image.fileName);
    if (found) byGameFile.set(image.fileName, found);
  }

  return {
    byGameFile,
    availableImages,
    availableAudio,
    atlasByName,
    imageRecords: Object.keys(cache.Images || {}).length,
    soundRecords: Object.keys(cache.Sounds || {}).length
  };
}

function parseAttrs(text) {
  const attrs = {};
  for (const match of text.matchAll(/([A-Za-z0-9_:-]+)="([^"]*)"/g)) attrs[match[1]] = match[2];
  return attrs;
}

function parseAtlasXml(file) {
  const xml = fs.readFileSync(file, "utf8");
  const atlasAttrs = parseAttrs(xml.match(/<TextureAtlas\b[^>]*>/)?.[0] || "");
  const imagePath = atlasAttrs.imagePath;
  if (!imagePath) return [];
  const entries = [];
  for (const match of xml.matchAll(/<SubTexture\b[^>]*\/>/g)) {
    const attrs = parseAttrs(match[0]);
    if (!attrs.name) continue;
    entries.push({
      name: attrs.name,
      url: `/assets/atlases/${imagePath}`,
      x: Number(attrs.x || 0),
      y: Number(attrs.y || 0),
      width: Number(attrs.width || 1),
      height: Number(attrs.height || 1),
      atlasWidth: Number(atlasAttrs.width || 2048),
      atlasHeight: Number(atlasAttrs.height || 2048)
    });
  }
  return entries;
}

function buildSearchEntries(manifest, cache) {
  const entries = [];
  for (const items of Object.values(manifest)) {
    for (const item of items) {
      const [table, key] = item.id.split(":");
      if (table === "SolarSystems" && !isVisibleMapSystem(cache.SolarSystems?.[key], key)) continue;
      entries.push({
        name: item.name,
        table: table === "Bodies" ? "Stations" : table === "MissionTypes" ? "Quests" : table,
        type: table === "MissionTypes" ? questCategoryInfo(cache[table]?.[key]).label : cache[table]?.[key]?.type || "",
        url: routeForEntry(item)
      });
    }
  }
  for (const item of dailyMissionCatalog(cache)) {
    entries.push({ name: item.name, table: "Quests", type: "Daily", url: item.url });
  }
  for (const item of uniqueArtifactCatalog(cache)) {
    entries.push({ name: item.label, table: "Unique Artifacts", type: uniqueArtifactSourceStatus(item, cache), url: item.url });
  }
  for (const [name, href, type] of GUIDE_PAGES) {
    entries.push({ name, table: "Guides", type, url: `/${href}` });
  }
  entries.push({ name: "Quests", table: "Quests", type: "Index", url: "/quests/" });
  entries.push({ name: "Story Quests", table: "Quests", type: "Story", url: "/quests/story/" });
  entries.push({ name: "Timed Quests", table: "Quests", type: "Timed", url: "/quests/timed/" });
  entries.push({ name: "Daily Quests", table: "Quests", type: "Daily", url: "/quests/daily/" });
  entries.push({ name: "PvP Quests", table: "Quests", type: "PvP", url: "/quests/pvp/" });
  return entries;
}

function buildMediaPage(cache, media) {
  const imageRows = Object.entries(cache.Images || {}).slice(0, 300).map(([key, image]) => {
    const preview = renderImageThumb(image, media);
    return `<tr><td>${preview}${escapeHtml(image.fileName || "")}</td><td>${escapeHtml(image.type || "")}</td><td>${escapeHtml(image.textureName || "")}</td><td>${escapeHtml(mediaImageStatus(image, media))}</td></tr>`;
  }).join("\n");
  const soundRows = Object.entries(cache.Sounds || {}).map(([_key, sound]) => {
    const local = media.byGameFile.get(sound.fileName);
    const player = local ? `<audio controls preload="none" src="${escapeAttr(local.url)}"></audio>` : "";
    return `<tr><td>${escapeHtml(sound.fileName || "")}</td><td>${escapeHtml(sound.type || "")}</td><td>${escapeHtml(sound.volume ?? "")}</td><td>${local ? "available" : "not found"}</td><td>${player}</td></tr>`;
  }).join("\n");
  const body = `<h1>Media</h1>
<p>GameFS texture atlases and audio files are indexed locally when available. Sprites are rendered from atlas XML regions, not only standalone image files.</p>
<h2>Images</h2>
<input class="table-filter" name="table-filter" placeholder="Filter images">
<div class="table-wrap"><table class="sortable filterable"><thead><tr><th>File</th><th>Type</th><th>Texture</th><th>Status</th></tr></thead><tbody>${imageRows}</tbody></table></div>
<h2>Sounds</h2>
<input class="table-filter" name="table-filter" placeholder="Filter sounds">
<div class="table-wrap"><table class="sortable filterable"><thead><tr><th>File</th><th>Type</th><th>Volume</th><th>Status</th><th>Preview</th></tr></thead><tbody>${soundRows}</tbody></table></div>`;
  writePage(path.join(DIST_DIR, "media", "index.html"), "Media", body);
}

function main() {
  const manifest = readJson(path.join(INDEX_DIR, "content-manifest.json"));
  const tables = readJson(path.join(INDEX_DIR, "tables.json"));
  const warnings = readJson(path.join(INDEX_DIR, "warnings.json"));
  const graph = readJson(path.join(INDEX_DIR, "graph.json"));
  const cache = readJson(path.join(RAW_DIR, "cache.json"));
  const map = prepareMapData(readJson(path.join(INDEX_DIR, "galaxy-map.json")), cache);
  const routes = routeMap(manifest, cache);

  cleanDir(DIST_DIR);
  const media = copyMediaAssets(cache);
  writeAssets(buildSearchEntries(manifest, cache), media);
  buildIndex(manifest, tables, warnings, media, map, cache);
  buildContentPages(manifest, cache, media, graph, routes);
  buildUniqueArtifactPages(cache, media, routes);
  buildQuestPages(manifest, cache, media, routes);
  buildMapPage(map, manifest);
  buildMediaPage(cache, media);
  buildGuidePages(cache, manifest, media, routes);
  buildStationsPage(cache, routes);

  const listings = {
    systems: ["Systems", manifest.SolarSystems || [], "SolarSystems"],
    enemies: ["Enemies", manifest.Enemies || [], "Enemies"],
    bosses: ["Bosses", manifest.Bosses || [], "Bosses"],
    weapons: ["Weapons", manifest.Weapons || [], "Weapons"],
    drops: ["Drops", manifest.Drops || [], "Drops"],
    commodities: ["Items", manifest.Commodities || [], "Commodities"],
    artifacts: ["Artifacts", manifest.ArtifactTypes || [], "ArtifactTypes"],
    ships: ["Ships", manifest.Ships || [], "Ships"],
    projectiles: ["Projectiles", manifest.Projectiles || [], "Projectiles"],
    engines: ["Engines", manifest.Engines || [], "Engines"],
    turrets: ["Turrets", manifest.Turrets || [], "Turrets"],
    spawners: ["Spawners", manifest.Spawners || [], "Spawners"],
    missions: ["Missions", manifest.MissionTypes || [], "MissionTypes"]
  };

  for (const [dir, [title, entries, table]] of Object.entries(listings)) {
    buildListing(dir, title, entries, table, cache, media, routes);
  }

  console.log(`Built static site in ${path.relative(ROOT, DIST_DIR)}`);
}

main();


