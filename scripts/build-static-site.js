import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, "source");
const CONTENT_DIR = path.join(ROOT, "content");
const INDEX_DIR = path.join(ROOT, "data", "index");
const RAW_DIR = path.join(ROOT, "data", "raw");
const DIST_DIR = path.join(ROOT, "dist");

const DAMAGE_TYPES = [
  "Kinetic",
  "Energy",
  "Corrosive",
  "50% Kinetic + 50% Energy",
  "50% Corrosive + 50% Kinetic",
  "All",
  "Health",
  "Kinetic + Energy + Corrosive",
  "None",
  "50% Energy + 50% Corrosive"
];

const GUIDE_PAGES = [
  ["Guides", "guides/", "Start here"],
  ["Combat Guide", "guides/combat.html", "Damage, resistances, and threat reading"],
  ["Weapon Finder", "guides/weapons.html", "Compare damage, range, heat, and reload"],
  ["Artifact Guide", "guides/artifacts.html", "Artifact stats, special rolls, and drop odds"],
  ["Farming Guide", "guides/farming.html", "Find where items and resources drop"],
  ["Travel Guide", "guides/travel.html", "Systems, locations, shops, and hostiles"]
];

const WEAPON_ELITE_TECHS = [
  ["AddKineticDamage", "Kinetic Damage"],
  ["AddEnergyDamage", "Energy Damage"],
  ["AddCorrosiveDamage", "Corrosive Damage"],
  ["AddKineticBaseDamage", "Kinetic Damage"],
  ["AddEnergyBaseDamage", "Energy Damage"],
  ["AddCorrosiveBaseDamage", "Corrosive Damage"],
  ["AddKineticDot5", "Kinetic DoT 5 Seconds"],
  ["AddEnergyDot5", "Energy DoT 5 Seconds"],
  ["AddCorrosiveDot5", "Corrosive DoT 5 Seconds"],
  ["AddKineticDot10", "Kinetic DoT 10 Seconds"],
  ["AddEnergyDot10", "Energy DoT 10 Seconds"],
  ["AddCorrosiveDot10", "Corrosive DoT 10 Seconds"],
  ["AddKineticDot20", "Kinetic DoT 20 Seconds"],
  ["AddEnergyDot20", "Energy DoT 20 Seconds"],
  ["AddCorrosiveDot20", "Corrosive DoT 20 Seconds"],
  ["AddEnergyBurn", "Energy Burn 10 Seconds"],
  ["AddCorrosiveBurn", "Corrosive Burn 10 Seconds"],
  ["AddHealthVamp", "Health Leech"],
  ["AddShieldVamp", "Shield Leech"],
  ["AddDualVamp", "Health and Shield Leech"],
  ["KineticPenetration", "Reduce Kinetic Resistance"],
  ["EnergyPenetration", "Reduce Energy Resistance"],
  ["CorrosivePenetration", "Reduce Corrosive Resistance"],
  ["AddExtraProjectiles", "Extra Projectiles"],
  ["IncreaseDirectDamage", "Improved Direct Damage"],
  ["IncreaseDebuffDamage", "Improved DoT"],
  ["IncreaseRange", "Improved Range"],
  ["IncreaseRefire", "Improved Attack Speed"],
  ["IncreaseGuidance", "Improved Velocity and Guidance"],
  ["ReducePowerCost", "Reduced Power Cost"],
  ["DisableHealing", "Disables Target Healing"],
  ["DisableShieldRegen", "Disables Target Shield Regen"],
  ["ReduceTargetDamage", "Reduce Target Damage"],
  ["ReduceTargetArmor", "Reduce Target Armor"],
  ["IncreaseAOE", "Improved Area Of Effect"],
  ["AddAOE", "Added Area Of Effect"],
  ["IncreaseNrHits", "Improved Number of Hits"],
  ["IncreaseSpeed", "Increase Speed"],
  ["IncreasePetHp", "Increase Pet HP and Shield"]
];

const ELITE_TECH_COST = {
  increase: 1.025,
  sum: 432.548654,
  primary: 3200000,
  secondary: 540000,
  flux: 12000
};

const ARTIFACT_STAT_LABELS = {
  healthAdd: "Flat health",
  healthMulti: "Percent health",
  armorAdd: "Flat armor",
  armorMulti: "Percent armor",
  corrosiveAdd: "Flat corrosive damage",
  corrosiveMulti: "Percent corrosive damage",
  energyAdd: "Flat energy damage",
  energyMulti: "Percent energy damage",
  kineticAdd: "Flat kinetic damage",
  kineticMulti: "Percent kinetic damage",
  shieldAdd: "Flat shield",
  shieldMulti: "Percent shield",
  shieldRegen: "Shield regen",
  corrosiveResist: "Corrosive resist",
  energyResist: "Energy resist",
  kineticResist: "Kinetic resist",
  allResist: "All resist",
  allAdd: "Flat all damage",
  allMulti: "Percent all damage",
  dotDamage: "Debuff damage",
  dotDuration: "Debuff duration",
  directDamage: "Direct damage",
  speed: "Speed",
  refire: "Attack speed",
  convHp: "HP converted to shield",
  convShield: "Shield converted to HP",
  powerReg: "Power regen",
  powerMax: "Maximum power",
  cooldown: "Cooldown reduction",
  increaseRecyleRate: "Recycle yield",
  damageReduction: "Damage reduction",
  damageReductionWithLowHealth: "Low health damage reduction",
  damageReductionWithLowShield: "Low shield damage reduction",
  healthRegenAdd: "Health regen",
  shieldVamp: "Shield leech",
  healthVamp: "Health leech",
  kineticChanceToPenetrateShield: "Kinetic shield penetration",
  energyChanceToShieldOverload: "Energy shield overload",
  corrosiveChanceToIgnite: "Corrosive ignite",
  beamAndMissileDoesBonusDamage: "Beam and missile bonus",
  recycleCatalyst: "Recycle catalyst",
  velocityCore: "Velocity core",
  slowDown: "Slow debuff",
  mantisCore: "Close target damage core",
  thermofangCore: "Burning target kinetic core",
  reduceKineticResistance: "Kinetic resistance debuff",
  reduceCorrosiveResistance: "Corrosive resistance debuff",
  reduceEnergyResistance: "Energy resistance debuff",
  crownOfXhersix: "Cleansing crown",
  veilOfYhgvis: "Cloak ambush veil",
  fistOfZharix: "Kill shockwave",
  bloodlineSurge: "On-kill surge",
  dotDamageUnique: "Unique debuff damage",
  directDamageUnique: "Unique direct damage",
  reflectDamageUnique: "Reflect damage",
  damageReductionUnique: "Unique damage reduction",
  damageReductionWithLowHealthUnique: "Unique low health reduction",
  damageReductionWithLowShieldUnique: "Unique low shield reduction",
  damageReductionWhileStationaryUnique: "Stationary damage reduction",
  overmind: "Overmind",
  upgrade: "Legacy ship upgrade",
  lucaniteCore: "Lucanite core"
};

const UNIQUE_ARTIFACT_STATS = [
  ["slowDown", "Slowing debuff"],
  ["kineticChanceToPenetrateShield", "Kinetic shield penetration"],
  ["energyChanceToShieldOverload", "Energy shield overload"],
  ["corrosiveChanceToIgnite", "Corrosive ignite"],
  ["recycleCatalyst", "Recycle Catalyst"],
  ["beamAndMissileDoesBonusDamage", "Beam and Missile Core"],
  ["velocityCore", "Velocity Core"],
  ["damageReductionUnique", "Unique damage reduction"],
  ["damageReductionWithLowShieldUnique", "Unique low shield reduction"],
  ["damageReductionWithLowHealthUnique", "Unique low health reduction"],
  ["damageReductionWhileStationaryUnique", "Fortress Lock"],
  ["overmind", "Overmind"],
  ["upgrade", "Legacy hull upgrade"],
  ["lucaniteCore", "Lucanite Core"],
  ["mantisCore", "Mantis Core"],
  ["thermofangCore", "Thermofang Core"],
  ["reduceKineticResistance", "Kinetic resistance debuff"],
  ["reduceCorrosiveResistance", "Corrosive resistance debuff"],
  ["reduceEnergyResistance", "Energy resistance debuff"],
  ["crownOfXhersix", "Crown of Xhersix"],
  ["veilOfYhgvis", "Veil of Yhgvis"],
  ["fistOfZharix", "Fist of Zharix"],
  ["bloodlineSurge", "Bloodline Surge"],
  ["dotDamageUnique", "Unique debuff damage"],
  ["directDamageUnique", "Unique direct damage"],
  ["reflectDamageUnique", "Unique reflect damage"]
];

const UNIQUE_ARTIFACT_TYPES = new Set(UNIQUE_ARTIFACT_STATS.map(([type]) => type));

