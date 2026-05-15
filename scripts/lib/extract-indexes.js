import { compactStats, titleFor } from "./extract-helpers.js";

export function buildDropIndex(cache) {
  const drops = cache.Drops || {};
  return Object.entries(drops).map(([key, record]) => {
    const crateChance = record.crate ? Number(record.chance ?? 1) : 1;
    const items = (record.dropItems || []).map((item) => {
      const itemChance = Number(item.chance ?? 1);
      const target = cache[item.table]?.[item.item];
      return {
        table: item.table,
        key: item.item,
        name: target ? titleFor(target, item.item) : null,
        chance: itemChance,
        effective_chance: crateChance * itemChance,
        min: item.min ?? null,
        max: item.max ?? null
      };
    });
    return {
      id: `Drops:${key}`,
      source_key: key,
      name: titleFor(record, key),
      crate: Boolean(record.crate),
      crate_chance: crateChance,
      artifact_chance: record.artifactChance ?? null,
      flux_min: record.fluxMin ?? null,
      flux_max: record.fluxMax ?? null,
      xp_min: record.xpMin ?? null,
      xp_max: record.xpMax ?? null,
      items
    };
  });
}

export function buildMapIndex(cache) {
  const systems = Object.entries(cache.SolarSystems || {}).map(([key, system]) => ({
    id: `SolarSystems:${key}`,
    key,
    name: titleFor(system, key),
    type: system.type ?? null,
    galaxy: system.galaxy ?? null,
    x: system.x ?? null,
    y: system.y ?? null,
    size: system.size ?? null
  }));

  const bodies = Object.entries(cache.Bodies || {}).map(([key, body]) => ({
    id: `Bodies:${key}`,
    key,
    name: titleFor(body, key),
    type: body.type ?? null,
    solar_system: body.solarSystem ? `SolarSystems:${body.solarSystem}` : null,
    parent: body.parent ? `Bodies:${body.parent}` : null,
    x: body.x ?? null,
    y: body.y ?? null,
    orbit_angle: body.orbitAngle ?? null,
    orbit_radius: body.orbitRadius ?? null,
    orbit_speed: body.orbitSpeed ?? null,
    landable: body.landable ?? null,
    explorable: body.explorable ?? null,
    level: body.level ?? null
  }));

  const warpPaths = Object.entries(cache.WarpPaths || {}).map(([key, warpPath]) => ({
    id: `WarpPaths:${key}`,
    key,
    name: titleFor(warpPath, key),
    stats: compactStats(warpPath)
  }));

  return { systems, bodies, warpPaths };
}
