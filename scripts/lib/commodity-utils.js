import { numberValue, percentLabel, rangeText } from "./display-utils.js";
import { dropSourceData, sourceSortScore } from "./drop-utils.js";
import { titleFor } from "./record-utils.js";

export function commoditySourceRowsData(itemKey, cache) {
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
