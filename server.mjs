import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const pagesRoot = resolve(projectRoot, "references", "TraeWEBTEST", "pages");
const assetsRoot = resolve(projectRoot, "references", "TraeWEBTEST", "assets");
const port = Number(process.env.PORT || 3002);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

function safePath(root, requestPath) {
  const decoded = decodeURIComponent(requestPath.split("?")[0]);
  const clean = normalize(decoded).replace(/^([/\\])+/, "");
  const absolute = resolve(root, clean);
  const rel = relative(root, absolute);
  return rel.startsWith("..") || rel.includes(`..${process.platform === "win32" ? "\\" : "/"}`) ? null : absolute;
}

function serveFile(response, filePath) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "content-type": contentTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
    "cache-control": "no-cache",
  });
  createReadStream(filePath).pipe(response);
}

function serveNotFound(response, pathname) {
  const notFound = join(pagesRoot, "404.html");
  if (!existsSync(notFound)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(404, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
  createReadStream(notFound).pipe(response);
  console.warn(`Static route not found: ${pathname}`);
}

const server = createServer((request, response) => {
  const pathname = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`).pathname;
  if (pathname === "/ghost-fibers") return serveFile(response, join(pagesRoot, "ghost-fibers.html"));
  if (pathname === "/") return serveFile(response, join(pagesRoot, "index.html"));

  if (pathname.startsWith("/assets/")) {
    const filePath = safePath(assetsRoot, pathname.slice("/assets/".length));
    if (filePath && existsSync(filePath) && statSync(filePath).isFile()) return serveFile(response, filePath);
    return serveNotFound(response, pathname);
  }

  const filePath = safePath(pagesRoot, pathname);
  if (filePath && existsSync(filePath) && statSync(filePath).isFile()) return serveFile(response, filePath);
  return serveNotFound(response, pathname);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`CODEX_WEB26 static server: http://localhost:${port}`);
  console.log(`Pages directory: ${pagesRoot}`);
});
