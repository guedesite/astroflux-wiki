import { DAMAGE_TYPES } from "./build-constants.js";
import { damageTypeLabel, numberValue, percentLabel, statCard, valueLabel } from "./display-utils.js";
import { entityLink, soundLink } from "./entity-links.js";
import { escapeAttr, escapeHtml } from "./html-utils.js";
import { renderDescription } from "./text-utils.js";
import {
  eliteCostRange,
  isPlayerFacingWeapon,
  weaponDps,
  weaponEliteRows,
  weaponHeatPerSecond,
  weaponHits,
  weaponShotDamage,
  weaponSourceRowsData,
  weaponSourceSummary,
  weaponTags
} from "./weapon-utils.js";

function entryKey(entry) {
  return entry.id.split(":")[1];
}

export function renderWeaponListing(entries, cache, media, routes, { renderImageThumb } = {}) {
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

export function renderWeaponPage(key, record, cache, routes) {
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

export function renderWeaponGuide(cache, manifest, media, routes, { renderImageThumb } = {}) {
  const entries = (manifest.Weapons || []).filter((entry) => isPlayerFacingWeapon(cache.Weapons?.[entryKey(entry)]));
  const topDps = entries
    .map((entry) => ({ entry, record: cache.Weapons?.[entryKey(entry)], score: weaponDps(cache.Weapons?.[entryKey(entry)] || {}) }))
    .filter((item) => item.record && item.score)
    .sort((a, b) => b.score - a.score)
    .slice(0, 25)
    .map(({ entry, record }) => weaponComparisonRow(entry, record, cache, media, { renderImageThumb }))
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
    .map(({ entry, record }) => weaponComparisonRow(entry, record, cache, media, { renderImageThumb }))
    .join("");
  return `<h1>Weapon Finder</h1><p class="muted">These rankings focus on player-facing weapons. Enemy and boss weapons stay available in the complete weapon index for research.</p>
<section class="content-grid">
  <article><h2>Highest Approximate DPS</h2><input class="table-filter" name="table-filter" placeholder="Filter weapons"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Weapon</th><th>Damage type</th><th>DPS</th><th>Range</th><th>Heat/s</th><th>Tags</th></tr></thead><tbody>${topDps}</tbody></table></div></article>
  <article><h2>Best DPS Per Heat Cost</h2><input class="table-filter" name="table-filter" placeholder="Filter weapons"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Weapon</th><th>Damage type</th><th>DPS</th><th>Range</th><th>Heat/s</th><th>Tags</th></tr></thead><tbody>${efficient}</tbody></table></div></article>
  <article><h2>Full Table</h2><p><a class="button-link" href="/weapons/">Open all weapons</a></p></article>
</section>`;
}

function weaponComparisonRow(entry, record, cache, media, { renderImageThumb } = {}) {
  const icon = cache.Images?.[record.techIcon] ? renderImageThumb(cache.Images[record.techIcon], media) : "";
  return `<tr><td>${icon}<a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${escapeHtml(damageTypeLabel(record.damageType))}</td><td>${escapeHtml(valueLabel(weaponDps(record)))}</td><td>${escapeHtml(valueLabel(record.range))}</td><td>${escapeHtml(valueLabel(weaponHeatPerSecond(record)))}</td><td>${escapeHtml(weaponTags(record))}</td></tr>`;
}
