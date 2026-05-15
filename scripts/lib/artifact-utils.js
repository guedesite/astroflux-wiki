import {
  ARTIFACT_STAT_LABELS,
  UNIQUE_ARTIFACT_BUILD_HINTS,
  UNIQUE_ARTIFACT_DESCRIPTIONS,
  UNIQUE_ARTIFACT_ICON_HINTS,
  UNIQUE_ARTIFACT_TYPES
} from "./build-constants.js";
import { formatNumber, numberValue, rangeText, valueLabel } from "./display-utils.js";
import { slugify } from "./html-utils.js";
import { titleFor } from "./record-utils.js";

export const ARTIFACT_FINDER_BANDS = [
  { id: "1-49", label: "1-49", min: 1, max: 49 },
  { id: "50-60", label: "50-60", min: 50, max: 60 },
  { id: "61-70", label: "61-70", min: 61, max: 70 },
  { id: "71-80", label: "71-80", min: 71, max: 80 },
  { id: "81-90", label: "81-90", min: 81, max: 90 },
  { id: "91-100", label: "91-100", min: 91, max: 100 },
  { id: "101-110", label: "101-110", min: 101, max: 110 },
  { id: "111-120", label: "111-120", min: 111, max: 120 },
  { id: "121-130", label: "121-130", min: 121, max: 130 },
  { id: "131-150", label: "131-150", min: 131, max: 150 }
];

export function artifactBaseType(type) {
  return String(type || "").replace(/[23]$/, "");
}

export function artifactStatLabel(type) {
  return ARTIFACT_STAT_LABELS[type] || ARTIFACT_STAT_LABELS[artifactBaseType(type)] || valueLabel(type);
}

