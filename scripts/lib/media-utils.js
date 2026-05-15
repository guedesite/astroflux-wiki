import fs from "node:fs";
import path from "node:path";

import { numberValue } from "./display-utils.js";
import { ensureDir } from "./file-utils.js";
import { escapeAttr, escapeHtml } from "./html-utils.js";
import { DIST_DIR, SOURCE_DIR } from "./project-paths.js";

export function renderImageCard(image, key, media, primary = false) {
  const local = media.byGameFile.get(image.fileName);
  if (local && isImageFile(image.fileName)) {
    return `<figure class="media-card image-card${primary ? " primary" : ""}"><img loading="lazy" src="${escapeAttr(local.url)}" alt="${escapeAttr(image.fileName)}"><figcaption>${escapeHtml(image.fileName)}</figcaption></figure>`;
  }
  const atlas = findAtlasSprite(media, image);
  if (atlas) return renderAtlasCard(atlas, image, primary);
  return `<div class="media-card missing"><strong>${escapeHtml(image.fileName || image.textureName || key)}</strong><span>GameFS texture ref: ${escapeHtml(image.type || "unknown")} / ${escapeHtml(image.textureName || "no textureName")}</span></div>`;
}

export function renderImageThumb(image, media, options = {}) {
  const size = Math.max(16, numberValue(options.size, 36));
  const frameClass = options.frameClass ? ` ${options.frameClass}` : "";
  const local = media.byGameFile.get(image.fileName);
  if (local && isImageFile(image.fileName)) {
    return `<span class="thumb-frame${escapeAttr(frameClass)}" style="width:${escapeAttr(size)}px;height:${escapeAttr(size)}px"><img class="thumb" loading="lazy" decoding="async" src="${escapeAttr(local.url)}" alt=""></span>`;
  }
  const atlas = findAtlasSprite(media, image);
  if (!atlas) return "";
  const frames = sampleAnimationFrames(atlas.frames, 12);
  const metrics = atlasThumbMetrics(frames, size);
  const framePayload = frames.map((item) => ({
    x: Math.round(item.x * metrics.scale),
    y: Math.round(item.y * metrics.scale),
    width: Math.max(1, Math.round(item.width * metrics.scale)),
    height: Math.max(1, Math.round(item.height * metrics.scale)),
    name: item.name
  }));
  const frameAttr = framePayload.length > 1 ? ` data-frame-data="${escapeAttr(JSON.stringify(framePayload))}"` : "";
  return `<span class="thumb-frame${escapeAttr(frameClass)}" style="width:${escapeAttr(size)}px;height:${escapeAttr(size)}px"><span class="thumb atlas-sprite"${frameAttr} style="${escapeAttr(atlasThumbStyle(frames[0], metrics))}" role="img" aria-label="${escapeAttr(image.fileName || atlas.label)}"></span></span>`;
}

export function resolveCanvasImageAsset(imageKey, cache, media) {
  if (!imageKey) return null;
  const image = cache.Images?.[imageKey];
  if (!image) return null;
  const local = media.byGameFile.get(image.fileName);
  if (local && isImageFile(image.fileName)) {
    return { url: local.url, label: image.fileName || image.textureName || imageKey };
  }
  const atlas = findAtlasSprite(media, image);
  const frame = atlas?.frames?.[0];
  if (!frame) return null;
  return {
    url: frame.url,
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
    atlasWidth: frame.atlasWidth,
    atlasHeight: frame.atlasHeight,
    label: atlas.label || image.fileName || image.textureName || imageKey
  };
}

function mediaImageStatus(image, media) {
  if (media.byGameFile.has(image.fileName) && isImageFile(image.fileName)) return "standalone file";
  if (findAtlasSprite(media, image)) return "atlas sprite";
  if (media.byGameFile.has(image.fileName)) return "non-image media";
  return "not found";
}

