import { DAMAGE_TYPES } from "./build-constants.js";
import { commoditySourceRowsData } from "./commodity-utils.js";
import { numberValue, valueLabel } from "./display-utils.js";
import { entityLink } from "./entity-links.js";
import { escapeAttr, escapeHtml } from "./html-utils.js";
import { isVisibleMapSystem, resolvedSystemBodies } from "./location-utils.js";
import { titleFor } from "./record-utils.js";

let renderImageThumb = () => "";

export function configureGuideRendering(deps = {}) {
  renderImageThumb = deps.renderImageThumb || renderImageThumb;
}

function entryKey(entry) {
  return entry.id.split(":")[1];
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

export function renderCombatGuide(cache) {
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

export function renderFarmingGuide(cache, manifest, media, routes) {
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

