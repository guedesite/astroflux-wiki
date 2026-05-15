import { valueLabel } from "./display-utils.js";
import { entityLink } from "./entity-links.js";
import { escapeHtml } from "./html-utils.js";
import { titleFor } from "./record-utils.js";
export function resolveShopItem(item, cache) {
  const key = item?.item || item?.key || item?.itemKey || "";
  const table = item?.table || item?.itemTable || item?.type || "";
  if (table && key) {
    return { table, key, name: item?.name || titleFor(cache[table]?.[key], key) };
  }
  for (const candidate of ["Skins", "Weapons", "Commodities", "Ships", "ArtifactTypes", "Engines"]) {
    if (key && cache[candidate]?.[key]) {
      return { table: candidate, key, name: item?.name || titleFor(cache[candidate]?.[key], key) };
    }
  }
  return { table: "", key, name: item?.name || key || "n/a" };
}

export function shopItemLink(item, cache, routes) {
  const resolved = resolveShopItem(item, cache);
  if (resolved.table === "Skins" && cache.Skins?.[resolved.key]?.ship) {
    return entityLink("Ships", cache.Skins[resolved.key].ship, cache, routes, resolved.name);
  }
  return resolved.table
    ? entityLink(resolved.table, resolved.key, cache, routes, resolved.name)
    : `<span>${escapeHtml(resolved.name)}</span>`;
}

export function shopItemPriceHtml(item, cache, routes) {
  return (item?.priceItems || []).length
    ? item.priceItems.map((price) => `${entityLink("Commodities", price.item, cache, routes)} x${escapeHtml(valueLabel(price.amount))}`).join("<br>")
    : "<span>n/a</span>";
}

