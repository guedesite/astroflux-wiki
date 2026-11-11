import { DAMAGE_TYPES } from "./build-constants.js";
import { damageTypeLabel, numberValue, statCard, valueLabel } from "./display-utils.js";
import {
  enemyDropRefs,
  enemyLootSourceMode,
  ENEMY_RARE_EFFECTS,
  enemyRareEffectItems,
  enemyRareMode,
  enemyShipStats,
  enemyTraits
} from "./enemy-utils.js";
import { entityLink, missingValue, refKey } from "./entity-links.js";
import { escapeAttr, escapeHtml } from "./html-utils.js";
import { bossPlacements, enemySpawnerPlacements, enemySummonSources, placementConditionLabels } from "./location-utils.js";
import { titleFor } from "./record-utils.js";
import { renderDescription } from "./text-utils.js";

function entryKey(entry) {
  return entry.id.split(":")[1];
}

export function renderEnemyListing(entries, cache, media, routes, { primaryImageKey, renderImageThumb } = {}) {
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
      const icon = cache.Images?.[imageKey] ? renderImageThumb(cache.Images[imageKey], media, { size: 64, frameClass: "enemy-thumb" }) : "";
      const stats = enemyShipStats(record, cache);
      const traits = enemyTraits(record, false);
      const effective = numberValue(stats.hpMax) + numberValue(stats.shieldMax);
      return `<tr data-search="${escapeAttr(`${entry.name} ${traits} ${damageTypeLabel(record.damageType)} ${stats.body}`)}" data-trait="${escapeAttr(traits)}" data-damage="${escapeAttr(record.damageType ?? "")}" data-level="${escapeAttr(record.level ?? 0)}" data-hp="${escapeAttr(effective)}" data-kres="${escapeAttr(record.kineticResist ?? 0)}" data-eres="${escapeAttr(record.energyResist ?? 0)}" data-cres="${escapeAttr(record.corrosiveResist ?? 0)}"><td class="name-cell">${icon}<a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${escapeHtml(valueLabel(record.level))}</td><td>${escapeHtml(valueLabel(stats.hpMax))}</td><td>${escapeHtml(valueLabel(stats.shieldMax))}</td><td>${escapeHtml(valueLabel(record.xp))}</td><td>${enemyTraits(record, true)}</td><td>${escapeHtml(damageTypeLabel(record.damageType))}</td><td>${escapeHtml(valueLabel(record.kineticResist))}</td><td>${escapeHtml(valueLabel(record.energyResist))}</td><td>${escapeHtml(valueLabel(record.corrosiveResist))}</td></tr>`;
    })
    .join("");
  return `<h1>Enemies</h1><p class="muted">The useful first pass for a player: sprite, name, level, survivability, special behavior, damage type, and resistances. HP is taken from the linked ship record; <code>startHp</code> is shown on detail pages when an enemy starts damaged.</p><p><a class="button-link" href="/guides/combat.html">Open combat guide</a> <a class="button-link" href="/guides/enemy-effects.html">Open enemy effects guide</a></p>
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

export function renderEnemyPage(key, record, cache, media, routes, { dropLinkSummaryHtml, renderSourceDropArticles, renderSpawnerDropItems } = {}) {
  const stats = enemyShipStats(record, cache);
  const loadout = (record.weapons || []).map((weapon) => renderWeaponLoadout(weapon, cache, routes)).join("");
  const dropRefs = enemyDropRefs(key, record, cache);
  const rareEffects = enemyRareEffectItems(record);
  const rareMode = enemyRareMode(record);
  const rareArticle = record?.miniBoss || record?.rareSettings || record?.alwaysRare || rareEffects.length
    ? `<article><h2>Special Effect Flags</h2><div class="stat-grid">${statCard("Mini-boss", record.miniBoss)}${statCard("Rare mode", rareMode.label, rareMode.hint)}${statCard("Effect pool", rareEffects.length ? rareEffects.map((effect) => effect.label).join(", ") : "No named rare family")}${statCard("Loot source model", enemyLootSourceMode(key, record, cache))}</div><p class="muted">${rareEffects.length ? `Enabled rare families: ${escapeHtml(rareEffects.map((effect) => `${effect.label} - ${effect.hint}`).join(" | "))}` : "The client cache does not publish exact random-effect multipliers for this enemy. Use the enemy effects guide for the global summary of what is exposed."}</p><p><a class="button-link" href="/guides/enemy-effects.html">Open enemy effects guide</a></p></article>`
    : "";
  const lootLinks = [...new Set(dropRefs.map((item) => item.key))]
    .map((dropKey) => dropLinkSummaryHtml(dropKey, cache, routes))
    .join(", ");
  const placements = enemySpawnerPlacements(key, cache);
  const spawnerRows = placements
    .slice(0, 60)
    .map((placement) => {
      const conditions = placementConditionLabels(placement);
      const conditionHtml = conditions.length
        ? conditions.map((label) => `<span class="status-pill">${escapeHtml(label)}</span>`).join(" ")
        : '<span class="status-pill status-accessible">Open world</span>';
      return `<tr><td>${entityLink("Spawners", placement.spawnerKey, cache, routes)}</td><td>${placement.systemKey ? entityLink("SolarSystems", placement.systemKey, cache, routes) : missingValue()}</td><td>${placement.bodyKey ? entityLink("Bodies", placement.bodyKey, cache, routes) : missingValue()}</td><td>${escapeHtml(valueLabel(placement.level))}</td><td>${conditionHtml}</td><td>${renderSpawnerDropItems([...(placement.spawner.drops || []), ...(placement.spawner.drops2 || [])], cache, routes)}</td></tr>`;
    })
    .join("");
  const reachableCount = placements.filter((placement) => placement.systemVisible && placement.bodyActive && !placement.hidden).length;
  const encounterNote = record?.excludeFromEnctounter
    ? '<p class="muted"><code>excludeFromEnctounter</code> is set on this enemy: it is excluded from the normal encounter generator, so the spawners below are the only scripted/invasion routes to it.</p>'
    : "";
  const placementArticle = spawnerRows
    ? `<article><h2>Where To Find</h2><p class="muted">World locations come from the spawners that reference this enemy (<code>enemy</code>, <code>enemy2</code>, <code>enemies</code>, <code>enemies2</code>), resolved to their body and solar system. Conditions show when a spawner is hidden, mission-triggered, on an event body, or in a Dev/hidden system. ${escapeHtml(valueLabel(placements.length))} spawner link(s), ${escapeHtml(valueLabel(reachableCount))} in a reachable open-world system.</p>${encounterNote}<input class="table-filter" name="table-filter" placeholder="Filter spawn locations"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Spawner</th><th>System</th><th>Location</th><th>Level</th><th>Conditions</th><th>Spawner drops</th></tr></thead><tbody>${spawnerRows}</tbody></table></div></article>`
    : renderEnemyPlacementFallback(key, record, cache, routes);
  return `<section class="content-grid">
    <article><h2>Threat Profile</h2><div class="stat-grid">${statCard("Traits", enemyTraits(record, false))}${statCard("Damage type", damageTypeLabel(record.damageType))}${statCard("Damage", record.damage || record.kamikazeDmg)}${statCard("Range", record.range || record.aggroRange)}${statCard("Refire", record.refire)}${statCard("XP", record.xp)}</div>${renderDescription(record.description)}</article>
    <article><h2>Survival Info</h2><div class="stat-grid">${statCard("Max HP", stats.hpMax)}${record.startHp !== undefined ? statCard("Starts With HP", stats.startHp, `${valueLabel(record.startHp)}% of max`) : ""}${statCard("Shield", stats.shieldMax)}${statCard("Armor", stats.armor)}${statCard("Kinetic resist", record.kineticResist)}${statCard("Energy resist", record.energyResist)}${statCard("Corrosive resist", record.corrosiveResist)}</div></article>
    ${rareArticle}
    <article><h2>Equipment</h2><ul class="link-list"><li>Ship sprite/base stats: ${entityLink("Ships", record.ship, cache, routes)}${stats.body ? ` <span class="muted">${escapeHtml(stats.body)}</span>` : ""}</li><li>Engine: ${entityLink("Engines", record.engine, cache, routes)}</li><li>Loot: ${lootLinks || missingValue()}</li>${loadout}</ul></article>
    ${renderSourceDropArticles("Enemy", dropRefs, cache, media, routes)}
    ${placementArticle}
  </section>`;
}

function renderEnemyPlacementFallback(key, record, cache, routes) {
  const summon = enemySummonSources(key, cache);
  const items = [];
  if (summon.byEnemies.length) {
    const parents = summon.byEnemies.map(({ key: enemyKey }) => {
      const systems = [...new Set(enemySpawnerPlacements(enemyKey, cache)
        .filter((placement) => placement.systemVisible)
        .map((placement) => placement.systemKey)
        .filter(Boolean))];
      const location = systems.slice(0, 2).map((systemKey) => entityLink("SolarSystems", systemKey, cache, routes)).join(", ");
      return `${entityLink("Enemies", enemyKey, cache, routes)}${location ? ` (${location})` : ""}`;
    });
    items.push(`Summoned by enemy: ${parents.join(", ")}`);
  }
  for (const weapon of summon.weapons) {
    const owners = [];
    if (weapon.enemies.length) owners.push(`hostiles: ${weapon.enemies.map(({ key: enemyKey }) => entityLink("Enemies", enemyKey, cache, routes)).join(", ")}`);
    if (weapon.playerSkins.length) {
      const ships = [...new Set(weapon.playerSkins.map(({ record: skin }) => skin.ship).filter(Boolean))];
      owners.push(`player ships: ${ships.map((shipKey) => entityLink("Ships", shipKey, cache, routes)).join(", ")}`);
    }
    if (weapon.shopBodies.length) {
      owners.push(`sold at: ${weapon.shopBodies.slice(0, 3).map(({ key: bodyKey }) => entityLink("Bodies", bodyKey, cache, routes)).join(", ")}`);
    }
    if (weapon.drops.length) {
      owners.push(`loot: ${weapon.drops.slice(0, 3).map(({ key: dropKey }) => entityLink("Drops", dropKey, cache, routes)).join(", ")}`);
    }
    items.push(`Summoned by weapon ${entityLink("Weapons", weapon.key, cache, routes)}${owners.length ? ` (${owners.join("; ")})` : ""}`);
  }
  for (const mount of summon.bossMounts || []) {
    const hosts = mount.bosses.filter(({ record: boss }) => !/^\?+$/.test(String(boss?.name || "").trim()));
    const hostBits = hosts.map(({ key: bossKey }) => {
      const systems = [...new Set(bossPlacements(bossKey, cache).map((placement) => placement.systemKey).filter(Boolean))];
      const location = systems.slice(0, 2).map((systemKey) => entityLink("SolarSystems", systemKey, cache, routes)).join(", ");
      return `${entityLink("Bosses", bossKey, cache, routes)}${location ? ` (${location})` : ""}`;
    });
    items.push(hostBits.length
      ? `Part of boss encounter ${hostBits.join(", ")} <span class="muted">— mounted spawner ${entityLink("Spawners", mount.spawnerKey, cache, routes)}</span>`
      : `Mounted spawner ${entityLink("Spawners", mount.spawnerKey, cache, routes)} with no world body <span class="muted">— likely a boss/part mount</span>`);
  }
  const flags = [];
  if (record?.excludeFromEnctounter) flags.push("<code>excludeFromEnctounter</code>: excluded from normal encounters (scripted or legacy spawn)");
  if (record?.hasSpawn) flags.push("<code>hasSpawn</code>: the record can spawn helpers of its own");
  if (record?.miniBoss) flags.push("<code>miniBoss</code>: flagged as a mini-boss variant");
  return `<article><h2>Where To Find</h2><p class="muted">No open-world spawner places this enemy in a system body. The links and flags below explain how it enters play.</p>${items.length ? `<ul class="link-list">${items.map((item) => `<li>${item}</li>`).join("")}</ul>` : ""}${flags.length ? `<p class="muted">${flags.join(" · ")}.</p>` : ""}${!items.length && !flags.length ? "<p class=\"muted\">No spawner, summon, weapon, or encounter flag explains how it enters play. It may be driven by server-side encounter logic or be an unused asset.</p>" : ""}</article>`;
}

function renderWeaponLoadout(loadout, cache, routes) {
  const key = refKey("Weapons", loadout);
  const range = typeof loadout === "object" && loadout
    ? [loadout.minRange, loadout.maxRange].filter((value) => value !== undefined).join("-")
    : "";
  return `<li>Weapon: ${entityLink("Weapons", key, cache, routes)}${range ? ` <span class="muted">range ${escapeHtml(range)}</span>` : ""}</li>`;
}

export function renderEnemyEffectsGuide(cache, routes) {
  const tracked = Object.entries(cache.Enemies || {})
    .map(([key, record]) => ({ key, record, effects: enemyRareEffectItems(record), rareMode: enemyRareMode(record) }))
    .filter(({ record, effects }) => record?.miniBoss || record?.rareSettings || record?.alwaysRare || effects.length);
  const miniBossCount = tracked.filter(({ record }) => record?.miniBoss).length;
  const randomRareCount = tracked.filter(({ record }) => record?.rareSettings).length;
  const alwaysRareCount = tracked.filter(({ record }) => record?.alwaysRare).length;
  const familyRows = ENEMY_RARE_EFFECTS.map((effect) => {
    const enemies = tracked.filter(({ record }) => record?.[effect.field]);
    const examples = enemies.slice(0, 4).map(({ key }) => entityLink("Enemies", key, cache, routes)).join(", ");
    return `<tr><td>${escapeHtml(effect.label)}</td><td><code>${escapeHtml(effect.field)}</code></td><td>${escapeHtml(effect.hint)}</td><td>No global multiplier is exposed. Check the enemy page for direct and spawner-linked loot tables.</td><td>${escapeHtml(valueLabel(enemies.length))}</td><td>${escapeHtml(valueLabel(enemies.filter(({ record }) => record?.miniBoss).length))}</td><td>${escapeHtml(valueLabel(enemies.filter(({ record }) => record?.alwaysRare).length))}</td><td>${examples || "<span>n/a</span>"}</td></tr>`;
  }).join("");
  const enemyRows = tracked
    .sort((a, b) => numberValue(b.record?.level, 0) - numberValue(a.record?.level, 0) || titleFor(a.record, a.key).localeCompare(titleFor(b.record, b.key)))
    .map(({ key, record, effects, rareMode }) => {
      const lootRefs = enemyDropRefs(key, record, cache);
      const lootPreview = [...new Set(lootRefs.map((item) => cache.Drops?.[item.key]?.name || item.key))]
        .slice(0, 3)
        .join(", ");
      return `<tr data-search="${escapeAttr(`${titleFor(record, key)} ${effects.map((effect) => effect.label).join(" ")} ${rareMode.label}`)}"><td>${entityLink("Enemies", key, cache, routes)}</td><td>${escapeHtml(valueLabel(record.level))}</td><td>${escapeHtml(valueLabel(record.miniBoss))}</td><td>${escapeHtml(rareMode.label)}</td><td>${effects.length ? effects.map((effect) => escapeHtml(effect.label)).join(", ") : "<span>n/a</span>"}</td><td>${escapeHtml(enemyLootSourceMode(key, record, cache))}</td><td>${lootPreview ? escapeHtml(lootPreview) : "<span>n/a</span>"}</td></tr>`;
    })
    .join("");
  return `<h1>Enemy Effects Guide</h1>
