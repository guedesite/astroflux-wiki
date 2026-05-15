import fs from "node:fs";
import path from "node:path";

import { ensureDir } from "./file-utils.js";
import { escapeHtml } from "./html-utils.js";
import { siteBaseHref, stripLeadingSlashSiteUrls } from "./site-url-utils.js";

export function pageShell(title, body, { nav = "", baseHref = "./", assetVersion = "dev" } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="${baseHref}">
  <title>${escapeHtml(title)} - Astroflux Wiki</title>
  <link rel="icon" href="assets/favicon.ico">
  <link rel="stylesheet" href="assets/site.css?v=${assetVersion}">
</head>
<body>
  <header>
    <a class="brand" href=".">Astroflux Wiki</a>
    <form class="site-search" role="search">
      <input id="search-input" type="search" placeholder="Search wiki" autocomplete="off">
      <div id="search-results" class="search-results" hidden></div>
    </form>
    <nav>
      <a href="guides/">Guides</a>
      <a href="quests/">Quests</a>
      <a href="systems/">Systems</a>
      <a href="stations/">Stations</a>
      <a href="enemies/">Enemies</a>
      <a href="bosses/">Bosses</a>
      <a href="weapons/">Weapons</a>
      <a href="ships/">Ships</a>
      <a href="commodities/">Items</a>
      <a href="artifacts/">Artifacts</a>
      <a href="drops/">Drops</a>
      <a href="media/">Media</a>
      <a href="map/">Map</a>
    </nav>
  </header>
  ${nav}
  <main>${body}</main>
  <footer class="site-footer">
    <p>Want to improve this wiki? Contributions are welcome on <a href="https://github.com/guedesite/astroflux-wiki">github.com/guedesite/astroflux-wiki</a>.</p>
  </footer>
  <script src="assets/search.js?v=${assetVersion}"></script>
</body>
</html>`;
}

export function writeSitePage(file, title, body, { nav = "", distDir, assetVersion = "dev" } = {}) {
  ensureDir(path.dirname(file));
  const html = pageShell(title, body, {
    nav,
    baseHref: siteBaseHref(file, distDir),
    assetVersion
  });
  fs.writeFileSync(file, stripLeadingSlashSiteUrls(html), "utf8");
}
