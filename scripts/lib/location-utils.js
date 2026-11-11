import { DESTROYED_SYSTEMS, STATION_TYPES } from "./build-constants.js";
import { numberValue } from "./display-utils.js";
import { refKey } from "./entity-links.js";
import { titleFor } from "./record-utils.js";

export function isStationBody(body) {
  return STATION_TYPES.has(body?.type);
}

export function systemStatusInfo(system, key = "") {
  const destroyed = DESTROYED_SYSTEMS.get(key);
  if (destroyed) return { key: "destroyed", label: destroyed.status, access: destroyed.access, note: destroyed.note };
  if (String(system?.name || "").trim().toLowerCase() === "dev") return { key: "hidden", label: "Hidden", access: "Development system", note: "Filtered out of player navigation pages." };
  return { key: "accessible", label: "Accessible", access: "Selectable", note: "Visible in the player star map data." };
}

export function isGenericHiddenBodyName(name, body = null) {
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) return false;
  if (!body && /\bhidden\b/.test(normalized)) return true;
  if (normalized === "hidden" || normalized === "hidden body") return true;
  if (body?.type === "hidden" && /\bhidden\b/.test(normalized)) return true;
  return false;
}

export function hiddenBodyDisplayName(bodyKey, body, cache) {
  const name = titleFor(body, bodyKey);
  if (!isGenericHiddenBodyName(name, body)) return name;

  const spawners = Object.entries(cache.Spawners || {}).filter(([, spawner]) => spawner.body === bodyKey);
  const enemyNames = [...new Set(spawners
    .flatMap(([, spawner]) => spawnerEnemyKeys(spawner)
      .map((enemyKey) => titleFor(cache.Enemies?.[enemyKey], enemyKey)))
    .filter((label) => label && !isGenericHiddenBodyName(label)))];
  if (enemyNames.length === 1) return enemyNames[0];

  const bossNames = [...new Set(spawners
    .map(([, spawner]) => titleFor(cache.Bosses?.[spawner.bossSpawner || spawner.bossSpawner2], spawner.bossSpawner || spawner.bossSpawner2 || ""))
    .filter((label) => label && !isGenericHiddenBodyName(label)))];
  if (bossNames.length === 1) return bossNames[0];

  const spawnerNames = [...new Set(spawners
    .map(([spawnerKey, spawner]) => titleFor(spawner, spawnerKey))
    .filter((label) => label && !isGenericHiddenBodyName(label)))];
  if (spawnerNames.length === 1) return spawnerNames[0];

  return "";
}

export function bodyDisplayName(bodyKey, body, cache) {
  const sourceName = titleFor(body, bodyKey);
  return hiddenBodyDisplayName(bodyKey, body, cache)
    || (isGenericHiddenBodyName(sourceName, body) ? "Hidden location" : sourceName);
}

export function bodyLocationInfo(bodyKey, cache) {
  const body = cache.Bodies?.[bodyKey];
  if (!body) return null;
  const systemKey = body.solarSystem;
  if (!isVisibleMapSystem(cache.SolarSystems?.[systemKey], systemKey)) return null;
  return {
    systemKey,
    systemName: titleFor(cache.SolarSystems?.[systemKey], systemKey),
    bodyKey,
    bodyName: bodyDisplayName(bodyKey, body, cache)
  };
}

export const EVENT_LABELS = new Map([
  ["autumnBoss", "Autumn event"]
]);

export function eventLabel(event) {
  if (!event) return "";
  return EVENT_LABELS.get(event) || String(event);
}

// A spawner can reference enemies through four different fields depending on
// when it was authored: enemy/enemy2 hold a single key, enemies/enemies2 hold
// an array of `{ probability, name, key }` entries.
export function spawnerEnemyKeys(spawner) {
  const keys = [];
  if (spawner?.enemy) keys.push(spawner.enemy);
  if (spawner?.enemy2) keys.push(spawner.enemy2);
  for (const item of spawner?.enemies || []) {
    const key = refKey("Enemies", item);
    if (key) keys.push(key);
  }
  for (const item of spawner?.enemies2 || []) {
    const key = refKey("Enemies", item);
    if (key) keys.push(key);
  }
  return [...new Set(keys)];
}

