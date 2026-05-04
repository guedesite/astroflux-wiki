import fs from "node:fs";
import http from "node:http";
import path from "node:path";

import { DIST_DIR, ROOT } from "./lib/project-paths.js";

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "127.0.0.1";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".mp3": "audio/mpeg"
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const relative = urlPath.endsWith("/") ? `${urlPath}index.html` : urlPath;
  const file = path.normalize(path.join(DIST_DIR, relative));
  if (!file.startsWith(DIST_DIR)) {
    send(res, 403, "Forbidden");
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      send(res, 404, "Not found");
      return;
    }
    send(res, 200, data, TYPES[path.extname(file).toLowerCase()] || "application/octet-stream");
  });
}).listen(PORT, HOST, () => {
  console.log(`Serving ${path.relative(ROOT, DIST_DIR)} at http://${HOST}:${PORT}/`);
});
