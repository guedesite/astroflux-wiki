import path from "node:path";

import {
  UNIQUE_ARTIFACT_DESCRIPTIONS,
  UNIQUE_ARTIFACT_STATS,
  UNIQUE_ARTIFACT_TYPES
} from "./build-constants.js";
import {
  artifactBaseType,
  artifactDropEntries,
  ARTIFACT_FINDER_BANDS,
  artifactFinderBandFor,
  artifactFinderEligiblePool,
  artifactFinderRollChance,
  artifactIsUnique,
  artifactLevelRange,
  artifactNumericRange,
  artifactRarityLabel,
  artifactStatLabel,
  artifactUpgradeLabel,
  artifactValueRange,
  uniqueArtifactCatalog,
  uniqueArtifactEffectRole,
  uniqueArtifactFocusSummary,
  uniqueArtifactRowNotes,
  uniqueArtifactSourceStatus,
  uniqueDropEntry
} from "./artifact-utils.js";
import { numberValue, percentLabel, rangeText, statCard, valueLabel } from "./display-utils.js";
import { dropSourceData } from "./drop-utils.js";
import { entityLink, missingValue } from "./entity-links.js";
import { escapeAttr, escapeHtml } from "./html-utils.js";
import { sourceLocationInfo } from "./location-utils.js";
import { DIST_DIR } from "./project-paths.js";
import { titleFor } from "./record-utils.js";

let renderImageThumb = () => "";
let renderImageCard = () => "";
let writePage = () => {
  throw new Error("Artifact renderer dependencies are not configured");
};
let primaryImageKey = (table, record) => record?.bitmap || record?.techIcon || record?.background || "";

export function configureArtifactRendering(deps = {}) {
  renderImageThumb = deps.renderImageThumb || renderImageThumb;
  renderImageCard = deps.renderImageCard || renderImageCard;
  writePage = deps.writePage || writePage;
  primaryImageKey = deps.primaryImageKey || primaryImageKey;
}

function entryKey(entry) {
  return entry.id.split(":")[1];
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

export function renderArtifactListing(entries, cache, media, routes) {
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

export function renderArtifactPage(key, record, cache, routes) {
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

export function buildUniqueArtifactPages(cache, media, routes) {
  const rows = uniqueArtifactIconRows(cache, media, routes);
  writePage(path.join(DIST_DIR, "artifacts", "unique", "index.html"), "Unique Artifacts", `<h1>Unique Artifacts</h1><p class="muted">Sprites come from the GameFS atlas, and unique stat families are marked when the client exposes a stable mapping.</p><input class="table-filter" name="table-filter" placeholder="Filter unique artifacts"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Unique artifact</th><th>Stat / effect</th><th>Damage / build focus</th><th>Bosses</th><th>Crate</th><th>Source status</th></tr></thead><tbody>${rows}</tbody></table></div>`);
  for (const item of uniqueArtifactCatalog(cache)) {
    writePage(path.join(DIST_DIR, `${item.slug}.html`), item.label, renderUniqueArtifactPage(item, cache, media, routes));
  }
}

export function renderArtifactGuide(cache, manifest, media, routes) {
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

