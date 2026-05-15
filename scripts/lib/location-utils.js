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
    .map(([, spawner]) => titleFor(cache.Enemies?.[spawner.enemy || spawner.enemy2], spawner.enemy || spawner.enemy2 || ""))
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

export function sourceLocationInfo(source, cache) {
  const dedupe = (items) => [...new Map(items.filter(Boolean).map((item) => [`${item.systemKey}:${item.bodyKey}`, item])).values()];
  if (source.body) {
    const direct = bodyLocationInfo(source.body, cache);
    if (direct) return { ...direct, extraLocations: 0 };
  }
  if (source.table === "Enemies") {
    const locations = dedupe(Object.entries(cache.Spawners || {})
      .filter(([, spawner]) => spawner.enemy === source.key || spawner.enemy2 === source.key || (spawner.enemies || []).some((enemy) => refKey("Enemies", enemy) === source.key))
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