// Like bodyLocationInfo(), but keeps invisible/dev systems and exposes the
// conditions a player must meet to reach the spawn point.
export function spawnerLocation(spawnerKey, spawner, cache) {
  const body = cache.Bodies?.[spawner?.body] || null;
  const system = body ? cache.SolarSystems?.[body.solarSystem] : null;
  const systemKey = body?.solarSystem || "";
  return {
    spawnerKey,
    spawner,
    spawnerName: titleFor(spawner, spawnerKey),
    bodyKey: spawner?.body || "",
    body,
    bodyMissing: !body && Boolean(spawner?.body),
    bodyName: body ? bodyDisplayName(spawner.body, body, cache) : "",
    systemKey,
    system,
    systemName: titleFor(system, systemKey),
    systemVisible: isVisibleMapSystem(system, systemKey),
    systemStatus: systemStatusInfo(system, systemKey),
    bodyEvent: body?.event || "",
    bodyActive: body ? body.active !== false : true,
    hidden: spawner?.hidden === true,
    triggeredByMission: spawner?.triggeredByMission === true,
    level: spawner?.level
  };
}

export function placementConditionLabels(placement) {
  if (!placement) return [];
  const labels = [];
  if (placement.bodyMissing) {
    labels.push("Spawner body not in cache (instanced/scripted area)");
  } else if (!placement.systemVisible) {
    labels.push("Dev / hidden system (not reachable)");
  }
  if (placement.systemStatus?.key === "destroyed") labels.push("System destroyed (not selectable)");
  if (!placement.bodyActive) labels.push("Body inactive");
  if (placement.bodyEvent) labels.push(`Event: ${eventLabel(placement.bodyEvent)}`);
  if (placement.hidden) labels.push("Hidden spawner");
  if (placement.triggeredByMission) labels.push("Mission-triggered");
  if (/^(dev|test)\b/i.test(String(placement.spawnerName || ""))) labels.push("Test/development spawner");
  return labels;
}

export function enemySpawnerPlacements(enemyKey, cache) {
  return Object.entries(cache.Spawners || {})
    .filter(([, spawner]) => spawnerEnemyKeys(spawner).includes(enemyKey))
    .map(([spawnerKey, spawner]) => spawnerLocation(spawnerKey, spawner, cache))
    // Keep spawners whose body key is missing: they still name an instanced or
    // scripted encounter. Spawners with no body at all are boss mounts and are
    // handled by enemySummonSources().
    .filter((placement) => placement.body || placement.bodyMissing);
}

// Some enemies never appear in a world spawner: they are summoned by another
// enemy or by a weapon that spawns a hostile. Those links explain the "unknown
// location" cases (Aureus orbs, constructors, mirrors, etc.).
export function enemySummonSources(enemyKey, cache) {
  const byEnemies = Object.entries(cache.Enemies || {})
    .filter(([key, record]) => key !== enemyKey && (record?.enemies || []).some((item) => refKey("Enemies", item) === enemyKey))
    .map(([key, record]) => ({ key, record }));
  const summonWeapons = Object.entries(cache.Weapons || {})
    .filter(([, weapon]) => weapon?.enemy === enemyKey)
    .map(([key, record]) => ({ key, record }));
  // Bosses mount spawners without a world body (e.g. "Boss Aureus"). Enemies
  // listed in those spawners are part of the boss encounter itself.
  const bossMounts = Object.entries(cache.Spawners || {})
    .filter(([spawnerKey, spawner]) => !spawner?.body && spawnerEnemyKeys(spawner).includes(enemyKey))
    .map(([spawnerKey, spawner]) => ({
      spawnerKey,
      spawner,
      bosses: Object.entries(cache.Bosses || {})
        .filter(([, boss]) => (boss?.spawners || []).some((mount) => (mount?.spawner || refKey("Spawners", mount)) === spawnerKey))
        .map(([bossKey, boss]) => ({ key: bossKey, record: boss }))
    }));
  const users = summonWeapons.map(({ key, record }) => ({
    key,
    record,
    enemies: Object.entries(cache.Enemies || {})
      .filter(([, enemy]) => (enemy?.weapons || []).some((item) => refKey("Weapons", item) === key))
      .map(([enemyKey, enemy]) => ({ key: enemyKey, record: enemy })),
    playerSkins: Object.entries(cache.Skins || {})
      .filter(([, skin]) => (skin?.upgrades || []).some((upgrade) => upgrade?.tech === key))
      .map(([skinKey, skin]) => ({ key: skinKey, record: skin })),
    shopBodies: Object.entries(cache.Bodies || {})
      .filter(([, body]) => (body?.shopItems || []).some((item) => {
        const itemKey = item?.item || item?.key || item?.itemKey;
        const itemTable = item?.table || item?.itemTable || item?.type;
        return itemKey === key && (!itemTable || itemTable === "Weapons");
      }))
      .map(([bodyKey, body]) => ({ key: bodyKey, record: body })),
    drops: Object.entries(cache.Drops || {})
      .filter(([, drop]) => (drop?.dropItems || []).some((item) => item?.table === "Weapons" && item?.item === key))
      .map(([dropKey, drop]) => ({ key: dropKey, record: drop }))
  }));
  return { byEnemies, weapons: users, bossMounts };
}

