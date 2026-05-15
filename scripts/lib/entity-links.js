import { escapeAttr, escapeHtml } from "./html-utils.js";
import { titleFor } from "./record-utils.js";

export function missingValue(label = "n/a") {
  return `<span class="missing-value">${escapeHtml(label)}</span>`;
}

export function refKey(table, value) {
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
  return value[byTable[table]] || value.drop || value.key || value.id || value.item || value.weapon || "";
}

export function entityLink(table, key, cache, routes, fallback = null) {
  key = refKey(table, key);
  if (!table || !key) return missingValue("n/a");
  const id = `${table}:${key}`;
  const record = cache[table]?.[key];
  const label = fallback || (record ? titleFor(record, key) : key);
  const href = routes.get(id);
  return href ? `<a href="${escapeAttr(href)}">${escapeHtml(label)}</a>` : `<span>${escapeHtml(label)}</span>`;
}

export function entityLinks(table, value, cache, routes) {
  if (!Array.isArray(value)) return entityLink(table, value, cache, routes);
  const links = value.map((item) => entityLink(table, item, cache, routes)).filter((html) => !html.includes('class="missing-value"'));
  return links.length ? links.join(", ") : missingValue();
}

export function soundLink(key, cache, routes) {
  return cache.Sounds?.[key] ? entityLink("Sounds", key, cache, routes) : missingValue();
}
