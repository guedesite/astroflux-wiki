import { formatNumber, numberValue, statCard, valueLabel } from "./display-utils.js";
import { normalizeDropRefs } from "./drop-utils.js";
import { bossHpStats } from "./enemy-utils.js";
import { entityLink, refKey } from "./entity-links.js";
import { escapeAttr, escapeHtml } from "./html-utils.js";
import { atlasFrameStyle, findAtlasSprite, renderBossPartCard, renderImageThumb } from "./media-utils.js";
import { renderSourceDropArticles } from "./render-drops.js";

function entryKey(entry) {
  return entry.id.split(":")[1];
}
export function bossImageKeys(record, cache = null) {
  const keys = [];
  if (record.bitmap) keys.push(record.bitmap);
  for (const obj of record.basicObjs || []) {
    if (obj?.bitmap) keys.push(obj.bitmap);
  }
  if (cache) {
    for (const mount of record.turrets || []) {
      const turretKey = mount?.turret || refKey("Turrets", mount);
      const shipKey = cache.Turrets?.[turretKey]?.body;
      const bitmap = shipKey ? cache.Ships?.[shipKey]?.bitmap : "";
      if (bitmap) keys.push(bitmap);
    }
    for (const mount of record.spawners || []) {
      const spawnerKey = mount?.spawner || refKey("Spawners", mount);
      const bitmap = cache.Spawners?.[spawnerKey]?.bitmap;
      if (bitmap) keys.push(bitmap);
    }
  }
  return [...new Set(keys)];
}


