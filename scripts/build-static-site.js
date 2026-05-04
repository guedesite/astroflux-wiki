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
  ["Travel Guide", "guides/travel.html", "Systems, locations, shops, and hostiles"],
  ["Stations", "stations/", "Filter shops, warp gates, research, hangars, cantinas, and recycle stations"]
];

const STATION_TYPES = new Set(["paintShop", "warpGate", "research", "shop", "junk yard", "hangar", "cantina"]);

const DESTROYED_SYSTEMS = new Map([
  ["DrMy6JjyO0OI0ui7c80bNw", {
    status: "Destroyed",
    access: "Not selectable on the game star map unless it is the current system.",
    note: "The game client hard-codes Azuron as destroyed in SolarSystem.isDestroyed(). The wiki keeps the page visible so players can still inspect the remaining data, lore hooks, locations, and links."
  }]
]);

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

const UNIQUE_ARTIFACT_ICON_HINTS = {
  artifact_unique_armorlock_protocol: { stat: "damageReductionWhileStationaryUnique", confidence: "inferred-stat" },
  artifact_unique_bloodline_surge: { stat: "bloodlineSurge", confidence: "direct-stat-name" },
  artifact_unique_bullwark_prism: { stat: "damageReductionWithLowShieldUnique", confidence: "inferred-stat" },
  artifact_unique_cleaner: { bossNames: ["The Cleaner"], confidence: "boss-sprite-match" },
  artifact_unique_crown_of_xhersix: { stat: "crownOfXhersix", bossNames: ["Three Emperors"], confidence: "direct-stat-name" },
  artifact_unique_eternal_aegis: { stat: "damageReductionUnique", confidence: "inferred-stat" },
  artifact_unique_fist_of_zharix: { stat: "fistOfZharix", bossNames: ["Three Emperors"], confidence: "direct-stat-name" },
  artifact_unique_hyper_acid_splicer: { stat: "corrosiveChanceToIgnite", confidence: "inferred-stat" },
  artifact_unique_impact_emitter_core: { stat: "slowDown", confidence: "inferred-stat" },
  artifact_unique_legacy_core: { stat: "upgrade", confidence: "inferred-stat" },
  artifact_unique_lunacite_core: { stat: "lucaniteCore", confidence: "direct-stat-name" },
  artifact_unique_mantis_core: { stat: "mantisCore", confidence: "direct-stat-name" },
  artifact_unique_motherbrain: { stat: "overmind", bossNames: ["Mother Brain"], confidence: "boss-sprite-match" },
  artifact_unique_omega_shield_driver: { stat: "energyChanceToShieldOverload", confidence: "inferred-stat" },
  artifact_unique_phase_nullifier: { stat: "kineticChanceToPenetrateShield", confidence: "inferred-stat" },
  artifact_unique_plasma_disruptor_relic: { stat: "reduceEnergyResistance", confidence: "inferred-stat" },
  artifact_unique_ring_of_yxthal: { stat: "reduceKineticResistance", confidence: "inferred-stat" },
  artifact_unique_scourgebinder_core: { stat: "reduceCorrosiveResistance", confidence: "inferred-stat" },
  artifact_unique_tefat: { bossNames: ["Tefat"], confidence: "boss-sprite-match" },
  artifact_unique_thermofang_core: { stat: "thermofangCore", confidence: "direct-stat-name" },
  artifact_unique_titanheart_core: { stat: "damageReductionWithLowHealthUnique", confidence: "inferred-stat" },
  artifact_unique_veil_of_yhgvis: { stat: "veilOfYhgvis", bossNames: ["Three Emperors"], confidence: "direct-stat-name" },
  artifact_unique_velocity_core: { stat: "velocityCore", confidence: "direct-stat-name" },
  artifact_unique_virex_injector: { stat: "dotDamageUnique", confidence: "inferred-stat" }
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

function slugify(value) {
  return String(value || "item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function routeForEntry(entry) {
  const [table] = entry.id.split(":");
  const slug = table === "Bodies" ? entry.slug.replace(/^bodies\//, "stations/") : entry.slug;
  return `/${slug}.html`;
}

function routeMap(manifest, cache = null) {
  const routes = new Map();
  for (const entries of Object.values(manifest)) {
    for (const entry of entries) {
      const [table, key] = entry.id.split(":");
      if (cache && table === "SolarSystems" && !isVisibleMapSystem(cache.SolarSystems?.[key], key)) continue;
      routes.set(entry.id, routeForEntry(entry));
    }
  }
  if (cache) {
    for (const item of uniqueArtifactCatalog(cache)) {
      routes.set(`UniqueArtifacts:${item.key}`, item.url);
    }
  }
  return routes;
}

function entityLink(table, key, cache, routes, fallback = null) {
  key = refKey(table, key);
  if (!table || !key) return missingValue("n/a");
  const id = `${table}:${key}`;
  const record = cache[table]?.[key];
  const label = fallback || (record ? titleFor(record, key) : key);
  const href = routes.get(id);
  return href ? `<a href="${escapeAttr(href)}">${escapeHtml(label)}</a>` : `<span>${escapeHtml(label)}</span>`;
}

function missingValue(label = "n/a") {
  return `<span class="missing-value">${escapeHtml(label)}</span>`;
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
  const links = value.map((item) => entityLink(table, item, cache, routes)).filter((html) => !html.includes('class="missing-value"'));
  return links.length ? links.join(", ") : missingValue();
}

function soundLink(key, cache, routes) {
  return cache.Sounds?.[key] ? entityLink("Sounds", key, cache, routes) : missingValue();
}

function valueLabel(value) {
  if (value === null || value === undefined || value === "") return "n/a";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
  return String(value);
}
function coordinateLabel(value) {
  if (value === null || value === undefined || value === "") return "n/a";
  const num = Number(value);
  if (!Number.isFinite(num)) return "n/a";
  return formatNumber(num * 0.025, 3);
}

function statCard(label, value, hint = "") {
  const missing = value === null || value === undefined || value === "";
  return `<div class="stat-card"><span>${escapeHtml(label)}</span><strong${missing ? ' class="missing-value"' : ""}>${missing ? escapeHtml("n/a") : escapeHtml(valueLabel(value))}</strong>${hint ? `<small>${escapeHtml(hint)}</small>` : ""}</div>`;
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
  const bodyHps = (record.basicObjs || [])
    .map((part) => numberValue(part?.hp, 0))
    .filter((hp) => hp > 0);
  const turretHps = (record.turrets || [])
    .map((part) => numberValue(cache.Ships?.[cache.Turrets?.[part?.turret]?.body]?.hp, 0))
    .filter((hp) => hp > 0);
  const spawnerHps = (record.spawners || [])
    .map((part) => numberValue(cache.Spawners?.[part?.spawner]?.hp, 0))
    .filter((hp) => hp > 0);
  const partHps = [...bodyHps, ...turretHps, ...spawnerHps];
  const totalPartHp = partHps.reduce((sum, hp) => sum + hp, 0);
  const highestPartHp = partHps.length ? Math.max(...partHps) : "";
  const displayHp = directHp !== "" ? directHp : shipHp !== "" ? shipHp : totalPartHp || "";
  const source = directHp !== ""
    ? "boss record"
    : shipHp !== ""
      ? "linked ship"
      : totalPartHp
        ? "sum of body/turret/spawner HP"
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

function dropSourceSummary(dropKey, cache, routes) {
  const sources = dropSourceData(dropKey, cache).slice(0, 3);
  if (!sources.length) return "<span>n/a</span>";
  return sources.map((source) => {
    if (source.table === "Spawners") {
      const context = `${source.body ? entityLink("Bodies", source.body, cache, routes) : "<span>No linked body</span>"}${source.enemy ? ` / ${entityLink("Enemies", source.enemy, cache, routes)}` : ""}${source.boss ? ` / ${entityLink("Bosses", source.boss, cache, routes)}` : ""}`;
      return `${entityLink(source.table, source.key, cache, routes)}<br><span class="muted">${context}</span>`;
    }
    return `${entityLink(source.table, source.key, cache, routes)}<br><span class="muted">${escapeHtml(source.context)}</span>`;
  }).join("<br>");
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
      if (!item.available) continue;
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

function artifactStatNumber(type, value) {
  const base = artifactBaseType(type);
  const v = numberValue(value);
  switch (base) {
    case "healthAdd": return 2 * v;
    case "healthMulti": return 1.35 * v;
    case "armorAdd": return 7.5 * v;
    case "corrosiveAdd":
    case "energyAdd":
    case "kineticAdd": return 4 * v;
    case "shieldAdd": return 1.75 * v;
    case "shieldMulti": return 1.35 * v;
    case "allAdd":
    case "allMulti": return 1.5 * v;
    case "speed": return 0.2 * v;
    case "refire": return 0.3 * v;
    case "convHp":
    case "convShield": return -Math.min(100, 0.1 * v);
    case "powerReg": return 0.15 * v;
    case "powerMax": return 1.5 * v;
    case "cooldown": return 0.1 * v;
    default: return v;
  }
}

function artifactNumericRange(record) {
  const min = record.add ? record.addMinValue : record.multiMinValue;
  const max = record.add ? record.addMaxValue : record.multiMaxValue;
  const raw = [min, max].filter((value) => value !== undefined && value !== null && value !== "");
  if (!raw.length) return { min: "", max: "" };
  const values = raw.map((value) => artifactStatNumber(record.type, value));
  return { min: Math.min(...values), max: Math.max(...values) };
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

function uniqueArtifactLabelFromTexture(textureName) {
  return String(textureName || "")
    .replace(/^artifact_unique_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bOf\b/g, "of");
}

function normalizedLookupName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function uniqueDropEntry(cache) {
  return Object.entries(cache.Drops || {}).find(([, drop]) => /unique artifact/i.test(drop.name || ""));
}

function artifactDropEntries(record, cache) {
  return (record?.drops || []).filter((item) => {
    const drop = cache.Drops?.[item.drop];
    return numberValue(drop?.artifactChance, 0) > 0 || /artifact/i.test(drop?.name || item.name || "");
  });
}

function uniqueArtifactCatalog(cache) {
  const bossByName = new Map(Object.entries(cache.Bosses || {}).map(([key, boss]) => [normalizedLookupName(titleFor(boss, key)), { key, boss }]));
  return Object.entries(cache.Images || {})
    .filter(([, image]) => /^artifact_unique_/i.test(image.textureName || ""))
    .map(([imageKey, image]) => {
      const textureName = image.textureName || "";
      const hint = UNIQUE_ARTIFACT_ICON_HINTS[textureName] || {};
      const label = uniqueArtifactLabelFromTexture(textureName);
      const bossNames = [...(hint.bossNames || [])];
      const textureBoss = bossByName.get(normalizedLookupName(label));
      if (textureBoss && !bossNames.includes(titleFor(textureBoss.boss, textureBoss.key))) bossNames.push(titleFor(textureBoss.boss, textureBoss.key));
      const bossKeys = bossNames
        .map((name) => bossByName.get(normalizedLookupName(name))?.key)
        .filter(Boolean);
      return {
        key: textureName,
        slug: `artifacts/unique/${slugify(label)}`,
        url: `/artifacts/unique/${slugify(label)}.html`,
        imageKey,
        image,
        label,
        stat: hint.stat || "",
        confidence: hint.confidence || (bossKeys.length ? "boss-sprite-match" : "sprite-only"),
        bossKeys
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

function uniqueArtifactSourceStatus(item, cache) {
  const hasStat = item.stat && UNIQUE_ARTIFACT_TYPES.has(item.stat);
  if (item.bossKeys.length && hasStat) return "Boss sprite match + unique stat";
  if (item.bossKeys.length) return "Boss sprite match";
  if (item.confidence === "direct-stat-name") return "Direct unique stat";
  if (hasStat) return "Inferred unique stat";
  return "Sprite only";
}

function uniqueArtifactEffectRole(item) {
  const text = `${item.stat ? artifactStatLabel(item.stat) : ""} ${item.stat ? (UNIQUE_ARTIFACT_DESCRIPTIONS[item.stat] || "") : ""}`.toLowerCase();
  const buffMatch = /(increase|adds?|improv|boost|grant|regen|recovery|heal|leech|doubles?)/.test(text);
  const debuffMatch = /(reduce|reduces|reduc|slow|disable|ignite|overload|penetrat|drain|shockwave|reflect)/.test(text);
  if (buffMatch && debuffMatch) return "Mixed";
  if (debuffMatch) return "Debuff";
  if (buffMatch) return "Buff";
  if (item.stat) return "Utility";
  return "Unknown";
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

function uniqueArtifactRowNotes(item) {
  if (item.stat && UNIQUE_ARTIFACT_TYPES.has(item.stat)) {
    return UNIQUE_ARTIFACT_DESCRIPTIONS[item.stat] || artifactStatLabel(item.stat);
  }
  return "The downloaded client cache does not expose a fixed stat type or value for this sprite.";
}

function uniqueArtifactMainRows(cache, media, routes) {
  return uniqueArtifactCatalog(cache).map((item) => {
    const statText = item.stat && UNIQUE_ARTIFACT_TYPES.has(item.stat)
      ? `${artifactStatLabel(item.stat)}: ${UNIQUE_ARTIFACT_DESCRIPTIONS[item.stat] || item.stat}`
      : "Fixed stat not exposed by the downloaded client cache";
    return `<tr data-search="${escapeAttr(`${item.label} ${item.stat} ${uniqueArtifactSourceStatus(item, cache)} ${item.bossKeys.map((bossKey) => titleFor(cache.Bosses?.[bossKey], bossKey)).join(" ")} ${UNIQUE_ARTIFACT_DESCRIPTIONS[item.stat] || ""}`)}" data-stat="${escapeAttr(item.stat || "")}" data-role="${escapeAttr(uniqueArtifactEffectRole(item))}" data-source-status="${escapeAttr(uniqueArtifactSourceStatus(item, cache))}"><td>${renderImageThumb(item.image, media)}<a href="${escapeAttr(item.url)}">${escapeHtml(item.label)}</a></td><td>${escapeHtml(statText)}${item.stat ? `<br><code class="source-key">${escapeHtml(item.stat)}</code>` : ""}</td><td>${escapeHtml(uniqueArtifactEffectRole(item))}</td><td>${uniqueArtifactBossSummary(item, cache, routes)}</td><td class="missing-value">unknown</td><td>${escapeHtml(uniqueArtifactRowNotes(item))}</td></tr>`;
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
    return `<tr data-search="${escapeAttr(`${item.label} ${item.stat} ${uniqueArtifactSourceStatus(item, cache)} ${item.bossKeys.map((bossKey) => titleFor(cache.Bosses?.[bossKey], bossKey)).join(" ")}`)}"><td>${renderImageThumb(item.image, media)}<a href="${escapeAttr(item.url)}">${escapeHtml(item.label)}</a></td><td>${escapeHtml(statText)}${item.stat ? `<br><code class="source-key">${escapeHtml(item.stat)}</code>` : ""}</td><td>${bosses}</td><td>${drop ? entityLink("Drops", drop[0], cache, routes) : "<span>n/a</span>"}</td><td>${escapeHtml(uniqueArtifactSourceStatus(item, cache))}</td></tr>`;
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

function bossImageKeys(record, cache = null) {
  const keys = [];
  if (record.bitmap) keys.push(record.bitmap);
  for (const obj of record.basicObjs || []) {
    if (obj?.bitmap) keys.push(obj.bitmap);
  }
  if (cache) {
    for (const mount of record.turrets || []) {
      const turretKey = mount?.turret || refKey("Turrets", mount);
      const shipKey = cache.Turrets?.[turretKey]?.body;
      const bitmap = shipKey ? cache.Ships?.[shipKey]?.bitmap : "";
      if (bitmap) keys.push(bitmap);
    }
    for (const mount of record.spawners || []) {
      const spawnerKey = mount?.spawner || refKey("Spawners", mount);
      const bitmap = cache.Spawners?.[spawnerKey]?.bitmap;
      if (bitmap) keys.push(bitmap);
    }
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

function pageShell(title, body, nav = "", assetPrefix = "") {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} - Astroflux Wiki</title>
  <link rel="icon" href="${assetPrefix}favicon.ico">
  <link rel="stylesheet" href="${assetPrefix}site.css">
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
      <a href="/stations/">Stations</a>
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
  <script src="${assetPrefix}search.js"></script>
</body>
</html>`;
}

function writePage(file, title, body, nav = "") {
  ensureDir(path.dirname(file));
  const assetPrefix = path.relative(path.dirname(file), path.join(DIST_DIR, "assets"));
  const normalizedPrefix = assetPrefix ? `${assetPrefix.replace(/\\/g, "/")}/` : "";
  fs.writeFileSync(file, pageShell(title, body, nav, normalizedPrefix), "utf8");
}

function writeRootIndexPage(sourceFile, targetFile) {
  const html = fs.readFileSync(sourceFile, "utf8").replace(/(["'])\/(?!\/)/g, "$1dist/");
  fs.writeFileSync(targetFile, html, "utf8");
}

function buildContentPages(manifest, cache, media, graph, routes) {
  for (const entries of Object.values(manifest)) {
    for (const entry of entries) {
      const output = path.join(DIST_DIR, routeForEntry(entry).slice(1));
      const [table, key] = entry.id.split(":");
      const record = cache[table]?.[key];
      if (!record) continue;
      if (table === "SolarSystems" && !isVisibleMapSystem(record, key)) continue;
      writePage(output, entry.name, renderEntityPage(table, key, record, cache, media, graph, routes));
    }
  }
}

function renderEntityPage(table, key, record, cache, media, graph, routes) {
  if (table === "SolarSystems") {
    return [
      renderPlayerSections(table, key, record, cache, media, routes),
      renderMediaPanel(table, record, cache, media),
      renderRelations(table, key, cache, graph, routes),
      renderAdvancedDetails(table, key, record)
    ].filter(Boolean).join("\n");
  }
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
    Bodies: "Station / location",
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

function sourceTableDisplayName(table) {
  return ({
    Bodies: "Stations / locations"
  })[table] || table;
}

function primaryImageKey(table, record, cache) {
  if (table === "Enemies") return cache.Ships?.[record.ship]?.bitmap || record.bitmap || "";
  if (table === "Bosses") return cache.Ships?.[record.ship]?.bitmap || record.bitmap || bossImageKeys(record, cache)[0] || "";
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
    return `<tr><td><a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${entityLink("SolarSystems", body.solarSystem, cache, routes)}</td><td>${escapeHtml(valueLabel(body.type))}</td><td>${escapeHtml(valueLabel(body.level))}</td><td>${escapeHtml(valueLabel(body.landable))}</td><td>${escapeHtml(valueLabel((body.shopItems || []).length))}</td><td>${escapeHtml(valueLabel(spawnersByBody.get(key) || 0))}</td><td>${escapeHtml(coordinateLabel(body.x))}, ${escapeHtml(coordinateLabel(body.y))}</td></tr>`;
  }).join("");
  return `<h1>Bodies and Locations</h1><p class="muted">Locations are grouped around systems. Use shop count and hostile count to find practical destinations quickly.</p><input class="table-filter" name="table-filter" placeholder="Filter locations"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Location</th><th>System</th><th>Type</th><th>Level</th><th>Landable</th><th>Shop items</th><th>Hostiles</th><th>Coords</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderDropListing(entries, cache, routes) {
  const rows = entries.map((entry) => {
    const key = entryKey(entry);
    const drop = cache.Drops?.[key];
    if (!drop) return "";
    const firstItems = (drop.dropItems || []).slice(0, 4).map((item) => entityLink(item.table, item.item, cache, routes)).join(", ");
    return `<tr><td><a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${dropSourceSummary(key, cache, routes)}</td><td>${escapeHtml(valueLabel(drop.crate))}</td><td>${escapeHtml(percentLabel(drop.crate ? drop.chance ?? 1 : 1))}</td><td>${escapeHtml(percentLabel(drop.artifactChance))}</td><td>${escapeHtml(rangeText(drop.fluxMin, drop.fluxMax))}</td><td>${escapeHtml(rangeText(drop.xpMin, drop.xpMax))}</td><td>${firstItems}</td></tr>`;
  }).join("");
  return `<h1>Drops</h1><p class="muted">Open a drop page to see effective chances and the enemies or bosses that reference it.</p><input class="table-filter" name="table-filter" placeholder="Filter drops"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Drop table</th><th>Where it drops</th><th>Crate</th><th>Crate chance</th><th>Artifact</th><th>Flux</th><th>XP</th><th>Preview items</th></tr></thead><tbody>${rows}</tbody></table></div>`;
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
  const statOptions = [...new Set(artifacts.map(({ record }) => artifactBaseType(record.type)))].sort()
    .map((stat) => `<option value="${escapeAttr(stat)}">${escapeHtml(artifactStatLabel(stat))}</option>`).join("");
  const rarityOptions = [...new Set(artifacts.map(({ record }) => artifactRarityLabel(record)))].sort().map((rarity) => `<option value="${escapeAttr(rarity)}">${escapeHtml(rarity)}</option>`).join("");
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
<div class="table-wrap"><table id="artifact-table" class="sortable filterable"><thead><tr><th>Sprite</th><th>Unique artifact</th><th>Stat family</th><th>Buff / debuff</th><th>Bosses</th><th>Level</th><th>Additional notes</th></tr></thead><tbody>${uniqueRows}</tbody></table></div>`;
}

function isStationBody(body) {
  return STATION_TYPES.has(body?.type);
}

function systemStatusInfo(system, key = "") {
  const destroyed = DESTROYED_SYSTEMS.get(key);
  if (destroyed) return { key: "destroyed", label: destroyed.status, access: destroyed.access, note: destroyed.note };
  if (String(system?.name || "").trim().toLowerCase() === "dev") return { key: "hidden", label: "Hidden", access: "Development system", note: "Filtered out of player navigation pages." };
  return { key: "accessible", label: "Accessible", access: "Selectable", note: "Visible in the player star map data." };
}

function resolvedSystemBodies(systemKey, cache) {
  const entries = Object.entries(cache.Bodies || {}).filter(([, body]) => body.solarSystem === systemKey);
  const byKey = new Map(entries);
  const memo = new Map();
  const positionFor = (bodyKey) => {
    if (memo.has(bodyKey)) return memo.get(bodyKey);
    const body = byKey.get(bodyKey);
    if (!body) return { x: 0, y: 0 };
    let pos;
    if (body.parent && byKey.has(body.parent)) {
      const parent = positionFor(body.parent);
      const angle = numberValue(body.orbitAngle, 0);
      const radius = numberValue(body.orbitRadius, 0);
      pos = {
        x: parent.x + radius * Math.cos(angle),
        y: parent.y + radius * Math.sin(angle)
      };
    } else {
      pos = { x: numberValue(body.x, 0), y: numberValue(body.y, 0) };
    }
    memo.set(bodyKey, pos);
    return pos;
  };
  return entries.map(([bodyKey, body]) => {
    const pos = positionFor(bodyKey);
    return {
      key: bodyKey,
      name: titleFor(body, bodyKey),
      type: body.type || "body",
      level: body.level ?? "",
      x: Math.round(pos.x),
      y: Math.round(pos.y),
      radius: numberValue(body.collisionRadius, 80),
      warningRadius: numberValue(body.warningRadius, 0),
      parent: body.parent || "",
      landable: Boolean(body.landable),
      explorable: Boolean(body.explorable),
      station: isStationBody(body),
      boss: body.type === "boss" ? body.boss || "" : "",
      hidden: body.type === "hidden"
    };
  });
}

function renderSystemLocalMap(systemKey, record, cache, routes) {
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
        bodyName: anchor?.name || "",
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
  const data = {
    name: titleFor(record, systemKey),
    bodies,
    spawners,
    bosses: bossMarkers,
    routes: {
      Bodies: Object.fromEntries(bodies.map((body) => [body.key, routes.get(`Bodies:${body.key}`) || ""])),
      Spawners: Object.fromEntries(spawners.map((spawner) => [spawner.key, routes.get(`Spawners:${spawner.key}`) || ""])),
      Bosses: Object.fromEntries(bossMarkers.map((boss) => [boss.key, routes.get(`Bosses:${boss.key}`) || ""]))
    }
  };
  const canvasId = `system-map-${systemKey.replace(/[^a-z0-9_-]/gi, "").slice(0, 24)}`;
  return `<article class="system-map-card"><h2>System Map</h2><p class="muted">2D placement from body coordinates and orbit data. Yellow rings are elite zones; station, boss, and spawner markers are clickable when a page exists. Use the mouse wheel to zoom and drag to pan.</p><div class="system-map-wrap"><div class="map-toolbar"><button type="button" data-map-action="zoom-out">-</button><button type="button" data-map-action="zoom-reset">Reset</button><button type="button" data-map-action="zoom-in">+</button></div><canvas id="${escapeAttr(canvasId)}" width="1080" height="660" aria-label="${escapeAttr(titleFor(record, systemKey))} local map"></canvas><div class="map-tooltip" id="${escapeAttr(canvasId)}-tooltip" aria-hidden="true"></div><div class="map-readout" id="${escapeAttr(canvasId)}-readout">Hover a marker to inspect location, spawner, boss, or elite-zone data.</div><div class="map-legend"><span><i class="legend-dot" style="background:#ffd166"></i>Sun</span><span><i class="legend-dot" style="background:#6ee7f9"></i>Station</span><span><i class="legend-dot" style="background:#d7f5ff"></i>Body</span><span><i class="legend-dot" style="background:#c792ea"></i>Spawner</span><span><i class="legend-dot" style="background:#ff6b52"></i>Boss</span></div></div><script>window.addEventListener("DOMContentLoaded",()=>initSystemMap("${canvasId}",${JSON.stringify(data)}));</script></article>`;
}

function renderSystemListing(entries, cache, routes) {
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
  const resolved = new Map(resolvedSystemBodies(key, cache).map((body) => [body.key, body]));
  const bodyRows = bodies.map(([bodyKey, body]) => {
    const pos = resolved.get(bodyKey);
    return `<tr><td>${entityLink("Bodies", bodyKey, cache, routes)}</td><td>${escapeHtml(valueLabel(body.type))}</td><td>${escapeHtml(valueLabel(body.level))}</td><td>${escapeHtml(valueLabel(body.landable))}</td><td>${escapeHtml(valueLabel(body.explorable))}</td><td>${escapeHtml(coordinateLabel(pos?.x))}, ${escapeHtml(coordinateLabel(pos?.y))}</td></tr>`;
  }).join("");
  const warpLinks = renderSystemWarpLinks(key, cache, routes);
  const status = systemStatusInfo(record, key);
  const statusNotice = status.key === "destroyed"
    ? `<article class="notice status-notice"><h2>Destroyed System</h2><p>${escapeHtml(status.note)}</p><p class="muted">${escapeHtml(status.access)}</p></article>`
    : "";
  const map = renderSystemLocalMap(key, record, cache, routes);
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

function renderBodyPage(key, record, cache, routes) {
  const spawners = Object.entries(cache.Spawners || {}).filter(([, spawner]) => spawner.body === key);
  const shopRows = (record.shopItems || []).map((item) => `<tr><td>${entityLink(item.table, item.item, cache, routes, item.name)}</td><td>${escapeHtml(valueLabel(item.available))}</td><td>${(item.priceItems || []).map((p) => `${entityLink("Commodities", p.item, cache, routes)} x${escapeHtml(valueLabel(p.amount))}`).join("<br>")}</td></tr>`).join("");
  const spawnerRows = spawners.map(([spawnerKey, spawner]) => `<tr><td>${entityLink("Spawners", spawnerKey, cache, routes, spawner.name || spawnerKey)}</td><td>${entityLink("Enemies", spawner.enemy, cache, routes)}</td><td>${entityLink("Bosses", spawner.bossSpawner, cache, routes)}</td><td>${renderSpawnerDropItems(spawner.drops, cache, routes)}</td><td>${escapeHtml(valueLabel(spawner.level))}</td></tr>`).join("");
  return `<section class="content-grid">
    <article><h2>Location Info</h2><div class="stat-grid">${statCard("System", record.solarSystem ? titleFor(cache.SolarSystems?.[record.solarSystem], record.solarSystem) : "n/a")}${statCard("Safe zone", record.safeZoneRadius)}${statCard("Orbit", record.orbitRadius)}${statCard("Spawners", spawners.length)}</div></article>
    <article><h2>Travel Links</h2><ul class="link-list"><li>System: ${entityLink("SolarSystems", record.solarSystem, cache, routes)}</li><li>Coordinates: ${escapeHtml(coordinateLabel(record.x))}, ${escapeHtml(coordinateLabel(record.y))}</li><li>Type: ${escapeHtml(valueLabel(record.type))}</li></ul></article>
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
  const lootLinks = [...new Set((record.drops || []).map((item) => item.drop).filter(Boolean))]
    .map((dropKey) => entityLink("Drops", dropKey, cache, routes))
    .join(", ");
  const spawnerLinks = [...new Set((record.spawners || []).map((item) => item.spawner).filter(Boolean))]
    .map((spawnerKey) => `<li>Spawner: ${entityLink("Spawners", spawnerKey, cache, routes)}</li>`)
    .join("");
  const turretLinks = [...new Set((record.turrets || []).map((item) => item.turret).filter(Boolean))]
    .map((turretKey) => `<li>Turret: ${entityLink("Turrets", turretKey, cache, routes)}</li>`)
    .join("");
  return `<section class="content-grid"><article><h2>Boss Stats</h2><div class="stat-grid">${statCard("Level", record.level)}${statCard("HP", hp.displayHp !== "" ? formatNumber(hp.displayHp, 0) : "", hp.source)}${statCard("Total part HP", hp.totalPartHp !== "" ? formatNumber(hp.totalPartHp, 0) : "")}${statCard("Highest part HP", hp.highestPartHp !== "" ? formatNumber(hp.highestPartHp, 0) : "")}${statCard("Destructible parts", hp.destructibleParts)}${statCard("XP", record.xp)}${statCard("Regen", record.regen)}${statCard("Radius", record.radius)}${statCard("Speed", record.speed)}${statCard("Reset", record.resetTime)}${statCard("Body sprites", (record.basicObjs || []).length)}${statCard("Turret sprites", (record.turrets || []).length)}${statCard("Spawner sprites", (record.spawners || []).length)}${statCard("Kinetic resist", record.kineticResist)}${statCard("Energy resist", record.energyResist)}${statCard("Corrosive resist", record.corrosiveResist)}</div></article>${renderBossLayeredPreview(record, cache, media)}${renderBossSpriteParts(record, cache, media, routes)}<article><h2>Encounter Links</h2><ul class="link-list"><li>Loot: ${lootLinks || "<span>n/a</span>"}</li><li>Explosion sound: ${entityLink("Sounds", record.explosionSound, cache, routes)}</li>${spawnerLinks}${turretLinks}</ul></article></section>`;
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

function renderUniqueArtifactPage(item, cache, media, routes) {
  const drop = uniqueDropEntry(cache);
  const bossRows = item.bossKeys.map((bossKey) => {
    const boss = cache.Bosses?.[bossKey];
    const artDrops = artifactDropEntries(boss, cache)
      .map((dropItem) => `${entityLink("Drops", dropItem.drop, cache, routes)} x${escapeHtml(rangeText(dropItem.min, dropItem.max))} @ ${escapeHtml(percentLabel(dropItem.chance ?? 1))}`)
      .join("<br>");
    return `<tr><td>${entityLink("Bosses", bossKey, cache, routes)}</td><td>${artDrops || "<span>n/a</span>"}</td></tr>`;
  }).join("");
  const statRows = item.stat && UNIQUE_ARTIFACT_TYPES.has(item.stat)
    ? `<tr><td>${escapeHtml(artifactStatLabel(item.stat))}<br><code class="source-key">${escapeHtml(item.stat)}</code></td><td>${escapeHtml(UNIQUE_ARTIFACT_DESCRIPTIONS[item.stat] || item.stat)}</td><td>No</td></tr>`
    : `<tr><td>Server-generated artifact instance</td><td>The downloaded client cache does not expose a fixed stat type or value for this sprite.</td><td>No, when the received stat is one of <code>ArtifactStat.isUnique</code></td></tr>`;
  const sourceRows = [
    ["Sprite", `Atlas image ${item.imageKey} / ${item.image.textureName}`],
    ["Crate", drop ? `${drop[1].name}: crate ${percentLabel(drop[1].chance)}, artifact ${percentLabel(drop[1].artifactChance)}` : "No unique crate record found"],
    ["How it shows up", "Unique artifacts are spawned from the server and resolved when the item is picked up."],
    ["Stat rule", item.stat ? "This family is marked unique and cannot be upgraded." : "No fixed stat row is present in the downloaded client cache."],
    ["Boss link", item.bossKeys.length ? "The boss name matches the artifact and the boss has drop rows." : "No direct boss match in the client data."]
  ].map(([kind, text]) => `<tr><td>${escapeHtml(kind)}</td><td>${escapeHtml(text)}</td></tr>`).join("");
  return `<section class="entity-hero unique-artifact-hero"><div class="hero-visual">${renderImageCard(item.image, item.imageKey, media, true)}</div><div class="hero-main"><p class="eyebrow">Unique artifact</p><h1>${escapeHtml(item.label)}</h1><span class="pill">${escapeHtml(uniqueArtifactSourceStatus(item, cache))}</span></div><div class="stat-grid compact">${statCard("Upgradeable", "No")}${statCard("Source", drop ? drop[1].name : "Unique crate")}${statCard("Sprite", item.image.textureName)}${statCard("Mapped stat", item.stat ? artifactStatLabel(item.stat) : "Server-side")}</div></section>
<section class="content-grid">
  <article><h2>Stats</h2><div class="table-wrap"><table><thead><tr><th>Stat</th><th>Effect</th><th>Upgradeable</th></tr></thead><tbody>${statRows}</tbody></table></div></article>
  ${bossRows ? `<article><h2>Bosses</h2><div class="table-wrap"><table><thead><tr><th>Boss</th><th>Artifact drop rows</th></tr></thead><tbody>${bossRows}</tbody></table></div></article>` : ""}
  <article><h2>Where It Comes From</h2><div class="table-wrap"><table><thead><tr><th>Source</th><th>Notes</th></tr></thead><tbody>${sourceRows}</tbody></table></div></article>
</section>`;
}

function buildUniqueArtifactPages(cache, media, routes) {
  const rows = uniqueArtifactIconRows(cache, media, routes);
  writePage(path.join(DIST_DIR, "artifacts", "unique", "index.html"), "Unique Artifacts", `<h1>Unique Artifacts</h1><p class="muted">Sprites come from the GameFS atlas, and unique stat families are marked when the client exposes a stable mapping.</p><input class="table-filter" name="table-filter" placeholder="Filter unique artifacts"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Unique artifact</th><th>Stat / effect</th><th>Bosses</th><th>Crate</th><th>Source status</th></tr></thead><tbody>${rows}</tbody></table></div>`);
  for (const item of uniqueArtifactCatalog(cache)) {
    writePage(path.join(DIST_DIR, `${item.slug}.html`), item.label, renderUniqueArtifactPage(item, cache, media, routes));
  }
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
<div class="table-wrap"><table id="artifact-table" class="sortable filterable"><thead><tr><th>Sprite</th><th>Unique artifact</th><th>Stat family</th><th>Buff / debuff</th><th>Bosses</th><th>Level</th><th>Additional notes</th></tr></thead><tbody>${uniqueRows}</tbody></table></div>`;
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

function renderTravelGuide(cache, manifest, routes) {
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

function renderStationsPage(cache, routes) {
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
    const topItems = shopItems.slice(0, 5).map((item) => entityLink(item.table, item.item, cache, routes, item.name)).join(", ");
    const status = systemStatusInfo(system, body.solarSystem);
    return `<tr data-search="${escapeAttr(`${titleFor(body, bodyKey)} ${body.type} ${titleFor(system, body.solarSystem)} ${shopItems.map((item) => item.name || titleFor(cache[item.table]?.[item.item], item.item)).join(" ")}`)}" data-system="${escapeAttr(body.solarSystem)}" data-kind="${escapeAttr(body.type || "")}" data-status="${escapeAttr(status.key)}" data-shop="${escapeAttr(shopItems.length)}"><td>${entityLink("Bodies", bodyKey, cache, routes)}</td><td>${escapeHtml(valueLabel(body.type))}</td><td>${entityLink("SolarSystems", body.solarSystem, cache, routes)}</td><td><span class="status-pill status-${escapeAttr(status.key)}">${escapeHtml(status.label)}</span></td><td>${escapeHtml(valueLabel(body.level))}</td><td>${escapeHtml(valueLabel(body.x))}, ${escapeHtml(valueLabel(body.y))}</td><td>${escapeHtml(valueLabel(shopItems.length))}</td><td>${topItems || "<span>n/a</span>"}</td></tr>`;
    return `<tr data-search="${escapeAttr(`${titleFor(body, bodyKey)} ${body.type} ${titleFor(system, body.solarSystem)} ${shopItems.map((item) => item.name || titleFor(cache[item.table]?.[item.item], item.item)).join(" ")}`)}" data-system="${escapeAttr(body.solarSystem)}" data-kind="${escapeAttr(body.type || "")}" data-status="${escapeAttr(status.key)}" data-shop="${escapeAttr(shopItems.length)}"><td>${entityLink("Bodies", bodyKey, cache, routes)}</td><td>${escapeHtml(valueLabel(body.type))}</td><td>${entityLink("SolarSystems", body.solarSystem, cache, routes)}</td><td><span class="status-pill status-${escapeAttr(status.key)}">${escapeHtml(status.label)}</span></td><td>${escapeHtml(valueLabel(body.level))}</td><td>${escapeHtml(coordinateLabel(body.x))}, ${escapeHtml(coordinateLabel(body.y))}</td><td>${escapeHtml(valueLabel(shopItems.length))}</td><td>${topItems || "<span>n/a</span>"}</td></tr>`;
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

function buildStationsPage(cache, routes) {
  writePage(path.join(DIST_DIR, "stations", "index.html"), "Stations", renderStationsPage(cache, routes));
}

function buildIndex(manifest, tables, warnings, media, map, cache) {
  const guideCards = GUIDE_PAGES.slice(1)
    .map(([label, href, desc]) => `<a class="card" href="/${href}"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(desc)}</span></a>`)
    .join("\n");
  const visibleSystemCount = (manifest.SolarSystems || [])
    .filter((entry) => isVisibleMapSystem(cache.SolarSystems?.[entryKey(entry)], entryKey(entry))).length;
  const cards = [
    ["Systems", "systems", visibleSystemCount],
    ["Stations", "stations", Object.values(cache.Bodies || {}).filter((body) => isStationBody(body) && isVisibleMapSystem(cache.SolarSystems?.[body.solarSystem], body.solarSystem)).length],
    ["Enemies", "enemies", manifest.Enemies?.length ?? 0],
    ["Bosses", "bosses", manifest.Bosses?.length ?? 0],
    ["Weapons", "weapons", manifest.Weapons?.length ?? 0],
    ["Projectiles", "projectiles", manifest.Projectiles?.length ?? 0],
    ["Items", "commodities", manifest.Commodities?.length ?? 0],
    ["Artifacts", "artifacts", manifest.ArtifactTypes?.length ?? 0],
    ["Unique Artifacts", "artifacts/unique", uniqueArtifactCatalog(cache).length],
    ["Drops", "drops", manifest.Drops?.length ?? 0],
    ["Ships", "ships", manifest.Ships?.length ?? 0],
    ["Engines", "engines", manifest.Engines?.length ?? 0],
    ["Turrets", "turrets", manifest.Turrets?.length ?? 0],
    ["Missions", "missions", manifest.MissionTypes?.length ?? 0],
    ["Media", "media", media.imageRecords + media.soundRecords]
  ].map(([label, href, count]) => `<a class="card" href="/${href}/"><strong>${label}</strong><span>${count} pages</span></a>`).join("\n");

  const tableRows = Object.entries(tables)
    .map(([table, count]) => {
      const label = sourceTableDisplayName(table);
      const source = label !== table ? `<span class="source-key">source: ${escapeHtml(table)}</span>` : "";
      return `<tr><td>${escapeHtml(label)}${source}</td><td>${count}</td></tr>`;
    })
    .join("\n");

  const body = `${renderGalaxyMapSection(map, manifest, "home-map", true)}
<section class="home-hero">
  <img src="/assets/source-images/logo.png" alt="Astroflux">
  <div>
    <h1>Astroflux Wiki</h1>
    <p>A player-first reference built from the game client data: enemies, weapons, drops, locations, sprites, sounds, and the links between them.</p>
  </div>
</section>
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
  writeRootIndexPage(path.join(DIST_DIR, "index.html"), path.join(ROOT, "index.html"));
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
  for (const key of bossImageKeys(record, cache)) {
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
  const parts = [];
  const addPart = (obj, index, kind, imageKey, refTable = "", refKeyValue = "") => {
    const image = cache.Images?.[imageKey];
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
      imageKey,
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
      mirror: Boolean(obj.mirror),
      scale: partScale,
      width,
      height,
      boundsWidth: rotated.width,
      boundsHeight: rotated.height,
      isDeadState: /\bdead\b/i.test(obj.name || ""),
      isHiddenAtStart: obj.active === false || obj.hideIfInactive === true,
      kind,
      refTable,
      refKey: refKeyValue
    };
  };
  (record.basicObjs || []).forEach((obj) => {
    const part = obj?.bitmap ? addPart(obj, parts.length, "body", obj.bitmap) : null;
    if (part) parts.push(part);
  });
  (record.turrets || []).forEach((mount) => {
    const turretKey = mount?.turret || refKey("Turrets", mount);
    const turret = cache.Turrets?.[turretKey];
    const ship = cache.Ships?.[turret?.body];
    const bitmap = ship?.bitmap;
    const obj = {
      ...mount,
      name: mount?.name || turret?.name || ship?.name || "Turret",
      hp: ship?.hp,
      bitmap,
      rotationSpeed: mount?.rotationSpeed ?? turret?.rotationSpeed ?? turret?.forcedRotationSpeed ?? 0,
      scale: mount?.scale ?? 1
    };
    const part = bitmap ? addPart(obj, parts.length, "turret", bitmap, "Turrets", turretKey) : null;
    if (part) parts.push(part);
  });
  (record.spawners || []).forEach((mount) => {
    const spawnerKey = mount?.spawner || refKey("Spawners", mount);
    const spawner = cache.Spawners?.[spawnerKey];
    const bitmap = spawner?.bitmap;
    const obj = {
      ...mount,
      name: mount?.name || spawner?.name || "Spawner",
      hp: spawner?.hp,
      bitmap,
      scale: mount?.scale ?? numberValue(spawner?.scale, 1)
    };
    const part = bitmap ? addPart(obj, parts.length, "spawner", bitmap, "Spawners", spawnerKey) : null;
    if (part) parts.push(part);
  });
  return parts;
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
        part.mirror ? "--mirror:-1" : "",
        `--spin:${part.rotationSpeed < 0 ? "-360deg" : "360deg"}`,
        part.rotationSpeed ? `animation-duration:${duration.toFixed(2)}s` : ""
      ].filter(Boolean).join(";");
      const stateClass = `${part.rotationSpeed ? " spinning" : ""}${part.isDeadState ? " dead-state" : ""}${part.isHiddenAtStart ? " hidden-start" : ""} ${part.kind || "body"}-part`;
      const title = [
        part.kind ? `${part.kind} part` : "Boss part",
        part.obj.name || part.image.fileName || "Boss part",
        `layer ${valueLabel(part.layer)}`,
        `angle ${valueLabel(part.angle)}`,
        part.refTable && part.refKey ? `${part.refTable}:${part.refKey}` : "",
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
  const bodyCount = rawParts.filter((part) => part.kind === "body").length;
  const turretCount = rawParts.filter((part) => part.kind === "turret").length;
  const spawnerCount = rawParts.filter((part) => part.kind === "spawner").length;
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
    `${bodyCount} body / ${turretCount} turret / ${spawnerCount} spawner`,
    deadCount ? `${deadCount} dead-state variant${deadCount === 1 ? "" : "s"} included` : "",
    hiddenCount ? `${hiddenCount} initially hidden/triggered part${hiddenCount === 1 ? "" : "s"} included` : "",
    offsetCount ? `${offsetCount} part${offsetCount === 1 ? "" : "s"} use image offset data` : ""
  ].filter(Boolean).join(" / ");
  return `<article><h2>Animated Layer Preview</h2><p class="muted">This assembles boss body sprites, mounted turret sprites, and mounted spawner sprites from their source position, image offset, scale, angle, and layer order. Rotating parts use their source <code>rotationSpeed</code>. ${escapeHtml(notes)}.</p>${stage.html}</article>`;
}

function renderBossSpriteParts(record, cache, media, routes) {
  const parts = bossLayeredParts(record, cache, media);
  if (!parts.length) return "";
  const cards = parts.slice(0, 120).map((part) => {
    const card = renderImageCard(part.image, part.imageKey, media, false);
    const source = part.refTable && part.refKey ? entityLink(part.refTable, part.refKey, cache, routes) : escapeHtml(part.image.fileName || part.imageKey);
    return card ? `<div class="boss-part">${card}<dl><dt>Kind</dt><dd>${escapeHtml(valueLabel(part.kind))}</dd><dt>Part</dt><dd>${escapeHtml(part.obj.name || "Sprite part")}</dd><dt>Source</dt><dd>${source}</dd><dt>Layer</dt><dd>${escapeHtml(valueLabel(part.layer))}</dd><dt>HP</dt><dd>${escapeHtml(valueLabel(part.obj.hp))}</dd><dt>Position</dt><dd>${escapeHtml(valueLabel(part.sourceX))}, ${escapeHtml(valueLabel(part.sourceY))}</dd></dl></div>` : "";
  }).join("");
  return `<article><h2>Boss Sprite Parts</h2><p class="muted">These are the visual parts used in the assembled preview, including <code>basicObjs</code>, mounted turrets, and mounted spawners when the cache exposes their sprites.</p><div class="boss-sprite-grid">${cards}</div></article>`;
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

function renderSystemWarpLinks(key, cache, routes) {
  const links = systemWarpLinks(key, cache);
  if (!links.length) return "";
  const rows = links.map((link) => {
    const status = systemStatusInfo(cache.SolarSystems?.[link.targetKey], link.targetKey);
    return `<tr><td>${entityLink("SolarSystems", link.targetKey, cache, routes, link.targetName)}</td><td><span class="status-pill status-${escapeAttr(status.key)}">${escapeHtml(status.label)}</span></td><td>${escapeHtml(link.transit ? "Transit" : "Warp path")}</td><td>${escapeHtml(link.name)}</td><td>${renderWarpPathPrice(link, cache, routes)}</td></tr>`;
  }).join("");
  return `<article><h2>Connected Systems</h2><p class="muted">These are the travel links from the game's <code>WarpPaths</code> table. Open the target system to continue following the route network.</p><div class="table-wrap"><table class="sortable"><thead><tr><th>Destination</th><th>Status</th><th>Link type</th><th>Warp path</th><th>Unlock cost</th></tr></thead><tbody>${rows}</tbody></table></div></article>`;
}

function collectImageKeys(table, record, cache) {
  const keys = [];
  const primary = primaryImageKey(table, record, cache);
  if (primary) keys.push(primary);
  if (table === "Bosses") keys.push(...bossImageKeys(record, cache));
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
  const css = `:root{color-scheme:dark;--bg:#0b1016;--panel:#121a23;--text:#e6edf3;--muted:#9fb0c0;--missing:#c8d1db;--line:#263545;--accent:#6ee7f9}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
header{position:sticky;top:0;z-index:10;display:flex;gap:18px;align-items:center;padding:12px 20px;background:#0b1016ee;border-bottom:1px solid var(--line);backdrop-filter:blur(8px)}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}.brand{font-weight:700;color:var(--text)}nav{display:flex;gap:14px;flex-wrap:wrap}
main{max-width:1160px;margin:0 auto;padding:28px 20px 56px}h1{font-size:32px;margin:0 0 18px}h2{margin-top:32px;border-bottom:1px solid var(--line);padding-bottom:6px}
.site-footer{border-top:1px solid var(--line);padding:18px 20px;color:var(--muted);text-align:center;background:#080d13}.site-footer p{margin:0}
code{background:#17212b;border:1px solid var(--line);border-radius:4px;padding:1px 4px}.source-key{display:inline-block;margin-top:4px;opacity:.38;font-size:11px}.table-wrap{max-height:min(80vh,760px);overflow:auto;border:1px solid var(--line);border-radius:8px}table{width:100%;border-collapse:separate;border-spacing:0}th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{background:#111b25;color:#fff}.table-wrap thead th{position:sticky;top:0;z-index:2}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:22px 0}.card{display:block;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px}.card strong{display:block;color:var(--text);font-size:18px}.card span,.listing span{display:block;color:var(--muted);font-size:12px}.missing-value{color:var(--missing)!important}.missing-value a,.missing-value code{color:var(--missing)!important}.stat-card strong.missing-value,.stat-card .missing-value{color:var(--missing)!important}
.listing{padding-left:0;list-style:none;columns:2;column-gap:28px}.listing li{break-inside:avoid;padding:8px 0;border-bottom:1px solid var(--line)}
canvas{width:100%;height:auto;border:1px solid var(--line);border-radius:8px;background:#071019}
.site-search{position:relative;min-width:220px;flex:1;max-width:420px}.site-search input{width:100%;height:34px;border:1px solid var(--line);border-radius:6px;background:#111b25;color:var(--text);padding:0 10px}.search-results{position:absolute;top:40px;left:0;right:0;background:#101923;border:1px solid var(--line);border-radius:8px;box-shadow:0 16px 40px #0008;overflow:hidden}.search-results a{display:block;padding:9px 11px;border-bottom:1px solid var(--line);color:var(--text)}.search-results span{display:block;color:var(--muted);font-size:12px}
.home-hero{display:flex;gap:22px;align-items:center;padding:28px;background:linear-gradient(90deg,#121a23,#0d141c);border:1px solid var(--line);border-radius:8px}.home-hero img{max-width:260px;width:32%;min-width:140px}.notice{padding:14px 16px;background:#14202b;border:1px solid var(--line);border-radius:8px;color:#d7e6f3}
.media-panel{margin-bottom:26px}.media-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.media-card{margin:0;display:flex;flex-direction:column;gap:8px;justify-content:center;min-height:104px;padding:12px;background:var(--panel);border:1px solid var(--line);border-radius:8px}.media-card img{max-width:100%;max-height:160px;object-fit:contain}.media-card span,.media-card figcaption{color:var(--muted);font-size:12px}.media-card.missing{border-style:dashed}.media-label{color:var(--muted);text-transform:uppercase;font-size:11px}.atlas-card,.image-card{align-items:center}.atlas-sprite{display:block;background-repeat:no-repeat;image-rendering:auto;filter:drop-shadow(0 8px 12px #0008)}
details.source-details{margin:18px 0;padding:8px 10px;border:1px solid var(--line);border-radius:8px;color:var(--muted);font-size:12px;opacity:.48}details.source-details:hover,details.source-details[open]{opacity:.9}details.source-details summary{cursor:pointer;color:var(--muted)}
.entity-hero{display:grid;grid-template-columns:auto minmax(220px,1fr) minmax(260px,.75fr);gap:22px;align-items:center;margin-bottom:20px;padding:22px;background:#111a24;border:1px solid var(--line);border-radius:8px}.hero-visual .media-card{min-width:180px;min-height:170px;background:#0c131b}.hero-visual figcaption{max-width:220px;text-align:center}.hero-main h1{font-size:38px;line-height:1.05;margin-bottom:10px}.system-first{margin:0 0 22px}.system-title{display:flex;align-items:end;gap:12px;flex-wrap:wrap;margin-bottom:10px}.system-title h1{margin:0;font-size:36px;line-height:1}.system-map-wrap{position:relative}.system-map-card{margin:0}.system-map-card h2{margin-top:0}.map-legend{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;color:var(--muted);font-size:12px}.map-legend span{display:inline-flex;align-items:center;gap:5px}.legend-dot{width:10px;height:10px;border-radius:50%;display:inline-block}.eyebrow{margin:0 0 4px;color:var(--muted);text-transform:uppercase;font-size:12px;letter-spacing:0}.pill{display:inline-block;padding:3px 8px;border:1px solid var(--line);border-radius:999px;color:#d7e6f3;background:#172332}.button-link{display:inline-flex;align-items:center;min-height:34px;padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:#162332;color:var(--text)}.steps{padding-left:22px}.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}.stat-grid.compact{min-width:360px}.stat-card{padding:10px 12px;background:var(--panel);border:1px solid var(--line);border-radius:8px}.stat-card span{display:block;color:var(--muted);font-size:12px}.stat-card strong{display:block;font-size:18px;color:#fff}.stat-card small{display:block;color:var(--muted)}.content-grid{display:grid;gap:18px}.link-list{padding-left:18px}.table-filter{width:100%;max-width:360px;height:32px;margin:0 0 8px;border:1px solid var(--line);border-radius:6px;background:#111b25;color:var(--text);padding:0 10px}.sortable th{cursor:pointer}.muted{color:var(--muted)}.thumb{width:36px;height:36px;object-fit:contain;margin-right:8px;vertical-align:middle}.thumb.atlas-sprite{display:inline-block}
.name-cell .thumb,.name-cell .thumb.atlas-sprite{width:52px;height:52px}.tip{border-bottom:1px dotted #7fa7ba;cursor:help}.filter-panel,.map-controls,.calculator,.elite-calculator{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:12px 0 16px;padding:12px;background:#101923;border:1px solid var(--line);border-radius:8px}.filter-panel input,.filter-panel select,.map-controls input,.map-controls select,.calculator input,.calculator select,.elite-calculator input{height:32px;border:1px solid var(--line);border-radius:6px;background:#0c131b;color:var(--text);padding:0 9px}.filter-panel label,.calculator label,.elite-calculator label{display:inline-flex;gap:6px;align-items:center;color:var(--muted)}.filter-panel input[type=search]{min-width:260px}.check input{height:auto}.calculator output,.elite-calculator output,.map-readout{display:block;min-height:32px;padding:7px 10px;background:#0c131b;border:1px solid var(--line);border-radius:6px;color:#d7e6f3}.map-section{margin:24px 0}.map-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.map-head h2{margin-top:0}.map-section canvas{background:#03070d}.map-readout{margin-top:8px}.map-toolbar{display:inline-flex;gap:6px;flex-wrap:wrap;align-items:center}.map-toolbar button{height:32px;min-width:36px;padding:0 10px;border:1px solid var(--line);border-radius:6px;background:#162332;color:#d7e6f3;cursor:pointer}.map-toolbar button:hover{background:#1b2c41}.source-rank{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;padding:0;list-style:none}.source-rank li{padding:10px 12px;background:var(--panel);border:1px solid var(--line);border-radius:8px}.source-rank strong,.source-rank span,.source-rank small{display:block}.source-rank small{color:var(--muted)}
.boss-layered-preview{position:relative;max-width:100%;overflow:hidden;margin:12px auto 4px;background:radial-gradient(circle at center,#132030 0,#071019 68%);border:1px solid var(--line);border-radius:8px}.boss-layer{position:absolute;display:block;animation:boss-layer-drift 3.6s ease-in-out infinite alternate;will-change:transform}.boss-layer-sprite{display:block;background-repeat:no-repeat;image-rendering:auto;filter:drop-shadow(0 10px 14px #0009);transform:rotate(var(--base-rot,0deg));transform-origin:center}.boss-layer-sprite.spinning{animation:boss-layer-spin linear infinite}.boss-layer-sprite.dead-state{filter:drop-shadow(0 10px 14px #0009) saturate(.82)}.boss-layer-sprite.hidden-start{opacity:.78}.boss-mini-preview,.boss-card-preview{position:relative;display:inline-block;vertical-align:middle;overflow:hidden;background:radial-gradient(circle at center,#132030 0,#071019 70%);border:1px solid var(--line);border-radius:6px}.boss-mini-preview{margin-right:8px}.boss-card-preview{margin:auto}.boss-mini-layer{position:absolute;display:block}.boss-mini-sprite{display:block;background-repeat:no-repeat;image-rendering:auto;filter:drop-shadow(0 4px 7px #0009);transform:rotate(var(--base-rot,0deg));transform-origin:center}.boss-assembled-card{align-items:center}.boss-assembled-card figcaption{text-align:center}@keyframes boss-layer-drift{from{transform:translate3d(var(--drift-x-neg),var(--drift-y-neg),0)}to{transform:translate3d(var(--drift-x),var(--drift-y),0)}}@keyframes boss-layer-spin{from{transform:rotate(var(--base-rot,0deg))}to{transform:rotate(calc(var(--base-rot,0deg) + var(--spin,360deg)))}}
.boss-sprite-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.boss-part{display:grid;gap:8px;align-content:start;padding:10px;background:#101923;border:1px solid var(--line);border-radius:8px}.boss-part .media-card{min-height:120px;background:#0a1118}.boss-part dl{display:grid;grid-template-columns:auto 1fr;gap:2px 8px;margin:0;color:var(--muted);font-size:12px}.boss-part dd{margin:0;color:#d7e6f3}
.status-pill{display:inline-block;padding:2px 7px;border:1px solid var(--line);border-radius:999px;background:#172332;color:#d7e6f3;font-size:12px}.status-destroyed{border-color:#9a3a2f;background:#3a1818;color:#ffd6c9}.status-accessible{border-color:#315f44;background:#12251a;color:#b8f7c6}.status-hidden{opacity:.65}.system-map-wrap{position:relative;display:grid;gap:8px}.system-map-wrap canvas,.map-section canvas{background:#06101a;touch-action:none;cursor:grab}.system-map-wrap canvas:active,.map-section canvas:active{cursor:grabbing}.map-tooltip{position:absolute;min-width:180px;max-width:min(320px,calc(100% - 24px));padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:rgba(8,16,26,.96);box-shadow:0 10px 24px rgba(0,0,0,.35);color:#e6edf3;font-size:12px;line-height:1.35;white-space:pre-line;pointer-events:none;display:none;z-index:2}.boss-layer-sprite,.boss-mini-sprite{transform:rotate(var(--base-rot,0deg)) scaleX(var(--mirror,1))}@keyframes boss-layer-spin{from{transform:rotate(var(--base-rot,0deg)) scaleX(var(--mirror,1))}to{transform:rotate(calc(var(--base-rot,0deg) + var(--spin,360deg))) scaleX(var(--mirror,1))}}
@media(max-width:900px){.entity-hero{grid-template-columns:1fr}.stat-grid.compact{min-width:0}.hero-main h1{font-size:32px}.hero-visual{justify-self:start}}@media(max-width:760px){header{align-items:flex-start;flex-direction:column}.site-search{width:100%;max-width:none}.listing{columns:1}.home-hero{flex-direction:column;align-items:flex-start}.home-hero img{width:70%}}`;
  ensureDir(path.join(DIST_DIR, "assets"));
  fs.writeFileSync(path.join(DIST_DIR, "assets", "favicon.ico"), Buffer.from("AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "base64"));
  fs.writeFileSync(path.join(DIST_DIR, "assets", "site.css"), css, "utf8");

  const js = `const SEARCH_INDEX=${JSON.stringify(searchEntries)};
const MAP_BACKGROUND=${JSON.stringify(mapBackground)};
const input=document.getElementById("search-input");
const results=document.getElementById("search-results");
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const tableRank={Guides:0,Commodities:1,Weapons:2,ArtifactTypes:3,"Unique Artifacts":3,Enemies:4,Bosses:5,Stations:6,Bodies:6,SolarSystems:7,Drops:8};
function markMissingValues(root=document){for(const el of root.querySelectorAll('span,strong,small,td,th,dd,li,p,option,code')){if(el.children.length)continue;const text=el.textContent.trim();if(!text)continue;if(/^(n\\/a|unknown)$/i.test(text)||/^(not found|missing)$/i.test(text)||/^no direct .* client data$/i.test(text)||/^artifact roll not exposed$/i.test(text)){el.classList.add('missing-value');}}}
function coordinateLabel(value){const num=Number(value);if(!Number.isFinite(num))return value===null||value===undefined||value===''?'n/a':String(value);return (num*0.025).toFixed(3).replace(/\.?0+$/,'');}
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
document.addEventListener("DOMContentLoaded",()=>markMissingValues(document.body));
for(const table of document.querySelectorAll('table.sortable')){for(const th of table.querySelectorAll('th')){th.tabIndex=0;th.addEventListener('click',()=>sortTable(table,[...th.parentNode.children].indexOf(th)));th.addEventListener('keydown',e=>{if(e.key==='Enter')sortTable(table,[...th.parentNode.children].indexOf(th));});}}
function sortTable(table,col){const body=table.tBodies[0];const rows=[...body.rows];const asc=table.dataset.sortCol!=col||table.dataset.sortDir==='desc';rows.sort((a,b)=>a.cells[col].innerText.localeCompare(b.cells[col].innerText,navigator.language||'en',{numeric:true}));if(!asc)rows.reverse();table.dataset.sortCol=col;table.dataset.sortDir=asc?'asc':'desc';rows.forEach(r=>body.appendChild(r));}
for(const filter of document.querySelectorAll('.table-filter')){const table=filter.nextElementSibling?.querySelector('table');if(!table)continue;filter.addEventListener('input',()=>{const q=filter.value.toLowerCase();for(const row of table.tBodies[0].rows){row.hidden=!row.innerText.toLowerCase().includes(q);}});}
for(const sprite of document.querySelectorAll('.atlas-sprite[data-frames]')){let frames=[];try{frames=JSON.parse(sprite.dataset.frames)}catch{}if(frames.length<2)continue;let i=0;setInterval(()=>{i=(i+1)%frames.length;sprite.setAttribute('style',frames[i].style);sprite.setAttribute('aria-label',frames[i].name);},180);}
for(const panel of document.querySelectorAll('.filter-panel[data-table-filter]')){const table=document.getElementById(panel.dataset.tableFilter);if(!table||!table.tBodies[0])continue;const controls=[...panel.querySelectorAll('input,select')];const apply=()=>{for(const row of table.tBodies[0].rows){let ok=true;for(const control of controls){if(control.type==='checkbox'&&control.dataset.filterFlag){if(control.checked&&row.dataset[control.dataset.filterFlag]!=='1')ok=false;continue;}const value=String(control.value||'').trim().toLowerCase();if(!value)continue;if('filterText' in control.dataset){const text=(row.dataset.search||row.innerText).toLowerCase();if(!text.includes(value))ok=false;}if(control.dataset.filterAttr){if(String(row.dataset[control.dataset.filterAttr]||'').toLowerCase()!==value)ok=false;}if(control.dataset.filterContains){if(!String(row.dataset[control.dataset.filterContains]||'').toLowerCase().includes(value))ok=false;}if(control.dataset.filterMin){if(Number(row.dataset[control.dataset.filterMin]||0)<Number(value))ok=false;}if(control.dataset.filterMax){if(Number(row.dataset[control.dataset.filterMax]||0)>Number(value))ok=false;}if(control.dataset.filterBetween){const min=Number(row.dataset[control.dataset.filterBetween+'Min']||0);const max=Number(row.dataset[control.dataset.filterBetween+'Max']||0);const n=Number(value);if(n<min||n>max)ok=false;}if(control.dataset.filterRangeMin){const base=control.dataset.filterRangeMin;const minRaw=row.dataset[base+'Min'];const maxRaw=row.dataset[base+'Max'];const n=Number(value);if(minRaw===''||maxRaw===''||Number(maxRaw)<n)ok=false;}if(control.dataset.filterRangeMax){const base=control.dataset.filterRangeMax;const minRaw=row.dataset[base+'Min'];const maxRaw=row.dataset[base+'Max'];const n=Number(value);if(minRaw===''||maxRaw===''||Number(minRaw)>n)ok=false;}}row.hidden=!ok;}};controls.forEach(c=>c.addEventListener('input',apply));controls.forEach(c=>c.addEventListener('change',apply));}
for(const box of document.querySelectorAll('.elite-calculator')){const from=box.querySelector('.elite-from');const to=box.querySelector('.elite-to');const out=box.querySelector('.elite-result');const cost=(lvl,total)=>Math.round(Math.pow(1.025,lvl-1)/432.548654*total);const sum=(a,b,total)=>{let s=0;for(let i=Math.max(1,a);i<=Math.min(100,b);i++)s+=cost(i,total);return s;};const fmt=n=>Number(n||0).toLocaleString('en-US');const update=()=>{const a=Number(from.value)+1;const b=Number(to.value);if(!out)return;if(b<a){out.textContent='Choose a target above the current level.';return;}out.textContent='Cost '+fmt(sum(a,b,3200000))+' primary, '+fmt(sum(a,b,540000))+' secondary, or '+fmt(sum(a,b,12000))+' Flux.';};from?.addEventListener('input',update);to?.addEventListener('input',update);update();}
for(const calc of document.querySelectorAll('#artifact-calculator')){let data=[];try{data=JSON.parse(calc.dataset.artifacts||'[]')}catch{}const target=calc.querySelector('#artifact-target');const level=calc.querySelector('#artifact-level');const drop=calc.querySelector('#artifact-drop-chance');const attempts=calc.querySelector('#artifact-attempts');const out=calc.querySelector('#artifact-result');const update=()=>{const targetKey=target?.value||'';const selected=targetKey?data.find(x=>x.key===targetKey):null;if(!out)return;if(!selected){out.textContent='Choose an artifact to estimate odds.';return;}const lvl=Number(level?.value||1);const eligible=data.filter(x=>lvl>=Number(x.minLevel||1)&&lvl<=Number(x.maxLevel||150));const total=eligible.reduce((s,x)=>s+Number(x.dropRate||0),0);const hit=eligible.find(x=>x.key===selected.key);const typeChance=total&&hit?Number(hit.dropRate||0)/total:0;const perTry=typeChance*(Number(drop?.value||0)/100);const tries=Math.max(1,Number(attempts?.value||1));const chance=1-Math.pow(1-perTry,tries);out.textContent=selected.name+': '+(100*typeChance).toFixed(2)+'% of eligible artifact rolls, '+(100*chance).toFixed(2)+'% after '+tries+' attempts.';};[target,level,drop,attempts].forEach(x=>x?.addEventListener('input',update));[target,level,drop,attempts].forEach(x=>x?.addEventListener('change',update));update();}
function initGalaxyMap(id,systems,warpPaths,routes){const canvas=document.getElementById(id);if(!canvas)return;const ctx=canvas.getContext('2d');const controls=document.querySelector('[data-map-controls="'+id+'"]');const search=controls?.querySelector('input[type=search]');const galaxy=controls?.querySelector('select');const pathsToggle=controls?.querySelector('input[type=checkbox]');const readout=document.getElementById(id+'-readout');const bg=new Image();bg.src=MAP_BACKGROUND?.url||'/assets/source-images/background.jpg';const xs=systems.map(s=>Number(s.x||0));const ys=systems.map(s=>Number(s.y||0));const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);const color=g=>{let h=0;for(const c of String(g||''))h=(h*31+c.charCodeAt(0))%360;return 'hsl('+h+' 78% 66%)';};const scale=(v,min,max,size)=>max===min?size/2:70+((v-min)/(max-min))*(size-140);let points=[];let pointByKey=new Map();function pathEnds(path){return{a:path.solarSystem1||path.stats?.solarSystem1,b:path.solarSystem2||path.stats?.solarSystem2,transit:Boolean(path.transit||path.stats?.transit),name:path.name||path.stats?.name||''};}function drawBackground(){const grad=ctx.createLinearGradient(0,0,canvas.width,canvas.height);grad.addColorStop(0,'#02060b');grad.addColorStop(.48,'#081522');grad.addColorStop(1,'#02050a');ctx.fillStyle=grad;ctx.fillRect(0,0,canvas.width,canvas.height);if(bg.complete&&bg.naturalWidth){ctx.save();ctx.globalAlpha=(MAP_BACKGROUND&&MAP_BACKGROUND.url&&MAP_BACKGROUND.url.includes('texture_gui')) ? .92 : .36;if(MAP_BACKGROUND&&Number.isFinite(MAP_BACKGROUND.x)){ctx.drawImage(bg,MAP_BACKGROUND.x,MAP_BACKGROUND.y,MAP_BACKGROUND.width,MAP_BACKGROUND.height,0,0,canvas.width,canvas.height);}else{ctx.drawImage(bg,0,0,canvas.width,canvas.height);}ctx.restore();}ctx.fillStyle='rgba(1,5,10,.38)';ctx.fillRect(0,0,canvas.width,canvas.height);for(let i=0;i<170;i++){const x=(i*97+53)%canvas.width;const y=(i*193+29)%canvas.height;const r=i%17===0?1.6:i%5===0?1.1:.7;ctx.globalAlpha=.18+(i%7)*.045;ctx.fillStyle=i%9===0?'#b7efff':'#ffffff';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}function visibleSystems(){const q=(search?.value||'').trim().toLowerCase();const g=galaxy?.value||'';const base=systems.filter(s=>(!g||s.galaxy===g));if(!q)return base.map(s=>({s,match:false,neighbor:false}));const matched=new Set(base.filter(s=>String(s.name||'').toLowerCase().includes(q)).map(s=>s.key));const linked=new Set(matched);for(const path of warpPaths){const ends=pathEnds(path);if(matched.has(ends.a))linked.add(ends.b);if(matched.has(ends.b))linked.add(ends.a);}return base.filter(s=>linked.has(s.key)).map(s=>({s,match:matched.has(s.key),neighbor:!matched.has(s.key)}));}function drawPath(a,b,transit,selected){const dx=b.x-a.x,dy=b.y-a.y,len=Math.max(1,Math.hypot(dx,dy));const sx=a.x+dx/len*(a.r+3),sy=a.y+dy/len*(a.r+3);const ex=b.x-dx/len*(b.r+3),ey=b.y-dy/len*(b.r+3);ctx.strokeStyle=selected?'rgba(255,255,255,.72)':transit?'rgba(110,231,249,.5)':'rgba(255,180,84,.38)';ctx.lineWidth=transit?2.2:1.4;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();if(transit){const angle=Math.atan2(dy,dx);for(const t of [.22,.78]){const x=sx+(ex-sx)*t,y=sy+(ey-sy)*t;ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle='rgba(110,231,249,.75)';ctx.beginPath();ctx.moveTo(7,0);ctx.lineTo(-5,-4);ctx.lineTo(-5,4);ctx.closePath();ctx.fill();ctx.restore();}}}function draw(){const q=(search?.value||'').trim().toLowerCase();drawBackground();const display=visibleSystems();points=display.map(item=>({s:item.s,match:item.match,neighbor:item.neighbor,x:scale(Number(item.s.x||0),minX,maxX,canvas.width),y:scale(Number(item.s.y||0),minY,maxY,canvas.height),r:Math.max(5,Math.min(14,Number(item.s.size||7)))}));pointByKey=new Map(points.map(p=>[p.s.key,p]));if(pathsToggle?.checked!==false){for(const path of warpPaths){const ends=pathEnds(path);const a=pointByKey.get(ends.a);const b=pointByKey.get(ends.b);if(!a||!b)continue;if(q&&!(a.match||b.match))continue;drawPath(a,b,ends.transit,q&&(a.match||b.match));}}for(const p of points){const systemColor=p.s.type&&String(p.s.type).includes('pvp')?'#ffb454':color(p.s.galaxy);ctx.globalAlpha=p.neighbor ? .72 : 1;ctx.beginPath();ctx.fillStyle=systemColor;ctx.shadowColor=systemColor;ctx.shadowBlur=p.match?18:10;ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();if(p.match){ctx.lineWidth=2;ctx.strokeStyle='#fff';ctx.stroke();}ctx.shadowBlur=0;ctx.globalAlpha=1;ctx.fillStyle='#e6edf3';ctx.font=(p.match?'600 ':'')+'13px system-ui';if(canvas.width>800||p.r>8)ctx.fillText(p.s.name,p.x+p.r+5,p.y+4);}}function pick(e){const box=canvas.getBoundingClientRect();const mx=(e.clientX-box.left)*canvas.width/box.width;const my=(e.clientY-box.top)*canvas.height/box.height;return points.find(p=>Math.hypot(mx-p.x,my-p.y)<=p.r+7);}canvas.addEventListener('mousemove',e=>{const hit=pick(e);canvas.style.cursor=hit?'pointer':'default';if(readout){if(hit){const links=(hit.s.links||[]).slice(0,5).map(x=>x.name).join(', ');readout.textContent=hit.s.name+' / '+(hit.s.galaxy||'Unknown galaxy')+' / '+(hit.s.type||'regular')+' / coords '+hit.s.x+', '+hit.s.y+(links?' / links: '+links:'');}else{readout.textContent='Hover a system to inspect level range, galaxy, coordinates, and connected systems.';}}});canvas.addEventListener('click',e=>{const hit=pick(e);if(hit&&routes[hit.s.key])location.href=routes[hit.s.key];});[search,galaxy,pathsToggle].forEach(x=>x?.addEventListener('input',draw));[search,galaxy,pathsToggle].forEach(x=>x?.addEventListener('change',draw));bg.onload=draw;draw();}
function initGalaxyMapStatus(id,systems,warpPaths,routes){const canvas=document.getElementById(id);if(!canvas)return;const ctx=canvas.getContext('2d');const controls=document.querySelector('[data-map-controls="'+id+'"]');const search=controls?.querySelector('input[type=search]');const galaxy=controls?.querySelector('select');const pathsToggle=controls?.querySelector('input[type=checkbox]');const readout=document.getElementById(id+'-readout');const bg=new Image();bg.src=MAP_BACKGROUND?.url||'/assets/source-images/background.jpg';const xs=systems.map(s=>Number(s.x||0));const ys=systems.map(s=>Number(s.y||0));const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);const scale=(v,min,max,size)=>max===min?size/2:70+((v-min)/(max-min))*(size-140);const color=g=>{let h=0;for(const c of String(g||''))h=(h*31+c.charCodeAt(0))%360;return 'hsl('+h+' 78% 66%)';};let points=[];function pathEnds(path){return{a:path.solarSystem1||path.stats?.solarSystem1,b:path.solarSystem2||path.stats?.solarSystem2,transit:Boolean(path.transit||path.stats?.transit)}}function background(){const grad=ctx.createLinearGradient(0,0,canvas.width,canvas.height);grad.addColorStop(0,'#02060b');grad.addColorStop(.5,'#081522');grad.addColorStop(1,'#02050a');ctx.fillStyle=grad;ctx.fillRect(0,0,canvas.width,canvas.height);if(bg.complete&&bg.naturalWidth){ctx.save();ctx.globalAlpha=(MAP_BACKGROUND&&MAP_BACKGROUND.url&&MAP_BACKGROUND.url.includes('texture_gui')) ? .9:.35;if(MAP_BACKGROUND&&Number.isFinite(MAP_BACKGROUND.x))ctx.drawImage(bg,MAP_BACKGROUND.x,MAP_BACKGROUND.y,MAP_BACKGROUND.width,MAP_BACKGROUND.height,0,0,canvas.width,canvas.height);else ctx.drawImage(bg,0,0,canvas.width,canvas.height);ctx.restore();}ctx.fillStyle='rgba(1,5,10,.42)';ctx.fillRect(0,0,canvas.width,canvas.height);for(let i=0;i<150;i++){ctx.globalAlpha=.18+(i%7)*.045;ctx.fillStyle=i%9===0?'#b7efff':'#fff';ctx.beginPath();ctx.arc((i*97+53)%canvas.width,(i*193+29)%canvas.height,i%17===0?1.6:.8,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}function visible(){const q=(search?.value||'').trim().toLowerCase();const g=galaxy?.value||'';const base=systems.filter(s=>!g||s.galaxy===g);if(!q)return base.map(s=>({s,match:false,neighbor:false}));const matched=new Set(base.filter(s=>String(s.name||'').toLowerCase().includes(q)).map(s=>s.key));const linked=new Set(matched);for(const path of warpPaths){const e=pathEnds(path);if(matched.has(e.a))linked.add(e.b);if(matched.has(e.b))linked.add(e.a);}return base.filter(s=>linked.has(s.key)).map(s=>({s,match:matched.has(s.key),neighbor:!matched.has(s.key)}));}function drawPath(a,b,transit,hot){const dx=b.x-a.x,dy=b.y-a.y,len=Math.max(1,Math.hypot(dx,dy));ctx.strokeStyle=hot?'rgba(255,255,255,.72)':transit?'rgba(110,231,249,.5)':'rgba(255,180,84,.36)';ctx.lineWidth=transit?2.2:1.3;ctx.beginPath();ctx.moveTo(a.x+dx/len*(a.r+3),a.y+dy/len*(a.r+3));ctx.lineTo(b.x-dx/len*(b.r+3),b.y-dy/len*(b.r+3));ctx.stroke();}function draw(){const q=(search?.value||'').trim().toLowerCase();background();points=visible().map(item=>({s:item.s,match:item.match,neighbor:item.neighbor,x:scale(Number(item.s.x||0),minX,maxX,canvas.width),y:scale(Number(item.s.y||0),minY,maxY,canvas.height),r:Math.max(5,Math.min(14,Number(item.s.size||7)))}));const byKey=new Map(points.map(p=>[p.s.key,p]));if(pathsToggle?.checked!==false){for(const path of warpPaths){const e=pathEnds(path),a=byKey.get(e.a),b=byKey.get(e.b);if(!a||!b)continue;if(q&&!(a.match||b.match))continue;drawPath(a,b,e.transit,q&&(a.match||b.match));}}for(const p of points){const destroyed=p.s.destroyed||p.s.statusKey==='destroyed';const fill=destroyed?'#ff6b52':p.s.type&&String(p.s.type).includes('pvp')?'#ffb454':color(p.s.galaxy);ctx.globalAlpha=p.neighbor?.valueOf()? .72:1;ctx.fillStyle=fill;ctx.shadowColor=fill;ctx.shadowBlur=p.match?18:10;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;if(destroyed){ctx.lineWidth=2;ctx.strokeStyle='#ffd166';ctx.beginPath();ctx.arc(p.x,p.y,p.r+5,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(p.x-p.r-5,p.y-p.r-5);ctx.lineTo(p.x+p.r+5,p.y+p.r+5);ctx.moveTo(p.x+p.r+5,p.y-p.r-5);ctx.lineTo(p.x-p.r-5,p.y+p.r+5);ctx.stroke();}else if(p.match){ctx.lineWidth=2;ctx.strokeStyle='#fff';ctx.stroke();}ctx.globalAlpha=1;ctx.fillStyle=destroyed?'#ffd6c9':'#e6edf3';ctx.font=(p.match?'600 ':'')+'13px system-ui';if(canvas.width>800||p.r>8)ctx.fillText(p.s.name,p.x+p.r+7,p.y+4);if(destroyed&&canvas.width>800){ctx.fillStyle='#ffb4a2';ctx.font='11px system-ui';ctx.fillText('Destroyed',p.x+p.r+7,p.y+18);}}}function pick(e){const box=canvas.getBoundingClientRect();const mx=(e.clientX-box.left)*canvas.width/box.width;const my=(e.clientY-box.top)*canvas.height/box.height;return points.find(p=>Math.hypot(mx-p.x,my-p.y)<=p.r+8);}canvas.addEventListener('mousemove',e=>{const hit=pick(e);canvas.style.cursor=hit?'pointer':'default';if(!readout)return;if(hit){const links=(hit.s.links||[]).slice(0,5).map(x=>x.name).join(', ');const status=hit.s.status?(' / '+hit.s.status+(hit.s.access?' - '+hit.s.access:'')):'';readout.textContent=hit.s.name+status+' / '+(hit.s.galaxy||'Unknown galaxy')+' / '+(hit.s.type||'regular')+' / coords '+hit.s.x+', '+hit.s.y+(links?' / links: '+links:'');}else readout.textContent='Hover a system to inspect level range, galaxy, coordinates, access status, and connected systems.';});canvas.addEventListener('click',e=>{const hit=pick(e);if(hit&&routes[hit.s.key])location.href=routes[hit.s.key];});[search,galaxy,pathsToggle].forEach(x=>x?.addEventListener('input',draw));[search,galaxy,pathsToggle].forEach(x=>x?.addEventListener('change',draw));bg.onload=draw;draw();}
function initSystemMap(id,data){const canvas=document.getElementById(id);if(!canvas)return;const ctx=canvas.getContext('2d');const readout=document.getElementById(id+'-readout');const bodies=data.bodies||[],spawners=data.spawners||[],bosses=data.bosses||[];const all=[...bodies,...spawners,...bosses];const xs=all.map(x=>Number(x.x||0)),ys=all.map(x=>Number(x.y||0));const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);const pad=54;const sx=x=>maxX===minX?canvas.width/2:pad+((x-minX)/(maxX-minX))*(canvas.width-pad*2);const sy=y=>maxY===minY?canvas.height/2:pad+((y-minY)/(maxY-minY))*(canvas.height-pad*2);const colors={sun:'#ffd166',planet:'#d7f5ff',warpGate:'#6ee7f9',research:'#ffb454',shop:'#7cc7ff','junk yard':'#c792ea',hangar:'#ff8fa3',cantina:'#a5d6a7',paintShop:'#ff74c7',warning:'#f7c948',hidden:'#8a9bad',boss:'#ff6b52'};let points=[];function draw(){ctx.fillStyle='#06101a';ctx.fillRect(0,0,canvas.width,canvas.height);const grad=ctx.createRadialGradient(canvas.width*.45,canvas.height*.42,20,canvas.width*.45,canvas.height*.42,canvas.width*.7);grad.addColorStop(0,'rgba(32,62,91,.55)');grad.addColorStop(1,'rgba(2,5,10,.08)');ctx.fillStyle=grad;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='rgba(110,231,249,.08)';ctx.lineWidth=1;for(let x=40;x<canvas.width;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke();}for(let y=40;y<canvas.height;y+=60){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke();}for(const body of bodies.filter(b=>b.type==='warning'&&b.warningRadius)){const x=sx(body.x),y=sy(body.y);const scale=Math.min((canvas.width-pad*2)/Math.max(1,maxX-minX),(canvas.height-pad*2)/Math.max(1,maxY-minY));ctx.fillStyle='rgba(247,201,72,.10)';ctx.strokeStyle='rgba(247,201,72,.55)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,Math.max(14,body.warningRadius*scale),0,Math.PI*2);ctx.fill();ctx.stroke();}points=[];for(const body of bodies){const x=sx(body.x),y=sy(body.y);const r=body.type==='sun'?9:body.station?7:body.type==='warning'?5:body.type==='hidden'?4:6;const fill=colors[body.type]||'#d7f5ff';ctx.fillStyle=fill;ctx.strokeStyle=body.station?'#fff':'rgba(255,255,255,.35)';ctx.lineWidth=body.station?1.5:1;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke();if(body.type==='boss'){ctx.strokeStyle='#ff6b52';ctx.beginPath();ctx.moveTo(x-7,y-7);ctx.lineTo(x+7,y+7);ctx.moveTo(x+7,y-7);ctx.lineTo(x-7,y+7);ctx.stroke();}if(body.station||body.type==='sun'||body.type==='boss'){ctx.fillStyle='#e6edf3';ctx.font='12px system-ui';ctx.fillText(body.name,x+r+5,y+4);}points.push({kind:'body',item:body,x,y,r:r+6,url:data.routes?.Bodies?.[body.key]});}for(const sp of spawners){const x=sx(sp.x),y=sy(sp.y);ctx.fillStyle=sp.bossSpawner?'#ff6b52':'#c792ea';ctx.strokeStyle=sp.hidden?'#8a9bad':'#fff';ctx.lineWidth=1.2;ctx.beginPath();ctx.rect(x-4,y-4,8,8);ctx.fill();ctx.stroke();points.push({kind:'spawner',item:sp,x,y,r:10,url:data.routes?.Spawners?.[sp.key]});}for(const boss of bosses){const x=sx(boss.x),y=sy(boss.y);ctx.strokeStyle='#ff6b52';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.stroke();points.push({kind:'boss',item:boss,x,y,r:14,url:data.routes?.Bosses?.[boss.key]});}}function pick(e){const box=canvas.getBoundingClientRect();const mx=(e.clientX-box.left)*canvas.width/box.width;const my=(e.clientY-box.top)*canvas.height/box.height;return points.find(p=>Math.hypot(mx-p.x,my-p.y)<=p.r);}canvas.addEventListener('mousemove',e=>{const p=pick(e);canvas.style.cursor=p?.url?'pointer':'default';if(!readout)return;if(!p){readout.textContent='Hover a marker to inspect location, spawner, boss, or elite-zone data.';return;}const item=p.item;if(p.kind==='spawner')readout.textContent='Spawner: '+item.name+' / '+(item.bodyName||'unknown body')+' / '+(item.enemyName||'no enemy')+' / drops: '+(item.drops||[]).join(', ');else if(p.kind==='boss')readout.textContent='Boss: '+item.name;else readout.textContent=item.name+' / '+item.type+' / level '+(item.level||'n/a')+' / coords '+coordinateLabel(item.x)+', '+coordinateLabel(item.y);});canvas.addEventListener('click',e=>{const p=pick(e);if(p?.url)location.href=p.url;});draw();}
function initSystemMapReadable(id,data){const canvas=document.getElementById(id);if(!canvas)return;const ctx=canvas.getContext('2d');const readout=document.getElementById(id+'-readout');const bodies=data.bodies||[],spawners=data.spawners||[],bosses=data.bosses||[];const all=[...bodies,...spawners,...bosses];const xs=all.map(x=>Number(x.x||0)),ys=all.map(x=>Number(x.y||0));const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);const pad=70;const spanX=Math.max(1,maxX-minX),spanY=Math.max(1,maxY-minY);const scale=Math.min((canvas.width-pad*2)/spanX,(canvas.height-pad*2)/spanY);const sx=x=>canvas.width/2+(Number(x||0)-(minX+maxX)/2)*scale;const sy=y=>canvas.height/2+(Number(y||0)-(minY+maxY)/2)*scale;const bg=new Image();bg.src=MAP_BACKGROUND?.url||'/assets/source-images/background.jpg';const colors={sun:'#ffd166',planet:'#d7f5ff',warpGate:'#6ee7f9',research:'#ffb454',shop:'#7cc7ff','junk yard':'#c792ea',hangar:'#ff8fa3',cantina:'#a5d6a7',paintShop:'#ff74c7',warning:'#f7c948',hidden:'#8a9bad',boss:'#ff6b52'};let points=[];function markerRadius(body){if(body.type==='sun')return 13;if(body.station)return 10;if(body.type==='warning')return 5;if(body.hidden)return 4;return Math.max(5,Math.min(11,Math.sqrt(Number(body.radius||80))/2.8));}function background(){const grad=ctx.createRadialGradient(canvas.width*.48,canvas.height*.42,60,canvas.width*.5,canvas.height*.5,canvas.width*.75);grad.addColorStop(0,'#14263a');grad.addColorStop(.58,'#06101b');grad.addColorStop(1,'#02050a');ctx.fillStyle=grad;ctx.fillRect(0,0,canvas.width,canvas.height);if(bg.complete&&bg.naturalWidth){ctx.save();ctx.globalAlpha=(MAP_BACKGROUND&&MAP_BACKGROUND.url&&MAP_BACKGROUND.url.includes('texture_gui'))?.valueOf()?0.35:0.22;if(MAP_BACKGROUND&&Number.isFinite(MAP_BACKGROUND.x))ctx.drawImage(bg,MAP_BACKGROUND.x,MAP_BACKGROUND.y,MAP_BACKGROUND.width,MAP_BACKGROUND.height,0,0,canvas.width,canvas.height);else ctx.drawImage(bg,0,0,canvas.width,canvas.height);ctx.restore();}ctx.fillStyle='rgba(0,0,0,.3)';ctx.fillRect(0,0,canvas.width,canvas.height);for(let i=0;i<130;i++){ctx.globalAlpha=.15+(i%6)*.045;ctx.fillStyle=i%8?'#fff':'#b7efff';ctx.beginPath();ctx.arc((i*83+47)%canvas.width,(i*157+31)%canvas.height,i%19?0.75:1.6,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;ctx.strokeStyle='rgba(110,231,249,.08)';ctx.lineWidth=1;for(let x=pad;x<canvas.width-pad;x+=90){ctx.beginPath();ctx.moveTo(x,pad*.55);ctx.lineTo(x,canvas.height-pad*.55);ctx.stroke();}for(let y=pad;y<canvas.height-pad;y+=90){ctx.beginPath();ctx.moveTo(pad*.55,y);ctx.lineTo(canvas.width-pad*.55,y);ctx.stroke();}}function drawOrbitLinks(){const byKey=new Map(bodies.map(b=>[b.key,b]));for(const body of bodies){if(!body.parent||!byKey.has(body.parent))continue;const parent=byKey.get(body.parent);const px=sx(parent.x),py=sy(parent.y),x=sx(body.x),y=sy(body.y);ctx.strokeStyle='rgba(180,210,230,.16)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(px,py,Math.hypot(x-px,y-py),0,Math.PI*2);ctx.stroke();ctx.strokeStyle='rgba(180,210,230,.12)';ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(x,y);ctx.stroke();}}function drawLabel(text,x,y,color='#e6edf3'){ctx.font='12px system-ui';ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(x+8,y-10,ctx.measureText(text).width+8,16);ctx.fillStyle=color;ctx.fillText(text,x+12,y+2);}function draw(){background();drawOrbitLinks();for(const body of bodies.filter(b=>b.type==='warning'&&b.warningRadius)){const x=sx(body.x),y=sy(body.y),r=Math.max(18,Number(body.warningRadius||0)*scale);ctx.fillStyle='rgba(247,201,72,.08)';ctx.strokeStyle='rgba(247,201,72,.62)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke();}points=[];for(const body of bodies){const x=sx(body.x),y=sy(body.y),r=markerRadius(body),fill=colors[body.type]||'#d7f5ff';ctx.shadowColor=fill;ctx.shadowBlur=body.station||body.type==='sun'?12:5;ctx.fillStyle=fill;ctx.strokeStyle=body.station?'#fff':'rgba(255,255,255,.45)';ctx.lineWidth=body.station?1.7:1;if(body.station){ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r,y);ctx.closePath();ctx.fill();ctx.stroke();}else{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke();}ctx.shadowBlur=0;if(body.type==='boss'){ctx.strokeStyle='#ff6b52';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-8,y-8);ctx.lineTo(x+8,y+8);ctx.moveTo(x+8,y-8);ctx.lineTo(x-8,y+8);ctx.stroke();}if(body.station||body.type==='sun'||body.type==='boss')drawLabel(body.name,x+r,y,body.type==='boss'?'#ffd6c9':'#e6edf3');points.push({kind:'body',item:body,x,y,r:r+8,url:data.routes?.Bodies?.[body.key]});}for(const sp of spawners){const x=sx(sp.x),y=sy(sp.y);ctx.fillStyle=sp.bossSpawner?'#ff6b52':'#c792ea';ctx.strokeStyle=sp.hidden?'#8a9bad':'#fff';ctx.lineWidth=1.2;ctx.beginPath();ctx.rect(x-5,y-5,10,10);ctx.fill();ctx.stroke();points.push({kind:'spawner',item:sp,x,y,r:12,url:data.routes?.Spawners?.[sp.key]});}for(const boss of bosses){const x=sx(boss.x),y=sy(boss.y);ctx.strokeStyle='#ff6b52';ctx.lineWidth=2.4;ctx.beginPath();ctx.arc(x,y,16,0,Math.PI*2);ctx.stroke();drawLabel(boss.name,x+13,y+14,'#ffd6c9');points.push({kind:'boss',item:boss,x,y,r:17,url:data.routes?.Bosses?.[boss.key]});}}function pick(e){const box=canvas.getBoundingClientRect();const mx=(e.clientX-box.left)*canvas.width/box.width;const my=(e.clientY-box.top)*canvas.height/box.height;return points.find(p=>Math.hypot(mx-p.x,my-p.y)<=p.r);}canvas.addEventListener('mousemove',e=>{const p=pick(e);canvas.style.cursor=p?.url?'pointer':'default';if(!readout)return;if(!p){readout.textContent='Hover a marker to inspect location, spawner, boss, or elite-zone data.';return;}const item=p.item;if(p.kind==='spawner')readout.textContent='Spawner: '+item.name+' / '+(item.bodyName||'unknown body')+' / '+(item.enemyName||'no enemy')+' / drops: '+(item.drops||[]).join(', ');else if(p.kind==='boss')readout.textContent='Boss: '+item.name;else readout.textContent=item.name+' / '+item.type+' / level '+(item.level||'n/a')+' / coords '+coordinateLabel(item.x)+', '+coordinateLabel(item.y)+(item.parent?' / orbiting another body':'');});canvas.addEventListener('click',e=>{const p=pick(e);if(p?.url)location.href=p.url;});bg.onload=draw;draw();}
function installMapNavigation(canvas, options){const ctx=canvas.getContext('2d');const state={scale:options.scale,offsetX:options.offsetX,offsetY:options.offsetY,initialScale:options.scale,initialOffsetX:options.offsetX,initialOffsetY:options.offsetY,dragging:false,dragStartX:0,dragStartY:0,dragOffsetX:0,dragOffsetY:0};const clampScale=(value)=>Math.max(options.minScale??.35,Math.min(options.maxScale??4,value));const toScreen=(x,y)=>({x:Number(x||0)*state.scale+state.offsetX,y:Number(y||0)*state.scale+state.offsetY});const toWorld=(x,y)=>({x:(x-state.offsetX)/state.scale,y:(y-state.offsetY)/state.scale});const boxPoint=(event)=>{const box=canvas.getBoundingClientRect();return{x:(event.clientX-box.left)*canvas.width/box.width,y:(event.clientY-box.top)*canvas.height/box.height,box};};const showTooltip=(event,text)=>{if(!options.tooltip)return;options.tooltip.textContent=text;const wrap=canvas.parentElement?.getBoundingClientRect();if(!wrap)return;const x=event.clientX-wrap.left;const y=event.clientY-wrap.top;options.tooltip.style.left=Math.max(12,Math.min(wrap.width-12,x+16))+'px';options.tooltip.style.top=Math.max(12,Math.min(wrap.height-12,y+16))+'px';options.tooltip.style.display='block';};const hideTooltip=()=>{if(!options.tooltip)return;options.tooltip.style.display='none';options.tooltip.textContent='';};let points=[];const redraw=()=>{points=options.getPoints({state,toScreen,toWorld});options.drawScene({ctx,canvas,state,points,toScreen,toWorld});};const pick=(event)=>{const {x,y}=boxPoint(event);return points.find(p=>Math.hypot(x-p.x,y-p.y)<=p.r);};const zoomAt=(event,factor)=>{const {x,y}=boxPoint(event);const world=toWorld(x,y);const nextScale=clampScale(state.scale*factor);state.offsetX=x-world.x*nextScale;state.offsetY=y-world.y*nextScale;state.scale=nextScale;};const resetView=()=>{state.scale=clampScale(state.initialScale);state.offsetX=state.initialOffsetX;state.offsetY=state.initialOffsetY;redraw();};const startDrag=(event)=>{state.dragging=true;if(canvas.setPointerCapture)canvas.setPointerCapture(event.pointerId);const {x,y}=boxPoint(event);state.dragStartX=x;state.dragStartY=y;state.dragOffsetX=state.offsetX;state.dragOffsetY=state.offsetY;canvas.style.cursor='grabbing';hideTooltip();};const moveDrag=(event)=>{if(!state.dragging)return;const {x,y}=boxPoint(event);state.offsetX=state.dragOffsetX+(x-state.dragStartX);state.offsetY=state.dragOffsetY+(y-state.dragStartY);redraw();};const stopDrag=(event)=>{state.dragging=false;if(canvas.releasePointerCapture)canvas.releasePointerCapture(event.pointerId);canvas.style.cursor='grab';};const zoomMap=(factor)=>{const centerX=canvas.width/2;const centerY=canvas.height/2;const world=toWorld(centerX,centerY);const nextScale=clampScale(state.scale*factor);state.scale=nextScale;state.offsetX=centerX-world.x*nextScale;state.offsetY=centerY-world.y*nextScale;redraw();};const toolbarButtons=canvas.parentElement?.querySelectorAll('[data-map-action]');toolbarButtons?.forEach((button)=>button.addEventListener('click',()=>{const action=button.dataset.mapAction;if(action==='zoom-in')zoomMap(1.2);else if(action==='zoom-out')zoomMap(1/1.2);else if(action==='zoom-reset')resetView();}));canvas.addEventListener('mousemove',event=>{if(state.dragging){moveDrag(event);return;}const hit=pick(event);canvas.style.cursor=hit?'pointer':'grab';if(options.readout)options.readout.textContent=hit?options.describe(hit):options.idleText;if(hit)showTooltip(event,options.describe(hit));else hideTooltip();});canvas.addEventListener('mouseleave',()=>{if(!state.dragging)canvas.style.cursor='grab';hideTooltip();});canvas.addEventListener('pointerdown',startDrag);canvas.addEventListener('pointermove',moveDrag);canvas.addEventListener('pointerup',stopDrag);canvas.addEventListener('pointercancel',stopDrag);canvas.addEventListener('wheel',event=>{event.preventDefault();zoomAt(event,Math.exp(-event.deltaY*0.0015));redraw();},{passive:false});canvas.addEventListener('dblclick',event=>{event.preventDefault();resetView();});canvas.addEventListener('click',event=>{const hit=pick(event);if(hit&&options.onClick)options.onClick(hit);});redraw();return{redraw,resetView,state,clampScale};}

function adjustMapZoom(map, canvas, factor) {
  const state = map.state;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const worldX = (centerX - state.offsetX) / state.scale;
  const worldY = (centerY - state.offsetY) / state.scale;
  const nextScale = map.clampScale(state.scale * factor);
  state.scale = nextScale;
  state.offsetX = centerX - worldX * nextScale;
  state.offsetY = centerY - worldY * nextScale;
  map.redraw();
}
function initGalaxyMapZoomable(id,systems,warpPaths,routes){const canvas=document.getElementById(id);if(!canvas)return;const controls=document.querySelector('[data-map-controls="'+id+'"]');const search=controls?.querySelector('input[type=search]');const galaxy=controls?.querySelector('select');const pathsToggle=controls?.querySelector('input[type=checkbox]');const readout=document.getElementById(id+'-readout');const tooltip=document.getElementById(id+'-tooltip');const bg=new Image();bg.src=MAP_BACKGROUND?.url||'/assets/source-images/background.jpg';const xs=systems.map(s=>Number(s.x||0));const ys=systems.map(s=>Number(s.y||0));const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);const fitScale=Math.min((canvas.width-140)/Math.max(1,maxX-minX),(canvas.height-140)/Math.max(1,maxY-minY));const centerX=(minX+maxX)/2;const centerY=(minY+maxY)/2;const color=g=>{let h=0;for(const c of String(g||''))h=(h*31+c.charCodeAt(0))%360;return 'hsl('+h+' 78% 66%)';};let visibleSystems=[];function pathEnds(path){return{a:path.solarSystem1||path.stats?.solarSystem1,b:path.solarSystem2||path.stats?.solarSystem2,transit:Boolean(path.transit||path.stats?.transit),name:path.name||path.stats?.name||''};}function drawBackground(ctx,canvas){const grad=ctx.createLinearGradient(0,0,canvas.width,canvas.height);grad.addColorStop(0,'#02060b');grad.addColorStop(.48,'#081522');grad.addColorStop(1,'#02050a');ctx.fillStyle=grad;ctx.fillRect(0,0,canvas.width,canvas.height);if(bg.complete&&bg.naturalWidth){ctx.save();ctx.globalAlpha=(MAP_BACKGROUND&&MAP_BACKGROUND.url&&MAP_BACKGROUND.url.includes('texture_gui'))?.valueOf()?0.92:0.36;if(MAP_BACKGROUND&&Number.isFinite(MAP_BACKGROUND.x)){ctx.drawImage(bg,MAP_BACKGROUND.x,MAP_BACKGROUND.y,MAP_BACKGROUND.width,MAP_BACKGROUND.height,0,0,canvas.width,canvas.height);}else{ctx.drawImage(bg,0,0,canvas.width,canvas.height);}ctx.restore();}ctx.fillStyle='rgba(1,5,10,.38)';ctx.fillRect(0,0,canvas.width,canvas.height);for(let i=0;i<170;i++){const x=(i*97+53)%canvas.width;const y=(i*193+29)%canvas.height;const r=i%17===0?1.6:i%5===0?1.1:.7;ctx.globalAlpha=.18+(i%7)*.045;ctx.fillStyle=i%9===0?'#b7efff':'#ffffff';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}function filterSystems(){const q=(search?.value||'').trim().toLowerCase();const g=galaxy?.value||'';const base=systems.filter(s=>(!g||s.galaxy===g));if(!q)return base.map(s=>({s,match:false,neighbor:false}));const matched=new Set(base.filter(s=>String(s.name||'').toLowerCase().includes(q)).map(s=>s.key));const linked=new Set(matched);for(const path of warpPaths){const ends=pathEnds(path);if(matched.has(ends.a))linked.add(ends.b);if(matched.has(ends.b))linked.add(ends.a);}return base.filter(s=>linked.has(s.key)).map(s=>({s,match:matched.has(s.key),neighbor:!matched.has(s.key)}));}function drawPath(ctx,a,b,transit,selected){const dx=b.x-a.x,dy=b.y-a.y,len=Math.max(1,Math.hypot(dx,dy));const sx=a.x+dx/len*(a.r+3),sy=a.y+dy/len*(a.r+3);const ex=b.x-dx/len*(b.r+3),ey=b.y-dy/len*(b.r+3);ctx.strokeStyle=selected?'rgba(255,255,255,.72)':transit?'rgba(110,231,249,.5)':'rgba(255,180,84,.38)';ctx.lineWidth=transit?2.2:1.4;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();if(transit){const angle=Math.atan2(dy,dx);for(const t of [.22,.78]){const x=sx+(ex-sx)*t,y=sy+(ey-sy)*t;ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle='rgba(110,231,249,.75)';ctx.beginPath();ctx.moveTo(7,0);ctx.lineTo(-5,-4);ctx.lineTo(-5,4);ctx.closePath();ctx.fill();ctx.restore();}}}const map=installMapNavigation(canvas,{scale:Math.max(.35,Math.min(4,fitScale)),offsetX:canvas.width/2-centerX*fitScale,offsetY:canvas.height/2-centerY*fitScale,minScale:.35,maxScale:4,readout,tooltip,idleText:'Hover a system to inspect level range, galaxy, coordinates, and connected systems.',getPoints:({state,toScreen})=>{visibleSystems=filterSystems();return visibleSystems.map(item=>{const pos=toScreen(Number(item.s.x||0),Number(item.s.y||0));const size=Math.max(5,Math.min(14,Number(item.s.size||7)));return{s:item.s,match:item.match,neighbor:item.neighbor,x:pos.x,y:pos.y,r:Math.max(4,size*state.scale)};});},drawScene:({ctx,canvas,points})=>{drawBackground(ctx,canvas);const byKey=new Map(points.map(p=>[p.s.key,p]));const q=(search?.value||'').trim().toLowerCase();if(pathsToggle?.checked!==false){for(const path of warpPaths){const ends=pathEnds(path);const a=byKey.get(ends.a);const b=byKey.get(ends.b);if(!a||!b)continue;if(q&&!(a.match||b.match))continue;drawPath(ctx,a,b,ends.transit,q&&(a.match||b.match));}}for(const p of points){const systemColor=p.s.type&&String(p.s.type).includes('pvp')?'#ffb454':color(p.s.galaxy);ctx.globalAlpha=p.neighbor?.valueOf()?0.72:1;ctx.beginPath();ctx.fillStyle=systemColor;ctx.shadowColor=systemColor;ctx.shadowBlur=p.match?18:10;ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();if(p.match){ctx.lineWidth=2;ctx.strokeStyle='#fff';ctx.stroke();}ctx.shadowBlur=0;ctx.globalAlpha=1;ctx.fillStyle='#e6edf3';ctx.font=(p.match?'600 ':'')+'13px system-ui';if(canvas.width>800||p.r>8)ctx.fillText(p.s.name,p.x+p.r+5,p.y+4);}},describe:(hit)=>{const links=(hit.s.links||[]).slice(0,5).map(x=>x.name).join(', ');return hit.s.name+' / '+(hit.s.galaxy||'Unknown galaxy')+' / '+(hit.s.type||'regular')+' / coords '+hit.s.x+', '+hit.s.y+(hit.s.status?(' / '+hit.s.status+(hit.s.access?' - '+hit.s.access:'')): '')+(links?' / links: '+links:'');},onClick:(hit)=>{if(routes[hit.s.key])location.href=routes[hit.s.key];}});[search,galaxy,pathsToggle].forEach(x=>x?.addEventListener('input',map.redraw));[search,galaxy,pathsToggle].forEach(x=>x?.addEventListener('change',map.redraw));bg.onload=map.redraw;map.redraw();}
window.initGalaxyMap=initGalaxyMapZoomable;
function initSystemMapZoomable(id,data){const canvas=document.getElementById(id);if(!canvas)return;const readout=document.getElementById(id+'-readout');const tooltip=document.getElementById(id+'-tooltip');const bodies=data.bodies||[],spawners=data.spawners||[],bosses=data.bosses||[];const all=[...bodies,...spawners,...bosses];const xs=all.map(x=>Number(x.x||0)),ys=all.map(x=>Number(x.y||0));const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);const pad=70;const spanX=Math.max(1,maxX-minX),spanY=Math.max(1,maxY-minY);const fitScale=Math.min((canvas.width-pad*2)/spanX,(canvas.height-pad*2)/spanY);const centerX=(minX+maxX)/2;const centerY=(minY+maxY)/2;const bg=new Image();bg.src=MAP_BACKGROUND?.url||'/assets/source-images/background.jpg';const colors={sun:'#ffd166',planet:'#d7f5ff',warpGate:'#6ee7f9',research:'#ffb454',shop:'#7cc7ff','junk yard':'#c792ea',hangar:'#ff8fa3',cantina:'#a5d6a7',paintShop:'#ff74c7',warning:'#f7c948',hidden:'#8a9bad',boss:'#ff6b52'};let visiblePoints=[];const nav=installMapNavigation(canvas,{scale:Math.max(.35,Math.min(4,fitScale)),offsetX:canvas.width/2-centerX*fitScale,offsetY:canvas.height/2-centerY*fitScale,minScale:.35,maxScale:4,readout,tooltip,idleText:'Hover a marker to inspect location, spawner, boss, or elite-zone data.',getPoints:({state,toScreen})=>{const scaleBody=(body)=>{if(body.type==='sun')return 13;if(body.station)return 10;if(body.type==='warning')return 5;if(body.hidden)return 4;return Math.max(5,Math.min(11,Math.sqrt(Number(body.radius||80))/2.8));};visiblePoints=[];const byKey=new Map(bodies.map(body=>[body.key,body]));for(const body of bodies){const pos=toScreen(body.x,body.y);visiblePoints.push({kind:'body',item:body,x:pos.x,y:pos.y,r:scaleBody(body)*state.scale+8,url:data.routes?.Bodies?.[body.key]});}for(const sp of spawners){const pos=toScreen(sp.x,sp.y);visiblePoints.push({kind:'spawner',item:sp,x:pos.x,y:pos.y,r:10*state.scale+2,url:data.routes?.Spawners?.[sp.key]});}for(const boss of bosses){const pos=toScreen(boss.x,boss.y);visiblePoints.push({kind:'boss',item:boss,x:pos.x,y:pos.y,r:13*state.scale+4,url:data.routes?.Bosses?.[boss.key]});}return visiblePoints;},drawScene:({ctx,canvas,state,points,toScreen})=>{ctx.fillStyle='#06101a';ctx.fillRect(0,0,canvas.width,canvas.height);const grad=ctx.createRadialGradient(canvas.width*.48,canvas.height*.42,60,canvas.width*.5,canvas.height*.5,canvas.width*.75);grad.addColorStop(0,'#14263a');grad.addColorStop(.58,'#06101b');grad.addColorStop(1,'#02050a');ctx.fillStyle=grad;ctx.fillRect(0,0,canvas.width,canvas.height);if(bg.complete&&bg.naturalWidth){ctx.save();ctx.globalAlpha=(MAP_BACKGROUND&&MAP_BACKGROUND.url&&MAP_BACKGROUND.url.includes('texture_gui'))?.valueOf()?0.35:0.22;if(MAP_BACKGROUND&&Number.isFinite(MAP_BACKGROUND.x))ctx.drawImage(bg,MAP_BACKGROUND.x,MAP_BACKGROUND.y,MAP_BACKGROUND.width,MAP_BACKGROUND.height,0,0,canvas.width,canvas.height);else ctx.drawImage(bg,0,0,canvas.width,canvas.height);ctx.restore();}ctx.fillStyle='rgba(0,0,0,.3)';ctx.fillRect(0,0,canvas.width,canvas.height);for(let i=0;i<130;i++){ctx.globalAlpha=.15+(i%6)*.045;ctx.fillStyle=i%8?'#fff':'#b7efff';ctx.beginPath();ctx.arc((i*83+47)%canvas.width,(i*157+31)%canvas.height,i%19?0.75:1.6,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;ctx.strokeStyle='rgba(110,231,249,.08)';ctx.lineWidth=1;for(let x=pad;x<canvas.width-pad;x+=90){ctx.beginPath();ctx.moveTo(x,pad*.55);ctx.lineTo(x,canvas.height-pad*.55);ctx.stroke();}for(let y=pad;y<canvas.height-pad;y+=90){ctx.beginPath();ctx.moveTo(pad*.55,y);ctx.lineTo(canvas.width-pad*.55,y);ctx.stroke();}const byKey=new Map(points.filter(point=>point.kind==='body').map(point=>[point.item.key,point]));for(const body of bodies.filter(body=>body.type==='warning'&&body.warningRadius)){const pos=toScreen(body.x,body.y);const radius=Math.max(18,Number(body.warningRadius||0)*state.scale);ctx.fillStyle='rgba(247,201,72,.08)';ctx.strokeStyle='rgba(247,201,72,.62)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(pos.x,pos.y,radius,0,Math.PI*2);ctx.fill();ctx.stroke();}for(const body of bodies){const pos=toScreen(body.x,body.y);const r=body.type==='sun'?13*state.scale:body.station?10*state.scale:body.type==='warning'?5*state.scale:body.hidden?4*state.scale:Math.max(5,Math.min(11,Math.sqrt(Number(body.radius||80))/2.8))*state.scale;const fill=colors[body.type]||'#d7f5ff';ctx.shadowColor=fill;ctx.shadowBlur=body.station||body.type==='sun'?12:5;ctx.fillStyle=fill;ctx.strokeStyle=body.station?'#fff':'rgba(255,255,255,.45)';ctx.lineWidth=body.station?1.7:1;if(body.station){ctx.beginPath();ctx.moveTo(pos.x,pos.y-r);ctx.lineTo(pos.x+r,pos.y);ctx.lineTo(pos.x,pos.y+r);ctx.lineTo(pos.x-r,pos.y);ctx.closePath();ctx.fill();ctx.stroke();}else{ctx.beginPath();ctx.arc(pos.x,pos.y,r,0,Math.PI*2);ctx.fill();ctx.stroke();}ctx.shadowBlur=0;if(body.type==='boss'){ctx.strokeStyle='#ff6b52';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(pos.x-8,pos.y-8);ctx.lineTo(pos.x+8,pos.y+8);ctx.moveTo(pos.x+8,pos.y-8);ctx.lineTo(pos.x-8,pos.y+8);ctx.stroke();}if(body.station||body.type==='sun'||body.type==='boss'||state.scale>1){ctx.font='12px system-ui';ctx.fillStyle=body.type==='boss'?'#ffd6c9':'#e6edf3';ctx.fillText(body.name,pos.x+r+5,pos.y+4);} }for(const sp of spawners){const pos=toScreen(sp.x,sp.y);ctx.fillStyle=sp.bossSpawner?'#ff6b52':'#c792ea';ctx.strokeStyle=sp.hidden?'#8a9bad':'#fff';ctx.lineWidth=1.2;ctx.beginPath();ctx.rect(pos.x-4,pos.y-4,8,8);ctx.fill();ctx.stroke();}for(const boss of bosses){const pos=toScreen(boss.x,boss.y);ctx.strokeStyle='#ff6b52';ctx.lineWidth=2.4;ctx.beginPath();ctx.arc(pos.x,pos.y,16*state.scale,0,Math.PI*2);ctx.stroke();}} ,describe:(hit)=>{if(hit.kind==='spawner')return 'Spawner: '+hit.item.name+'\\nBody: '+(hit.item.bodyName||'unknown body')+'\\nEnemy: '+(hit.item.enemyName||'no enemy')+'\\nDrops: '+((hit.item.drops||[]).join(', ')||'n/a');if(hit.kind==='boss')return 'Boss: '+hit.item.name+'\\nCoords: '+coordinateLabel(hit.item.x)+', '+coordinateLabel(hit.item.y);return hit.item.name+'\\nType: '+(hit.item.type||'body')+'\\nLevel: '+(hit.item.level||'n/a')+'\\nCoords: '+coordinateLabel(hit.item.x)+', '+coordinateLabel(hit.item.y)+(hit.item.parent?'\\nOrbiting: '+hit.item.parent:'');},onClick:(hit)=>{if(hit?.url)location.href=hit.url;}});canvas.addEventListener('click',e=>{const hit=visiblePoints.find(point=>Math.hypot(((e.clientX-canvas.getBoundingClientRect().left)*canvas.width/canvas.getBoundingClientRect().width)-point.x,((e.clientY-canvas.getBoundingClientRect().top)*canvas.height/canvas.getBoundingClientRect().height)-point.y)<=point.r);if(hit?.url)location.href=hit.url;});nav.redraw();bg.onload=nav.redraw;}
window.initSystemMap=initSystemMapZoomable;`;
  fs.writeFileSync(path.join(DIST_DIR, "assets", "search.js"), js, "utf8");
}

function buildSearchEntries(manifest, cache) {
  const entries = [];
  for (const items of Object.values(manifest)) {
    for (const item of items) {
      const [table, key] = item.id.split(":");
      if (table === "SolarSystems" && !isVisibleMapSystem(cache.SolarSystems?.[key], key)) continue;
      entries.push({
        name: item.name,
        table: table === "Bodies" ? "Stations" : table,
        type: cache[table]?.[key]?.type || "",
        url: routeForEntry(item)
      });
    }
  }
  for (const item of uniqueArtifactCatalog(cache)) {
    entries.push({ name: item.label, table: "Unique Artifacts", type: uniqueArtifactSourceStatus(item, cache), url: item.url });
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
  const routes = routeMap(manifest, cache);

  cleanDir(DIST_DIR);
  const media = copyMediaAssets(cache);
  writeAssets(buildSearchEntries(manifest, cache), media);
  buildIndex(manifest, tables, warnings, media, map, cache);
  buildContentPages(manifest, cache, media, graph, routes);
  buildUniqueArtifactPages(cache, media, routes);
  buildMapPage(map, manifest);
  buildMediaPage(cache, media);
  buildGuidePages(cache, manifest, media, routes);
  buildStationsPage(cache, routes);

  const listings = {
    systems: ["Systems", manifest.SolarSystems || [], "SolarSystems"],
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


