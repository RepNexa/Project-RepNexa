import fs from "node:fs";
import path from "node:path";

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const forbidden = path.join(process.cwd(), "src", "app");
if (fs.existsSync(forbidden)) {
  fail(
    "ERROR: src/app exists. RepNexa uses the App Router root at repo /app only. " +
      "Remove src/app to avoid route ownership collisions.",
  );
}

console.log("OK: single App Router owner (app/).");