function isImageFile(file) {
  return [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(path.extname(file || "").toLowerCase());
}

export function findAtlasSprite(media, image) {
  if (!media.atlasByName) return null;
  const prefix = image.textureName || "";
  const animatedFrames = prefix.length >= 3 ? atlasFramesForTexture(media, prefix).slice(0, 24) : [];
  if ((image.animate || numberValue(image.animationCells, 0) > 1) && animatedFrames.length > 1) {
    return { frames: animatedFrames, label: prefix };
  }
  const names = [
    image.textureName,
    image.fileName ? path.basename(image.fileName, path.extname(image.fileName)) : "",
    image.textureName ? `${image.textureName}1` : "",
    image.textureName ? `${image.textureName}01` : ""
  ].filter(Boolean);
  for (const name of names) {
    if (media.atlasByName.has(name)) return { frames: [media.atlasByName.get(name)], label: name };
  }
  if (animatedFrames.length) return { frames: animatedFrames, label: prefix };
  return null;
}

function atlasFramesForTexture(media, prefix) {
  return [...media.atlasByName.values()]
    .filter((entry) => entry.name === prefix || (entry.name.startsWith(prefix) && /^\d+$/.test(entry.name.slice(prefix.length))))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

function sampleAnimationFrames(frames, limit = 12) {
  if (!Array.isArray(frames) || frames.length <= limit) return frames || [];
  const sampled = [];
  const seen = new Set();
  for (let index = 0; index < limit; index += 1) {
    const frame = frames[Math.min(frames.length - 1, Math.floor(index * frames.length / limit))];
    if (!frame || seen.has(frame.name)) continue;
    sampled.push(frame);
    seen.add(frame.name);
  }
  return sampled.length ? sampled : frames.slice(0, limit);
}

function atlasThumbMetrics(frames, box = 36) {
  const maxFrameWidth = Math.max(...frames.map((frame) => numberValue(frame?.width, 1)), 1);
  const maxFrameHeight = Math.max(...frames.map((frame) => numberValue(frame?.height, 1)), 1);
  const scale = Math.min(1, box / maxFrameWidth, box / maxFrameHeight);
  const atlasWidth = Math.max(...frames.map((frame) => numberValue(frame?.atlasWidth, 1)), 1);
  const atlasHeight = Math.max(...frames.map((frame) => numberValue(frame?.atlasHeight, 1)), 1);
  return {
    scale,
    boxWidth: Math.max(1, Math.round(maxFrameWidth * scale)),
    boxHeight: Math.max(1, Math.round(maxFrameHeight * scale)),
    atlasWidth,
    atlasHeight
  };
}

export function atlasFrameStyle(frame, scale = 1) {
  return [
    `width:${Math.max(1, Math.round(frame.width * scale))}px`,
    `height:${Math.max(1, Math.round(frame.height * scale))}px`,
    `background-image:url('${escapeAttr(frame.url)}')`,
    `background-size:${Math.round(frame.atlasWidth * scale)}px ${Math.round(frame.atlasHeight * scale)}px`,
    `background-position:-${Math.round(frame.x * scale)}px -${Math.round(frame.y * scale)}px`
  ].join(";");
}

function atlasStyle(frame, primary = false) {
  const maxWidth = primary ? 260 : 180;
  const maxHeight = primary ? 220 : 160;
  const minScale = primary ? 1.35 : 1;
  const scale = Math.min(minScale, maxWidth / frame.width, maxHeight / frame.height);
  return atlasFrameStyle(frame, scale);
}

function atlasThumbStyle(frame, metrics) {
  return [
    `width:${Math.max(1, Math.round(frame.width * metrics.scale))}px`,
    `height:${Math.max(1, Math.round(frame.height * metrics.scale))}px`,
    `background-image:url('${escapeAttr(frame.url)}')`,
    `background-size:${Math.round(metrics.atlasWidth * metrics.scale)}px ${Math.round(metrics.atlasHeight * metrics.scale)}px`,
    `background-position:-${Math.round(frame.x * metrics.scale)}px -${Math.round(frame.y * metrics.scale)}px`
  ].join(";");
}

function atlasCardMetrics(frames, primary = false) {
  const maxFrameWidth = Math.max(...frames.map((frame) => numberValue(frame?.width, 1)), 1);
  const maxFrameHeight = Math.max(...frames.map((frame) => numberValue(frame?.height, 1)), 1);
  const maxWidth = primary ? 260 : 180;
  const maxHeight = primary ? 220 : 160;
  const minScale = primary ? 1.35 : 1;
  const scale = Math.min(minScale, maxWidth / maxFrameWidth, maxHeight / maxFrameHeight);
  const atlasWidth = Math.max(...frames.map((frame) => numberValue(frame?.atlasWidth, 1)), 1);
  const atlasHeight = Math.max(...frames.map((frame) => numberValue(frame?.atlasHeight, 1)), 1);
  return {
    scale,
    boxWidth: Math.max(1, Math.round(maxFrameWidth * scale)),
    boxHeight: Math.max(1, Math.round(maxFrameHeight * scale)),
    atlasWidth,
    atlasHeight
  };
}

function renderAtlasCard(atlas, image, primary = false) {
  const frames = sampleAnimationFrames(atlas.frames, primary ? 18 : 12);
  const metrics = atlasCardMetrics(frames, primary);
  const frame = frames[0];
  const framePayload = frames.map((item) => ({
    x: Math.round(item.x * metrics.scale),
    y: Math.round(item.y * metrics.scale),
    width: Math.max(1, Math.round(item.width * metrics.scale)),
    height: Math.max(1, Math.round(item.height * metrics.scale)),
    name: item.name
  }));
  const frameAttr = framePayload.length > 1 ? ` data-frame-data="${escapeAttr(JSON.stringify(framePayload))}"` : "";
  return `<figure class="media-card atlas-card${primary ? " primary" : ""}"><span class="atlas-stage" style="--stage-w:${escapeAttr(metrics.boxWidth)}px;--stage-h:${escapeAttr(metrics.boxHeight)}px;--stage-max-h:${escapeAttr(primary ? 220 : 160)}px"><span class="atlas-sprite atlas-card-sprite"${frameAttr} style="${escapeAttr(atlasThumbStyle(frame, metrics))}" role="img" aria-label="${escapeAttr(image.fileName || atlas.label)}"></span></span><figcaption>${escapeHtml(image.fileName || atlas.label)}${framePayload.length > 1 ? ` (${framePayload.length} frames)` : ""}</figcaption></figure>`;
}

export function renderBossPartCard(image, key, media) {
  const local = media.byGameFile.get(image?.fileName);
  if (local && isImageFile(image?.fileName)) {
    return `<figure class="media-card image-card boss-part-visual"><span class="boss-part-stage"><img loading="lazy" decoding="async" src="${escapeAttr(local.url)}" alt="${escapeAttr(image.fileName || key)}"></span><figcaption>${escapeHtml(image.fileName || key)}</figcaption></figure>`;
  }
  const atlas = findAtlasSprite(media, image);
  if (!atlas) return "";
  const frames = sampleAnimationFrames(atlas.frames, 10);
  const metrics = atlasCardMetrics(frames, false);
  const fitScale = Math.min(metrics.scale, 128 / Math.max(metrics.boxWidth || 1, 1), 96 / Math.max(metrics.boxHeight || 1, 1));
  const bounded = {
    scale: fitScale,
    boxWidth: Math.max(1, Math.round(Math.max(...frames.map((frame) => numberValue(frame?.width, 1)), 1) * fitScale)),
    boxHeight: Math.max(1, Math.round(Math.max(...frames.map((frame) => numberValue(frame?.height, 1)), 1) * fitScale)),
    atlasWidth: metrics.atlasWidth,
    atlasHeight: metrics.atlasHeight
  };
  const frame = frames[0];
  const framePayload = frames.map((item) => ({
    x: Math.round(item.x * bounded.scale),
    y: Math.round(item.y * bounded.scale),
    width: Math.max(1, Math.round(item.width * bounded.scale)),
    height: Math.max(1, Math.round(item.height * bounded.scale)),
    name: item.name
  }));
  const frameAttr = framePayload.length > 1 ? ` data-frame-data="${escapeAttr(JSON.stringify(framePayload))}"` : "";
  return `<figure class="media-card atlas-card boss-part-visual"><span class="atlas-stage boss-part-stage" style="--stage-w:${escapeAttr(bounded.boxWidth)}px;--stage-h:${escapeAttr(bounded.boxHeight)}px"><span class="atlas-sprite atlas-card-sprite"${frameAttr} style="${escapeAttr(atlasThumbStyle(frame, bounded))}" role="img" aria-label="${escapeAttr(image.fileName || atlas.label)}"></span></span><figcaption>${escapeHtml(image.fileName || atlas.label)}${framePayload.length > 1 ? ` (${framePayload.length} frames)` : ""}</figcaption></figure>`;
}


function findSourceImage(nameToken) {
  const dir = path.join(SOURCE_DIR, "images");
  if (!fs.existsSync(dir)) return null;
  return fs.readdirSync(dir).find((file) => file.toLowerCase().includes(nameToken));
}

export function copyMediaAssets(cache) {
  const mediaDir = path.join(DIST_DIR, "assets", "source-images");
  const atlasDir = path.join(DIST_DIR, "assets", "atlases");
  const gamefsDir = path.join(SOURCE_DIR, "gamefs");
  ensureDir(mediaDir);
  ensureDir(atlasDir);
  const byGameFile = new Map();
  const availableImages = [];
  const availableAudio = [];
  const atlasByName = new Map();
  const sourceImageDir = path.join(SOURCE_DIR, "images");

  if (fs.existsSync(sourceImageDir)) {
    for (const file of fs.readdirSync(sourceImageDir)) {
      const ext = path.extname(file).toLowerCase();
      if (![".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) continue;
      const safeName = file.includes("logo_png") ? "logo.png" : file.includes("bg_jpg") ? "background.jpg" : file;
      fs.copyFileSync(path.join(sourceImageDir, file), path.join(mediaDir, safeName));
      availableImages.push({ source: file, url: `/assets/source-images/${safeName}` });
    }
  }

  const logo = findSourceImage("logo_png");
  const bg = findSourceImage("bg_jpg");
  if (logo) byGameFile.set("astroflux-logo", { url: "/assets/source-images/logo.png" });
  if (bg) byGameFile.set("astroflux-background", { url: "/assets/source-images/background.jpg" });

  const gamefsTextures = path.join(gamefsDir, "textures");
  if (fs.existsSync(gamefsTextures)) {
    for (const file of fs.readdirSync(gamefsTextures)) {
      const ext = path.extname(file).toLowerCase();
      if (![".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) continue;
      const outName = `gamefs-${file}`;
      fs.copyFileSync(path.join(gamefsTextures, file), path.join(mediaDir, outName));
      fs.copyFileSync(path.join(gamefsTextures, file), path.join(atlasDir, file));
      availableImages.push({ source: file, url: `/assets/source-images/${outName}` });
      byGameFile.set(file, { url: `/assets/source-images/${outName}` });
    }
    for (const file of fs.readdirSync(gamefsTextures)) {
      if (path.extname(file).toLowerCase() !== ".xml") continue;
      for (const entry of parseAtlasXml(path.join(gamefsTextures, file))) {
        atlasByName.set(entry.name, entry);
      }
    }
  }

  const gamefsAudio = path.join(gamefsDir, "audio");
  const audioOut = path.join(DIST_DIR, "assets", "audio");
  if (fs.existsSync(gamefsAudio)) {
    for (const type of fs.readdirSync(gamefsAudio)) {
      const typeDir = path.join(gamefsAudio, type);
      if (!fs.statSync(typeDir).isDirectory()) continue;
      ensureDir(path.join(audioOut, type));
      for (const file of fs.readdirSync(typeDir)) {
        fs.copyFileSync(path.join(typeDir, file), path.join(audioOut, type, file));
        availableAudio.push({ source: `${type}/${file}`, url: `/assets/audio/${type}/${file}` });
        byGameFile.set(file, { url: `/assets/audio/${type}/${file}` });
      }
    }
  }

  for (const image of Object.values(cache.Images || {})) {
    const found = availableImages.find((item) => item.source === image.fileName);
    if (found) byGameFile.set(image.fileName, found);
  }

  return {
    byGameFile,
    availableImages,
    availableAudio,
    atlasByName,
    imageRecords: Object.keys(cache.Images || {}).length,
    soundRecords: Object.keys(cache.Sounds || {}).length
  };
}

function parseAttrs(text) {
  const attrs = {};
  for (const match of text.matchAll(/([A-Za-z0-9_:-]+)="([^"]*)"/g)) attrs[match[1]] = match[2];
  return attrs;
}

function parseAtlasXml(file) {
  const xml = fs.readFileSync(file, "utf8");
  const atlasAttrs = parseAttrs(xml.match(/<TextureAtlas\b[^>]*>/)?.[0] || "");
  const imagePath = atlasAttrs.imagePath;
  if (!imagePath) return [];
  const entries = [];
  for (const match of xml.matchAll(/<SubTexture\b[^>]*\/>/g)) {
    const attrs = parseAttrs(match[0]);
    if (!attrs.name) continue;
    entries.push({
      name: attrs.name,
      url: `/assets/atlases/${imagePath}`,
      x: Number(attrs.x || 0),
      y: Number(attrs.y || 0),
      width: Number(attrs.width || 1),
      height: Number(attrs.height || 1),
      atlasWidth: Number(atlasAttrs.width || 2048),
      atlasHeight: Number(atlasAttrs.height || 2048)
    });
  }
  return entries;
}


export function buildMediaPage(cache, media, { writePage } = {}) {
  const imageRows = Object.entries(cache.Images || {}).slice(0, 300).map(([key, image]) => {
    const preview = renderImageThumb(image, media);
    return `<tr><td>${preview}${escapeHtml(image.fileName || "")}</td><td>${escapeHtml(image.type || "")}</td><td>${escapeHtml(image.textureName || "")}</td><td>${escapeHtml(mediaImageStatus(image, media))}</td></tr>`;
  }).join("\n");
  const soundRows = Object.entries(cache.Sounds || {}).map(([_key, sound]) => {
    const local = media.byGameFile.get(sound.fileName);
    const player = local ? `<audio controls preload="none" src="${escapeAttr(local.url)}"></audio>` : "";
    return `<tr><td>${escapeHtml(sound.fileName || "")}</td><td>${escapeHtml(sound.type || "")}</td><td>${escapeHtml(sound.volume ?? "")}</td><td>${local ? "available" : "not found"}</td><td>${player}</td></tr>`;
  }).join("\n");
  const body = `<h1>Media</h1>
<p>GameFS texture atlases and audio files are indexed locally when available. Sprites are rendered from atlas XML regions, not only standalone image files.</p>
<h2>Images</h2>
<input class="table-filter" name="table-filter" placeholder="Filter images">
<div class="table-wrap"><table class="sortable filterable"><thead><tr><th>File</th><th>Type</th><th>Texture</th><th>Status</th></tr></thead><tbody>${imageRows}</tbody></table></div>
<h2>Sounds</h2>
<input class="table-filter" name="table-filter" placeholder="Filter sounds">
<div class="table-wrap"><table class="sortable filterable"><thead><tr><th>File</th><th>Type</th><th>Volume</th><th>Status</th><th>Preview</th></tr></thead><tbody>${soundRows}</tbody></table></div>`;
  writePage(path.join(DIST_DIR, "media", "index.html"), "Media", body);
}

