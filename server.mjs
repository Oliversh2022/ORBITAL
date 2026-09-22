import { createReadStream, existsSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { extname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const pagesRoot = resolve(projectRoot, "references", "TraeWEBTEST", "pages");
const assetsRoot = resolve(projectRoot, "references", "TraeWEBTEST", "assets");
const port = Number(process.env.PORT || 3002);
const appPort = Number(process.env.APP_PORT || 3010);
const commercePort = Number(process.env.COMMERCE_PORT || 9001);
const appRoot = resolve(projectRoot, "apps", "storefront");

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

const appPrefixes = ["/collections", "/products", "/cart", "/checkout", "/order", "/explore", "/design-preview", "/api/", "/_next/", "/images/", "/icon.svg", "/favicon.ico", "/robots.txt", "/sitemap.xml"];
const commercePrefixes = ["/app", "/admin", "/health"];

function shouldProxy(pathname) {
  return appPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`));
}

function shouldProxyCommerce(pathname) {
  return commercePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

async function proxyToStorefront(request, response) {
  try {
    const body = request.method === "GET" || request.method === "HEAD" ? undefined : await readRequestBody(request);
    const headers = { ...request.headers, host: `127.0.0.1:${appPort}` };
    const upstream = await fetch(`http://127.0.0.1:${appPort}${request.url}`, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
    });
    const responseHeaders = Object.fromEntries(upstream.headers.entries());
    delete responseHeaders["content-encoding"];
    delete responseHeaders["content-length"];
    if (responseHeaders.location) responseHeaders.location = responseHeaders.location.replace(`http://localhost:${appPort}`, `http://localhost:${port}`);
    response.writeHead(upstream.status, responseHeaders);
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    response.end(`Storefront service unavailable: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

async function proxyToCommerce(request, response) {
  try {
    const body = request.method === "GET" || request.method === "HEAD" ? undefined : await readRequestBody(request);
    const headers = { ...request.headers, host: `127.0.0.1:${commercePort}` };
    const upstream = await fetch(`http://127.0.0.1:${commercePort}${request.url}`, { method: request.method, headers, body, redirect: "manual" });
    const responseHeaders = Object.fromEntries(upstream.headers.entries());
    delete responseHeaders["content-encoding"];
    delete responseHeaders["content-length"];
    if (responseHeaders.location) responseHeaders.location = responseHeaders.location.replace(`http://localhost:${commercePort}`, `http://localhost:${port}`);
    response.writeHead(upstream.status, responseHeaders);
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    response.end(`Commerce service unavailable: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

const server = createServer((request, response) => {
  const pathname = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`).pathname;
  if (shouldProxyCommerce(pathname)) return void proxyToCommerce(request, response);
  if (shouldProxy(pathname)) return void proxyToStorefront(request, response);
  if (pathname === "/ghost-fibers") return serveFile(response, join(pagesRoot, "ghost-fibers.html"));
  if (pathname === "/") return serveFile(response, join(pagesRoot, "index.html"));

  if (pathname.startsWith("/assets/")) {
    const filePath = safePath(assetsRoot, pathname.slice("/assets/".length));
    return filePath ? serveFile(response, filePath) : serveFile(response, "");
  }

  const filePath = safePath(pagesRoot, pathname);
  return filePath ? serveFile(response, filePath) : serveFile(response, "");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`CODEX_WEB26 static server: http://localhost:${port}`);
  console.log(`Pages directory: ${pagesRoot}`);
  const publicOrigin = `http://localhost:${port}`;
  const commerceEnv = {
    ...process.env,
    PORT: String(commercePort),
    CODEX_COMMERCE_PORT: String(commercePort),
    NODE_ENV: "development",
    STORE_CORS: publicOrigin,
    ADMIN_CORS: publicOrigin,
    AUTH_CORS: publicOrigin,
    STOREFRONT_URL: publicOrigin,
    MEDUSA_BACKEND_URL: `http://127.0.0.1:${commercePort}`,
  };
  delete commerceEnv.EVENTS_REDIS_URL;
  delete commerceEnv.CACHE_REDIS_URL;
  delete commerceEnv.REDIS_URL;
  const services = [];
  if (existsSync(resolve(projectRoot, "apps", "commerce"))) {
    services.push(spawn(`pnpm exec medusa start --port ${commercePort}`, {
      cwd: resolve(projectRoot, "apps", "commerce"), env: commerceEnv, stdio: "inherit", shell: true, windowsHide: true,
    }));
  }
  if (existsSync(join(appRoot, "package.json"))) {
    services.push(spawn(`pnpm exec next dev --port ${appPort}`, {
      cwd: appRoot,
      env: { ...process.env, MEDUSA_BACKEND_URL: `http://127.0.0.1:${commercePort}`, NEXT_PUBLIC_SITE_URL: publicOrigin, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: "inherit", shell: true, windowsHide: true,
    }));
  }
  const shutdown = () => services.forEach(service => { if (!service.killed) service.kill(); });
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  services.forEach(service => service.once("exit", code => { if (code && code !== 0) console.error(`Optional application service exited with code ${code}`); }));
});