export function artifactStatValue(type, value) {
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

export function artifactStatNumber(type, value) {
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

export function artifactNumericRange(record) {
  const min = record.add ? record.addMinValue : record.multiMinValue;
  const max = record.add ? record.addMaxValue : record.multiMaxValue;
  const raw = [min, max].filter((value) => value !== undefined && value !== null && value !== "");
  if (!raw.length) return { min: "", max: "" };
  const values = raw.map((value) => artifactStatNumber(record.type, value));
  return { min: Math.min(...values), max: Math.max(...values) };
}

export function artifactValueRange(record) {
  const min = record.add ? record.addMinValue : record.multiMinValue;
  const max = record.add ? record.addMaxValue : record.multiMaxValue;
  if (min === undefined && max === undefined) return "n/a";
  if (min === undefined || min === max) return artifactStatValue(record.type, max);
  return `${artifactStatValue(record.type, min)} to ${artifactStatValue(record.type, max)}`;
}

export function artifactLevelRange(record) {
  if (record.minLevel === undefined && record.maxLevel === undefined) return "Any";
  return rangeText(record.minLevel ?? 1, record.maxLevel ?? 150);
}

export function artifactFinderBandFor(level) {
  const value = numberValue(level, 0);
  return ARTIFACT_FINDER_BANDS.find((band) => value >= band.min && value <= band.max) || ARTIFACT_FINDER_BANDS[ARTIFACT_FINDER_BANDS.length - 1];
}

export function artifactIsUnique(record) {
  return UNIQUE_ARTIFACT_TYPES.has(record?.type);
}

export function artifactRarityLabel(record) {
  if (artifactIsUnique(record)) return "Unique";
  if (record.special) return "Special";
  return "Normal";
}

export function artifactUpgradeLabel(record) {
  return artifactIsUnique(record) ? "No, unique artifacts cannot be upgraded" : "Yes";
}

export function uniqueArtifactLabelFromTexture(textureName) {
  return String(textureName || "")
    .replace(/^artifact_unique_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bOf\b/g, "of");
}

export function normalizedLookupName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function uniqueDropEntry(cache) {
  return Object.entries(cache.Drops || {}).find(([, drop]) => /unique artifact/i.test(drop.name || ""));
}

export function artifactDropEntries(record, cache) {
  return (record?.drops || []).filter((item) => {
    const drop = cache.Drops?.[item.drop];
    return numberValue(drop?.artifactChance, 0) > 0 || /artifact/i.test(drop?.name || item.name || "");
  });
}

export function uniqueArtifactCatalog(cache) {
  const bossByName = new Map(Object.entries(cache.Bosses || {}).map(([key, boss]) => [normalizedLookupName(titleFor(boss, key)), { key, boss }]));
  return Object.entries(cache.Images || {})
    .filter(([, image]) => /^artifact_unique_/i.test(image.textureName || ""))
    .map(([imageKey, image]) => {
      const textureName = image.textureName || "";
      const hint = UNIQUE_ARTIFACT_ICON_HINTS[textureName] || {};
      const statHint = UNIQUE_ARTIFACT_BUILD_HINTS[hint.stat] || {};
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
        bossKeys,
        damageType: hint.damageType || statHint.damageType || "",
        focus: hint.focus || statHint.focus || ""
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function uniqueArtifactSourceStatus(item, cache) {
  const hasStat = item.stat && UNIQUE_ARTIFACT_TYPES.has(item.stat);
  if (item.bossKeys.length && hasStat) return "Boss sprite match + unique stat";
  if (item.bossKeys.length) return "Boss sprite match";
  if (item.confidence === "direct-stat-name") return "Direct unique stat";
  if (hasStat) return "Inferred unique stat";
  return "Sprite only";
}

export function uniqueArtifactEffectRole(item) {
  const text = `${item.stat ? artifactStatLabel(item.stat) : ""} ${item.stat ? (UNIQUE_ARTIFACT_DESCRIPTIONS[item.stat] || "") : ""}`.toLowerCase();
  const buffMatch = /(increase|adds?|improv|boost|grant|regen|recovery|heal|leech|doubles?)/.test(text);
  const debuffMatch = /(reduce|reduces|reduc|slow|disable|ignite|overload|penetrat|drain|shockwave|reflect)/.test(text);
  if (buffMatch && debuffMatch) return "Mixed";
  if (debuffMatch) return "Debuff";
  if (buffMatch) return "Buff";
  if (item.stat) return "Utility";
  return "Unknown";
}

export function uniqueArtifactFocusSummary(item) {
  const parts = [];
  const damageType = String(item.damageType || "");
  const focus = String(item.focus || "");
  if (damageType && (!focus || !focus.toLowerCase().includes(damageType.toLowerCase()))) parts.push(damageType);
  if (focus && !parts.includes(focus)) parts.push(focus);
  return parts.join(" / ");
}

export function uniqueArtifactRowNotes(item) {
  const focus = uniqueArtifactFocusSummary(item);
  if (item.stat && UNIQUE_ARTIFACT_TYPES.has(item.stat)) {
    return focus
      ? `${UNIQUE_ARTIFACT_DESCRIPTIONS[item.stat] || artifactStatLabel(item.stat)} Best fit: ${focus}.`
      : UNIQUE_ARTIFACT_DESCRIPTIONS[item.stat] || artifactStatLabel(item.stat);
  }
  return focus
    ? `Best fit: ${focus}. The downloaded client cache does not expose a fixed stat type or value for this sprite.`
    : "The downloaded client cache does not expose a fixed stat type or value for this sprite.";
}

export function artifactFinderRollChance(drop) {
  const chance = numberValue(drop?.artifactChance, 0);
  if (chance > 0) return chance;
  return numberValue(drop?.artifactAmount, 0) > 0 ? 1 : 0;
}

export function artifactFinderEligiblePool(artifacts, artifactLevel) {
  return artifacts
    .filter(({ record }) => !artifactIsUnique(record))
    .filter(({ record }) => artifactLevel >= numberValue(record.minLevel, 1) && artifactLevel <= numberValue(record.maxLevel, 150))
    .sort((a, b) => a.entry.name.localeCompare(b.entry.name));
}
