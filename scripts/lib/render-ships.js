import { numberValue, statCard, valueLabel } from "./display-utils.js";
import { entityLink } from "./entity-links.js";
import { escapeAttr, escapeHtml } from "./html-utils.js";
import { resolveShopItem, shopItemLink, shopItemPriceHtml } from "./shop-utils.js";
import { titleFor } from "./record-utils.js";

let renderImageThumb = () => "";
let findAtlasSprite = () => null;

export function configureShipRendering(deps = {}) {
  renderImageThumb = deps.renderImageThumb || renderImageThumb;
  findAtlasSprite = deps.findAtlasSprite || findAtlasSprite;
}

function entryKey(entry) {
  return entry.id.split(":")[1];
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

export function renderShipListing(entries, cache, media, routes) {
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

export function renderShipPage(key, record, cache, media, routes) {
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