const UNIQUE_ARTIFACT_DESCRIPTIONS = {
  slowDown: "Hits can slow enemy movement for 4 seconds.",
  kineticChanceToPenetrateShield: "Kinetic hits can bypass shields and deal part of the kinetic damage directly to hull.",
  energyChanceToShieldOverload: "Energy hits can overload shields for extra energy damage.",
  corrosiveChanceToIgnite: "Corrosive hits can splice the hull for extra corrosive damage.",
  recycleCatalyst: "Recycling junk has a better rare-material chance and higher yield.",
  beamAndMissileDoesBonusDamage: "Beam and missile weapons gain bonus damage.",
  velocityCore: "Large ship speed increase.",
  damageReductionUnique: "Reduces incoming damage.",
  damageReductionWithLowShieldUnique: "Adds damage reduction when shields are low.",
  damageReductionWithLowHealthUnique: "Adds damage reduction when health is low.",
  damageReductionWhileStationaryUnique: "Adds damage reduction while stationary.",
  overmind: "Doubles pet count and increases pet health.",
  upgrade: "Legacy hull, shield, and armor upgrade for ships.",
  lucaniteCore: "Weapons can reduce the target's outgoing damage for 4 seconds.",
  mantisCore: "Adds damage when the target is close.",
  thermofangCore: "Adds kinetic damage against burning targets.",
  reduceKineticResistance: "Weapons can reduce target kinetic resistance for 4 seconds.",
  reduceCorrosiveResistance: "Weapons can reduce target corrosive resistance for 4 seconds.",
  reduceEnergyResistance: "Weapons can reduce target energy resistance for 4 seconds.",
  crownOfXhersix: "Automatically cleanses debuffs on a timer.",
  veilOfYhgvis: "Gives damage reduction while cloaked and bonus ambush damage.",
  fistOfZharix: "Kills trigger a shockwave that damages nearby enemies.",
  bloodlineSurge: "Kills grant a short stackable damage and mitigation boost.",
  dotDamageUnique: "Increases damage dealt by debuffs.",
  directDamageUnique: "Increases direct weapon damage.",
  reflectDamageUnique: "Reflects damage back to attackers when hit."
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanDir(dir) {
  ensureDir(dir);
  for (const entry of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function stripFrontmatter(markdown) {
  if (!markdown.startsWith("---")) return markdown;
  const end = markdown.indexOf("\n---", 3);
  if (end === -1) return markdown;
  return markdown.slice(end + 5).trimStart();
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function titleFor(record, key) {
  return record?.name || record?.title || record?.fileName || record?.textureName || key;
}

function routeMap(manifest) {
  const routes = new Map();
  for (const entries of Object.values(manifest)) {
    for (const entry of entries) routes.set(entry.id, `/${entry.slug}.html`);
  }
  return routes;
}

function entityLink(table, key, cache, routes, fallback = null) {
  key = refKey(table, key);
  if (!table || !key) return "<span>n/a</span>";
  const id = `${table}:${key}`;
  const record = cache[table]?.[key];
  const label = fallback || (record ? titleFor(record, key) : key);
  const href = routes.get(id);
  return href ? `<a href="${escapeAttr(href)}">${escapeHtml(label)}</a>` : `<span>${escapeHtml(label)}</span>`;
}

function refKey(table, value) {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) return value.map((item) => refKey(table, item)).find(Boolean) || "";
  if (typeof value !== "object") return value;
  const byTable = {
    Weapons: "weapon",
    Projectiles: "projectile",
    Ships: "ship",
    Engines: "engine",
    Drops: "drops",
    Enemies: "enemy",
    Bosses: "boss",
    Bodies: "body",
    Commodities: "item"
  };
  return value[byTable[table]] || value.key || value.id || value.item || value.weapon || "";
}

function entityLinks(table, value, cache, routes) {
  if (!Array.isArray(value)) return entityLink(table, value, cache, routes);
  const links = value.map((item) => entityLink(table, item, cache, routes)).filter((html) => !html.includes(">n/a<"));
  return links.length ? links.join(", ") : "<span>n/a</span>";
}

function soundLink(key, cache, routes) {
  return cache.Sounds?.[key] ? entityLink("Sounds", key, cache, routes) : "<span>n/a</span>";
}

function valueLabel(value) {
  if (value === null || value === undefined || value === "") return "n/a";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
  return String(value);
}

function statCard(label, value, hint = "") {
  return `<div class="stat-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(valueLabel(value))}</strong>${hint ? `<small>${escapeHtml(hint)}</small>` : ""}</div>`;
}

function tip(label, text) {
  return `<span class="tip" title="${escapeAttr(text)}">${escapeHtml(label)}</span>`;
}

function damageTypeLabel(type) {
  if (type === null || type === undefined || type === "") return "n/a";
  return DAMAGE_TYPES[Number(type)] || `Type ${type}`;
}

function numberValue(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function percentLabel(value) {
  if (value === null || value === undefined || value === "") return "n/a";
  const num = Number(value);
  if (!Number.isFinite(num)) return valueLabel(value);
  return `${(num * 100).toFixed(num < 0.01 && num > 0 ? 2 : 1).replace(/\.0$/, "")}%`;
}

function rangeText(min, max) {
  const a = valueLabel(min);
  const b = valueLabel(max);
  return a === b ? a : `${a}-${b}`;
}

function formatNumber(value, digits = 1) {
  const num = Number(value);
  if (!Number.isFinite(num)) return valueLabel(value);
  if (Math.abs(num) >= 1000) return Math.round(num).toLocaleString("en-US");
  return num.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function weaponHits(record) {
  return Math.max(1, numberValue(record.numberOfHits, 1) * Math.max(1, numberValue(record.multiNrOfP, 1)));
}

function weaponShotDamage(record) {
  return numberValue(record.dmg) * weaponHits(record);
}

function weaponDps(record) {
  const reload = numberValue(record.reloadTime);
  if (!reload) return "";
  const direct = weaponShotDamage(record);
  const dot = numberValue(record.dot);
  return Math.round((direct + dot) * 1000 / reload);
}

function weaponHeatPerSecond(record) {
  const reload = numberValue(record.reloadTime);
  if (!reload) return "";
  return Math.round(numberValue(record.heatCost) * 1000 / reload);
}

function weaponTags(record) {
  const tags = [];
  if (numberValue(record.radius) > 0) tags.push("AoE");
  if (numberValue(record.dot) > 0 || numberValue(record.dotDuration) > 0) tags.push("DoT");
  if (numberValue(record.healthVamp) > 0) tags.push("Health leech");
  if (numberValue(record.shieldVamp) > 0) tags.push("Shield leech");
  if (numberValue(record.numberOfHits) > 1 || numberValue(record.multiNrOfP) > 1) tags.push("Multi-hit");
  if (record.hasChargeUp) tags.push("Charge");
  if (record.type) tags.push(record.type);
  return tags.slice(0, 5).join(", ");
}

function weaponSourceSummary(weaponKey, cache) {
  const shops = Object.values(cache.Bodies || {}).reduce((sum, body) => sum + (body.shopItems || []).filter((item) => item.table === "Weapons" && item.item === weaponKey).length, 0);
  const drops = Object.values(cache.Drops || {}).reduce((sum, drop) => sum + (drop.dropItems || []).filter((item) => item.table === "Weapons" && item.item === weaponKey).length, 0);
  return { shops, drops, total: shops + drops };
}

function isPlayerFacingWeapon(record) {
  if (!record?.name) return false;
  const name = record.name.toLowerCase();
  const enemyPrefixes = ["enemy ", "boss ", "emperor ", "wasp ", "moth ", "turret "];
  if (enemyPrefixes.some((prefix) => name.startsWith(prefix))) return false;
  if (name.includes("stress test")) return false;
  if (/\blvl\b/.test(name)) return false;
  return true;
}

function cleanText(value) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function renderDescription(value) {
  const text = cleanText(value);
  if (!text) return "";
  const lines = text.split("\n").map((line) => line.replace(/^-\s*/, "").trim()).filter(Boolean);
  if (lines.length > 1) return `<ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`;
  return `<p>${escapeHtml(lines[0] || text)}</p>`;
}

function enemyShipStats(record, cache) {
  const ship = cache.Ships?.[record.ship] || {};
  const hpMax = numberValue(ship.hp, "");
  const shieldMax = numberValue(ship.shieldHp, "");
  const startHp = record.startHp !== undefined && hpMax !== "" ? Math.round(hpMax * numberValue(record.startHp, 100) / 100) : hpMax;
  return {
    hpMax,
    startHp,
    shieldMax: numberValue(ship.shieldHp, ""),
    armor: numberValue(ship.armor, ""),
    body: ship.name || ""
  };
}

function enemyHp(record, cache) {
  return enemyShipStats(record, cache).hpMax;
}

function bossHpStats(record, cache) {
  const directHp = numberValue(record.hp, "");
  const shipHp = numberValue(cache.Ships?.[record.ship]?.hp, "");
  const partHps = (record.basicObjs || [])
    .map((part) => numberValue(part?.hp, 0))
    .filter((hp) => hp > 0);
  const totalPartHp = partHps.reduce((sum, hp) => sum + hp, 0);
  const highestPartHp = partHps.length ? Math.max(...partHps) : "";
  const displayHp = directHp !== "" ? directHp : shipHp !== "" ? shipHp : totalPartHp || "";
  const source = directHp !== ""
    ? "boss record"
    : shipHp !== ""
      ? "linked ship"
      : totalPartHp
        ? "sum of basicObjs HP"
        : "";
  return {
    displayHp,
    source,
    totalPartHp: totalPartHp || "",
    highestPartHp,
    destructibleParts: partHps.length
  };
}

function enemyTraitItems(record) {
  const flags = [
    ["miniBoss", "Mini-boss", "Higher stat variant; treat it as tougher than the base enemy."],
    ["melee", "Melee", "Tries to fight at close range, often punishing slow ships."],
    ["kamikaze", "Kamikaze", "Can explode or self-damage near the target."],
    ["teleport", "Teleport", "Can reposition and break simple kiting patterns."],
    ["cloak", "Cloak", "Can hide or interrupt normal target reading."],
    ["healer", "Healer", "Can restore allies or targets; usually a priority kill."],
    ["grab", "Grab", "Can pull or hold the player."],
    ["sniper", "Sniper", "Has a long-range behavior profile."],
    ["flee", "Flees", "May run away after taking damage."]
  ];
  return flags.filter(([field]) => record[field]).map(([, label, hint]) => ({ label, hint }));
}

function enemyTraits(record, html = false) {
  const items = enemyTraitItems(record);
  if (!items.length) return html ? tip("Standard", "No special AI flag was found in the enemy record.") : "Standard";
  if (!html) return items.map((item) => item.label).join(", ");
  return items.map((item) => tip(item.label, item.hint)).join(", ");
}

function renderSpawnerDropItems(items, cache, routes) {
  if (!Array.isArray(items) || !items.length) return "<span>n/a</span>";
  const links = items
    .map((item) => {
      if (typeof item === "object" && item?.drop) return `${entityLink("Drops", item.drop, cache, routes)}${item.chance !== undefined ? ` <span class="muted">${percentLabel(item.chance)}</span>` : ""}`;
      return entityLink("Drops", item, cache, routes);
    })
    .filter(Boolean)
    .slice(0, 5);
  return links.length ? links.join("<br>") : "<span>n/a</span>";
}

function dropSourceData(dropKey, cache) {
  const rows = [];
  for (const [enemyKey, enemy] of Object.entries(cache.Enemies || {})) {
    if ((enemy.drops || []).some((item) => refKey("Drops", item) === dropKey)) {
      rows.push({ table: "Enemies", key: enemyKey, type: "Enemy", chance: 1, level: enemy.level, context: `Level ${valueLabel(enemy.level)}` });
    }
  }
  for (const [bossKey, boss] of Object.entries(cache.Bosses || {})) {
    if (refKey("Drops", boss.drops) === dropKey) {
      rows.push({ table: "Bosses", key: bossKey, type: "Boss", chance: 1, level: boss.level, context: `Level ${valueLabel(boss.level)}` });
    }
  }
  for (const [spawnerKey, spawner] of Object.entries(cache.Spawners || {})) {
    for (const item of [...(spawner.drops || []), ...(spawner.drops2 || [])]) {
      if (item.drop === dropKey || refKey("Drops", item) === dropKey) {
        const enemyKey = spawner.enemy || refKey("Enemies", (spawner.enemies || [])[0]);
        const bossKey = typeof spawner.bossSpawner === "string" ? spawner.bossSpawner : typeof spawner.bossSpawner2 === "string" ? spawner.bossSpawner2 : "";
        rows.push({
          table: "Spawners",
          key: spawnerKey,
          type: "Spawner",
          chance: numberValue(item.chance, 1),
          level: spawner.level,
          body: spawner.body,
          enemy: enemyKey,
          boss: bossKey,
          hidden: spawner.hidden,
          context: spawner.body || "No linked body"
        });
      }
    }
  }
  return rows;
}

function dropSourceRows(dropKey, cache, routes) {
  return dropSourceData(dropKey, cache).slice(0, 120).map((source) => {
    const context = source.table === "Spawners"
      ? `${source.body ? entityLink("Bodies", source.body, cache, routes) : "<span>No linked body</span>"}${source.enemy ? ` / ${entityLink("Enemies", source.enemy, cache, routes)}` : ""}${source.boss ? ` / ${entityLink("Bosses", source.boss, cache, routes)}` : ""}`
      : escapeHtml(source.context);
    return `<tr><td>${entityLink(source.table, source.key, cache, routes)}</td><td>${escapeHtml(source.type)}</td><td>${context}</td><td>${escapeHtml(percentLabel(source.chance))}</td></tr>`;
  }).join("");
}

function sourceSortScore(row) {
  const name = `${row.sourceName || ""} ${row.contextText || ""}`.toLowerCase();
  const penalty = /dev|test|dummy/.test(name) || row.hidden ? -10 : 0;
  return Number(row.effective || 0) + penalty;
}

function commoditySourceRowsData(itemKey, cache) {
  const rows = [];
  for (const [dropKey, drop] of Object.entries(cache.Drops || {})) {
    for (const item of drop.dropItems || []) {
      if (item.table !== "Commodities" || item.item !== itemKey) continue;
      const crateChance = drop.crate ? numberValue(drop.chance, 1) : 1;
      const itemChance = numberValue(item.chance, 1);
      const sources = dropSourceData(dropKey, cache);
      const base = {
        dropKey,
        dropName: drop.name || dropKey,
        qty: rangeText(item.min, item.max),
        itemChance,
        crateChance
      };
      if (!sources.length) {
        rows.push({
          ...base,
          table: "Drops",
          key: dropKey,
          sourceName: drop.name || dropKey,
          contextText: drop.type === "mission" ? "Mission reward table" : "Drop table",
          effective: crateChance * itemChance,
          chanceText: percentLabel(crateChance * itemChance)
        });
      }
      for (const source of sources) {
        const sourceName = titleFor(cache[source.table]?.[source.key], source.key);
        const bodyName = source.body ? titleFor(cache.Bodies?.[source.body], source.body) : "No linked body";
        const contextText = source.table === "Spawners"
          ? `${bodyName}${source.enemy ? ` / ${titleFor(cache.Enemies?.[source.enemy], source.enemy)}` : ""}${source.boss ? ` / ${titleFor(cache.Bosses?.[source.boss], source.boss)}` : ""}`
          : source.context;
        rows.push({
          ...base,
          ...source,
          sourceName,
          contextText,
          effective: numberValue(source.chance, 1) * crateChance * itemChance,
          chanceText: percentLabel(numberValue(source.chance, 1) * crateChance * itemChance)
        });
      }
    }
  }
  return rows.sort((a, b) => sourceSortScore(b) - sourceSortScore(a));
}

function weaponSourceRowsData(weaponKey, cache) {
  const rows = [];
  for (const [bodyKey, body] of Object.entries(cache.Bodies || {})) {
    for (const item of body.shopItems || []) {
      if (item.table !== "Weapons" || item.item !== weaponKey) continue;
      rows.push({
        table: "Bodies",
        key: bodyKey,
        type: "Shop",
        sourceName: titleFor(body, bodyKey),
        contextText: body.solarSystem ? titleFor(cache.SolarSystems?.[body.solarSystem], body.solarSystem) : "Shop",
        effective: 1,
        chanceText: valueLabel(item.available),
        price: (item.priceItems || []).map((p) => `${titleFor(cache.Commodities?.[p.item], p.item)} x${valueLabel(p.amount)}`).join(", ")
      });
    }
  }
  for (const [dropKey, drop] of Object.entries(cache.Drops || {})) {
    for (const item of drop.dropItems || []) {
      if (item.table !== "Weapons" || item.item !== weaponKey) continue;
      const crateChance = drop.crate ? numberValue(drop.chance, 1) : 1;
      const itemChance = numberValue(item.chance, 1);
      const sources = dropSourceData(dropKey, cache);
      if (!sources.length) {
        rows.push({
          table: "Drops",
          key: dropKey,
          type: "Drop table",
          sourceName: drop.name || dropKey,
          contextText: "Direct drop table",
          effective: crateChance * itemChance,
          chanceText: percentLabel(crateChance * itemChance),
          qty: rangeText(item.min, item.max)
        });
      }
      for (const source of sources) {
        rows.push({
          ...source,
          type: source.type === "Spawner" ? "Spawner drop" : `${source.type} drop`,
          sourceName: titleFor(cache[source.table]?.[source.key], source.key),
          contextText: source.table === "Spawners"
            ? `${source.body ? titleFor(cache.Bodies?.[source.body], source.body) : "No linked body"}${source.enemy ? ` / ${titleFor(cache.Enemies?.[source.enemy], source.enemy)}` : ""}`
            : source.context,
          dropKey,
          effective: numberValue(source.chance, 1) * crateChance * itemChance,
          chanceText: percentLabel(numberValue(source.chance, 1) * crateChance * itemChance),
          qty: rangeText(item.min, item.max)
        });
      }
    }
  }
  for (const [enemyKey, enemy] of Object.entries(cache.Enemies || {})) {
    if ((enemy.weapons || []).some((item) => refKey("Weapons", item) === weaponKey)) {
      rows.push({
        table: "Enemies",
        key: enemyKey,
        type: "Enemy loadout",
        sourceName: titleFor(enemy, enemyKey),
        contextText: `Level ${valueLabel(enemy.level)} uses this weapon`,
        effective: 0,
        chanceText: "Used by enemy"
      });
    }
  }
  return rows.sort((a, b) => sourceSortScore(b) - sourceSortScore(a));
}

function eliteTechName(key) {
  return WEAPON_ELITE_TECHS.find(([id]) => id === key)?.[1] || key;
}

function eliteCost(level, kind) {
  const total = ELITE_TECH_COST[kind] || ELITE_TECH_COST.primary;
  return Math.round(Math.pow(ELITE_TECH_COST.increase, level - 1) / ELITE_TECH_COST.sum * total);
}

function eliteCostRange(from, to, kind) {
  let total = 0;
  for (let level = Math.max(1, from); level <= Math.min(100, to); level += 1) total += eliteCost(level, kind);
  return total;
}

function weaponEliteRows(record) {
  const techs = record.eliteTechs || {};
  return WEAPON_ELITE_TECHS
    .filter(([key]) => numberValue(techs[key]) > 0)
    .map(([key, name]) => {
      const value = numberValue(techs[key]);
      const level1 = value / 100;
      const level100 = value;
      return `<tr><td>${escapeHtml(name)}</td><td><code>${escapeHtml(key)}</code></td><td>${escapeHtml(formatNumber(level1, 2))}</td><td>${escapeHtml(formatNumber(level100, 2))}</td><td>${escapeHtml(eliteTechHint(key, value))}</td></tr>`;
    })
    .join("");
}

function eliteTechHint(key, value) {
  const amount = formatNumber(value, 2);
  if (key.includes("Dot5")) return `Adds ${amount}% total DoT over 5 seconds at level 100.`;
  if (key.includes("Dot10") || key.includes("Burn")) return `Adds ${amount}% total DoT over 10 seconds at level 100.`;
  if (key.includes("Dot20")) return `Adds ${amount}% total DoT over 20 seconds at level 100.`;
  if (key.includes("Penetration")) return `Reduces the matching resistance by ${amount}% at level 100.`;
  if (key === "AddAOE") return `Adds ${formatNumber(5 + value, 2)} radius units at level 100.`;
  if (key === "IncreaseNrHits") return `Adds ${Math.trunc(1 + value)} hit(s) at level 100.`;
  if (key === "AddExtraProjectiles") return "Changes projectile count and redistributes damage per projectile.";
  return `${amount}% effect at level 100.`;
}

function artifactBaseType(type) {
  return String(type || "").replace(/[23]$/, "");
}

function artifactStatLabel(type) {
  return ARTIFACT_STAT_LABELS[type] || ARTIFACT_STAT_LABELS[artifactBaseType(type)] || valueLabel(type);
}

function artifactStatValue(type, value) {
  const base = artifactBaseType(type);
  const v = numberValue(value);
  switch (base) {
    case "healthAdd": return `${formatNumber(2 * v)} health`;
    case "healthMulti": return `${formatNumber(1.35 * v)}% health`;
    case "armorAdd": return `${formatNumber(7.5 * v)} armor`;
    case "armorMulti": return `${formatNumber(v)}% armor`;
    case "corrosiveAdd": return `${formatNumber(4 * v)} corrosive damage`;
    case "corrosiveMulti": return `${formatNumber(v)}% corrosive damage`;
    case "energyAdd": return `${formatNumber(4 * v)} energy damage`;
    case "energyMulti": return `${formatNumber(v)}% energy damage`;
    case "kineticAdd": return `${formatNumber(4 * v)} kinetic damage`;
    case "kineticMulti": return `${formatNumber(v)}% kinetic damage`;
    case "shieldAdd": return `${formatNumber(1.75 * v)} shield`;
    case "shieldMulti": return `${formatNumber(1.35 * v)}% shield`;
    case "allAdd": return `${formatNumber(1.5 * v)} all damage`;
    case "allMulti": return `${formatNumber(1.5 * v)}% all damage`;
    case "speed": return `${formatNumber(0.2 * v, 2)}% speed`;
    case "refire": return `${formatNumber(0.3 * v)}% attack speed`;
    case "convHp": return `-${formatNumber(Math.min(100, 0.1 * v))}% HP to 150% shield`;
    case "convShield": return `-${formatNumber(Math.min(100, 0.1 * v))}% shield to 150% HP`;
    case "powerReg": return `${formatNumber(0.15 * v)}% power regen`;
    case "powerMax": return `${formatNumber(1.5 * v)}% maximum power`;
    case "cooldown": return `${formatNumber(0.1 * v)}% cooldown reduction`;
    default:
      if (base.includes("Resist") || base.includes("Reduction") || base === "shieldRegen" || base === "dotDamage" || base === "dotDuration" || base === "directDamage" || base === "healthRegenAdd" || base === "shieldVamp" || base === "healthVamp") {
        return `${formatNumber(v)}% ${artifactStatLabel(type).toLowerCase()}`;
      }
      return `${formatNumber(v)} ${artifactStatLabel(type).toLowerCase()}`;
  }
}

function artifactValueRange(record) {
  const min = record.add ? record.addMinValue : record.multiMinValue;
  const max = record.add ? record.addMaxValue : record.multiMaxValue;
  if (min === undefined && max === undefined) return "n/a";
  if (min === undefined || min === max) return artifactStatValue(record.type, max);
  return `${artifactStatValue(record.type, min)} to ${artifactStatValue(record.type, max)}`;
}

function artifactLevelRange(record) {
  if (record.minLevel === undefined && record.maxLevel === undefined) return "Any";
  return rangeText(record.minLevel ?? 1, record.maxLevel ?? 150);
}

function artifactIsUnique(record) {
  return UNIQUE_ARTIFACT_TYPES.has(record?.type);
}

function artifactRarityLabel(record) {
  if (artifactIsUnique(record)) return "Unique";
  if (record.special) return "Special";
  return "Normal";
}

function artifactUpgradeLabel(record) {
  return artifactIsUnique(record) ? "No, unique artifacts cannot be upgraded" : "Yes";
}

function uniqueArtifactRows(cache, routes) {
  const uniqueDrop = Object.entries(cache.Drops || {}).find(([, drop]) => /unique artifact/i.test(drop.name || ""));
  return UNIQUE_ARTIFACT_STATS.map(([type, label]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(UNIQUE_ARTIFACT_DESCRIPTIONS[type] || artifactStatLabel(type))}<br><code class="source-key">${escapeHtml(type)}</code></td><td>${escapeHtml(artifactStatLabel(type))}</td><td>No</td><td>${uniqueDrop ? entityLink("Drops", uniqueDrop[0], cache, routes) : "Unique artifact drop tables / BigDB artifact rolls"}</td></tr>`).join("");
}

function bossImageKeys(record) {
  const keys = [];
  if (record.bitmap) keys.push(record.bitmap);
  for (const obj of record.basicObjs || []) {
    if (obj?.bitmap) keys.push(obj.bitmap);
  }
  return [...new Set(keys)];
}

function relationCount(graph, id) {
  return (graph.reverse[id] || []).length + graph.edges.filter((edge) => edge.from === id).length;
}

function renderMarkdown(markdown) {
  const lines = stripFrontmatter(markdown).split(/\r?\n/);
  const html = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("# ")) {
      html.push(`<h1>${inlineMarkdown(line.slice(2))}</h1>`);
      i += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      html.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
      i += 1;
      continue;
    }
    if (line.startsWith("- ")) {
      html.push("<ul>");
      while (i < lines.length && lines[i].startsWith("- ")) {
        html.push(`<li>${inlineMarkdown(lines[i].slice(2))}</li>`);
        i += 1;
      }
      html.push("</ul>");
      continue;
    }
    if (line.startsWith("| ")) {
      const tableLines = [];
      while (i < lines.length && lines[i].startsWith("| ")) {
        tableLines.push(lines[i]);
        i += 1;
      }
      html.push(renderTable(tableLines));
      continue;
    }
    if (line.trim() === "") {
      i += 1;
      continue;
    }
    html.push(`<p>${inlineMarkdown(line)}</p>`);
    i += 1;
  }

  return html.join("\n");
}

function renderTable(lines) {
  if (lines.length < 2) return "";
  const rows = lines
    .filter((line, index) => index !== 1)
    .map((line) => line.slice(1, -1).split("|").map((cell) => cell.trim()));
  const [head, ...body] = rows;
  return [
    "<div class=\"table-wrap\"><table>",
    `<thead><tr>${head.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join("")}</tr></thead>`,
    "<tbody>",
    ...body.map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`),
    "</tbody></table></div>"
  ].join("\n");
}

function pageShell(title, body, nav = "") {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} - Astroflux Wiki</title>
  <link rel="icon" href="/assets/favicon.ico">
  <link rel="stylesheet" href="/assets/site.css">
</head>
<body>
  <header>
    <a class="brand" href="/">Astroflux Wiki</a>
    <form class="site-search" role="search">
      <input id="search-input" type="search" placeholder="Search wiki" autocomplete="off">
      <div id="search-results" class="search-results" hidden></div>
    </form>
    <nav>
      <a href="/guides/">Guides</a>
      <a href="/systems/">Systems</a>
      <a href="/bodies/">Bodies</a>
      <a href="/enemies/">Enemies</a>
      <a href="/bosses/">Bosses</a>
      <a href="/weapons/">Weapons</a>
      <a href="/commodities/">Items</a>
      <a href="/artifacts/">Artifacts</a>
      <a href="/drops/">Drops</a>
      <a href="/media/">Media</a>
      <a href="/map/">Map</a>
    </nav>
  </header>
  ${nav}
  <main>${body}</main>
  <footer class="site-footer">
    <p>Want to improve this wiki? Contributions are welcome on <a href="https://github.com/guedesite/astroflux-wiki">github.com/guedesite/astroflux-wiki</a>.</p>
  </footer>
  <script src="/assets/search.js"></script>
</body>
</html>`;
}

function writePage(file, title, body, nav = "") {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, pageShell(title, body, nav), "utf8");
}

function buildContentPages(manifest, cache, media, graph, routes) {
  for (const entries of Object.values(manifest)) {
    for (const entry of entries) {
      const output = path.join(DIST_DIR, `${entry.slug}.html`);
      const [table, key] = entry.id.split(":");
      const record = cache[table]?.[key];
      if (!record) continue;
      writePage(output, entry.name, renderEntityPage(table, key, record, cache, media, graph, routes));
    }
  }
}

function renderEntityPage(table, key, record, cache, media, graph, routes) {
  const name = titleFor(record, key);
  const type = record.type ? `<span class="pill">${escapeHtml(record.type)}</span>` : "";
  const visual = renderPrimaryVisual(table, record, cache, media);
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
    Bodies: "Location",
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
    MissionTypes: "Mission"
  })[table] || table;
}

function primaryImageKey(table, record, cache) {
  if (table === "Enemies") return cache.Ships?.[record.ship]?.bitmap || record.bitmap || "";
  if (table === "Bosses") return cache.Ships?.[record.ship]?.bitmap || record.bitmap || bossImageKeys(record)[0] || "";
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
  return cards.length ? `<div class="stat-grid compact">${cards.slice(0, 6).join("")}</div>` : "";
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
  if (dir === "weapons") return renderWeaponListing(entries, cache, media, routes);
  if (dir === "enemies") return renderEnemyListing(entries, cache, media, routes);
  if (dir === "bosses") return renderBossListing(entries, cache, media, routes);
  if (dir === "bodies") return renderBodyListing(entries, cache, routes);
  if (dir === "drops") return renderDropListing(entries, cache, routes);
  if (dir === "commodities") return renderCommodityListing(entries, cache, media, routes);
  if (dir === "artifacts") return renderArtifactListing(entries, cache, media, routes);
  if (dir === "systems") return renderSystemListing(entries, cache, routes);
  return "";
}

function entryKey(entry) {
  return entry.id.split(":")[1];
}

function renderWeaponListing(entries, cache, media, routes) {
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

function renderEnemyListing(entries, cache, media, routes) {
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
      const icon = cache.Images?.[imageKey] ? renderImageThumb(cache.Images[imageKey], media) : "";
      const stats = enemyShipStats(record, cache);
      const traits = enemyTraits(record, false);
      const effective = numberValue(stats.hpMax) + numberValue(stats.shieldMax);
      return `<tr data-search="${escapeAttr(`${entry.name} ${traits} ${damageTypeLabel(record.damageType)} ${stats.body}`)}" data-trait="${escapeAttr(traits)}" data-damage="${escapeAttr(record.damageType ?? "")}" data-level="${escapeAttr(record.level ?? 0)}" data-hp="${escapeAttr(effective)}" data-kres="${escapeAttr(record.kineticResist ?? 0)}" data-eres="${escapeAttr(record.energyResist ?? 0)}" data-cres="${escapeAttr(record.corrosiveResist ?? 0)}"><td class="name-cell">${icon}<a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${escapeHtml(valueLabel(record.level))}</td><td>${escapeHtml(valueLabel(stats.hpMax))}</td><td>${escapeHtml(valueLabel(stats.shieldMax))}</td><td>${escapeHtml(valueLabel(record.xp))}</td><td>${enemyTraits(record, true)}</td><td>${escapeHtml(damageTypeLabel(record.damageType))}</td><td>${escapeHtml(valueLabel(record.kineticResist))}</td><td>${escapeHtml(valueLabel(record.energyResist))}</td><td>${escapeHtml(valueLabel(record.corrosiveResist))}</td></tr>`;
    })
    .join("");
  return `<h1>Enemies</h1><p class="muted">The useful first pass for a player: sprite, name, level, survivability, special behavior, damage type, and resistances. HP is taken from the linked ship record; <code>startHp</code> is shown on detail pages when an enemy starts damaged.</p><p><a class="button-link" href="/guides/combat.html">Open combat guide</a></p>
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

function renderBossListing(entries, cache, media, routes) {
  const rows = entries.map((entry) => {
    const key = entryKey(entry);
    const boss = cache.Bosses?.[key];
    if (!boss) return "";
    const sprite = renderBossSpriteThumb(boss, cache, media);
    const hp = bossHpStats(boss, cache);
    return `<tr data-hp="${escapeAttr(hp.displayHp || 0)}"><td class="name-cell">${sprite}<a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${escapeHtml(valueLabel(boss.level))}</td><td>${escapeHtml(hp.displayHp !== "" ? formatNumber(hp.displayHp, 0) : "n/a")}</td><td>${escapeHtml(valueLabel(boss.xp))}</td><td>${escapeHtml(valueLabel((boss.basicObjs || []).length))}</td><td>${escapeHtml(valueLabel((boss.turrets || []).length))}</td><td>${entityLink("Drops", boss.drops, cache, routes)}</td><td>${escapeHtml(valueLabel(boss.kineticResist))}</td><td>${escapeHtml(valueLabel(boss.energyResist))}</td><td>${escapeHtml(valueLabel(boss.corrosiveResist))}</td></tr>`;
  }).join("");
  return `<h1>Bosses</h1><p class="muted">Boss sprites are assembled from the boss <code>basicObjs</code> parts used by the game client. HP is calculated from boss HP, linked ship HP, or the sum of destructible sprite-part HP when the boss is made from parts.</p><input class="table-filter" name="table-filter" placeholder="Filter bosses"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Boss</th><th>Level</th><th>HP</th><th>XP</th><th>Sprite parts</th><th>Turrets</th><th>Loot</th><th>Kinetic res</th><th>Energy res</th><th>Corrosive res</th></tr></thead><tbody>${rows}</tbody></table></div>`;
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
  }).join("");
  return `<h1>Bodies and Locations</h1><p class="muted">Locations are grouped around systems. Use shop count and hostile count to find practical destinations quickly.</p><input class="table-filter" name="table-filter" placeholder="Filter locations"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Location</th><th>System</th><th>Type</th><th>Level</th><th>Landable</th><th>Shop items</th><th>Hostiles</th><th>Coords</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderDropListing(entries, cache, routes) {
  const rows = entries.map((entry) => {
    const key = entryKey(entry);
    const drop = cache.Drops?.[key];
    if (!drop) return "";
    const firstItems = (drop.dropItems || []).slice(0, 4).map((item) => entityLink(item.table, item.item, cache, routes)).join(", ");
    return `<tr><td><a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${escapeHtml(valueLabel(drop.crate))}</td><td>${escapeHtml(percentLabel(drop.crate ? drop.chance ?? 1 : 1))}</td><td>${escapeHtml(percentLabel(drop.artifactChance))}</td><td>${escapeHtml(rangeText(drop.fluxMin, drop.fluxMax))}</td><td>${escapeHtml(rangeText(drop.xpMin, drop.xpMax))}</td><td>${firstItems}</td></tr>`;
  }).join("");
  return `<h1>Drops</h1><p class="muted">Open a drop page to see effective chances and the enemies or bosses that reference it.</p><input class="table-filter" name="table-filter" placeholder="Filter drops"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Drop table</th><th>Crate</th><th>Crate chance</th><th>Artifact</th><th>Flux</th><th>XP</th><th>Preview items</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderCommodityListing(entries, cache, media, routes) {
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

function renderArtifactListing(entries, cache, media, routes) {
  const artifacts = entries.map((entry) => {
    const key = entryKey(entry);
    const record = cache.ArtifactTypes?.[key];
    return record ? { entry, key, record } : null;
  }).filter(Boolean);
  const data = artifacts.map(({ entry, record }) => ({
    name: entry.name,
    url: `/${entry.slug}.html`,
    type: record.type,
    stat: artifactStatLabel(record.type),
      special: Boolean(record.special),
      unique: artifactIsUnique(record),
      dropRate: numberValue(record.dropRate, 0),
    minLevel: record.minLevel ?? 1,
    maxLevel: record.maxLevel ?? 150
  }));
  const rows = artifacts.map(({ entry, key, record }) => {
    const icon = cache.Images?.[record.bitmap] ? renderImageThumb(cache.Images[record.bitmap], media) : "";
    return `<tr data-search="${escapeAttr(`${entry.name} ${record.type} ${artifactStatLabel(record.type)} ${artifactRarityLabel(record)}`)}" data-special="${record.special ? "1" : "0"}" data-unique="${artifactIsUnique(record) ? "1" : "0"}" data-stat="${escapeAttr(artifactBaseType(record.type))}" data-level-min="${escapeAttr(record.minLevel ?? 1)}" data-level-max="${escapeAttr(record.maxLevel ?? 150)}" data-drop="${escapeAttr(record.dropRate ?? 0)}"><td>${icon}<a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${escapeHtml(artifactStatLabel(record.type))}</td><td>${escapeHtml(artifactValueRange(record))}</td><td>${escapeHtml(artifactRarityLabel(record))}</td><td>${escapeHtml(artifactUpgradeLabel(record))}</td><td>${escapeHtml(valueLabel(record.dropRate))}</td><td>${escapeHtml(artifactLevelRange(record))}</td><td>${(record.recycleItems || []).map((item) => `${entityLink("Commodities", item.item, cache, routes)} x${escapeHtml(rangeText(item.min, item.max))}`).join("<br>")}</td></tr>`;
  }).join("");
  const statOptions = [...new Set(artifacts.map(({ record }) => artifactBaseType(record.type)))].sort()
    .map((stat) => `<option value="${escapeAttr(stat)}">${escapeHtml(artifactStatLabel(stat))}</option>`).join("");
  const artifactOptions = artifacts
    .sort((a, b) => a.entry.name.localeCompare(b.entry.name))
    .map(({ entry, key }) => `<option value="${escapeAttr(key)}">${escapeHtml(entry.name)}</option>`).join("");
  return `<h1>Artifacts</h1>
<p class="muted">All artifact type records are listed here with icons, special flags, level gates, recycle outputs, and drop weights. The calculator estimates odds from the artifact type drop weights among records eligible for the selected level.</p>
<section class="content-grid">
  <article>
    <h2>Drop Calculator</h2>
    <div class="calculator" id="artifact-calculator" data-artifacts="${escapeAttr(JSON.stringify(data))}">
      <label>Target artifact <select id="artifact-target">${artifactOptions}</select></label>
      <label>Artifact level <input id="artifact-level" type="number" min="1" max="150" value="80"></label>
      <label>Artifact drop chance <input id="artifact-drop-chance" type="number" min="0" max="100" step="0.1" value="100"><span>%</span></label>
      <label>Attempts <input id="artifact-attempts" type="number" min="1" value="100"></label>
      <output id="artifact-result">Choose values to estimate odds.</output>
    </div>
  </article>
  <article>
    <h2>Filters</h2>
    <div class="filter-panel" data-table-filter="artifact-table">
      <input id="artifact-filter-text" name="artifact-filter-text" data-filter-text type="search" placeholder="Search artifact, stat, material">
      <select id="artifact-filter-stat" name="artifact-filter-stat" data-filter-attr="stat"><option value="">All stats</option>${statOptions}</select>
      <label class="check"><input id="artifact-filter-special" name="artifact-filter-special" data-filter-flag="special" type="checkbox"> Special only</label>
      <label class="check"><input id="artifact-filter-unique" name="artifact-filter-unique" data-filter-flag="unique" type="checkbox"> Unique only</label>
      <label>Level includes <input id="artifact-filter-level" name="artifact-filter-level" data-filter-between="level" type="number" min="1" max="150" placeholder="any"></label>
    </div>
  </article>
</section>
<section class="content-grid"><article><h2>Unique Artifact Effects</h2><p class="muted">Unique artifacts are loaded as player artifact records from BigDB. The game checks these stat types with <code>ArtifactStat.isUnique</code>; unique artifacts cannot be upgraded.</p><div class="table-wrap"><table class="sortable"><thead><tr><th>Unique effect</th><th>Game effect</th><th>Stat family</th><th>Upgradeable</th><th>Known source</th></tr></thead><tbody>${uniqueArtifactRows(cache, routes)}</tbody></table></div></article></section>
<div class="table-wrap"><table id="artifact-table" class="sortable filterable"><thead><tr><th>Artifact</th><th>Stat</th><th>Value Range</th><th>Rarity</th><th>Upgradeable</th><th>Drop Weight</th><th>Levels</th><th>Recycles Into</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderSystemListing(entries, cache, routes) {
  const rows = entries.filter((entry) => isVisibleMapSystem(cache.SolarSystems?.[entryKey(entry)], entryKey(entry))).map((entry) => {
    const key = entryKey(entry);
    const system = cache.SolarSystems?.[key];
    if (!system) return "";
    const bodies = Object.values(cache.Bodies || {}).filter((body) => body.solarSystem === key);
    return `<tr><td><a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${escapeHtml(valueLabel(system.galaxy))}</td><td>${escapeHtml(valueLabel(system.type))}</td><td>${escapeHtml(rangeText(system.uberMinLevel, system.uberMaxLevel))}</td><td>${escapeHtml(valueLabel(system.pvpDisabled))}</td><td>${escapeHtml(valueLabel(bodies.length))}</td><td>${escapeHtml(valueLabel(system.x))}, ${escapeHtml(valueLabel(system.y))}</td></tr>`;
  }).join("");
  return `<h1>Systems</h1><p class="muted">Systems connect the map, locations, music, level ranges, and PvP flags. Use the map for visual navigation.</p><p><a class="button-link" href="/map/">Open galaxy map</a></p><input class="table-filter" name="table-filter" placeholder="Filter systems"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>System</th><th>Galaxy</th><th>Type</th><th>Level range</th><th>PvP disabled</th><th>Locations</th><th>Coords</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderPlayerSections(table, key, record, cache, media, routes) {
  switch (table) {
    case "SolarSystems":
      return renderSystemPage(key, record, cache, routes);
    case "Bodies":
      return renderBodyPage(key, record, cache, routes);
    case "Weapons":
      return renderWeaponPage(key, record, cache, routes);
    case "Enemies":
      return renderEnemyPage(key, record, cache, routes);
    case "Bosses":
      return renderBossPage(record, cache, media, routes);
    case "Drops":
      return renderDropPage(key, record, cache, routes);
    case "Ships":
      return renderShipPage(record, cache, routes);
    case "Commodities":
      return renderCommodityPage(key, record, cache, routes);
    case "ArtifactTypes":
      return renderArtifactPage(key, record, cache, routes);
    case "Projectiles":
      return renderProjectilePage(record, cache, routes);
    case "Engines":
      return renderEnginePage(record, cache, routes);
    case "MissionTypes":
      return renderMissionPage(record, cache, routes);
    default:
      return renderGeneralInfo(record);
  }
}

function renderSystemPage(key, record, cache, routes) {
  const bodies = Object.entries(cache.Bodies || {}).filter(([, body]) => body.solarSystem === key);
  const bodyRows = bodies.map(([bodyKey, body]) => `<tr><td>${entityLink("Bodies", bodyKey, cache, routes)}</td><td>${escapeHtml(valueLabel(body.type))}</td><td>${escapeHtml(valueLabel(body.level))}</td><td>${escapeHtml(valueLabel(body.landable))}</td><td>${escapeHtml(valueLabel(body.explorable))}</td></tr>`).join("");
  const warpLinks = renderSystemWarpLinks(key, cache, routes);
  return `<section class="content-grid">
    <article><h2>Overview</h2><div class="stat-grid">${statCard("Galaxy", record.galaxy)}${statCard("Coordinates", `${valueLabel(record.x)}, ${valueLabel(record.y)}`)}${statCard("PvP disabled", record.pvpDisabled)}${statCard("Locations", bodies.length)}</div></article>
    ${warpLinks}
    <article><h2>Locations</h2><input class="table-filter" name="table-filter" placeholder="Filter locations"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Name</th><th>Type</th><th>Level</th><th>Landable</th><th>Explorable</th></tr></thead><tbody>${bodyRows}</tbody></table></div></article>
  </section>`;
}

function renderBodyPage(key, record, cache, routes) {
  const spawners = Object.entries(cache.Spawners || {}).filter(([, spawner]) => spawner.body === key);
  const shopRows = (record.shopItems || []).map((item) => `<tr><td>${entityLink(item.table, item.item, cache, routes, item.name)}</td><td>${escapeHtml(valueLabel(item.available))}</td><td>${(item.priceItems || []).map((p) => `${entityLink("Commodities", p.item, cache, routes)} x${escapeHtml(valueLabel(p.amount))}`).join("<br>")}</td></tr>`).join("");
  const spawnerRows = spawners.map(([spawnerKey, spawner]) => `<tr><td>${entityLink("Spawners", spawnerKey, cache, routes, spawner.name || spawnerKey)}</td><td>${entityLink("Enemies", spawner.enemy, cache, routes)}</td><td>${entityLink("Bosses", spawner.bossSpawner, cache, routes)}</td><td>${renderSpawnerDropItems(spawner.drops, cache, routes)}</td><td>${escapeHtml(valueLabel(spawner.level))}</td></tr>`).join("");
  return `<section class="content-grid">
    <article><h2>Location Info</h2><div class="stat-grid">${statCard("System", record.solarSystem ? titleFor(cache.SolarSystems?.[record.solarSystem], record.solarSystem) : "n/a")}${statCard("Safe zone", record.safeZoneRadius)}${statCard("Orbit", record.orbitRadius)}${statCard("Spawners", spawners.length)}</div></article>
    <article><h2>Travel Links</h2><ul class="link-list"><li>System: ${entityLink("SolarSystems", record.solarSystem, cache, routes)}</li><li>Coordinates: ${escapeHtml(valueLabel(record.x))}, ${escapeHtml(valueLabel(record.y))}</li><li>Type: ${escapeHtml(valueLabel(record.type))}</li></ul></article>
    ${shopRows ? `<article><h2>Shop Items</h2><input class="table-filter" name="table-filter" placeholder="Filter shop"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Item</th><th>Available</th><th>Price</th></tr></thead><tbody>${shopRows}</tbody></table></div></article>` : ""}
    ${spawnerRows ? `<article><h2>Hostiles Around This Location</h2><input class="table-filter" name="table-filter" placeholder="Filter hostiles"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Spawner</th><th>Enemy</th><th>Boss</th><th>Loot</th><th>Level</th></tr></thead><tbody>${spawnerRows}</tbody></table></div></article>` : ""}
  </section>`;
}

function renderWeaponPage(key, record, cache, routes) {
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

function renderEnemyPage(key, record, cache, routes) {
  const stats = enemyShipStats(record, cache);
  const loadout = (record.weapons || []).map((weapon) => renderWeaponLoadout(weapon, cache, routes)).join("");
  const spawnerRows = Object.entries(cache.Spawners || {})
    .filter(([, spawner]) => spawner.enemy === key || spawner.enemy2 === key || (spawner.enemies || []).some((item) => refKey("Enemies", item) === key))
    .slice(0, 60)
    .map(([spawnerKey, spawner]) => `<tr><td>${entityLink("Spawners", spawnerKey, cache, routes)}</td><td>${entityLink("Bodies", spawner.body, cache, routes)}</td><td>${escapeHtml(valueLabel(spawner.level))}</td><td>${renderSpawnerDropItems(spawner.drops, cache, routes)}</td></tr>`)
    .join("");
  return `<section class="content-grid">
    <article><h2>Threat Profile</h2><div class="stat-grid">${statCard("Traits", enemyTraits(record, false))}${statCard("Damage type", damageTypeLabel(record.damageType))}${statCard("Damage", record.damage || record.kamikazeDmg)}${statCard("Range", record.range || record.aggroRange)}${statCard("Refire", record.refire)}${statCard("XP", record.xp)}</div>${renderDescription(record.description)}</article>
    <article><h2>Survival Info</h2><div class="stat-grid">${statCard("Max HP", stats.hpMax)}${record.startHp !== undefined ? statCard("Starts With HP", stats.startHp, `${valueLabel(record.startHp)}% of max`) : ""}${statCard("Shield", stats.shieldMax)}${statCard("Armor", stats.armor)}${statCard("Kinetic resist", record.kineticResist)}${statCard("Energy resist", record.energyResist)}${statCard("Corrosive resist", record.corrosiveResist)}</div></article>
    <article><h2>Equipment</h2><ul class="link-list"><li>Ship sprite/base stats: ${entityLink("Ships", record.ship, cache, routes)}${stats.body ? ` <span class="muted">${escapeHtml(stats.body)}</span>` : ""}</li><li>Engine: ${entityLink("Engines", record.engine, cache, routes)}</li><li>Loot: ${entityLinks("Drops", record.drops, cache, routes)}</li>${loadout}</ul></article>
    ${spawnerRows ? `<article><h2>Found At</h2><input class="table-filter" name="table-filter" placeholder="Filter spawn locations"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Spawner</th><th>Location</th><th>Level</th><th>Spawner drops</th></tr></thead><tbody>${spawnerRows}</tbody></table></div></article>` : ""}
  </section>`;
}

function renderWeaponLoadout(loadout, cache, routes) {
  const key = refKey("Weapons", loadout);
  const range = typeof loadout === "object" && loadout
    ? [loadout.minRange, loadout.maxRange].filter((value) => value !== undefined).join("-")
    : "";
  return `<li>Weapon: ${entityLink("Weapons", key, cache, routes)}${range ? ` <span class="muted">range ${escapeHtml(range)}</span>` : ""}</li>`;
}

function renderBossPage(record, cache, media, routes) {
  const hp = bossHpStats(record, cache);
  return `<section class="content-grid"><article><h2>Boss Stats</h2><div class="stat-grid">${statCard("Level", record.level)}${statCard("HP", hp.displayHp !== "" ? formatNumber(hp.displayHp, 0) : "", hp.source)}${statCard("Total part HP", hp.totalPartHp !== "" ? formatNumber(hp.totalPartHp, 0) : "")}${statCard("Highest part HP", hp.highestPartHp !== "" ? formatNumber(hp.highestPartHp, 0) : "")}${statCard("Destructible parts", hp.destructibleParts)}${statCard("XP", record.xp)}${statCard("Regen", record.regen)}${statCard("Radius", record.radius)}${statCard("Speed", record.speed)}${statCard("Reset", record.resetTime)}${statCard("Sprite parts", (record.basicObjs || []).length)}${statCard("Turrets", (record.turrets || []).length)}${statCard("Kinetic resist", record.kineticResist)}${statCard("Energy resist", record.energyResist)}${statCard("Corrosive resist", record.corrosiveResist)}</div></article>${renderBossLayeredPreview(record, cache, media)}${renderBossSpriteParts(record, cache, media)}<article><h2>Encounter Links</h2><ul class="link-list"><li>Loot: ${entityLink("Drops", record.drops, cache, routes)}</li><li>Explosion sound: ${entityLink("Sounds", record.explosionSound, cache, routes)}</li>${(record.spawners || []).map((x) => `<li>Spawner: ${entityLink("Spawners", x, cache, routes)}</li>`).join("")}${(record.turrets || []).map((x) => `<li>Turret: ${entityLink("Turrets", x, cache, routes)}</li>`).join("")}</ul></article></section>`;
}

function renderDropPage(key, record, cache, routes) {
  const crateChance = record.crate ? Number(record.chance ?? 1) : 1;
  const rows = (record.dropItems || []).map((item) => {
    const effective = crateChance * Number(item.chance ?? 1);
    return `<tr><td>${entityLink(item.table, item.item, cache, routes)}</td><td>${escapeHtml(item.table || "")}</td><td>${escapeHtml(percentLabel(item.chance))}</td><td>${escapeHtml(percentLabel(effective))}</td><td>${escapeHtml(rangeText(item.min, item.max))}</td></tr>`;
  }).join("");
  const sources = dropSourceRows(key, cache, routes);
  return `<section class="content-grid"><article><h2>Loot Summary</h2><div class="stat-grid">${statCard("Crate", record.crate)}${statCard("Crate chance", percentLabel(crateChance))}${statCard("Artifact chance", percentLabel(record.artifactChance))}${statCard("Flux", rangeText(record.fluxMin, record.fluxMax))}${statCard("XP", rangeText(record.xpMin, record.xpMax))}</div></article>${rows ? `<article><h2>Possible Items</h2><input class="table-filter" name="table-filter" placeholder="Filter loot"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Item</th><th>Table</th><th>Chance</th><th>Effective</th><th>Qty</th></tr></thead><tbody>${rows}</tbody></table></div></article>` : ""}${sources ? `<article><h2>Where It Appears</h2><input class="table-filter" name="table-filter" placeholder="Filter sources"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Source</th><th>Type</th><th>Context</th><th>Source chance</th></tr></thead><tbody>${sources}</tbody></table></div></article>` : ""}</section>`;
}

function renderCommodityPage(key, record, cache, routes) {
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

function renderArtifactPage(key, record, cache, routes) {
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

function renderProjectilePage(record, cache, routes) {
  return `<section class="content-grid"><article><h2>Projectile Behavior</h2><div class="stat-grid">${statCard("AI", record.ai)}${statCard("Collision radius", record.collisionRadius)}${statCard("Explosive", record.explosive)}${statCard("Forced rotation", record.forcedRotation)}${statCard("Wave", record.wave)}${statCard("Blast speed", record.aiBlastSpeed)}</div></article><article><h2>Effects</h2><ul class="link-list"><li>Explosion effect: ${entityLink("Images", record.explosionEffect, cache, routes)}</li><li>Explosion sound: ${soundLink(record.explosionSound, cache, routes)}</li></ul></article></section>`;
}

function renderEnginePage(record, cache, routes) {
  return `<section class="content-grid"><article><h2>Engine Stats</h2><div class="stat-grid">${statCard("Acceleration", record.acceleration)}${statCard("Max speed", record.maxSpeed)}${statCard("Rotation speed", record.rotationSpeed)}${statCard("Friction", record.friction)}${statCard("Booster", record.booster)}${statCard("Sound", cache.Sounds?.[record.sound]?.fileName || "n/a")}</div></article></section>`;
}

function renderShipPage(record, cache, routes) {
  return `<section class="content-grid"><article><h2>Ship Stats</h2><div class="stat-grid">${statCard("HP", record.hp)}${statCard("Shield", record.shieldHp)}${statCard("Regen", record.shieldRegen)}${statCard("Armor", record.armor)}${statCard("Radius", record.collisionRadius)}${statCard("Image", titleFor(cache.Images?.[record.bitmap], record.bitmap))}</div></article></section>`;
}

function renderMissionPage(record, cache, routes) {
  return `<section class="content-grid"><article><h2>Mission Info</h2><div class="stat-grid">${statCard("Major type", record.majorType)}${statCard("Level", record.level)}${statCard("Timed", record.timed)}${statCard("Reward", record.reward)}</div></article><article><h2>Targets</h2><ul class="link-list">${["body", "item", "enemy", "boss"].map((f) => record[f] ? `<li>${escapeHtml(f)}: ${entityLink(f === "body" ? "Bodies" : f === "item" ? "Commodities" : f === "boss" ? "Bosses" : "Enemies", record[f], cache, routes)}</li>` : "").join("")}</ul></article></section>`;
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
  writePage(path.join(DIST_DIR, "guides", "weapons.html"), "Weapon Finder", renderWeaponGuide(cache, manifest, media, routes));
  writePage(path.join(DIST_DIR, "guides", "artifacts.html"), "Artifact Guide", renderArtifactGuide(cache, manifest, media, routes));
  writePage(path.join(DIST_DIR, "guides", "farming.html"), "Farming Guide", renderFarmingGuide(cache, manifest, media, routes));
  writePage(path.join(DIST_DIR, "guides", "travel.html"), "Travel Guide", renderTravelGuide(cache, manifest, routes));
}

function renderCombatGuide(cache) {
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

function renderWeaponGuide(cache, manifest, media, routes) {
  const entries = (manifest.Weapons || []).filter((entry) => isPlayerFacingWeapon(cache.Weapons?.[entryKey(entry)]));
  const topDps = entries
    .map((entry) => ({ entry, record: cache.Weapons?.[entryKey(entry)], score: weaponDps(cache.Weapons?.[entryKey(entry)] || {}) }))
    .filter((item) => item.record && item.score)
    .sort((a, b) => b.score - a.score)
    .slice(0, 25)
    .map(({ entry, record }) => weaponComparisonRow(entry, record, cache, media))
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
    .map(({ entry, record }) => weaponComparisonRow(entry, record, cache, media))
    .join("");
  return `<h1>Weapon Finder</h1><p class="muted">These rankings focus on player-facing weapons. Enemy and boss weapons stay available in the complete weapon index for research.</p>
<section class="content-grid">
  <article><h2>Highest Approximate DPS</h2><input class="table-filter" name="table-filter" placeholder="Filter weapons"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Weapon</th><th>Damage type</th><th>DPS</th><th>Range</th><th>Heat/s</th><th>Tags</th></tr></thead><tbody>${topDps}</tbody></table></div></article>
  <article><h2>Best DPS Per Heat Cost</h2><input class="table-filter" name="table-filter" placeholder="Filter weapons"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Weapon</th><th>Damage type</th><th>DPS</th><th>Range</th><th>Heat/s</th><th>Tags</th></tr></thead><tbody>${efficient}</tbody></table></div></article>
  <article><h2>Full Table</h2><p><a class="button-link" href="/weapons/">Open all weapons</a></p></article>
</section>`;
}

function weaponComparisonRow(entry, record, cache, media) {
  const icon = cache.Images?.[record.techIcon] ? renderImageThumb(cache.Images[record.techIcon], media) : "";
  return `<tr><td>${icon}<a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${escapeHtml(damageTypeLabel(record.damageType))}</td><td>${escapeHtml(valueLabel(weaponDps(record)))}</td><td>${escapeHtml(valueLabel(record.range))}</td><td>${escapeHtml(valueLabel(weaponHeatPerSecond(record)))}</td><td>${escapeHtml(weaponTags(record))}</td></tr>`;
}

function renderArtifactGuide(cache, manifest, media, routes) {
  const entries = (manifest.ArtifactTypes || []).map((entry) => ({ entry, record: cache.ArtifactTypes?.[entryKey(entry)] })).filter((item) => item.record);
  const specialRows = entries
    .filter(({ record }) => record.special)
    .sort((a, b) => numberValue(b.record.dropRate) - numberValue(a.record.dropRate))
    .map(({ entry, record }) => {
      const icon = cache.Images?.[record.bitmap] ? renderImageThumb(cache.Images[record.bitmap], media) : "";
      return `<tr><td>${icon}<a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${escapeHtml(artifactStatLabel(record.type))}</td><td>${escapeHtml(artifactValueRange(record))}</td><td>${escapeHtml(valueLabel(record.dropRate))}</td><td>${escapeHtml(artifactLevelRange(record))}</td></tr>`;
    })
    .join("");
  const sourceRows = Object.entries(cache.Drops || {})
    .filter(([, drop]) => numberValue(drop.artifactChance) > 0)
    .map(([dropKey, drop]) => `<tr><td>${entityLink("Drops", dropKey, cache, routes)}</td><td>${escapeHtml(percentLabel((drop.crate ? numberValue(drop.chance, 1) : 1) * numberValue(drop.artifactChance, 0)))}</td><td>${escapeHtml(valueLabel(drop.type || "drop"))}</td><td>${escapeHtml(rangeText(drop.artifactAmount, drop.artifactAmount))}</td><td>${escapeHtml(valueLabel(drop.artifactLevel))}</td></tr>`)
    .join("");
  return `<h1>Artifact Guide</h1>
<section class="content-grid">
  <article><h2>What Matters</h2><p>Read artifacts by stat family, value range, special flag, unique flag, level gate, and drop weight. Unique artifacts use stat types from <code>ArtifactStat.isUnique</code> and cannot be upgraded.</p><p><a class="button-link" href="/artifacts/">Open artifact database and calculator</a></p></article>
  <article><h2>Artifact Drop Tables</h2><div class="table-wrap"><table class="sortable"><thead><tr><th>Drop</th><th>Artifact chance</th><th>Type</th><th>Amount</th><th>Level</th></tr></thead><tbody>${sourceRows}</tbody></table></div></article>
  <article><h2>Unique Artifact Effects</h2><div class="table-wrap"><table class="sortable"><thead><tr><th>Unique effect</th><th>Game effect</th><th>Stat family</th><th>Upgradeable</th><th>Known source</th></tr></thead><tbody>${uniqueArtifactRows(cache, routes)}</tbody></table></div></article>
  <article><h2>Special Artifacts</h2><input class="table-filter" name="table-filter" placeholder="Filter special artifacts"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Artifact</th><th>Stat</th><th>Value Range</th><th>Drop Weight</th><th>Levels</th></tr></thead><tbody>${specialRows}</tbody></table></div></article>
</section>`;
}

function renderFarmingGuide(cache, manifest, media, routes) {
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
  const rows = (manifest.Commodities || [])
    .map((entry) => {
      const key = entryKey(entry);
      const item = cache.Commodities?.[key];
      if (!item) return "";
      const icon = cache.Images?.[item.bitmap] ? renderImageThumb(cache.Images[item.bitmap], media) : "";
      return `<tr><td>${icon}<a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${escapeHtml(valueLabel(item.type))}</td><td>${escapeHtml(valueLabel(sourceCounts.get(key) || 0))}</td><td>${escapeHtml(valueLabel(useCounts.get(key) || 0))}</td></tr>`;
    })
    .join("");
  return `<h1>Farming Guide</h1><p class="muted">Start here when you need a material. Sort by sources or upgrade uses, then open the item page for drop tables, spawners, shops, and recycle outputs.</p><input class="table-filter" name="table-filter" placeholder="Filter items"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Item</th><th>Type</th><th>Known sources</th><th>Weapon tech uses</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderTravelGuide(cache, manifest, routes) {
  const rows = (manifest.SolarSystems || []).filter((entry) => isVisibleMapSystem(cache.SolarSystems?.[entryKey(entry)], entryKey(entry))).map((entry) => {
    const key = entryKey(entry);
    const system = cache.SolarSystems?.[key];
    if (!system) return "";
    const bodies = Object.values(cache.Bodies || {}).filter((body) => body.solarSystem === key);
    const shops = bodies.reduce((sum, body) => sum + (body.shopItems || []).length, 0);
    const hostileBodies = new Set(Object.values(cache.Spawners || {}).filter((spawner) => bodies.some((body) => body.key === spawner.body)).map((spawner) => spawner.body));
    return `<tr><td><a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${escapeHtml(valueLabel(system.galaxy))}</td><td>${escapeHtml(valueLabel(system.type))}</td><td>${escapeHtml(rangeText(system.uberMinLevel, system.uberMaxLevel))}</td><td>${escapeHtml(valueLabel(bodies.length))}</td><td>${escapeHtml(valueLabel(shops))}</td><td>${escapeHtml(valueLabel(hostileBodies.size))}</td></tr>`;
  }).join("");
  return `<h1>Travel Guide</h1><p class="muted">Use this when choosing where to go next. Systems link to their locations; locations link to shops, hostiles, spawners, drops, and the global map.</p><p><a class="button-link" href="/map/">Open galaxy map</a></p><input class="table-filter" name="table-filter" placeholder="Filter systems"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>System</th><th>Galaxy</th><th>Type</th><th>Level range</th><th>Locations</th><th>Shop items</th><th>Hostile locations</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function buildIndex(manifest, tables, warnings, media, map) {
  const guideCards = GUIDE_PAGES.slice(1)
    .map(([label, href, desc]) => `<a class="card" href="/${href}"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(desc)}</span></a>`)
    .join("\n");
  const cards = [
    ["Systems", "systems", manifest.SolarSystems?.length ?? 0],
    ["Bodies", "bodies", manifest.Bodies?.length ?? 0],
    ["Enemies", "enemies", manifest.Enemies?.length ?? 0],
    ["Bosses", "bosses", manifest.Bosses?.length ?? 0],
    ["Weapons", "weapons", manifest.Weapons?.length ?? 0],
    ["Projectiles", "projectiles", manifest.Projectiles?.length ?? 0],
    ["Items", "commodities", manifest.Commodities?.length ?? 0],
    ["Artifacts", "artifacts", manifest.ArtifactTypes?.length ?? 0],
    ["Drops", "drops", manifest.Drops?.length ?? 0],
    ["Ships", "ships", manifest.Ships?.length ?? 0],
    ["Engines", "engines", manifest.Engines?.length ?? 0],
    ["Turrets", "turrets", manifest.Turrets?.length ?? 0],
    ["Missions", "missions", manifest.MissionTypes?.length ?? 0],
    ["Media", "media", media.imageRecords + media.soundRecords]
  ].map(([label, href, count]) => `<a class="card" href="/${href}/"><strong>${label}</strong><span>${count} pages</span></a>`).join("\n");

  const tableRows = Object.entries(tables)
    .map(([table, count]) => `<tr><td><code>${escapeHtml(table)}</code></td><td>${count}</td></tr>`)
    .join("\n");

  const body = `<section class="home-hero">
  <img src="/assets/source-images/logo.png" alt="Astroflux">
  <div>
    <h1>Astroflux Wiki</h1>
    <p>A player-first reference built from the game client data: enemies, weapons, drops, locations, sprites, sounds, and the links between them.</p>
  </div>
</section>
${renderGalaxyMapSection(map, manifest, "home-map", true)}
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

function renderImageCard(image, key, media, primary = false) {
  const local = media.byGameFile.get(image.fileName);
  if (local && isImageFile(image.fileName)) {
    return `<figure class="media-card image-card${primary ? " primary" : ""}"><img loading="lazy" src="${escapeAttr(local.url)}" alt="${escapeAttr(image.fileName)}"><figcaption>${escapeHtml(image.fileName)}</figcaption></figure>`;
  }
  const atlas = findAtlasSprite(media, image);
  if (atlas) return renderAtlasCard(atlas, image, primary);
  return `<div class="media-card missing"><strong>${escapeHtml(image.fileName || image.textureName || key)}</strong><span>GameFS texture ref: ${escapeHtml(image.type || "unknown")} / ${escapeHtml(image.textureName || "no textureName")}</span></div>`;
}

function renderImageThumb(image, media) {
  const local = media.byGameFile.get(image.fileName);
  if (local && isImageFile(image.fileName)) return `<img class="thumb" src="${escapeAttr(local.url)}" alt="">`;
  const atlas = findAtlasSprite(media, image);
  if (!atlas) return "";
  return `<span class="thumb atlas-sprite" style="${escapeAttr(atlasStyle(atlas.frames[0], false))}" role="img" aria-label="${escapeAttr(image.fileName || atlas.label)}"></span>`;
}

function mediaImageStatus(image, media) {
  if (media.byGameFile.has(image.fileName) && isImageFile(image.fileName)) return "standalone file";
  if (findAtlasSprite(media, image)) return "atlas sprite";
  if (media.byGameFile.has(image.fileName)) return "non-image media";
  return "not found";
}

function isImageFile(file) {
  return [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(path.extname(file || "").toLowerCase());
}

function findAtlasSprite(media, image) {
  if (!media.atlasByName) return null;
  const prefix = image.textureName || "";
  const animatedFrames = prefix.length >= 3 ? atlasFramesForTexture(media, prefix).slice(0, 24) : [];
  if ((image.animate || numberValue(image.animationCells, 0) > 1) && animatedFrames.length > 1) {
    return { frames: animatedFrames, label: prefix };
  }
  const names = [
    image.textureName,
    image.fileName ? path.basename(image.fileName, path.extname(image.fileName)) : "",
    image.textureName ? `${image.textureName}1` : "",
    image.textureName ? `${image.textureName}01` : ""
  ].filter(Boolean);
  for (const name of names) {
    if (media.atlasByName.has(name)) return { frames: [media.atlasByName.get(name)], label: name };
  }
  if (animatedFrames.length) return { frames: animatedFrames, label: prefix };
  return null;
}

function atlasFramesForTexture(media, prefix) {
  return [...media.atlasByName.values()]
    .filter((entry) => entry.name === prefix || (entry.name.startsWith(prefix) && /^\d+$/.test(entry.name.slice(prefix.length))))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

function atlasFrameStyle(frame, scale = 1) {
  return [
    `width:${Math.max(1, Math.round(frame.width * scale))}px`,
    `height:${Math.max(1, Math.round(frame.height * scale))}px`,
    `background-image:url('${escapeAttr(frame.url)}')`,
    `background-size:${Math.round(frame.atlasWidth * scale)}px ${Math.round(frame.atlasHeight * scale)}px`,
    `background-position:-${Math.round(frame.x * scale)}px -${Math.round(frame.y * scale)}px`
  ].join(";");
}

function atlasStyle(frame, primary = false) {
  const maxWidth = primary ? 260 : 180;
  const maxHeight = primary ? 220 : 160;
  const minScale = primary ? 1.35 : 1;
  const scale = Math.min(minScale, maxWidth / frame.width, maxHeight / frame.height);
  return atlasFrameStyle(frame, scale);
}

function renderAtlasCard(atlas, image, primary = false) {
  const frame = atlas.frames[0];
  const frames = atlas.frames.map((item) => ({
    style: atlasStyle(item),
    name: item.name
  }));
  const frameAttr = frames.length > 1 ? ` data-frames="${escapeAttr(JSON.stringify(frames))}"` : "";
  return `<figure class="media-card atlas-card${primary ? " primary" : ""}"><span class="atlas-sprite"${frameAttr} style="${escapeAttr(atlasStyle(frame, primary))}" role="img" aria-label="${escapeAttr(image.fileName || atlas.label)}"></span><figcaption>${escapeHtml(image.fileName || atlas.label)}${frames.length > 1 ? ` (${frames.length} frames)` : ""}</figcaption></figure>`;
}

function renderBossSpriteThumb(record, cache, media) {
  const assembled = renderBossLayeredMini(record, cache, media);
  if (assembled) return assembled;
  for (const key of bossImageKeys(record)) {
    const image = cache.Images?.[key];
    if (!image) continue;
    const thumb = renderImageThumb(image, media);
    if (thumb) return thumb;
  }
  return "";
}

function bossRotatedBounds(width, height, degrees) {
  const rad = numberValue(degrees, 0) * Math.PI / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return {
    width: width * cos + height * sin,
    height: width * sin + height * cos
  };
}

function bossLayeredParts(record, cache, media) {
  return (record.basicObjs || []).map((obj, index) => {
    const image = cache.Images?.[obj.bitmap];
    if (!image) return null;
    const atlas = findAtlasSprite(media, image);
    if (!atlas) return null;
    const frame = atlas.frames[0];
    const partScale = numberValue(obj.scale, numberValue(image.scale, 1)) || 1;
    const width = frame.width * partScale;
    const height = frame.height * partScale;
    const angle = numberValue(obj.angle, numberValue(obj.rotation, 0));
    const rotated = bossRotatedBounds(width, height, angle);
    return {
      obj,
      image,
      frame,
      index,
      x: numberValue(obj.xpos, 0) + numberValue(obj.imageOffsetX, 0),
      y: numberValue(obj.ypos, 0) + numberValue(obj.imageOffsetY, 0),
      sourceX: numberValue(obj.xpos, 0),
      sourceY: numberValue(obj.ypos, 0),
      imageOffsetX: numberValue(obj.imageOffsetX, 0),
      imageOffsetY: numberValue(obj.imageOffsetY, 0),
      layer: numberValue(obj.layer, 0),
      angle,
      rotationSpeed: numberValue(obj.rotationSpeed, 0),
      scale: partScale,
      width,
      height,
      boundsWidth: rotated.width,
      boundsHeight: rotated.height,
      isDeadState: /\bdead\b/i.test(obj.name || ""),
      isHiddenAtStart: obj.active === false || obj.hideIfInactive === true
    };
  }).filter(Boolean);
}

function bossLayeredStage(parts, options = {}) {
  const maxWidth = options.maxWidth ?? 760;
  const maxHeight = options.maxHeight ?? 560;
  const maxScale = options.maxScale ?? 1.2;
  const minWidth = options.minWidth ?? 240;
  const minHeight = options.minHeight ?? 180;
  const pad = options.pad ?? 30;
  const containerClass = options.containerClass || "boss-layered-preview";
  const layerClass = options.layerClass || "boss-layer";
  const spriteClass = options.spriteClass || "boss-layer-sprite";
  const animate = options.animate !== false;
  const limit = options.limit ?? 120;
  const minX = Math.min(...parts.map((part) => part.x - part.boundsWidth / 2));
  const maxX = Math.max(...parts.map((part) => part.x + part.boundsWidth / 2));
  const minY = Math.min(...parts.map((part) => part.y - part.boundsHeight / 2));
  const maxY = Math.max(...parts.map((part) => part.y + part.boundsHeight / 2));
  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  const stageScale = Math.min(maxScale, maxWidth / contentWidth, maxHeight / contentHeight);
  const stageWidth = Math.max(minWidth, Math.round(contentWidth * stageScale + pad * 2));
  const stageHeight = Math.max(minHeight, Math.round(contentHeight * stageScale + pad * 2));
  const layers = parts
    .sort((a, b) => a.layer - b.layer || a.index - b.index)
    .slice(0, limit)
    .map((part, visualIndex) => {
      const x = pad + (part.x - part.width / 2 - minX) * stageScale;
      const y = pad + (part.y - part.height / 2 - minY) * stageScale;
      const spriteScale = stageScale * part.scale;
      const duration = part.rotationSpeed ? Math.max(2.8, Math.min(18, 7 / Math.abs(part.rotationSpeed))) : 0;
      const drift = Math.min(5, Math.max(1, Math.abs(part.layer) + 1));
      const layerStyle = [
        `left:${Math.round(x)}px`,
        `top:${Math.round(y)}px`,
        `z-index:${100 + part.layer * 10 + visualIndex}`,
        animate ? `--drift-x:${drift}px` : "",
        animate ? `--drift-x-neg:-${drift}px` : "",
        animate ? `--drift-y:${(drift * 0.35).toFixed(2)}px` : "",
        animate ? `--drift-y-neg:-${(drift * 0.35).toFixed(2)}px` : "",
        animate ? `animation-delay:-${(visualIndex % 9) * 0.22}s` : ""
      ].filter(Boolean).join(";");
      const spriteStyle = [
        atlasFrameStyle(part.frame, spriteScale),
        `--base-rot:${part.angle}deg`,
        `--spin:${part.rotationSpeed < 0 ? "-360deg" : "360deg"}`,
        part.rotationSpeed ? `animation-duration:${duration.toFixed(2)}s` : ""
      ].filter(Boolean).join(";");
      const stateClass = `${part.rotationSpeed ? " spinning" : ""}${part.isDeadState ? " dead-state" : ""}${part.isHiddenAtStart ? " hidden-start" : ""}`;
      const title = [
        part.obj.name || part.image.fileName || "Boss part",
        `layer ${valueLabel(part.layer)}`,
        `angle ${valueLabel(part.angle)}`,
        part.imageOffsetX || part.imageOffsetY ? `image offset ${valueLabel(part.imageOffsetX)}, ${valueLabel(part.imageOffsetY)}` : ""
      ].filter(Boolean).join(" / ");
      return `<span class="${layerClass}" style="${escapeAttr(layerStyle)}" title="${escapeAttr(title)}"><span class="${spriteClass}${stateClass}" style="${escapeAttr(spriteStyle)}" role="img" aria-label="${escapeAttr(part.image.fileName || part.obj.name || "Boss part")}"></span></span>`;
    }).join("");
  return {
    html: `<div class="${containerClass}" style="width:${stageWidth}px;height:${stageHeight}px">${layers}</div>`,
    width: stageWidth,
    height: stageHeight,
    scale: stageScale,
    rendered: Math.min(parts.length, limit)
  };
}

function renderBossLayeredMini(record, cache, media) {
  const rawParts = bossLayeredParts(record, cache, media);
  if (!rawParts.length) return "";
  return bossLayeredStage(rawParts, {
    maxWidth: 72,
    maxHeight: 56,
    minWidth: 58,
    minHeight: 48,
    maxScale: 0.8,
    pad: 4,
    containerClass: "boss-mini-preview",
    layerClass: "boss-mini-layer",
    spriteClass: "boss-mini-sprite",
    animate: false
  }).html;
}

function renderBossLayeredCard(record, cache, media) {
  const rawParts = bossLayeredParts(record, cache, media);
  if (!rawParts.length) return "";
  const stage = bossLayeredStage(rawParts, {
    maxWidth: 260,
    maxHeight: 220,
    minWidth: 180,
    minHeight: 150,
    maxScale: 1,
    pad: 12,
    containerClass: "boss-card-preview",
    layerClass: "boss-mini-layer",
    spriteClass: "boss-mini-sprite",
    animate: false
  });
  return `<figure class="media-card boss-assembled-card primary">${stage.html}<figcaption>${escapeHtml(record.name || "Boss")} assembled from ${rawParts.length} sprite part${rawParts.length === 1 ? "" : "s"}</figcaption></figure>`;
}

function renderBossLayeredPreview(record, cache, media) {
  const rawParts = bossLayeredParts(record, cache, media);
  if (!rawParts.length) return "";
  const deadCount = rawParts.filter((part) => part.isDeadState).length;
  const hiddenCount = rawParts.filter((part) => part.isHiddenAtStart).length;
  const offsetCount = rawParts.filter((part) => part.imageOffsetX || part.imageOffsetY).length;
  const stage = bossLayeredStage(rawParts, {
    maxWidth: 760,
    maxHeight: 560,
    minWidth: 240,
    minHeight: 180,
    maxScale: 1.2,
    pad: 30,
    animate: true
  });
  const notes = [
    `${stage.rendered} of ${rawParts.length} sprite part${rawParts.length === 1 ? "" : "s"} rendered`,
    deadCount ? `${deadCount} dead-state variant${deadCount === 1 ? "" : "s"} included` : "",
    hiddenCount ? `${hiddenCount} initially hidden/triggered part${hiddenCount === 1 ? "" : "s"} included` : "",
    offsetCount ? `${offsetCount} part${offsetCount === 1 ? "" : "s"} use image offset data` : ""
  ].filter(Boolean).join(" / ");
  return `<article><h2>Animated Layer Preview</h2><p class="muted">This assembles every boss sprite from <code>basicObjs</code> position, image offset, scale, angle, and layer order. Rotating parts use their source <code>rotationSpeed</code>. ${escapeHtml(notes)}.</p>${stage.html}</article>`;
}

function renderBossSpriteParts(record, cache, media) {
  const parts = (record.basicObjs || []).filter((obj) => obj?.bitmap && cache.Images?.[obj.bitmap]);
  if (!parts.length) return "";
  const cards = parts.slice(0, 80).map((obj) => {
    const image = cache.Images[obj.bitmap];
    const card = renderImageCard(image, obj.bitmap, media, false);
    return card ? `<div class="boss-part">${card}<dl><dt>Part</dt><dd>${escapeHtml(obj.name || "Sprite part")}</dd><dt>Layer</dt><dd>${escapeHtml(valueLabel(obj.layer))}</dd><dt>HP</dt><dd>${escapeHtml(valueLabel(obj.hp))}</dd><dt>Position</dt><dd>${escapeHtml(valueLabel(obj.xpos))}, ${escapeHtml(valueLabel(obj.ypos))}</dd></dl></div>` : "";
  }).join("");
  return `<article><h2>Boss Sprite Parts</h2><p class="muted">These are the visual parts from <code>basicObjs</code>. Multi-part bosses are built by layering these sprites in-game.</p><div class="boss-sprite-grid">${cards}</div></article>`;
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

function isVisibleMapSystem(system, key = "") {
  if (!system) return false;
  const type = String(system.type || "").toLowerCase();
  const name = String(system.name || key || "").trim().toLowerCase();
  if (name === "dev") return false;
  if (type && !["regular", "pvp"].includes(type)) return false;
  if (/debug|test/.test(type)) return false;
  return true;
}

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

function prepareMapData(rawMap, cache) {
  const systems = Object.entries(cache.SolarSystems || {})
    .filter(([key, system]) => isVisibleMapSystem(system, key))
    .map(([key, system]) => ({
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
      links: []
    }));
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

function renderSystemWarpLinks(key, cache, routes) {
  const links = systemWarpLinks(key, cache);
  if (!links.length) return "";
  const rows = links.map((link) => `<tr><td>${entityLink("SolarSystems", link.targetKey, cache, routes, link.targetName)}</td><td>${escapeHtml(link.transit ? "Transit" : "Warp path")}</td><td>${escapeHtml(link.name)}</td><td>${renderWarpPathPrice(link, cache, routes)}</td></tr>`).join("");
  return `<article><h2>Connected Systems</h2><p class="muted">These are the travel links from the game's <code>WarpPaths</code> table. Open the target system to continue following the route network.</p><div class="table-wrap"><table class="sortable"><thead><tr><th>Destination</th><th>Link type</th><th>Warp path</th><th>Unlock cost</th></tr></thead><tbody>${rows}</tbody></table></div></article>`;
}

function collectImageKeys(table, record, cache) {
  const keys = [];
  const primary = primaryImageKey(table, record, cache);
  if (primary) keys.push(primary);
  if (table === "Bosses") keys.push(...bossImageKeys(record));
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

function renderGalaxyMapSection(map, manifest, canvasId = "map", compact = false) {
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
  <div><h2>${compact ? "Galaxy Map" : "Interactive Galaxy Map"}</h2><p class="muted">Click a system to open its page. Raw star-map coordinates are normalized to fit this canvas; in-system radar icons use the game map scale of 0.1 px per world unit before dynamic shrinking.</p></div>
  <a class="button-link" href="/map/">Open full map</a>
</div>
<div class="map-controls" data-map-controls="${escapeAttr(canvasId)}">
  <input id="${escapeAttr(canvasId)}-search" name="${escapeAttr(canvasId)}-search" type="search" placeholder="Find system">
  <select id="${escapeAttr(canvasId)}-galaxy" name="${escapeAttr(canvasId)}-galaxy"><option value="">All galaxies</option>${galaxyOptions}</select>
  <label class="check"><input id="${escapeAttr(canvasId)}-paths" name="${escapeAttr(canvasId)}-paths" type="checkbox" checked> Warp paths</label>
</div>
<canvas id="${escapeAttr(canvasId)}" width="${compact ? 1100 : 1300}" height="${compact ? 520 : 820}" aria-label="Galaxy map"></canvas>
<div class="map-readout" id="${escapeAttr(canvasId)}-readout">Hover a system to inspect level range, galaxy, and coordinates.</div>
<script>
const systems = ${systems};
const warpPaths = ${warpPaths};
const routes = ${JSON.stringify(systemRoutes)};
window.addEventListener("DOMContentLoaded", () => initGalaxyMap("${canvasId}", systems, warpPaths, routes));
</script>
</section>`;
}

function buildMapPage(map, manifest) {
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

function findSourceImage(nameToken) {
  const dir = path.join(SOURCE_DIR, "images");
  if (!fs.existsSync(dir)) return null;
  return fs.readdirSync(dir).find((file) => file.toLowerCase().includes(nameToken));
}

function copyMediaAssets(cache) {
  const mediaDir = path.join(DIST_DIR, "assets", "source-images");
  const atlasDir = path.join(DIST_DIR, "assets", "atlases");
  const gamefsDir = path.join(SOURCE_DIR, "gamefs");
  ensureDir(mediaDir);
  ensureDir(atlasDir);
  const byGameFile = new Map();
  const availableImages = [];
  const availableAudio = [];
  const atlasByName = new Map();
  const sourceImageDir = path.join(SOURCE_DIR, "images");

  if (fs.existsSync(sourceImageDir)) {
    for (const file of fs.readdirSync(sourceImageDir)) {
      const ext = path.extname(file).toLowerCase();
      if (![".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) continue;
      const safeName = file.includes("logo_png") ? "logo.png" : file.includes("bg_jpg") ? "background.jpg" : file;
      fs.copyFileSync(path.join(sourceImageDir, file), path.join(mediaDir, safeName));
      availableImages.push({ source: file, url: `/assets/source-images/${safeName}` });
    }
  }

  const logo = findSourceImage("logo_png");
  const bg = findSourceImage("bg_jpg");
  if (logo) byGameFile.set("astroflux-logo", { url: "/assets/source-images/logo.png" });
  if (bg) byGameFile.set("astroflux-background", { url: "/assets/source-images/background.jpg" });

  const gamefsTextures = path.join(gamefsDir, "textures");
  if (fs.existsSync(gamefsTextures)) {
    for (const file of fs.readdirSync(gamefsTextures)) {
      const ext = path.extname(file).toLowerCase();
      if (![".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) continue;
      const outName = `gamefs-${file}`;
      fs.copyFileSync(path.join(gamefsTextures, file), path.join(mediaDir, outName));
      fs.copyFileSync(path.join(gamefsTextures, file), path.join(atlasDir, file));
      availableImages.push({ source: file, url: `/assets/source-images/${outName}` });
      byGameFile.set(file, { url: `/assets/source-images/${outName}` });
    }
    for (const file of fs.readdirSync(gamefsTextures)) {
      if (path.extname(file).toLowerCase() !== ".xml") continue;
      for (const entry of parseAtlasXml(path.join(gamefsTextures, file))) {
        atlasByName.set(entry.name, entry);
      }
    }
  }

  const gamefsAudio = path.join(gamefsDir, "audio");
  const audioOut = path.join(DIST_DIR, "assets", "audio");
  if (fs.existsSync(gamefsAudio)) {
    for (const type of fs.readdirSync(gamefsAudio)) {
      const typeDir = path.join(gamefsAudio, type);
      if (!fs.statSync(typeDir).isDirectory()) continue;
      ensureDir(path.join(audioOut, type));
      for (const file of fs.readdirSync(typeDir)) {
        fs.copyFileSync(path.join(typeDir, file), path.join(audioOut, type, file));
        availableAudio.push({ source: `${type}/${file}`, url: `/assets/audio/${type}/${file}` });
        byGameFile.set(file, { url: `/assets/audio/${type}/${file}` });
      }
    }
  }

  for (const image of Object.values(cache.Images || {})) {
    const found = availableImages.find((item) => item.source === image.fileName);
    if (found) byGameFile.set(image.fileName, found);
  }

  return {
    byGameFile,
    availableImages,
    availableAudio,
    atlasByName,
    imageRecords: Object.keys(cache.Images || {}).length,
    soundRecords: Object.keys(cache.Sounds || {}).length
  };
}

function parseAttrs(text) {
  const attrs = {};
  for (const match of text.matchAll(/([A-Za-z0-9_:-]+)="([^"]*)"/g)) attrs[match[1]] = match[2];
  return attrs;
}

function parseAtlasXml(file) {
  const xml = fs.readFileSync(file, "utf8");
  const atlasAttrs = parseAttrs(xml.match(/<TextureAtlas\b[^>]*>/)?.[0] || "");
  const imagePath = atlasAttrs.imagePath;
  if (!imagePath) return [];
  const entries = [];
  for (const match of xml.matchAll(/<SubTexture\b[^>]*\/>/g)) {
    const attrs = parseAttrs(match[0]);
    if (!attrs.name) continue;
    entries.push({
      name: attrs.name,
      url: `/assets/atlases/${imagePath}`,
      x: Number(attrs.x || 0),
      y: Number(attrs.y || 0),
      width: Number(attrs.width || 1),
      height: Number(attrs.height || 1),
      atlasWidth: Number(atlasAttrs.width || 2048),
      atlasHeight: Number(atlasAttrs.height || 2048)
    });
  }
  return entries;
}

function writeAssets(searchEntries = [], media = {}) {
  const mapBackground = media.atlasByName?.get("star_map") || null;
  const css = `:root{color-scheme:dark;--bg:#0b1016;--panel:#121a23;--text:#e6edf3;--muted:#9fb0c0;--line:#263545;--accent:#6ee7f9}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
header{position:sticky;top:0;z-index:10;display:flex;gap:18px;align-items:center;padding:12px 20px;background:#0b1016ee;border-bottom:1px solid var(--line);backdrop-filter:blur(8px)}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}.brand{font-weight:700;color:var(--text)}nav{display:flex;gap:14px;flex-wrap:wrap}
main{max-width:1160px;margin:0 auto;padding:28px 20px 56px}h1{font-size:32px;margin:0 0 18px}h2{margin-top:32px;border-bottom:1px solid var(--line);padding-bottom:6px}
.site-footer{border-top:1px solid var(--line);padding:18px 20px;color:var(--muted);text-align:center;background:#080d13}.site-footer p{margin:0}
code{background:#17212b;border:1px solid var(--line);border-radius:4px;padding:1px 4px}.source-key{display:inline-block;margin-top:4px;opacity:.38;font-size:11px}.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:8px}table{width:100%;border-collapse:collapse}th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{background:#111b25;color:#fff}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:22px 0}.card{display:block;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px}.card strong{display:block;color:var(--text);font-size:18px}.card span,.listing span{display:block;color:var(--muted);font-size:12px}
.listing{padding-left:0;list-style:none;columns:2;column-gap:28px}.listing li{break-inside:avoid;padding:8px 0;border-bottom:1px solid var(--line)}
canvas{width:100%;height:auto;border:1px solid var(--line);border-radius:8px;background:#071019}
.site-search{position:relative;min-width:220px;flex:1;max-width:420px}.site-search input{width:100%;height:34px;border:1px solid var(--line);border-radius:6px;background:#111b25;color:var(--text);padding:0 10px}.search-results{position:absolute;top:40px;left:0;right:0;background:#101923;border:1px solid var(--line);border-radius:8px;box-shadow:0 16px 40px #0008;overflow:hidden}.search-results a{display:block;padding:9px 11px;border-bottom:1px solid var(--line);color:var(--text)}.search-results span{display:block;color:var(--muted);font-size:12px}
.home-hero{display:flex;gap:22px;align-items:center;padding:28px;background:linear-gradient(90deg,#121a23,#0d141c);border:1px solid var(--line);border-radius:8px}.home-hero img{max-width:260px;width:32%;min-width:140px}.notice{padding:14px 16px;background:#14202b;border:1px solid var(--line);border-radius:8px;color:#d7e6f3}
.media-panel{margin-bottom:26px}.media-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.media-card{margin:0;display:flex;flex-direction:column;gap:8px;justify-content:center;min-height:104px;padding:12px;background:var(--panel);border:1px solid var(--line);border-radius:8px}.media-card img{max-width:100%;max-height:160px;object-fit:contain}.media-card span,.media-card figcaption{color:var(--muted);font-size:12px}.media-card.missing{border-style:dashed}.media-label{color:var(--muted);text-transform:uppercase;font-size:11px}.atlas-card,.image-card{align-items:center}.atlas-sprite{display:block;background-repeat:no-repeat;image-rendering:auto;filter:drop-shadow(0 8px 12px #0008)}
details.source-details{margin:18px 0;padding:8px 10px;border:1px solid var(--line);border-radius:8px;color:var(--muted);font-size:12px;opacity:.48}details.source-details:hover,details.source-details[open]{opacity:.9}details.source-details summary{cursor:pointer;color:var(--muted)}
.entity-hero{display:grid;grid-template-columns:auto minmax(220px,1fr) minmax(260px,.75fr);gap:22px;align-items:center;margin-bottom:20px;padding:22px;background:#111a24;border:1px solid var(--line);border-radius:8px}.hero-visual .media-card{min-width:180px;min-height:170px;background:#0c131b}.hero-visual figcaption{max-width:220px;text-align:center}.hero-main h1{font-size:38px;line-height:1.05;margin-bottom:10px}.eyebrow{margin:0 0 4px;color:var(--muted);text-transform:uppercase;font-size:12px;letter-spacing:0}.pill{display:inline-block;padding:3px 8px;border:1px solid var(--line);border-radius:999px;color:#d7e6f3;background:#172332}.button-link{display:inline-flex;align-items:center;min-height:34px;padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:#162332;color:var(--text)}.steps{padding-left:22px}.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}.stat-grid.compact{min-width:360px}.stat-card{padding:10px 12px;background:var(--panel);border:1px solid var(--line);border-radius:8px}.stat-card span{display:block;color:var(--muted);font-size:12px}.stat-card strong{display:block;font-size:18px;color:#fff}.stat-card small{display:block;color:var(--muted)}.content-grid{display:grid;gap:18px}.link-list{padding-left:18px}.table-filter{width:100%;max-width:360px;height:32px;margin:0 0 8px;border:1px solid var(--line);border-radius:6px;background:#111b25;color:var(--text);padding:0 10px}.sortable th{cursor:pointer}.muted{color:var(--muted)}.thumb{width:36px;height:36px;object-fit:contain;margin-right:8px;vertical-align:middle}.thumb.atlas-sprite{display:inline-block}
.name-cell .thumb,.name-cell .thumb.atlas-sprite{width:52px;height:52px}.tip{border-bottom:1px dotted #7fa7ba;cursor:help}.filter-panel,.map-controls,.calculator,.elite-calculator{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:12px 0 16px;padding:12px;background:#101923;border:1px solid var(--line);border-radius:8px}.filter-panel input,.filter-panel select,.map-controls input,.map-controls select,.calculator input,.calculator select,.elite-calculator input{height:32px;border:1px solid var(--line);border-radius:6px;background:#0c131b;color:var(--text);padding:0 9px}.filter-panel label,.calculator label,.elite-calculator label{display:inline-flex;gap:6px;align-items:center;color:var(--muted)}.filter-panel input[type=search]{min-width:260px}.check input{height:auto}.calculator output,.elite-calculator output,.map-readout{display:block;min-height:32px;padding:7px 10px;background:#0c131b;border:1px solid var(--line);border-radius:6px;color:#d7e6f3}.map-section{margin:24px 0}.map-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.map-head h2{margin-top:0}.map-section canvas{background:#03070d}.map-readout{margin-top:8px}.source-rank{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;padding:0;list-style:none}.source-rank li{padding:10px 12px;background:var(--panel);border:1px solid var(--line);border-radius:8px}.source-rank strong,.source-rank span,.source-rank small{display:block}.source-rank small{color:var(--muted)}
.boss-layered-preview{position:relative;max-width:100%;overflow:hidden;margin:12px auto 4px;background:radial-gradient(circle at center,#132030 0,#071019 68%);border:1px solid var(--line);border-radius:8px}.boss-layer{position:absolute;display:block;animation:boss-layer-drift 3.6s ease-in-out infinite alternate;will-change:transform}.boss-layer-sprite{display:block;background-repeat:no-repeat;image-rendering:auto;filter:drop-shadow(0 10px 14px #0009);transform:rotate(var(--base-rot,0deg));transform-origin:center}.boss-layer-sprite.spinning{animation:boss-layer-spin linear infinite}.boss-layer-sprite.dead-state{filter:drop-shadow(0 10px 14px #0009) saturate(.82)}.boss-layer-sprite.hidden-start{opacity:.78}.boss-mini-preview,.boss-card-preview{position:relative;display:inline-block;vertical-align:middle;overflow:hidden;background:radial-gradient(circle at center,#132030 0,#071019 70%);border:1px solid var(--line);border-radius:6px}.boss-mini-preview{margin-right:8px}.boss-card-preview{margin:auto}.boss-mini-layer{position:absolute;display:block}.boss-mini-sprite{display:block;background-repeat:no-repeat;image-rendering:auto;filter:drop-shadow(0 4px 7px #0009);transform:rotate(var(--base-rot,0deg));transform-origin:center}.boss-assembled-card{align-items:center}.boss-assembled-card figcaption{text-align:center}@keyframes boss-layer-drift{from{transform:translate3d(var(--drift-x-neg),var(--drift-y-neg),0)}to{transform:translate3d(var(--drift-x),var(--drift-y),0)}}@keyframes boss-layer-spin{from{transform:rotate(var(--base-rot,0deg))}to{transform:rotate(calc(var(--base-rot,0deg) + var(--spin,360deg)))}}
.boss-sprite-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.boss-part{display:grid;gap:8px;align-content:start;padding:10px;background:#101923;border:1px solid var(--line);border-radius:8px}.boss-part .media-card{min-height:120px;background:#0a1118}.boss-part dl{display:grid;grid-template-columns:auto 1fr;gap:2px 8px;margin:0;color:var(--muted);font-size:12px}.boss-part dd{margin:0;color:#d7e6f3}
@media(max-width:900px){.entity-hero{grid-template-columns:1fr}.stat-grid.compact{min-width:0}.hero-main h1{font-size:32px}.hero-visual{justify-self:start}}@media(max-width:760px){header{align-items:flex-start;flex-direction:column}.site-search{width:100%;max-width:none}.listing{columns:1}.home-hero{flex-direction:column;align-items:flex-start}.home-hero img{width:70%}}`;
  ensureDir(path.join(DIST_DIR, "assets"));
  fs.writeFileSync(path.join(DIST_DIR, "assets", "favicon.ico"), Buffer.from("AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "base64"));
  fs.writeFileSync(path.join(DIST_DIR, "assets", "site.css"), css, "utf8");

  const js = `const SEARCH_INDEX=${JSON.stringify(searchEntries)};
const MAP_BACKGROUND=${JSON.stringify(mapBackground)};
const input=document.getElementById("search-input");
const results=document.getElementById("search-results");
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const tableRank={Guides:0,Commodities:1,Weapons:2,ArtifactTypes:3,Enemies:4,Bosses:5,Bodies:6,SolarSystems:7,Drops:8};
function searchScore(item,q){
  const name=String(item.name||"").toLowerCase();
  const table=String(item.table||"").toLowerCase();
  const type=String(item.type||"").toLowerCase();
  if(name===q)return 0;
  if(name.startsWith(q))return 1;
  if(name.split(/\\s+/).some(part=>part.startsWith(q)))return 2;
  if(name.includes(q))return 3;
  if(table.includes(q))return 4;
  if(type.includes(q))return 5;
  return 99;
}
if(input&&results){input.addEventListener("input",()=>{const q=input.value.trim().toLowerCase();if(q.length<2){results.hidden=true;results.innerHTML="";return;}const hits=SEARCH_INDEX.map(x=>({x,score:searchScore(x,q)})).filter(item=>item.score<99).sort((a,b)=>a.score-b.score||(tableRank[a.x.table]??20)-(tableRank[b.x.table]??20)||a.x.name.localeCompare(b.x.name,navigator.language||'en',{numeric:true})).slice(0,10).map(item=>item.x);results.innerHTML=hits.map(x=>'<a href="'+x.url+'"><strong>'+esc(x.name)+'</strong><span>'+esc(x.table)+(x.type?' / '+esc(x.type):'')+'</span></a>').join("");results.hidden=hits.length===0;});document.addEventListener("click",e=>{if(!e.target.closest(".site-search"))results.hidden=true;});}
for(const table of document.querySelectorAll('table.sortable')){for(const th of table.querySelectorAll('th')){th.tabIndex=0;th.addEventListener('click',()=>sortTable(table,[...th.parentNode.children].indexOf(th)));th.addEventListener('keydown',e=>{if(e.key==='Enter')sortTable(table,[...th.parentNode.children].indexOf(th));});}}
function sortTable(table,col){const body=table.tBodies[0];const rows=[...body.rows];const asc=table.dataset.sortCol!=col||table.dataset.sortDir==='desc';rows.sort((a,b)=>a.cells[col].innerText.localeCompare(b.cells[col].innerText,navigator.language||'en',{numeric:true}));if(!asc)rows.reverse();table.dataset.sortCol=col;table.dataset.sortDir=asc?'asc':'desc';rows.forEach(r=>body.appendChild(r));}
for(const filter of document.querySelectorAll('.table-filter')){const table=filter.nextElementSibling?.querySelector('table');if(!table)continue;filter.addEventListener('input',()=>{const q=filter.value.toLowerCase();for(const row of table.tBodies[0].rows){row.hidden=!row.innerText.toLowerCase().includes(q);}});}
for(const sprite of document.querySelectorAll('.atlas-sprite[data-frames]')){let frames=[];try{frames=JSON.parse(sprite.dataset.frames)}catch{}if(frames.length<2)continue;let i=0;setInterval(()=>{i=(i+1)%frames.length;sprite.setAttribute('style',frames[i].style);sprite.setAttribute('aria-label',frames[i].name);},180);}
for(const panel of document.querySelectorAll('.filter-panel[data-table-filter]')){const table=document.getElementById(panel.dataset.tableFilter);if(!table||!table.tBodies[0])continue;const controls=[...panel.querySelectorAll('input,select')];const apply=()=>{for(const row of table.tBodies[0].rows){let ok=true;for(const control of controls){if(control.type==='checkbox'&&control.dataset.filterFlag){if(control.checked&&row.dataset[control.dataset.filterFlag]!=='1')ok=false;continue;}const value=String(control.value||'').trim().toLowerCase();if(!value)continue;if('filterText' in control.dataset){const text=(row.dataset.search||row.innerText).toLowerCase();if(!text.includes(value))ok=false;}if(control.dataset.filterAttr){if(String(row.dataset[control.dataset.filterAttr]||'').toLowerCase()!==value)ok=false;}if(control.dataset.filterContains){if(!String(row.dataset[control.dataset.filterContains]||'').toLowerCase().includes(value))ok=false;}if(control.dataset.filterMin){if(Number(row.dataset[control.dataset.filterMin]||0)<Number(value))ok=false;}if(control.dataset.filterMax){if(Number(row.dataset[control.dataset.filterMax]||0)>Number(value))ok=false;}if(control.dataset.filterBetween){const min=Number(row.dataset[control.dataset.filterBetween+'Min']||0);const max=Number(row.dataset[control.dataset.filterBetween+'Max']||0);const n=Number(value);if(n<min||n>max)ok=false;}}row.hidden=!ok;}};controls.forEach(c=>c.addEventListener('input',apply));controls.forEach(c=>c.addEventListener('change',apply));}
for(const box of document.querySelectorAll('.elite-calculator')){const from=box.querySelector('.elite-from');const to=box.querySelector('.elite-to');const out=box.querySelector('.elite-result');const cost=(lvl,total)=>Math.round(Math.pow(1.025,lvl-1)/432.548654*total);const sum=(a,b,total)=>{let s=0;for(let i=Math.max(1,a);i<=Math.min(100,b);i++)s+=cost(i,total);return s;};const fmt=n=>Number(n||0).toLocaleString('en-US');const update=()=>{const a=Number(from.value)+1;const b=Number(to.value);if(!out)return;if(b<a){out.textContent='Choose a target above the current level.';return;}out.textContent='Cost '+fmt(sum(a,b,3200000))+' primary, '+fmt(sum(a,b,540000))+' secondary, or '+fmt(sum(a,b,12000))+' Flux.';};from?.addEventListener('input',update);to?.addEventListener('input',update);update();}
for(const calc of document.querySelectorAll('#artifact-calculator')){let data=[];try{data=JSON.parse(calc.dataset.artifacts||'[]')}catch{}const target=calc.querySelector('#artifact-target');const level=calc.querySelector('#artifact-level');const drop=calc.querySelector('#artifact-drop-chance');const attempts=calc.querySelector('#artifact-attempts');const out=calc.querySelector('#artifact-result');const update=()=>{const selected=data.find(x=>x.url&&target?.selectedOptions[0]?.textContent===x.name)||data.find(x=>x.name===target?.selectedOptions[0]?.textContent);const lvl=Number(level?.value||1);const eligible=data.filter(x=>lvl>=Number(x.minLevel||1)&&lvl<=Number(x.maxLevel||150));const total=eligible.reduce((s,x)=>s+Number(x.dropRate||0),0);const hit=eligible.find(x=>x.name===selected?.name);const typeChance=total&&hit?Number(hit.dropRate||0)/total:0;const perTry=typeChance*(Number(drop?.value||0)/100);const tries=Math.max(1,Number(attempts?.value||1));const chance=1-Math.pow(1-perTry,tries);if(out)out.textContent=(hit?hit.name:'Target')+': '+(100*typeChance).toFixed(2)+'% of eligible artifact rolls, '+(100*chance).toFixed(2)+'% after '+tries+' attempts.';};[target,level,drop,attempts].forEach(x=>x?.addEventListener('input',update));[target,level,drop,attempts].forEach(x=>x?.addEventListener('change',update));update();}
function initGalaxyMap(id,systems,warpPaths,routes){const canvas=document.getElementById(id);if(!canvas)return;const ctx=canvas.getContext('2d');const controls=document.querySelector('[data-map-controls="'+id+'"]');const search=controls?.querySelector('input[type=search]');const galaxy=controls?.querySelector('select');const pathsToggle=controls?.querySelector('input[type=checkbox]');const readout=document.getElementById(id+'-readout');const bg=new Image();bg.src=MAP_BACKGROUND?.url||'/assets/source-images/background.jpg';const xs=systems.map(s=>Number(s.x||0));const ys=systems.map(s=>Number(s.y||0));const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);const color=g=>{let h=0;for(const c of String(g||''))h=(h*31+c.charCodeAt(0))%360;return 'hsl('+h+' 78% 66%)';};const scale=(v,min,max,size)=>max===min?size/2:70+((v-min)/(max-min))*(size-140);let points=[];let pointByKey=new Map();function pathEnds(path){return{a:path.solarSystem1||path.stats?.solarSystem1,b:path.solarSystem2||path.stats?.solarSystem2,transit:Boolean(path.transit||path.stats?.transit),name:path.name||path.stats?.name||''};}function drawBackground(){const grad=ctx.createLinearGradient(0,0,canvas.width,canvas.height);grad.addColorStop(0,'#02060b');grad.addColorStop(.48,'#081522');grad.addColorStop(1,'#02050a');ctx.fillStyle=grad;ctx.fillRect(0,0,canvas.width,canvas.height);if(bg.complete&&bg.naturalWidth){ctx.save();ctx.globalAlpha=(MAP_BACKGROUND&&MAP_BACKGROUND.url&&MAP_BACKGROUND.url.includes('texture_gui')) ? .92 : .36;if(MAP_BACKGROUND&&Number.isFinite(MAP_BACKGROUND.x)){ctx.drawImage(bg,MAP_BACKGROUND.x,MAP_BACKGROUND.y,MAP_BACKGROUND.width,MAP_BACKGROUND.height,0,0,canvas.width,canvas.height);}else{ctx.drawImage(bg,0,0,canvas.width,canvas.height);}ctx.restore();}ctx.fillStyle='rgba(1,5,10,.38)';ctx.fillRect(0,0,canvas.width,canvas.height);for(let i=0;i<170;i++){const x=(i*97+53)%canvas.width;const y=(i*193+29)%canvas.height;const r=i%17===0?1.6:i%5===0?1.1:.7;ctx.globalAlpha=.18+(i%7)*.045;ctx.fillStyle=i%9===0?'#b7efff':'#ffffff';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}function visibleSystems(){const q=(search?.value||'').trim().toLowerCase();const g=galaxy?.value||'';const base=systems.filter(s=>(!g||s.galaxy===g));if(!q)return base.map(s=>({s,match:false,neighbor:false}));const matched=new Set(base.filter(s=>String(s.name||'').toLowerCase().includes(q)).map(s=>s.key));const linked=new Set(matched);for(const path of warpPaths){const ends=pathEnds(path);if(matched.has(ends.a))linked.add(ends.b);if(matched.has(ends.b))linked.add(ends.a);}return base.filter(s=>linked.has(s.key)).map(s=>({s,match:matched.has(s.key),neighbor:!matched.has(s.key)}));}function drawPath(a,b,transit,selected){const dx=b.x-a.x,dy=b.y-a.y,len=Math.max(1,Math.hypot(dx,dy));const sx=a.x+dx/len*(a.r+3),sy=a.y+dy/len*(a.r+3);const ex=b.x-dx/len*(b.r+3),ey=b.y-dy/len*(b.r+3);ctx.strokeStyle=selected?'rgba(255,255,255,.72)':transit?'rgba(110,231,249,.5)':'rgba(255,180,84,.38)';ctx.lineWidth=transit?2.2:1.4;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();if(transit){const angle=Math.atan2(dy,dx);for(const t of [.22,.78]){const x=sx+(ex-sx)*t,y=sy+(ey-sy)*t;ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle='rgba(110,231,249,.75)';ctx.beginPath();ctx.moveTo(7,0);ctx.lineTo(-5,-4);ctx.lineTo(-5,4);ctx.closePath();ctx.fill();ctx.restore();}}}function draw(){const q=(search?.value||'').trim().toLowerCase();drawBackground();const display=visibleSystems();points=display.map(item=>({s:item.s,match:item.match,neighbor:item.neighbor,x:scale(Number(item.s.x||0),minX,maxX,canvas.width),y:scale(Number(item.s.y||0),minY,maxY,canvas.height),r:Math.max(5,Math.min(14,Number(item.s.size||7)))}));pointByKey=new Map(points.map(p=>[p.s.key,p]));if(pathsToggle?.checked!==false){for(const path of warpPaths){const ends=pathEnds(path);const a=pointByKey.get(ends.a);const b=pointByKey.get(ends.b);if(!a||!b)continue;if(q&&!(a.match||b.match))continue;drawPath(a,b,ends.transit,q&&(a.match||b.match));}}for(const p of points){const systemColor=p.s.type&&String(p.s.type).includes('pvp')?'#ffb454':color(p.s.galaxy);ctx.globalAlpha=p.neighbor ? .72 : 1;ctx.beginPath();ctx.fillStyle=systemColor;ctx.shadowColor=systemColor;ctx.shadowBlur=p.match?18:10;ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();if(p.match){ctx.lineWidth=2;ctx.strokeStyle='#fff';ctx.stroke();}ctx.shadowBlur=0;ctx.globalAlpha=1;ctx.fillStyle='#e6edf3';ctx.font=(p.match?'600 ':'')+'13px system-ui';if(canvas.width>800||p.r>8)ctx.fillText(p.s.name,p.x+p.r+5,p.y+4);}}function pick(e){const box=canvas.getBoundingClientRect();const mx=(e.clientX-box.left)*canvas.width/box.width;const my=(e.clientY-box.top)*canvas.height/box.height;return points.find(p=>Math.hypot(mx-p.x,my-p.y)<=p.r+7);}canvas.addEventListener('mousemove',e=>{const hit=pick(e);canvas.style.cursor=hit?'pointer':'default';if(readout){if(hit){const links=(hit.s.links||[]).slice(0,5).map(x=>x.name).join(', ');readout.textContent=hit.s.name+' / '+(hit.s.galaxy||'Unknown galaxy')+' / '+(hit.s.type||'regular')+' / coords '+hit.s.x+', '+hit.s.y+(links?' / links: '+links:'');}else{readout.textContent='Hover a system to inspect level range, galaxy, coordinates, and connected systems.';}}});canvas.addEventListener('click',e=>{const hit=pick(e);if(hit&&routes[hit.s.key])location.href=routes[hit.s.key];});[search,galaxy,pathsToggle].forEach(x=>x?.addEventListener('input',draw));[search,galaxy,pathsToggle].forEach(x=>x?.addEventListener('change',draw));bg.onload=draw;draw();}
window.initGalaxyMap=initGalaxyMap;`;
  fs.writeFileSync(path.join(DIST_DIR, "assets", "search.js"), js, "utf8");
}

function buildSearchEntries(manifest, cache) {
  const entries = [];
  for (const items of Object.values(manifest)) {
    for (const item of items) {
      const [table, key] = item.id.split(":");
      if (table === "SolarSystems" && String(item.name || "").trim().toLowerCase() === "dev") continue;
      entries.push({
        name: item.name,
        table,
        type: cache[table]?.[key]?.type || "",
        url: `/${item.slug}.html`
      });
    }
  }
  for (const [name, href, type] of GUIDE_PAGES) {
    entries.push({ name, table: "Guides", type, url: `/${href}` });
  }
  return entries;
}

function buildMediaPage(cache, media) {
  const imageRows = Object.entries(cache.Images || {}).slice(0, 300).map(([key, image]) => {
    const preview = renderImageThumb(image, media);
    return `<tr><td>${preview}${escapeHtml(image.fileName || "")}</td><td>${escapeHtml(image.type || "")}</td><td>${escapeHtml(image.textureName || "")}</td><td>${escapeHtml(mediaImageStatus(image, media))}</td></tr>`;
  }).join("\n");
  const soundRows = Object.entries(cache.Sounds || {}).map(([_key, sound]) => {
    const local = media.byGameFile.get(sound.fileName);
    const player = local ? `<audio controls preload="none" src="${escapeAttr(local.url)}"></audio>` : "";
    return `<tr><td>${escapeHtml(sound.fileName || "")}</td><td>${escapeHtml(sound.type || "")}</td><td>${escapeHtml(sound.volume ?? "")}</td><td>${local ? "available" : "not found"}</td><td>${player}</td></tr>`;
  }).join("\n");
  const body = `<h1>Media</h1>
<p>GameFS texture atlases and audio files are indexed locally when available. Sprites are rendered from atlas XML regions, not only standalone image files.</p>
<h2>Images</h2>
<input class="table-filter" name="table-filter" placeholder="Filter images">
<div class="table-wrap"><table class="sortable filterable"><thead><tr><th>File</th><th>Type</th><th>Texture</th><th>Status</th></tr></thead><tbody>${imageRows}</tbody></table></div>
<h2>Sounds</h2>
<input class="table-filter" name="table-filter" placeholder="Filter sounds">
<div class="table-wrap"><table class="sortable filterable"><thead><tr><th>File</th><th>Type</th><th>Volume</th><th>Status</th><th>Preview</th></tr></thead><tbody>${soundRows}</tbody></table></div>`;
  writePage(path.join(DIST_DIR, "media", "index.html"), "Media", body);
}

function main() {
  const manifest = readJson(path.join(INDEX_DIR, "content-manifest.json"));
  const tables = readJson(path.join(INDEX_DIR, "tables.json"));
  const warnings = readJson(path.join(INDEX_DIR, "warnings.json"));
  const graph = readJson(path.join(INDEX_DIR, "graph.json"));
  const cache = readJson(path.join(RAW_DIR, "cache.json"));
  const map = prepareMapData(readJson(path.join(INDEX_DIR, "galaxy-map.json")), cache);
  const routes = routeMap(manifest);

  cleanDir(DIST_DIR);
  const media = copyMediaAssets(cache);
  writeAssets(buildSearchEntries(manifest, cache), media);
  buildIndex(manifest, tables, warnings, media, map);
  buildContentPages(manifest, cache, media, graph, routes);
  buildMapPage(map, manifest);
  buildMediaPage(cache, media);
  buildGuidePages(cache, manifest, media, routes);

  const listings = {
    systems: ["Systems", manifest.SolarSystems || [], "SolarSystems"],
    bodies: ["Bodies", manifest.Bodies || [], "Bodies"],
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
