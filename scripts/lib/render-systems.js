import path from "node:path";

import { coordinateLabel, numberValue, rangeText, statCard, valueLabel } from "./display-utils.js";
import { entityLink } from "./entity-links.js";
import { escapeAttr, escapeHtml } from "./html-utils.js";
import { bodyDisplayName, isStationBody, isVisibleMapSystem, resolvedSystemBodies, systemStatusInfo } from "./location-utils.js";
import { DIST_DIR } from "./project-paths.js";
import { titleFor } from "./record-utils.js";
import { resolveShopItem, shopItemLink, shopItemPriceHtml } from "./shop-utils.js";

let resolveCanvasImageAsset = () => null;
let renderSystemWarpLinks = () => "";
let renderSpawnerDropItems = () => "<span>n/a</span>";
let writePage = () => {
  throw new Error("System renderer dependencies are not configured");
};

export function configureSystemRendering(deps = {}) {
  resolveCanvasImageAsset = deps.resolveCanvasImageAsset || resolveCanvasImageAsset;
  renderSystemWarpLinks = deps.renderSystemWarpLinks || renderSystemWarpLinks;
  renderSpawnerDropItems = deps.renderSpawnerDropItems || renderSpawnerDropItems;
  writePage = deps.writePage || writePage;
}

function entryKey(entry) {
  return entry.id.split(":")[1];
}
export function renderSystemLocalMap(systemKey, record, cache, media, routes, options = {}) {
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

export function renderSystemListing(entries, cache, routes) {
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

export function renderSystemPage(key, record, cache, media, routes) {
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

export function renderBodyPage(key, record, cache, media, routes) {
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

export function renderTravelGuide(cache, manifest, routes) {
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

export function renderStationsPage(cache, routes) {
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

export function buildStationsPage(cache, routes) {
  writePage(path.join(DIST_DIR, "stations", "index.html"), "Stations", renderStationsPage(cache, routes));
}

