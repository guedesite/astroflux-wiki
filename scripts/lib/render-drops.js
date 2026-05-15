import { numberValue, percentLabel, rangeText, statCard, valueLabel } from "./display-utils.js";
import { dropSourceData } from "./drop-utils.js";
import { entityLink, missingValue, refKey } from "./entity-links.js";
import { escapeAttr, escapeHtml } from "./html-utils.js";
import { sourceLocationInfo } from "./location-utils.js";
import { titleFor } from "./record-utils.js";

let primaryImageKeyFn = () => "";
let renderImageThumbFn = () => "";

export function configureDropRendering({ primaryImageKey, renderImageThumb } = {}) {
  if (primaryImageKey) primaryImageKeyFn = primaryImageKey;
  if (renderImageThumb) renderImageThumbFn = renderImageThumb;
}

function entryKey(entry) {
  return entry.id.split(":")[1];
}
export function renderSpawnerDropItems(items, cache, routes) {
  if (!Array.isArray(items) || !items.length) return "<span>n/a</span>";
  const links = items
    .map((item) => {
      if (typeof item === "object" && item?.drop) return `${dropLinkSummaryHtml(item.drop, cache, routes)}${item.chance !== undefined ? ` <span class="muted">${percentLabel(item.chance)}</span>` : ""}`;
      return dropLinkSummaryHtml(item, cache, routes);
    })
    .filter(Boolean)
    .slice(0, 5);
  return links.length ? links.join("<br>") : "<span>n/a</span>";
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

function dropArtifactSummaryText(drop) {
  if (!drop) return "";
  const parts = [];
  if (numberValue(drop.artifactLevel, 0) > 0) parts.push(`artifact lvl ${valueLabel(drop.artifactLevel)}`);
  if (numberValue(drop.artifactAmount, 0) > 0) {
    const amount = numberValue(drop.artifactAmount, 0);
    parts.push(`${valueLabel(drop.artifactAmount)} roll${amount === 1 ? "" : "s"}`);
  }
  if (numberValue(drop.artifactChance, 0) > 0) parts.push(`${percentLabel(drop.artifactChance)} artifact chance`);
  return parts.join(" / ");
}

export function dropLinkSummaryHtml(dropKey, cache, routes, label = null) {
  if (!dropKey) return "<span>n/a</span>";
  const drop = cache.Drops?.[dropKey];
  const summary = dropArtifactSummaryText(drop);
  return `${entityLink("Drops", dropKey, cache, routes, label || drop?.name || dropKey)}${summary ? ` <span class="muted">(${escapeHtml(summary)})</span>` : ""}`;
}

function entityThumbLinkHtml(table, key, cache, media, routes, fallback = null) {
  if (!table || !key) return fallback ? `<span>${escapeHtml(fallback)}</span>` : "<span>n/a</span>";
  const record = cache[table]?.[key];
  const imageKey = record ? primaryImageKeyFn(table, record, cache) : "";
  const image = imageKey ? cache.Images?.[imageKey] : null;
  const icon = image ? renderImageThumbFn(image, media) : "";
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

export function renderSourceDropArticles(label, dropRefs, cache, media, routes) {
  if (!dropRefs.length) return `<article><h2>${escapeHtml(label)} Loot</h2><p class="muted">No direct drop table is linked from the downloaded client cache for this source.</p></article>`;
  const summaryRows = sourceDropSummaryRows(dropRefs, cache, routes);
  const rewardRows = sourceDropRewardRows(dropRefs, cache, media, routes);
  return [
    `<article><h2>${escapeHtml(label)} Loot Tables</h2><input class="table-filter" name="table-filter" placeholder="Filter loot tables"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Drop table</th><th>Type</th><th>Source chance</th><th>Crate open</th><th>Effective open</th><th>Qty / rolls</th><th>Artifact lvl</th><th>Artifact chance</th><th>XP</th><th>Flux</th><th>Rewards</th></tr></thead><tbody>${summaryRows}</tbody></table></div></article>`,
    rewardRows ? `<article><h2>Possible Rewards</h2><input class="table-filter" name="table-filter" placeholder="Filter rewards"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Reward</th><th>Table</th><th>From drop</th><th>Source chance</th><th>Item chance</th><th>Effective</th><th>Qty</th><th>Artifact lvl</th></tr></thead><tbody>${rewardRows}</tbody></table></div></article>` : ""
  ].filter(Boolean).join("");
}


export function renderDropListing(entries, cache, routes) {
  const rows = entries.map((entry) => {
    const key = entryKey(entry);
    const drop = cache.Drops?.[key];
    if (!drop) return "";
    const firstItems = (drop.dropItems || []).slice(0, 4).map((item) => entityLink(item.table, item.item, cache, routes)).join(", ");
    return `<tr><td><a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${dropSourceSummary(key, cache, routes)}</td><td>${escapeHtml(valueLabel(drop.crate))}</td><td>${escapeHtml(percentLabel(drop.crate ? drop.chance ?? 1 : 1))}</td><td>${escapeHtml(percentLabel(drop.artifactChance))}</td><td>${escapeHtml(rangeText(drop.fluxMin, drop.fluxMax))}</td><td>${escapeHtml(rangeText(drop.xpMin, drop.xpMax))}</td><td>${firstItems}</td></tr>`;
  }).join("");
  return `<h1>Drops</h1><p class="muted">Open a drop page to see effective chances and the enemies or bosses that reference it.</p><input class="table-filter" name="table-filter" placeholder="Filter drops"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Drop table</th><th>Where it drops</th><th>Crate</th><th>Crate chance</th><th>Artifact</th><th>Flux</th><th>XP</th><th>Preview items</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}


export function renderDropPage(key, record, cache, routes) {
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

