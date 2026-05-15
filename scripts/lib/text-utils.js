import { escapeHtml } from "./html-utils.js";

export function cleanText(value) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

export function renderDescription(value) {
  const text = cleanText(value);
  if (!text) return "";
  const lines = text.split("\n").map((line) => line.replace(/^-\s*/, "").trim()).filter(Boolean);
  if (lines.length > 1) return `<ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`;
  return `<p>${escapeHtml(lines[0] || text)}</p>`;
}
