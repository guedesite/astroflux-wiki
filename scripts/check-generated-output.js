import fs from "node:fs";
import path from "node:path";

import { walk } from "./lib/file-utils.js";
import { CONTENT_DIR, DATA_DIR, DIST_DIR, ROOT, ROOT_INDEX_FILE } from "./lib/project-paths.js";

function fail(message, details = []) {
  console.error(message);
  for (const detail of details.slice(0, 20)) console.error(`- ${detail}`);
  process.exit(1);
}

function checkJson() {
  const jsonFiles = walk(DATA_DIR).filter((file) => file.endsWith(".json"));
  const errors = [];
  for (const file of jsonFiles) {
    try {
      JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
      errors.push(`${path.relative(ROOT, file)}: ${error.message}`);
    }
  }
  if (errors.length) fail("Invalid generated JSON files", errors);
  return jsonFiles.length;
}

function checkMarkdown() {
  const markdownFiles = walk(CONTENT_DIR).filter((file) => file.endsWith(".md"));
  const errors = [];
  for (const file of markdownFiles) {
    const text = fs.readFileSync(file, "utf8");
    if (!text.startsWith("---\n")) errors.push(`${path.relative(ROOT, file)} missing frontmatter opener`);
    if (!/^---\n[\s\S]*?\n---\n/m.test(text)) errors.push(`${path.relative(ROOT, file)} missing frontmatter closer`);
    if (text.includes("\uFFFD")) errors.push(`${path.relative(ROOT, file)} contains replacement character`);
  }
  if (errors.length) fail("Malformed generated Markdown files", errors);
  return markdownFiles.length;
}

function checkHtmlLinks() {
  const htmlFiles = walk(DIST_DIR).filter((file) => file.endsWith(".html"));
  const missing = [];
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, "utf8");
    const fileDir = path.dirname(path.relative(DIST_DIR, file));
    const baseHref = html.match(/<base\s+href="([^"]+)"/i)?.[1] || "";
    const baseDir = baseHref.startsWith("/")
      ? baseHref.slice(1)
      : path.normalize(path.join(fileDir, baseHref || "."));
    const matches = html.matchAll(/href="([^"]+)"/g);
    for (const match of matches) {
      const href = match[1];
      if (href.startsWith("http:") || href.startsWith("https:") || href.startsWith("#")) continue;
      const rel = href.startsWith("/")
        ? href.slice(1)
        : path.join(baseDir, href);
      const normalizedRel = rel === "." || rel === "" ? "index.html" : rel.endsWith("/") ? path.join(rel, "index.html") : rel;
      const target = path.join(DIST_DIR, normalizedRel);
      if (!fs.existsSync(target)) {
        missing.push(`${path.relative(ROOT, file)} -> ${href}`);
      }
    }
  }
  if (missing.length) fail("Broken generated HTML links", missing);
  return htmlFiles.length;
}

function checkRootIndex() {
  if (!fs.existsSync(ROOT_INDEX_FILE)) {
    fail("Missing project root index.html", [path.relative(ROOT, ROOT_INDEX_FILE)]);
  }

  const html = fs.readFileSync(ROOT_INDEX_FILE, "utf8");
  const requiredSnippets = [
    '<meta http-equiv="refresh" content="0; url=dist/">',
    '<link rel="canonical" href="dist/">',
    'window.location.replace("dist/")'
  ];
  const missing = requiredSnippets.filter((snippet) => !html.includes(snippet));
  if (missing.length) {
    fail("Malformed project root index.html", missing);
  }
}

const jsonCount = checkJson();
const markdownCount = checkMarkdown();
const htmlCount = checkHtmlLinks();
checkRootIndex();
console.log(`Checked ${jsonCount} JSON files, ${markdownCount} Markdown files, ${htmlCount} HTML files, and the project root index`);
