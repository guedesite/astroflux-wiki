import path from "node:path";

export function siteBaseHref(file, rootDir) {
  const relative = path.relative(path.dirname(file), rootDir).replace(/\\/g, "/");
  return relative ? `${relative}/` : "./";
}

export function stripLeadingSlashSiteUrls(text) {
  return String(text)
    .replace(/(["'])\/(?!\/)/g, "$1")
    .replace(/(&#39;|&quot;)\/(?!\/)/g, "$1");
}
