import path from "node:path";

import { valueLabel } from "./display-utils.js";
import { entityLink } from "./entity-links.js";
import { escapeAttr, escapeHtml } from "./html-utils.js";
import { isVisibleMapSystem, systemStatusInfo } from "./location-utils.js";
import { DIST_DIR } from "./project-paths.js";
import { titleFor } from "./record-utils.js";

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

export function prepareMapData(rawMap, cache) {
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

export function renderSystemWarpLinks(key, cache, routes) {
  const links = systemWarpLinks(key, cache);
  if (!links.length) return "";
  const rows = links.map((link) => {
    const status = systemStatusInfo(cache.SolarSystems?.[link.targetKey], link.targetKey);
    return `<tr><td>${entityLink("SolarSystems", link.targetKey, cache, routes, link.targetName)}</td><td><span class="status-pill status-${escapeAttr(status.key)}">${escapeHtml(status.label)}</span></td><td>${escapeHtml(link.transit ? "Transit" : "Warp path")}</td><td>${escapeHtml(link.name)}</td><td>${renderWarpPathPrice(link, cache, routes)}</td></tr>`;
  }).join("");
  return `<article><h2>Connected Systems</h2><p class="muted">These are the travel links from the game's <code>WarpPaths</code> table. Open the target system to continue following the route network.</p><div class="table-wrap"><table class="sortable"><thead><tr><th>Destination</th><th>Status</th><th>Link type</th><th>Warp path</th><th>Unlock cost</th></tr></thead><tbody>${rows}</tbody></table></div></article>`;
}


export function renderGalaxyMapSection(map, manifest, canvasId = "map", compact = false) {
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

export function buildMapPage(map, manifest, { writePage } = {}) {
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

