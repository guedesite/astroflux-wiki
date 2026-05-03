import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const CONTENT_DIR = path.join(ROOT, "content");
const DIST_DIR = path.join(ROOT, "dist");

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

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
    const matches = html.matchAll(/href="([^"]+)"/g);
    for (const match of matches) {
      const href = match[1];
      if (href.startsWith("http:") || href.startsWith("https:") || href.startsWith("#")) continue;
      const rel = href.startsWith("/")
        ? href.slice(1)
        : path.join(path.dirname(path.relative(DIST_DIR, file)), href);
      const target = path.join(DIST_DIR, rel.endsWith("/") ? path.join(rel, "index.html") : rel);
      if (!fs.existsSync(target)) {
        missing.push(`${path.relative(ROOT, file)} -> ${href}`);
      }
    }
  }
  if (missing.length) fail("Broken generated HTML links", missing);
  return htmlFiles.length;
}

const jsonCount = checkJson();
const markdownCount = checkMarkdown();
const htmlCount = checkHtmlLinks();
console.log(`Checked ${jsonCount} JSON files, ${markdownCount} Markdown files, and ${htmlCount} HTML files`);
