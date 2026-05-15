import { commoditySourceRowsData } from "./commodity-utils.js";
import { percentLabel, rangeText, statCard, valueLabel } from "./display-utils.js";
import { entityLink } from "./entity-links.js";
import { escapeHtml } from "./html-utils.js";

function entryKey(entry) {
  return entry.id.split(":")[1];
}

export function renderCommodityListing(entries, cache, media, routes, { renderImageThumb } = {}) {
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

export function renderCommodityPage(key, record, cache, routes) {
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
