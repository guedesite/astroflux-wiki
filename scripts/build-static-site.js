import path from "node:path";

import { GUIDE_PAGES } from "./lib/build-constants.js";
import {
  artifactIsUnique,
  artifactLevelRange,
  artifactRarityLabel,
  artifactStatLabel,
  artifactValueRange,
  uniqueArtifactCatalog,
  uniqueArtifactSourceStatus
} from "./lib/artifact-utils.js";
import { writeAssets } from "./lib/build-assets.js";
import { coordinateLabel, formatNumber, statCard, valueLabel } from "./lib/display-utils.js";
import { bossHpStats } from "./lib/enemy-utils.js";
import { entityLink, soundLink } from "./lib/entity-links.js";
import { cleanDir, readJson } from "./lib/file-utils.js";
import { escapeAttr, escapeHtml } from "./lib/html-utils.js";
import { isStationBody, isVisibleMapSystem } from "./lib/location-utils.js";
import { buildMediaPage, copyMediaAssets, findAtlasSprite, renderImageCard, renderImageThumb, resolveCanvasImageAsset } from "./lib/media-utils.js";
import { writeSitePage } from "./lib/page-shell.js";
import { DIST_DIR, INDEX_DIR, RAW_DIR, ROOT, ROOT_INDEX_FILE } from "./lib/project-paths.js";
import { titleFor } from "./lib/record-utils.js";
import { buildUniqueArtifactPages, configureArtifactRendering, renderArtifactGuide, renderArtifactListing, renderArtifactPage } from "./lib/render-artifacts.js";
import { bossImageKeys, renderBossLayeredCard, renderBossListing, renderBossPage, renderBossPageSections } from "./lib/render-bosses.js";
import { renderCommodityListing, renderCommodityPage } from "./lib/render-commodities.js";
import { configureDropRendering, dropLinkSummaryHtml, renderDropListing, renderDropPage, renderSourceDropArticles, renderSpawnerDropItems } from "./lib/render-drops.js";
import { renderEnemyEffectsGuide, renderEnemyListing, renderEnemyPage } from "./lib/render-enemies.js";
import { configureGuideRendering, renderCombatGuide, renderFarmingGuide } from "./lib/render-guides.js";
import { buildMapPage, prepareMapData, renderGalaxyMapSection, renderSystemWarpLinks } from "./lib/render-map.js";
import { buildQuestPages, dailyMissionCatalog, questCategoryInfo, renderMissionPage, storyMissionChains } from "./lib/render-quests.js";
import { configureShipRendering, renderShipListing, renderShipPage } from "./lib/render-ships.js";
import { buildStationsPage, configureSystemRendering, renderBodyPage, renderSystemListing, renderSystemPage, renderTravelGuide } from "./lib/render-systems.js";
import { renderWeaponGuide, renderWeaponListing, renderWeaponPage } from "./lib/render-weapons.js";
import { writeRootIndexPage } from "./lib/root-index.js";
import { routeForEntry, routeMap } from "./lib/routes.js";

let assetVersion = "dev";

function relationCount(graph, id) {
  return (graph.reverse[id] || []).length + graph.edges.filter((edge) => edge.from === id).length;
}

function writePage(file, title, body, nav = "") {
  writeSitePage(file, title, body, { nav, distDir: DIST_DIR, assetVersion });
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
  if (dir === "weapons") return renderWeaponListing(entries, cache, media, routes, { renderImageThumb });
  if (dir === "enemies") return renderEnemyListing(entries, cache, media, routes, { primaryImageKey, renderImageThumb });
  if (dir === "bosses") return renderBossListing(entries, cache, media, routes);
  if (dir === "bodies") return renderBodyListing(entries, cache, routes);
  if (dir === "ships") return renderShipListing(entries, cache, media, routes);
  if (dir === "drops") return renderDropListing(entries, cache, routes);
  if (dir === "commodities") return renderCommodityListing(entries, cache, media, routes, { renderImageThumb });
  if (dir === "artifacts") return renderArtifactListing(entries, cache, media, routes);
  if (dir === "systems") return renderSystemListing(entries, cache, routes);
  return "";
}