<section class="content-grid">
  <article><h2>What The Client Cache Exposes</h2><p>The random special-effect system is only partially exposed in the downloaded client data. The cache gives stable flags such as <code>miniBoss</code>, <code>rareSettings</code>, <code>alwaysRare</code>, and named rare families like <code>rareAttacker</code> or <code>rareLegend</code>. It does <strong>not</strong> publish a numeric table for the exact stat multipliers or a global loot-bonus formula, so this guide stays factual about what can be proven from the data.</p></article>
  <article><h2>Observed Coverage</h2><div class="stat-grid">${statCard("Tracked hostiles", tracked.length)}${statCard("Mini-boss flagged", miniBossCount)}${statCard("Random rare enabled", randomRareCount)}${statCard("Always rare", alwaysRareCount)}${statCard("Rare families", ENEMY_RARE_EFFECTS.length)}</div><p class="muted">Use each enemy page for the exact loot tables. This guide explains the special-effect flags and shows which enemies are wired for them.</p></article>
</section>
<article><h2>Rare Effect Families</h2><div class="table-wrap"><table class="sortable"><thead><tr><th>Family</th><th>Cache flag</th><th>Observable stat signal</th><th>Observable loot signal</th><th>Eligible enemies</th><th>Mini-bosses</th><th>Always rare</th><th>Examples</th></tr></thead><tbody>${familyRows}</tbody></table></div></article>
<article><h2>Tracked Enemy Records</h2><p class="muted">Rows below include enemies that are mini-bosses, have rare-mode enabled, are always rare, or expose one of the named rare families.</p><input class="table-filter" name="table-filter" placeholder="Filter effect family, enemy, or rare mode"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Enemy</th><th>Level</th><th>Mini-boss</th><th>Rare mode</th><th>Effect pool</th><th>Loot wiring</th><th>Loot preview</th></tr></thead><tbody>${enemyRows}</tbody></table></div></article>`;
}