export function renderBossListing(entries, cache, media, routes) {
  const rows = entries.map((entry) => {
    const key = entryKey(entry);
    const boss = cache.Bosses?.[key];
    if (!boss) return "";
    const sprite = renderBossSpriteThumb(boss, cache, media);
    const hp = bossHpStats(boss, cache);
    return `<tr data-hp="${escapeAttr(hp.displayHp || 0)}"><td class="name-cell">${sprite}<a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${escapeHtml(valueLabel(boss.level))}</td><td>${escapeHtml(hp.displayHp !== "" ? formatNumber(hp.displayHp, 0) : "n/a")}</td><td>${escapeHtml(valueLabel(boss.xp))}</td><td>${escapeHtml(valueLabel((boss.basicObjs || []).length))}</td><td>${escapeHtml(valueLabel((boss.turrets || []).length))}</td><td>${entityLink("Drops", boss.drops, cache, routes)}</td><td>${escapeHtml(valueLabel(boss.kineticResist))}</td><td>${escapeHtml(valueLabel(boss.energyResist))}</td><td>${escapeHtml(valueLabel(boss.corrosiveResist))}</td></tr>`;
  }).join("");
  return `<h1>Bosses</h1><p class="muted">Boss sprites are assembled from the boss <code>basicObjs</code> parts used by the game client. HP is calculated from boss HP, linked ship HP, or the sum of destructible sprite-part HP when the boss is made from parts.</p><input class="table-filter" name="table-filter" placeholder="Filter bosses"><div class="table-wrap"><table class="sortable filterable"><thead><tr><th>Boss</th><th>Level</th><th>HP</th><th>XP</th><th>Sprite parts</th><th>Turrets</th><th>Loot</th><th>Kinetic res</th><th>Energy res</th><th>Corrosive res</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}


export function renderBossPage(record, cache, media, routes) {
  const sections = renderBossPageSections(record, cache, media, routes);
  return [sections.preMedia, sections.postMedia].filter(Boolean).join("");
}

export function renderBossPageSections(record, cache, media, routes) {
  const hp = bossHpStats(record, cache);
  const dropRefs = normalizeDropRefs(record.drops);
  const lootLinks = [...new Set((record.drops || []).map((item) => item.drop).filter(Boolean))]
    .map((dropKey) => entityLink("Drops", dropKey, cache, routes))
    .join(", ");
  const spawnerLinks = [...new Set((record.spawners || []).map((item) => item.spawner).filter(Boolean))]
    .map((spawnerKey) => `<li>Spawner: ${entityLink("Spawners", spawnerKey, cache, routes)}</li>`)
    .join("");
  const turretLinks = [...new Set((record.turrets || []).map((item) => item.turret).filter(Boolean))]
    .map((turretKey) => `<li>Turret: ${entityLink("Turrets", turretKey, cache, routes)}</li>`)
    .join("");
  return {
    preMedia: `<section class="content-grid">${renderSourceDropArticles("Boss", dropRefs, cache, media, routes)}<article><h2>Boss Stats</h2><div class="stat-grid">${statCard("Level", record.level)}${statCard("HP", hp.displayHp !== "" ? formatNumber(hp.displayHp, 0) : "", hp.source)}${statCard("Total part HP", hp.totalPartHp !== "" ? formatNumber(hp.totalPartHp, 0) : "")}${statCard("Highest part HP", hp.highestPartHp !== "" ? formatNumber(hp.highestPartHp, 0) : "")}${statCard("Destructible parts", hp.destructibleParts)}${statCard("XP", record.xp)}${statCard("Regen", record.regen)}${statCard("Radius", record.radius)}${statCard("Speed", record.speed)}${statCard("Reset", record.resetTime)}${statCard("Body sprites", (record.basicObjs || []).length)}${statCard("Turret sprites", (record.turrets || []).length)}${statCard("Spawner sprites", (record.spawners || []).length)}${statCard("Kinetic resist", record.kineticResist)}${statCard("Energy resist", record.energyResist)}${statCard("Corrosive resist", record.corrosiveResist)}</div></article></section>`,
    postMedia: `<section class="content-grid">${renderBossLayeredPreview(record, cache, media)}${renderBossSpriteParts(record, cache, media, routes)}<article><h2>Encounter Links</h2><ul class="link-list"><li>Loot: ${lootLinks || "<span>n/a</span>"}</li><li>Explosion sound: ${entityLink("Sounds", record.explosionSound, cache, routes)}</li>${spawnerLinks}${turretLinks}</ul></article></section>`
  };
}


function renderBossSpriteThumb(record, cache, media) {
  const assembled = renderBossLayeredMini(record, cache, media);
  if (assembled) return assembled;
  for (const key of bossImageKeys(record, cache)) {
    const image = cache.Images?.[key];
    if (!image) continue;
    const thumb = renderImageThumb(image, media);
    if (thumb) return thumb;
  }
  return "";
}

function bossRotatedBounds(width, height, degrees) {
  const rad = numberValue(degrees, 0) * Math.PI / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return {
    width: width * cos + height * sin,
    height: width * sin + height * cos
  };
}

function bossLayeredParts(record, cache, media) {
  const parts = [];
  const addPart = (obj, index, kind, imageKey, refTable = "", refKeyValue = "") => {
    const image = cache.Images?.[imageKey];
    if (!image) return null;
    const atlas = findAtlasSprite(media, image);
    if (!atlas) return null;
    const frame = atlas.frames[0];
    const partScale = numberValue(obj.scale, numberValue(image.scale, 1)) || 1;
    const width = frame.width * partScale;
    const height = frame.height * partScale;
    const angle = numberValue(obj.angle, numberValue(obj.rotation, 0));
    const rotated = bossRotatedBounds(width, height, angle);
    return {
      obj,
      image,
      imageKey,
      frame,
      frames: atlas.frames,
      index,
      x: numberValue(obj.xpos, 0) + numberValue(obj.imageOffsetX, 0),
      y: numberValue(obj.ypos, 0) + numberValue(obj.imageOffsetY, 0),
      sourceX: numberValue(obj.xpos, 0),
      sourceY: numberValue(obj.ypos, 0),
      imageOffsetX: numberValue(obj.imageOffsetX, 0),
      imageOffsetY: numberValue(obj.imageOffsetY, 0),
      layer: numberValue(obj.layer, 0),
      angle,
      rotationSpeed: numberValue(obj.rotationSpeed, 0),
      mirror: Boolean(obj.mirror),
      scale: partScale,
      width,
      height,
      boundsWidth: rotated.width,
      boundsHeight: rotated.height,
      isDeadState: /\bdead\b/i.test(obj.name || ""),
      isHiddenAtStart: obj.active === false || obj.hideIfInactive === true,
      kind,
      refTable,
      refKey: refKeyValue
    };
  };
  (record.basicObjs || []).forEach((obj) => {
    const part = obj?.bitmap ? addPart(obj, parts.length, "body", obj.bitmap) : null;
    if (part) parts.push(part);
  });
  (record.turrets || []).forEach((mount) => {
    const turretKey = mount?.turret || refKey("Turrets", mount);
    const turret = cache.Turrets?.[turretKey];
    const ship = cache.Ships?.[turret?.body];
    const bitmap = ship?.bitmap;
    const obj = {
      ...mount,
      name: mount?.name || turret?.name || ship?.name || "Turret",
      hp: ship?.hp,
      bitmap,
      rotationSpeed: mount?.rotationSpeed ?? turret?.rotationSpeed ?? turret?.forcedRotationSpeed ?? 0,
      scale: mount?.scale ?? 1
    };
    const part = bitmap ? addPart(obj, parts.length, "turret", bitmap, "Turrets", turretKey) : null;
    if (part) parts.push(part);
  });
  (record.spawners || []).forEach((mount) => {
    const spawnerKey = mount?.spawner || refKey("Spawners", mount);
    const spawner = cache.Spawners?.[spawnerKey];
    const bitmap = spawner?.bitmap;
    const obj = {
      ...mount,
      name: mount?.name || spawner?.name || "Spawner",
      hp: spawner?.hp,
      bitmap,
      scale: mount?.scale ?? numberValue(spawner?.scale, 1)
    };
    const part = bitmap ? addPart(obj, parts.length, "spawner", bitmap, "Spawners", spawnerKey) : null;
    if (part) parts.push(part);
  });
  return parts;
}

function bossLayeredStage(parts, options = {}) {
  const maxWidth = options.maxWidth ?? 760;
  const maxHeight = options.maxHeight ?? 560;
  const maxScale = options.maxScale ?? 1.2;
  const minWidth = options.minWidth ?? 240;
  const minHeight = options.minHeight ?? 180;
  const pad = options.pad ?? 30;
  const containerClass = options.containerClass || "boss-layered-preview";
  const layerClass = options.layerClass || "boss-layer";
  const spriteClass = options.spriteClass || "boss-layer-sprite";
  const animate = options.animate !== false;
  const limit = options.limit ?? 120;
  const minX = Math.min(...parts.map((part) => part.x - part.boundsWidth / 2));
  const maxX = Math.max(...parts.map((part) => part.x + part.boundsWidth / 2));
  const minY = Math.min(...parts.map((part) => part.y - part.boundsHeight / 2));
  const maxY = Math.max(...parts.map((part) => part.y + part.boundsHeight / 2));
  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  const stageScale = Math.min(maxScale, maxWidth / contentWidth, maxHeight / contentHeight);
  const stageWidth = Math.max(minWidth, Math.round(contentWidth * stageScale + pad * 2));
  const stageHeight = Math.max(minHeight, Math.round(contentHeight * stageScale + pad * 2));
  const layers = parts
    .sort((a, b) => a.layer - b.layer || a.index - b.index)
    .slice(0, limit)
    .map((part, visualIndex) => {
      const x = pad + (part.x - part.width / 2 - minX) * stageScale;
      const y = pad + (part.y - part.height / 2 - minY) * stageScale;
      const spriteScale = stageScale * part.scale;
      const duration = part.rotationSpeed ? Math.max(2.8, Math.min(18, 7 / Math.abs(part.rotationSpeed))) : 0;
      const drift = Math.min(5, Math.max(1, Math.abs(part.layer) + 1));
      const layerStyle = [
        `left:${Math.round(x)}px`,
        `top:${Math.round(y)}px`,
        `z-index:${100 + part.layer * 10 + visualIndex}`,
        animate ? `--drift-x:${drift}px` : "",
        animate ? `--drift-x-neg:-${drift}px` : "",
        animate ? `--drift-y:${(drift * 0.35).toFixed(2)}px` : "",
        animate ? `--drift-y-neg:-${(drift * 0.35).toFixed(2)}px` : "",
        animate ? `animation-delay:-${(visualIndex % 9) * 0.22}s` : ""
      ].filter(Boolean).join(";");
      const spriteStyle = [
        atlasFrameStyle(part.frame, spriteScale),
        `--base-rot:${part.angle}deg`,
        part.mirror ? "--mirror:-1" : "",
        `--spin:${part.rotationSpeed < 0 ? "-360deg" : "360deg"}`,
        part.rotationSpeed ? `animation-duration:${duration.toFixed(2)}s` : ""
      ].filter(Boolean).join(";");
      const frameAttr = (part.frames || []).length > 1
        ? ` data-frames="${escapeAttr(JSON.stringify(part.frames.map((item) => ({ style: `${atlasFrameStyle(item, spriteScale)};--base-rot:${part.angle}deg;${part.mirror ? "--mirror:-1;" : ""}${part.rotationSpeed ? `--spin:${part.rotationSpeed < 0 ? "-360deg" : "360deg"};animation-duration:${duration.toFixed(2)}s;` : ""}`, name: item.name }))))}"`
        : "";
      const stateClass = `${part.rotationSpeed ? " spinning" : ""}${part.isDeadState ? " dead-state" : ""}${part.isHiddenAtStart ? " hidden-start" : ""} ${part.kind || "body"}-part`;
      const title = [
        part.kind ? `${part.kind} part` : "Boss part",
        part.obj.name || part.image.fileName || "Boss part",
        `layer ${valueLabel(part.layer)}`,
        `angle ${valueLabel(part.angle)}`,
        part.refTable && part.refKey ? `${part.refTable}:${part.refKey}` : "",
        part.imageOffsetX || part.imageOffsetY ? `image offset ${valueLabel(part.imageOffsetX)}, ${valueLabel(part.imageOffsetY)}` : ""
      ].filter(Boolean).join(" / ");
      return `<span class="${layerClass}" style="${escapeAttr(layerStyle)}" title="${escapeAttr(title)}"><span class="${spriteClass}${stateClass}"${frameAttr} style="${escapeAttr(spriteStyle)}" role="img" aria-label="${escapeAttr(part.image.fileName || part.obj.name || "Boss part")}"></span></span>`;
    }).join("");
  return {
    html: `<div class="${containerClass}" style="width:${stageWidth}px;height:${stageHeight}px">${layers}</div>`,
    width: stageWidth,
    height: stageHeight,
    scale: stageScale,
    rendered: Math.min(parts.length, limit)
  };
}

function renderBossLayeredMini(record, cache, media) {
  const rawParts = bossLayeredParts(record, cache, media);
  if (!rawParts.length) return "";
  return bossLayeredStage(rawParts, {
    maxWidth: 72,
    maxHeight: 56,
    minWidth: 58,
    minHeight: 48,
    maxScale: 0.8,
    pad: 4,
    containerClass: "boss-mini-preview",
    layerClass: "boss-mini-layer",
    spriteClass: "boss-mini-sprite",
    animate: true
  }).html;
}

export function renderBossLayeredCard(record, cache, media) {
  const rawParts = bossLayeredParts(record, cache, media);
  if (!rawParts.length) return "";
  const stage = bossLayeredStage(rawParts, {
    maxWidth: 260,
    maxHeight: 220,
    minWidth: 180,
    minHeight: 150,
    maxScale: 1,
    pad: 12,
    containerClass: "boss-card-preview",
    layerClass: "boss-mini-layer",
    spriteClass: "boss-mini-sprite",
    animate: true
  });
  return `<figure class="media-card boss-assembled-card primary">${stage.html}<figcaption>${escapeHtml(record.name || "Boss")} assembled from ${rawParts.length} sprite part${rawParts.length === 1 ? "" : "s"}</figcaption></figure>`;
}

function renderBossLayeredPreview(record, cache, media) {
  const rawParts = bossLayeredParts(record, cache, media);
  if (!rawParts.length) return "";
  const deadCount = rawParts.filter((part) => part.isDeadState).length;
  const hiddenCount = rawParts.filter((part) => part.isHiddenAtStart).length;
  const offsetCount = rawParts.filter((part) => part.imageOffsetX || part.imageOffsetY).length;
  const bodyCount = rawParts.filter((part) => part.kind === "body").length;
  const turretCount = rawParts.filter((part) => part.kind === "turret").length;
  const spawnerCount = rawParts.filter((part) => part.kind === "spawner").length;
  const stage = bossLayeredStage(rawParts, {
    maxWidth: 760,
    maxHeight: 560,
    minWidth: 240,
    minHeight: 180,
    maxScale: 1.2,
    pad: 30,
    animate: true
  });
  const notes = [
    `${stage.rendered} of ${rawParts.length} sprite part${rawParts.length === 1 ? "" : "s"} rendered`,
    `${bodyCount} body / ${turretCount} turret / ${spawnerCount} spawner`,
    deadCount ? `${deadCount} dead-state variant${deadCount === 1 ? "" : "s"} included` : "",
    hiddenCount ? `${hiddenCount} initially hidden/triggered part${hiddenCount === 1 ? "" : "s"} included` : "",
    offsetCount ? `${offsetCount} part${offsetCount === 1 ? "" : "s"} use image offset data` : ""
  ].filter(Boolean).join(" / ");
  return `<article><h2>Animated Layer Preview</h2><p class="muted">This assembles boss body sprites, mounted turret sprites, and mounted spawner sprites from their source position, image offset, scale, angle, and layer order. Rotating parts use their source <code>rotationSpeed</code>. ${escapeHtml(notes)}.</p>${stage.html}</article>`;
}

function renderBossSpriteParts(record, cache, media, routes) {
  const parts = bossLayeredParts(record, cache, media);
  if (!parts.length) return "";
  const cards = parts.slice(0, 120).map((part) => {
    const card = renderBossPartCard(part.image, part.imageKey, media);
    const source = part.refTable && part.refKey ? entityLink(part.refTable, part.refKey, cache, routes) : escapeHtml(part.image.fileName || part.imageKey);
    return card ? `<div class="boss-part">${card}<dl><dt>Kind</dt><dd>${escapeHtml(valueLabel(part.kind))}</dd><dt>Part</dt><dd>${escapeHtml(part.obj.name || "Sprite part")}</dd><dt>Source</dt><dd>${source}</dd><dt>Layer</dt><dd>${escapeHtml(valueLabel(part.layer))}</dd><dt>HP</dt><dd>${escapeHtml(valueLabel(part.obj.hp))}</dd><dt>Position</dt><dd>${escapeHtml(valueLabel(part.sourceX))}, ${escapeHtml(valueLabel(part.sourceY))}</dd></dl></div>` : "";
  }).join("");
  return `<article><h2>Boss Sprite Parts</h2><p class="muted">These are the visual parts used in the assembled preview, including <code>basicObjs</code>, mounted turrets, and mounted spawners when the cache exposes their sprites.</p><div class="boss-sprite-grid">${cards}</div></article>`;
}

