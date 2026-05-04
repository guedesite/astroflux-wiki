import fs from "node:fs";
import path from "node:path";

import { ROOT_INDEX_FILE } from "./project-paths.js";
import { ensureDir } from "./file-utils.js";

export function buildRootIndexHtml(targetHref = "dist/") {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Astroflux Wiki</title>
  <meta http-equiv="refresh" content="0; url=${targetHref}">
  <link rel="canonical" href="${targetHref}">
  <script>window.location.replace(${JSON.stringify(targetHref)});</script>
</head>
<body>
  <p>Redirecting to <a href="${targetHref}">${targetHref}</a>...</p>
</body>
</html>
`;
}

export function writeRootIndexPage(targetFile = ROOT_INDEX_FILE, targetHref = "dist/") {
  ensureDir(path.dirname(targetFile));
  fs.writeFileSync(targetFile, buildRootIndexHtml(targetHref), "utf8");
}
