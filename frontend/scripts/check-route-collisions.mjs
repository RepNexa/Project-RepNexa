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

function toRoute(rel) {
  let s = rel.replace(/\\/g, "/");

  // Strip trailing page.tsx (works for "page.tsx" and "x/page.tsx")
  s = s.replace(/(^|\/)page\.tsx$/, "");

  // Strip route groups like "(admin)" whether at start or mid-path
  s = s.replace(/(^|\/)\([^/]+\)/g, "");

  // Ensure leading slash
  if (!s.startsWith("/")) s = "/" + s;

  // Collapse slashes and trim trailing slash (except root)
  s = s.replace(/\/+/g, "/");
  if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);

  // Root becomes "/"
  if (s === "") s = "/";

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