function entryKey(entry) {
  return entry.id.split(":")[1];
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

function renderPlayerSections(table, key, record, cache, media, routes) {
  switch (table) {
    case "SolarSystems":
      return renderSystemPage(key, record, cache, media, routes);
    case "Bodies":
      return renderBodyPage(key, record, cache, media, routes);
    case "Weapons":
      return renderWeaponPage(key, record, cache, routes);
    case "Enemies":
      return renderEnemyPage(key, record, cache, media, routes, { dropLinkSummaryHtml, renderSourceDropArticles, renderSpawnerDropItems });
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

function renderProjectilePage(record, cache, routes) {
  return `<section class="content-grid"><article><h2>Projectile Behavior</h2><div class="stat-grid">${statCard("AI", record.ai)}${statCard("Collision radius", record.collisionRadius)}${statCard("Explosive", record.explosive)}${statCard("Forced rotation", record.forcedRotation)}${statCard("Wave", record.wave)}${statCard("Blast speed", record.aiBlastSpeed)}</div></article><article><h2>Effects</h2><ul class="link-list"><li>Explosion effect: ${entityLink("Images", record.explosionEffect, cache, routes)}</li><li>Explosion sound: ${soundLink(record.explosionSound, cache, routes)}</li></ul></article></section>`;
}

function renderEnginePage(record, cache, routes) {
  return `<section class="content-grid"><article><h2>Engine Stats</h2><div class="stat-grid">${statCard("Acceleration", record.acceleration)}${statCard("Max speed", record.maxSpeed)}${statCard("Rotation speed", record.rotationSpeed)}${statCard("Friction", record.friction)}${statCard("Booster", record.booster)}${statCard("Sound", cache.Sounds?.[record.sound]?.fileName || "n/a")}</div></article></section>`;
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
  writePage(path.join(DIST_DIR, "guides", "enemy-effects.html"), "Enemy Effects Guide", renderEnemyEffectsGuide(cache, routes));
  writePage(path.join(DIST_DIR, "guides", "weapons.html"), "Weapon Finder", renderWeaponGuide(cache, manifest, media, routes, { renderImageThumb }));
  writePage(path.join(DIST_DIR, "guides", "artifacts.html"), "Artifact Guide", renderArtifactGuide(cache, manifest, media, routes));
  writePage(path.join(DIST_DIR, "guides", "farming.html"), "Farming Guide", renderFarmingGuide(cache, manifest, media, routes));
  writePage(path.join(DIST_DIR, "guides", "travel.html"), "Travel Guide", renderTravelGuide(cache, manifest, routes));
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
  for (const item of storyMissionChains(manifest.MissionTypes || [], cache)) {
    entries.push({ name: item.title, table: "Quests", type: "Story Chain", url: item.url });
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

function main() {
  configureArtifactRendering({ renderImageThumb, renderImageCard, writePage, primaryImageKey });
  configureDropRendering({ primaryImageKey, renderImageThumb });
  configureGuideRendering({ renderImageThumb });
  configureShipRendering({ renderImageThumb, findAtlasSprite });
  configureSystemRendering({ resolveCanvasImageAsset, renderSystemWarpLinks, renderSpawnerDropItems, writePage });
  const manifest = readJson(path.join(INDEX_DIR, "content-manifest.json"));
  const tables = readJson(path.join(INDEX_DIR, "tables.json"));
  const warnings = readJson(path.join(INDEX_DIR, "warnings.json"));
  const graph = readJson(path.join(INDEX_DIR, "graph.json"));
  const cache = readJson(path.join(RAW_DIR, "cache.json"));
  const map = prepareMapData(readJson(path.join(INDEX_DIR, "galaxy-map.json")), cache);
  const routes = routeMap(manifest, {
    cache,
    isVisibleSystem: isVisibleMapSystem,
    uniqueArtifacts: uniqueArtifactCatalog
  });

  cleanDir(DIST_DIR);
  const media = copyMediaAssets(cache);
  ({ assetVersion } = writeAssets(buildSearchEntries(manifest, cache), media));
  buildIndex(manifest, tables, warnings, media, map, cache);
  buildContentPages(manifest, cache, media, graph, routes);
  buildUniqueArtifactPages(cache, media, routes);
  buildQuestPages(manifest, cache, media, routes, { writePage, renderImageCard });
  buildMapPage(map, manifest, { writePage });
  buildMediaPage(cache, media, { writePage });
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








