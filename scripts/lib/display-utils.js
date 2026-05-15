import { DAMAGE_TYPES } from "./build-constants.js";
import { escapeAttr, escapeHtml } from "./html-utils.js";

export function valueLabel(value) {
  if (value === null || value === undefined || value === "") return "n/a";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
  return String(value);
}

export function coordinateLabel(value) {
  if (value === null || value === undefined || value === "") return "n/a";
  const num = Number(value);
  if (!Number.isFinite(num)) return "n/a";
  return formatNumber(num * 0.025, 3);
}

export function statCard(label, value, hint = "") {
  const missing = value === null || value === undefined || value === "";
  return `<div class="stat-card"><span>${escapeHtml(label)}</span><strong${missing ? ' class="missing-value"' : ""}>${missing ? escapeHtml("n/a") : escapeHtml(valueLabel(value))}</strong>${hint ? `<small>${escapeHtml(hint)}</small>` : ""}</div>`;
}

export function tip(label, text) {
  return `<span class="tip" title="${escapeAttr(text)}">${escapeHtml(label)}</span>`;
}

export function damageTypeLabel(type) {
  if (type === null || type === undefined || type === "") return "n/a";
  return DAMAGE_TYPES[Number(type)] || `Type ${type}`;
}

export function numberValue(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function percentLabel(value) {
  if (value === null || value === undefined || value === "") return "n/a";
  const num = Number(value);
  if (!Number.isFinite(num)) return valueLabel(value);
  return `${(num * 100).toFixed(num < 0.01 && num > 0 ? 2 : 1).replace(/\.0$/, "")}%`;
}

export function rangeText(min, max) {
  const a = valueLabel(min);
  const b = valueLabel(max);
  return a === b ? a : `${a}-${b}`;
}

export function formatNumber(value, digits = 1) {
  const num = Number(value);
  if (!Number.isFinite(num)) return valueLabel(value);
  if (Math.abs(num) >= 1000) return Math.round(num).toLocaleString("en-US");
  return num.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}
