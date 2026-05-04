import path from "node:path";

export const ROOT = process.cwd();
export const SOURCE_DIR = path.join(ROOT, "source");
export const BINARY_DIR = path.join(SOURCE_DIR, "binaryData");
export const DATA_DIR = path.join(ROOT, "data");
export const RAW_DIR = path.join(DATA_DIR, "raw");
export const INDEX_DIR = path.join(DATA_DIR, "index");
export const CONTENT_DIR = path.join(ROOT, "content");
export const DIST_DIR = path.join(ROOT, "dist");
export const ROOT_INDEX_FILE = path.join(ROOT, "index.html");