// Bosses are placed by a body whose `boss` field points at them. The boss's own
// `spawners` array is made of sprite mounts, not world locations: most of those
// spawners have no body, so only body-backed mounts are kept as a fallback.
export function bossPlacements(bossKey, cache) {
  const placements = [];
  const seen = new Map();
  const pushBody = (bodyKey, spawnerKey = "") => {
    if (!bodyKey) return;
    const body = cache.Bodies?.[bodyKey];
    if (!body) return;
    if (!seen.has(bodyKey)) {
      const system = cache.SolarSystems?.[body.solarSystem];
      const systemKey = body.solarSystem || "";
      const placement = {
        bodyKey,
        body,
        bodyName: bodyDisplayName(bodyKey, body, cache),
        systemKey,
        system,
        systemName: titleFor(system, systemKey),
        systemVisible: isVisibleMapSystem(system, systemKey),
        systemStatus: systemStatusInfo(system, systemKey),
        bodyEvent: body.event || "",
        bodyActive: body.active !== false,
        hidden: /hidden/i.test(String(body.name || "")),
        triggeredByMission: false,
        spawnerKeys: []
      };
      seen.set(bodyKey, placement);
      placements.push(placement);
    }
    if (spawnerKey && !seen.get(bodyKey).spawnerKeys.includes(spawnerKey)) {
      seen.get(bodyKey).spawnerKeys.push(spawnerKey);
    }
  };

  for (const [bodyKey, body] of Object.entries(cache.Bodies || {})) {
    if (body?.boss === bossKey) pushBody(bodyKey);
  }
  for (const mount of cache.Bosses?.[bossKey]?.spawners || []) {
    const spawnerKey = mount?.spawner || refKey("Spawners", mount);
    const spawner = cache.Spawners?.[spawnerKey];
    if (spawner?.body) pushBody(spawner.body, spawnerKey);
  }
  for (const [spawnerKey, spawner] of Object.entries(cache.Spawners || {})) {
    if (spawner?.bossSpawner === bossKey || spawner?.bossSpawner2 === bossKey) pushBody(spawner.body, spawnerKey);
  }
  return placements;
}

export function sourceLocationInfo(source, cache) {
  const dedupe = (items) => [...new Map(items.filter(Boolean).map((item) => [`${item.systemKey}:${item.bodyKey}`, item])).values()];
  if (source.body) {
    const direct = bodyLocationInfo(source.body, cache);
    if (direct) return { ...direct, extraLocations: 0 };
  }
  if (source.table === "Enemies") {
    const locations = dedupe(Object.entries(cache.Spawners || {})
      .filter(([, spawner]) => spawnerEnemyKeys(spawner).includes(source.key))
      .map(([, spawner]) => bodyLocationInfo(spawner.body, cache)));
    if (locations.length) return { ...locations[0], extraLocations: locations.length - 1 };
  }
  if (source.table === "Bosses") {
    const bodyLocations = dedupe(Object.entries(cache.Bodies || {})
      .filter(([, body]) => body.boss === source.key)
      .map(([bodyKey]) => bodyLocationInfo(bodyKey, cache)));
    if (bodyLocations.length) return { ...bodyLocations[0], extraLocations: bodyLocations.length - 1 };
    const spawnerLocations = dedupe(Object.entries(cache.Spawners || {})
      .filter(([, spawner]) => spawner.bossSpawner === source.key || spawner.bossSpawner2 === source.key)
      .map(([, spawner]) => bodyLocationInfo(spawner.body, cache)));
    if (spawnerLocations.length) return { ...spawnerLocations[0], extraLocations: spawnerLocations.length - 1 };
    const bossMounts = dedupe((cache.Bosses?.[source.key]?.spawners || [])
      .map((mount) => cache.Spawners?.[mount?.spawner || refKey("Spawners", mount)])
      .map((spawner) => bodyLocationInfo(spawner?.body, cache)));
    if (bossMounts.length) return { ...bossMounts[0], extraLocations: bossMounts.length - 1 };
  }
  return null;
}

export function resolvedSystemBodies(systemKey, cache) {
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
    const sourceName = titleFor(body, bodyKey);
    const displayName = bodyDisplayName(bodyKey, body, cache);
    return {
      key: bodyKey,
      name: displayName,
      sourceName,
      displayName,
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

export function isVisibleMapSystem(system, key = "") {
  if (!system) return false;
  const type = String(system.type || "").toLowerCase();
  const name = String(system.name || key || "").trim().toLowerCase();
  if (name === "dev") return false;
  if (type && !["regular", "pvp"].includes(type)) return false;
  if (/debug|test/.test(type)) return false;
  return true;
}
