const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appSource = fs.readFileSync(
  path.join(__dirname, "..", "public", "app.js"),
  "utf8",
);
const indexSource = fs.readFileSync(
  path.join(__dirname, "..", "public", "index.html"),
  "utf8",
);

function extractAttributeValues(source, attribute) {
  const pattern = new RegExp(`\\b${attribute}="([^"]+)"`, "g");
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

test("frontend element IDs are unique", () => {
  const ids = extractAttributeValues(indexSource, "id");
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

  assert.ok(ids.length > 0, "Expected the frontend to define element IDs");
  assert.deepEqual([...new Set(duplicates)], []);
});

test("dashboard navigation and panels stay in sync", () => {
  const targets = new Set(
    extractAttributeValues(indexSource, "data-section-target"),
  );
  const panelIds = new Set(
    [...indexSource.matchAll(/<section\b[^>]*>/g)]
      .map((match) => match[0])
      .filter((tag) => /\bclass="[^"]*\bdashboard-section\b[^"]*"/.test(tag))
      .map((tag) => /\bid="([^"]+)"/.exec(tag)?.[1])
      .filter(Boolean),
  );

  assert.ok(targets.size > 0, "Expected dashboard navigation targets");
  assert.deepEqual(
    [...targets].filter((target) => !panelIds.has(target)),
    [],
  );
  assert.deepEqual(
    [...panelIds].filter((panelId) => !targets.has(panelId)),
    [],
  );
});

test("static frontend actions are handled by the global dispatcher", () => {
  const handlerStart = appSource.indexOf("function bindGlobalHandlers()");
  const handlerEnd = appSource.indexOf(
    "\nasync function bootstrap()",
    handlerStart,
  );

  assert.notEqual(
    handlerStart,
    -1,
    "Expected bindGlobalHandlers to be defined",
  );
  assert.notEqual(
    handlerEnd,
    -1,
    "Expected the global handler block to end before bootstrap",
  );

  const handlerSource = appSource.slice(handlerStart, handlerEnd);
  const handledActions = new Set(
    [...handlerSource.matchAll(/\baction\s*===\s*["']([^"']+)["']/g)].map(
      (match) => match[1],
    ),
  );
  const staticActions = new Set(
    extractAttributeValues(indexSource, "data-action"),
  );

  assert.ok(staticActions.size > 0, "Expected static frontend actions");
  assert.deepEqual(
    [...staticActions].filter((action) => !handledActions.has(action)),
    [],
  );
});
