import { numberValue, tip } from "./display-utils.js";
import { dedupeDropRefs, normalizeDropRefs } from "./drop-utils.js";
import { refKey } from "./entity-links.js";

export const ENEMY_RARE_EFFECTS = [
  {
    field: "rareAttacker",
    label: "Attacker",
    hint: "The name suggests an offense-oriented rare roll. The client cache does not expose the exact damage or refire multiplier."
  },
  {
    field: "rareDefender",
    label: "Defender",
    hint: "The name suggests a survivability-oriented rare roll. The client cache does not expose the exact HP, shield, armor, or resistance multiplier."
  },
  {
    field: "rareLegend",
    label: "Legend",
    hint: "A distinct rare family used by high-tier named enemies. The client cache exposes the flag but not the exact stat formula behind it."
  },
  {
    field: "rareSpeeder",
    label: "Speeder",
    hint: "The name suggests a movement-focused rare roll. The client cache does not expose the exact speed or chase-range multiplier."
  },
  {
    field: "rareUnique",
    label: "Unique",
    hint: "A distinct rare family used by a smaller set of named enemies. The client cache does not expose a separate global loot rule for it."
  }
];

export function enemyShipStats(record, cache) {
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

export function enemyHp(record, cache) {
  return enemyShipStats(record, cache).hpMax;
}

export function bossHpStats(record, cache) {
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

export function linkedEnemySpawners(enemyKey, cache) {
  return Object.entries(cache.Spawners || {}).filter(([, spawner]) =>
    spawner.enemy === enemyKey
    || spawner.enemy2 === enemyKey
    || (spawner.enemies || []).some((item) => refKey("Enemies", item) === enemyKey)
  );
}

export function enemyDropRefs(enemyKey, record, cache) {
  return dedupeDropRefs([
    ...normalizeDropRefs(record?.drops),
    ...linkedEnemySpawners(enemyKey, cache).flatMap(([, spawner]) => normalizeDropRefs([...(spawner.drops || []), ...(spawner.drops2 || [])]))
  ]);
}

export function enemyLootSourceMode(enemyKey, record, cache) {
  const directKeys = new Set(normalizeDropRefs(record?.drops).map((item) => item.key));
  const allKeys = new Set(enemyDropRefs(enemyKey, record, cache).map((item) => item.key));
  const spawnerOnly = [...allKeys].filter((key) => !directKeys.has(key));
  if (!allKeys.size) return "No enemy/spawner loot link in client cache";
  if (directKeys.size && spawnerOnly.length) return "Direct enemy + spawner-linked loot";
  if (directKeys.size) return "Direct enemy loot";
  return "Spawner-linked loot";
}

export function enemyTraitItems(record) {
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

export function enemyRareEffectItems(record) {
  return ENEMY_RARE_EFFECTS
    .filter((effect) => record?.[effect.field])
    .map((effect) => ({ ...effect, active: true }));
}

export function enemyRareMode(record) {
  if (record?.alwaysRare) {
    return {
      label: "Always rare",
      hint: "This enemy record is already wired as a rare-profile hostile in the client cache."
    };
  }
  if (record?.rareSettings) {
    return {
      label: "Random rare effect enabled",
      hint: "This enemy can roll from the rare-effect families exposed by the client cache."
    };
  }
  if (enemyRareEffectItems(record).length) {
    return {
      label: "Rare flags present",
      hint: "The record exposes rare-family flags, but the client cache does not mark it as alwaysRare."
    };
  }
  return {
    label: "No rare effect flag",
    hint: "The client cache does not expose a random rare-effect flag for this enemy."
  };
}

export function enemyTraits(record, html = false) {
  const items = enemyTraitItems(record);
  if (!items.length) return html ? tip("Standard", "No special AI flag was found in the enemy record.") : "Standard";
  if (!html) return items.map((item) => item.label).join(", ");
  return items.map((item) => tip(item.label, item.hint)).join(", ");
}
