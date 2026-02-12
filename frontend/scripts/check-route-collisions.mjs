import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function listPageTsxFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    const entries = fs.readdirSync(cur, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile() && e.name === "page.tsx") out.push(p);
    }
  }
  return out.sort();
}

function toRoute(rel, basePrefix) {
  // rel is path like "(admin)/admin/page.tsx" or "rep/dcr/[id]/page.tsx"
  let s = rel.replace(/\\/g, "/");
  if (s.startsWith(basePrefix)) s = s.slice(basePrefix.length);
  if (s.endsWith("/page.tsx")) s = s.slice(0, -"/page.tsx".length);
  // strip route groups: /(admin)/
  s = s.replace(/\/\([^/]+\)/g, "");
  if (!s.startsWith("/")) s = "/" + s;
  // normalize double slashes and trailing slash
  s = s.replace(/\/+/g, "/");
  if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

function routesFromPages(dir, basePrefix) {
  const files = listPageTsxFiles(dir);
  const routes = new Set();
  for (const abs of files) {
    const rel = path.relative(path.join(ROOT, dir), abs);
    routes.add(toRoute(rel, basePrefix));
  }
  return routes;
}

const appRoutes = routesFromPages("app", "");
const legacyRoutes = routesFromPages("src/features/legacyPages", "");

const overlaps = [...appRoutes].filter((r) => legacyRoutes.has(r)).sort();

if (overlaps.length) {
  console.error(
    "ERROR: route collisions detected between app/ and src/features/legacyPages/",
  );
  for (const r of overlaps) console.error(" - " + r);
  console.error("");
  console.error(
    "Fix: move legacy implementations out of src/features/legacyPages/ and update app/* wrappers.",
  );
  process.exit(1);
}

console.log(
  "OK: no route collisions between app/ and src/features/legacyPages/",
);
